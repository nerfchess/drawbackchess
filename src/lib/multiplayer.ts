// Two-player chess matchmaking over WebRTC. We use Trystero's Nostr strategy
// for signaling — it talks to public Nostr relays, which are widely reachable
// (we don't have to run our own server, and there's no central matchmaker
// that can go down the way the free PeerJS cloud does).
//
// The Trystero "room" model is symmetric: both peers join a room keyed by the
// 5-letter code and discover each other. We keep the host/guest distinction at
// the app layer — the host generates the code and the initial game spec, the
// guest joins with that code, and the host sends `init` once a peer appears.

import type { Move } from "@/engine/types";

export type MPMessage =
  | { type: "init"; whiteDrawbackId: string; blackDrawbackId: string; seed: number; timeSec: number }
  | { type: "move"; move: Move }
  | { type: "resign" }
  | { type: "ping" };

export type MPEvent =
  | { type: "open"; code: string }
  | { type: "guest-connected" }
  | { type: "host-ready" }
  | { type: "message"; message: MPMessage }
  | { type: "disconnected" }
  | { type: "error"; message: string };

const APP_ID = "drawbackchess-v1";
const JOIN_TIMEOUT_MS = 25000;

// Well-known, battle-tested public Nostr relays. Trystero's default pool is
// a grab-bag of obscure relays — many of them are flaky or offline — which
// caused host and guest to silently end up on different live relays and
// never discover each other.
const RELAY_URLS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
  "wss://nostr.wine",
  "wss://offchain.pub",
  "wss://relay.nostr.bg",
];

function randomCode(): string {
  // Avoid 0/O/1/I/L for readability.
  const chars = "BCDFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class MPSession {
  private room: any | null = null;
  private sendMsg: ((data: any, peers?: string | string[]) => Promise<any>) | null = null;
  private peerIds: Set<string> = new Set();
  private listeners: Array<(e: MPEvent) => void> = [];
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

  private async openRoom(code: string): Promise<void> {
    const { joinRoom } = await import("trystero/nostr");
    const room = joinRoom(
      {
        appId: APP_ID,
        relayConfig: { urls: RELAY_URLS, redundancy: RELAY_URLS.length },
      },
      code,
    );
    this.room = room;
    const [sendMsg, getMsg] = room.makeAction("msg");
    this.sendMsg = sendMsg;
    getMsg((data: any) => {
      this.emit({ type: "message", message: data as MPMessage });
    });
    room.onPeerJoin((peerId: string) => {
      this.peerIds.add(peerId);
      this.emit(this.isHost ? { type: "guest-connected" } : { type: "host-ready" });
    });
    room.onPeerLeave((peerId: string) => {
      this.peerIds.delete(peerId);
      this.emit({ type: "disconnected" });
    });
  }

  async host(): Promise<string> {
    this.isHost = true;
    const code = randomCode();
    try {
      await this.openRoom(code);
      this.code = code;
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
    this.code = code;
    try {
      await this.openRoom(code);
    } catch (e: any) {
      const msg = String(e?.message || e) || "Could not join game.";
      console.error("[multiplayer] join error:", e);
      this.emit({ type: "error", message: msg });
      throw new Error(msg);
    }
    // Wait for the host peer to appear, with a timeout so a bad code doesn't
    // hang forever.
    await new Promise<void>((resolve, reject) => {
      if (this.peerIds.size > 0) {
        resolve();
        return;
      }
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        const msg =
          "No response — check the code, or have your friend re-create the game.";
        console.error("[multiplayer] join wait timeout for code:", code);
        this.emit({ type: "error", message: msg });
        reject(new Error(msg));
      }, JOIN_TIMEOUT_MS);
      const unsub = this.on((e) => {
        if (e.type === "host-ready" && !settled) {
          settled = true;
          clearTimeout(timeout);
          unsub();
          resolve();
        }
      });
    });
  }

  send(message: MPMessage) {
    if (!this.sendMsg) return;
    try {
      this.sendMsg(message as any);
    } catch (e) {
      console.error("[multiplayer] send error:", e);
    }
  }

  destroy() {
    try {
      this.room?.leave();
    } catch {}
    this.room = null;
    this.sendMsg = null;
    this.peerIds.clear();
    this.listeners = [];
  }
}
