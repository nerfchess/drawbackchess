// Public lobby: presence tracking + challenge channel, both via Supabase
// Realtime. The lobby is one shared channel; every signed-in browser is a
// member while they have the page open, and they advertise their name +
// preferred time control via presence state. Challenges are sent as
// broadcast events on the same channel, addressed to a specific recipient.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/multiplayer";
import type { Identity } from "@/lib/identity";

export interface LobbyPlayer {
  id: string;
  name: string;
  timeSec: number;
  joinedAt: number;
}

export type ChallengeOffer = {
  type: "challenge";
  from: string;
  fromName: string;
  to: string;
  timeSec: number;
  code: string;
};

export type ChallengeReply = {
  type: "challenge-accept" | "challenge-decline";
  from: string;
  to: string;
  code: string;
};

export type LobbyMessage = ChallengeOffer | ChallengeReply;

const LOBBY_CHANNEL = "dc-lobby-v1";

let _client: any | null = null;
function client() {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

export function makeRoomCode(): string {
  const chars = "BCDFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export interface LobbyHandle {
  setTimePref: (sec: number) => void;
  sendChallenge: (toId: string, timeSec: number, code: string) => Promise<void>;
  reply: (msg: ChallengeReply) => Promise<void>;
  leave: () => Promise<void>;
}

export interface LobbyOptions {
  identity: Identity;
  initialTimeSec: number;
  onPlayers: (players: LobbyPlayer[]) => void;
  onMessage: (m: LobbyMessage) => void;
  onStatus?: (status: "connecting" | "connected" | "error") => void;
}

export async function joinLobby(opts: LobbyOptions): Promise<LobbyHandle> {
  const { identity, initialTimeSec, onPlayers, onMessage, onStatus } = opts;
  onStatus?.("connecting");

  const c = client();
  // Supabase caches channels by topic. If a previous joinLobby created one
  // (e.g. on rename re-mount, or React effect re-run after navigation), the
  // cached channel is already subscribed and we can't attach new presence
  // listeners. Tear it down first so we start fresh.
  try {
    for (const existing of c.getChannels?.() ?? []) {
      const topic: string = existing?.topic ?? "";
      if (topic === LOBBY_CHANNEL || topic.endsWith(":" + LOBBY_CHANNEL)) {
        await c.removeChannel(existing);
      }
    }
  } catch (e) {
    console.warn("[lobby] cleanup of stale channels failed:", e);
  }

  const channel = c.channel(LOBBY_CHANNEL, {
    config: {
      presence: { key: identity.id },
      broadcast: { self: false, ack: false },
    },
  });

  let currentTime = initialTimeSec;

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState() as Record<string, Array<{ name: string; timeSec: number; joinedAt: number }>>;
    const players: LobbyPlayer[] = [];
    for (const [id, metas] of Object.entries(state)) {
      const meta = metas[0];
      if (!meta) continue;
      players.push({ id, name: meta.name, timeSec: meta.timeSec, joinedAt: meta.joinedAt });
    }
    players.sort((a, b) => a.joinedAt - b.joinedAt);
    onPlayers(players);
  });

  channel.on("broadcast", { event: "lobby-msg" }, (env: any) => {
    const payload = env?.payload as LobbyMessage | undefined;
    if (!payload) return;
    // Only deliver messages addressed to us (challenges + replies).
    if (payload.to !== identity.id) return;
    onMessage(payload);
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onStatus?.("error");
      reject(new Error("Couldn't reach the lobby."));
    }, 15000);
    channel.subscribe(async (status: string, err: any) => {
      if (settled) return;
      if (status === "SUBSCRIBED") {
        settled = true;
        clearTimeout(timer);
        await channel.track({
          name: identity.name,
          timeSec: currentTime,
          joinedAt: Date.now(),
        });
        onStatus?.("connected");
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        settled = true;
        clearTimeout(timer);
        onStatus?.("error");
        const detail = err?.message ?? "lobby channel error";
        reject(new Error(detail));
      }
    });
  });

  return {
    setTimePref: (sec: number) => {
      currentTime = sec;
      channel.track({
        name: identity.name,
        timeSec: sec,
        joinedAt: Date.now(),
      });
    },
    sendChallenge: async (toId, timeSec, code) => {
      const payload: ChallengeOffer = {
        type: "challenge",
        from: identity.id,
        fromName: identity.name,
        to: toId,
        timeSec,
        code,
      };
      await channel.send({ type: "broadcast", event: "lobby-msg", payload });
    },
    reply: async (msg) => {
      await channel.send({ type: "broadcast", event: "lobby-msg", payload: msg });
    },
    leave: async () => {
      try {
        await channel.untrack();
      } catch {}
      try {
        await channel.unsubscribe();
      } catch {}
    },
  };
}
