// Two-player chess matchmaking via Supabase Realtime broadcast channels.
//
// We tried several "zero config" public services (PeerJS cloud,
// Trystero/Nostr, public MQTT brokers, ntfy.sh) and they all turned out
// to be unreliable or have been locked down. Supabase Realtime is free,
// fast, and reliable — the only setup is creating a project and pasting
// the URL + anon key into env vars.
//
// Channel naming: `dc-room-<code>`. Both players join the same channel,
// listen for broadcast events, and send their own. A small hello
// handshake lets the host know when the guest has actually subscribed.
//
// Setup (one-time, ~1 minute):
//   1. Go to https://supabase.com → create a free project
//   2. In the project's API settings, copy the Project URL and the anon
//      public key
//   3. Add to your environment (e.g. .env.local for dev, Vercel env vars
//      for prod):
//        NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
//        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
//   4. No database tables or auth required — Realtime broadcast works
//      out of the box.

import type { Move } from "@/engine/types";

export type MPMessage =
  | {
      type: "init";
      whiteDrawbackId: string;
      blackDrawbackId: string;
      seed: number;
      timeSec: number;
      incSec?: number;
      whiteId?: string;
      whiteName?: string;
      blackId?: string;
      blackName?: string;
    }
  | { type: "move"; move: Move }
  | { type: "resign" }
  | { type: "rematch-offer" }
  | { type: "rematch-accept" }
  | { type: "rematch-decline" }
  | { type: "peer-info"; id: string; name: string }
  | { type: "ping" };

export type MPEvent =
  | { type: "open"; code: string }
  | { type: "guest-connected" }
  | { type: "host-ready" }
  | { type: "message"; message: MPMessage }
  | { type: "disconnected" }
  | { type: "error"; message: string };

// Supabase project. The anon key is a public client key (designed to be
// embedded in browser bundles) so it's fine to commit. Override via env
// vars if you ever swap projects.
const DEFAULT_SUPABASE_URL = "https://vahhsjtxhjddohtgqtaj.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhaGhzanR4aGpkZG9odGdxdGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTg0MzEsImV4cCI6MjA5NDYzNDQzMX0.SDDmEnGyqdeQGE5h25InmW3KtUOjWDmwfjOyis8Lopo";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const SUPABASE_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const CHANNEL_PREFIX = "dc-room-";
const SUBSCRIBE_TIMEOUT_MS = 12000;
const JOIN_TIMEOUT_MS = 25000;

type Envelope = { from: string; role: "host" | "guest"; payload: MPMessage | { type: "hello" } };

function randomCode(): string {
  // Avoid 0/O/1/I/L for readability.
  const chars = "BCDFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

let _client: any | null = null;
async function getClient(): Promise<any> {
  if (_client) return _client;
  const { createClient } = await import("@supabase/supabase-js");
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _client;
}

export class MPSession {
  private channel: any | null = null;
  private clientId = randomId();
  private listeners: Array<(e: MPEvent) => void> = [];
  private peerSeen = false;
  private helloInterval: any = null;
  isHost = false;
  code = "";

  on(fn: (e: MPEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  private emit(e: MPEvent) {
    for (const fn of [...this.listeners]) fn(e);
  }

  private async openChannel(code: string): Promise<void> {
    if (!SUPABASE_CONFIGURED) {
      throw new Error(
        "Multiplayer isn't configured. The site needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.",
      );
    }
    this.code = code;
    const client = await getClient();
    const channel = client.channel(CHANNEL_PREFIX + code, {
      config: { broadcast: { self: false, ack: false } },
    });
    this.channel = channel;

    channel.on("broadcast", { event: "msg" }, (msg: any) => {
      const env = msg?.payload as Envelope | undefined;
      if (!env) return;
      this.handleEnvelope(env);
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { channel.unsubscribe(); } catch {}
        reject(new Error("Couldn't reach the matchmaking server. Check your connection and try again."));
      }, SUBSCRIBE_TIMEOUT_MS);
      channel.subscribe((status: string, err: any) => {
        if (settled) return;
        if (status === "SUBSCRIBED") {
          settled = true;
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          settled = true;
          clearTimeout(timer);
          console.error("[multiplayer] channel error:", status, err);
          const detail = err?.message || (typeof err === "string" ? err : "");
          reject(new Error(detail ? `Matchmaking error: ${detail}` : "Couldn't reach the matchmaking server."));
        }
        // Ignore CLOSED — it fires during normal teardown after SUBSCRIBED.
      });
    });

    await this.publish({ type: "hello" } as any);
    this.helloInterval = setInterval(() => {
      if (this.peerSeen) {
        clearInterval(this.helloInterval);
        this.helloInterval = null;
        return;
      }
      this.publish({ type: "hello" } as any);
    }, 1500);
  }

  private handleEnvelope(env: Envelope) {
    if (env.from === this.clientId) return;
    const myRole = this.isHost ? "host" : "guest";
    if (env.role === myRole) return;
    const firstSighting = !this.peerSeen;
    if (firstSighting) {
      this.peerSeen = true;
      if (this.helloInterval) {
        clearInterval(this.helloInterval);
        this.helloInterval = null;
      }
      this.emit(this.isHost ? { type: "guest-connected" } : { type: "host-ready" });
    }
    const payload = env.payload as any;
    if (payload?.type === "hello") {
      // Reply so the peer that just came online learns about us.
      if (firstSighting) this.publish({ type: "hello" } as any);
      return;
    }
    this.emit({ type: "message", message: payload as MPMessage });
  }

  private async publish(payload: MPMessage | { type: "hello" }) {
    if (!this.channel) return;
    const env: Envelope = {
      from: this.clientId,
      role: this.isHost ? "host" : "guest",
      payload,
    };
    try {
      await this.channel.send({ type: "broadcast", event: "msg", payload: env });
    } catch (e) {
      console.error("[multiplayer] publish error:", e);
    }
  }

  async host(presetCode?: string): Promise<string> {
    this.isHost = true;
    const code = (presetCode && presetCode.trim().toUpperCase()) || randomCode();
    try {
      await this.openChannel(code);
      this.emit({ type: "open", code });
      return code;
    } catch (e: any) {
      const msg = String(e?.message || e) || "Could not create game.";
      console.error("[multiplayer] host error:", e);
      this.emit({ type: "error", message: msg });
      throw new Error(msg);
    }
  }

  async join(code: string): Promise<void> {
    this.isHost = false;
    try {
      await this.openChannel(code);
    } catch (e: any) {
      const msg = String(e?.message || e) || "Could not join game.";
      console.error("[multiplayer] join error:", e);
      this.emit({ type: "error", message: msg });
      throw new Error(msg);
    }
    await new Promise<void>((resolve, reject) => {
      if (this.peerSeen) {
        resolve();
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsub();
        const msg = "No host found for that code. Make sure your friend's lobby is still open and the code is right.";
        this.emit({ type: "error", message: msg });
        reject(new Error(msg));
      }, JOIN_TIMEOUT_MS);
      const unsub = this.on((e) => {
        if (e.type === "host-ready" && !settled) {
          settled = true;
          clearTimeout(timer);
          unsub();
          resolve();
        }
      });
    });
  }

  send(message: MPMessage) {
    this.publish(message);
  }

  destroy() {
    if (this.helloInterval) {
      clearInterval(this.helloInterval);
      this.helloInterval = null;
    }
    try { this.channel?.unsubscribe(); } catch {}
    this.channel = null;
    this.peerSeen = false;
    this.listeners = [];
  }
}
