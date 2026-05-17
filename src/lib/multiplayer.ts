// Two-player chess matchmaking via ntfy.sh.
//
// We've tried WebRTC P2P (PeerJS, Trystero/Nostr) and an MQTT-over-WebSockets
// broker, and both kept failing because the underlying services were either
// unreachable from some networks or required heavy client libraries that
// didn't reliably load in the browser.
//
// ntfy.sh is a free public pub/sub service that uses ordinary HTTPS:
// - publish:   POST https://ntfy.sh/<topic>
// - subscribe: EventSource on https://ntfy.sh/<topic>/sse
// Both use browser-native APIs (fetch + EventSource), no external library,
// no WebRTC, no signaling negotiation. Each game gets its own topic keyed
// by the 5-letter code; both players publish to and subscribe to it.

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

const BASE = "https://ntfy.sh";
const TOPIC_PREFIX = "drawbackchess-v1-";
const SUBSCRIBE_TIMEOUT_MS = 10000;
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

export class MPSession {
  private es: EventSource | null = null;
  private topic = "";
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

  private async openTopic(code: string): Promise<void> {
    this.code = code;
    this.topic = TOPIC_PREFIX + code;
    const url = `${BASE}/${this.topic}/sse`;
    const es = new EventSource(url);
    this.es = es;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { es.close(); } catch {}
        reject(new Error("Couldn't reach the matchmaking server. Check your connection and try again."));
      }, SUBSCRIBE_TIMEOUT_MS);
      es.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      es.onerror = (ev) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { es.close(); } catch {}
        console.error("[multiplayer] EventSource error:", ev);
        reject(new Error("Connection to the matchmaking server failed."));
      };
    });

    es.onmessage = (ev: MessageEvent) => {
      let outer: any;
      try {
        outer = JSON.parse(ev.data);
      } catch {
        return;
      }
      // ntfy wraps published bodies inside an `event: message` JSON with a
      // `message` field that contains our payload as a string.
      if (outer.event !== "message" || typeof outer.message !== "string") return;
      let env: Envelope;
      try {
        env = JSON.parse(outer.message);
      } catch {
        return;
      }
      this.handleEnvelope(env);
    };
    es.onerror = () => {
      // EventSource auto-reconnects on transient errors; we only treat it as
      // disconnect once we've actually seen the peer to avoid early noise.
      if (this.peerSeen) console.warn("[multiplayer] SSE stream blip; reconnecting…");
    };

    // Announce presence so the other side detects us. Repeat a few times in
    // case our publish lands before the other side has subscribed.
    await this.publish({ type: "hello" } as any);
    this.helloInterval = setInterval(() => {
      if (this.peerSeen) {
        clearInterval(this.helloInterval);
        this.helloInterval = null;
        return;
      }
      this.publish({ type: "hello" } as any).catch(() => {});
    }, 1500);
  }

  private handleEnvelope(env: Envelope) {
    if (env.from === this.clientId) return;
    const myRole = this.isHost ? "host" : "guest";
    if (env.role === myRole) return; // ignore peers in the same role
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
      // Reply with our own hello so the other side learns about us if it
      // came online after our initial hello bursts.
      if (firstSighting) this.publish({ type: "hello" } as any).catch(() => {});
      return;
    }
    this.emit({ type: "message", message: payload as MPMessage });
  }

  private async publish(payload: MPMessage | { type: "hello" }): Promise<void> {
    const env: Envelope = {
      from: this.clientId,
      role: this.isHost ? "host" : "guest",
      payload,
    };
    try {
      await fetch(`${BASE}/${this.topic}`, {
        method: "POST",
        body: JSON.stringify(env),
      });
    } catch (e) {
      console.error("[multiplayer] publish error:", e);
    }
  }

  async host(): Promise<string> {
    this.isHost = true;
    const code = randomCode();
    try {
      await this.openTopic(code);
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
      await this.openTopic(code);
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
    this.publish(message).catch(() => {});
  }

  destroy() {
    if (this.helloInterval) {
      clearInterval(this.helloInterval);
      this.helloInterval = null;
    }
    try { this.es?.close(); } catch {}
    this.es = null;
    this.peerSeen = false;
    this.listeners = [];
  }
}
