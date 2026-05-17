// Two-player chess matchmaking via a public MQTT broker.
//
// We dropped WebRTC-based P2P (PeerJS, Trystero/Nostr) because the
// signaling layer kept failing — public signaling services are
// inconsistently reachable, and once you can't introduce the peers,
// nothing works. Instead, we relay messages through `broker.emqx.io`,
// EMQ's long-running public test broker, over secure WebSockets.
//
// Each game is a topic `drawbackchess/v1/<code>`. Both players subscribe
// to it and publish to it. We tag each message with the sender's
// client ID and ignore our own. A small `hello` handshake lets the host
// detect when the guest has actually subscribed (vs. just typed the
// code) so the host knows when to send `init`.

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

const BROKER_URL = "wss://broker.emqx.io:8084/mqtt";
const TOPIC_PREFIX = "drawbackchess/v1/";
const CONNECT_TIMEOUT_MS = 15000;
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
  private client: any | null = null;
  private topic = "";
  private clientId = randomId();
  private listeners: Array<(e: MPEvent) => void> = [];
  private peerSeen = false;
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

  private async connect(code: string, role: "host" | "guest"): Promise<void> {
    const mqtt = (await import("mqtt")).default;
    this.code = code;
    this.topic = TOPIC_PREFIX + code;
    const client = mqtt.connect(BROKER_URL, {
      clientId: "dc_" + this.clientId,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: CONNECT_TIMEOUT_MS,
    });
    this.client = client;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { client.end(true); } catch {}
        reject(new Error("Couldn't reach the matchmaking server. Try again."));
      }, CONNECT_TIMEOUT_MS);
      client.on("connect", () => {
        if (settled) return;
        client.subscribe(this.topic, { qos: 1 }, (err: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      client.on("error", (e: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { client.end(true); } catch {}
        reject(e);
      });
    });

    client.on("message", (_topic: string, payloadBuf: Uint8Array) => {
      let env: Envelope;
      try {
        env = JSON.parse(new TextDecoder().decode(payloadBuf));
      } catch {
        return;
      }
      if (env.from === this.clientId) return; // our own broadcast
      if (env.role === role) return; // ignore same-role (e.g. two hosts)
      if (!this.peerSeen) {
        this.peerSeen = true;
        this.emit(this.isHost ? { type: "guest-connected" } : { type: "host-ready" });
      }
      const payload = env.payload as any;
      if (payload?.type === "hello") {
        // The other side announcing themselves; emit a presence event and
        // reply with our own hello so they detect us too.
        this.publish({ type: "hello" } as any);
        return;
      }
      this.emit({ type: "message", message: payload as MPMessage });
    });

    client.on("close", () => {
      if (this.peerSeen) this.emit({ type: "disconnected" });
    });

    // Announce presence so the other side can detect us.
    this.publish({ type: "hello" } as any);
  }

  private publish(payload: MPMessage | { type: "hello" }) {
    if (!this.client) return;
    const env: Envelope = {
      from: this.clientId,
      role: this.isHost ? "host" : "guest",
      payload,
    };
    try {
      this.client.publish(this.topic, JSON.stringify(env), { qos: 1 });
    } catch (e) {
      console.error("[multiplayer] publish error:", e);
    }
  }

  async host(): Promise<string> {
    this.isHost = true;
    const code = randomCode();
    try {
      await this.connect(code, "host");
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
      await this.connect(code, "guest");
    } catch (e: any) {
      const msg = String(e?.message || e) || "Could not join game.";
      console.error("[multiplayer] join error:", e);
      this.emit({ type: "error", message: msg });
      throw new Error(msg);
    }
    // Wait for the host to announce themselves.
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
    try {
      this.client?.end(true);
    } catch {}
    this.client = null;
    this.peerSeen = false;
    this.listeners = [];
  }
}
