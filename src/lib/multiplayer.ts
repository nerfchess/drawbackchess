// Thin wrapper around PeerJS for two-player chess over WebRTC. The free public
// PeerJS signaling server handles peer discovery; once peers find each other
// the data channel is direct browser-to-browser.

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

const ID_PREFIX = "drawbackchess-v1-";

function randomCode(): string {
  // Avoid 0/O/1/I/L for readability.
  const chars = "BCDFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class MPSession {
  private peer: any | null = null;
  private conn: any | null = null;
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

  async host(): Promise<string> {
    this.isHost = true;
    const code = randomCode();
    const { default: Peer } = await import("peerjs");
    this.peer = new Peer(ID_PREFIX + code);
    this.code = code;

    return new Promise((resolve, reject) => {
      const onOpen = () => {
        this.emit({ type: "open", code });
        resolve(code);
      };
      this.peer.on("open", onOpen);
      this.peer.on("error", (e: any) => {
        const msg = String(e?.type || e?.message || e);
        this.emit({ type: "error", message: msg });
        if (!this.code) reject(e);
      });
      this.peer.on("connection", (c: any) => {
        this.conn = c;
        c.on("open", () => {
          this.emit({ type: "guest-connected" });
        });
        this.bindConn(c);
      });
    });
  }

  async join(code: string): Promise<void> {
    this.isHost = false;
    this.code = code;
    const { default: Peer } = await import("peerjs");
    this.peer = new Peer();

    return new Promise((resolve, reject) => {
      this.peer.on("open", () => {
        const c = this.peer.connect(ID_PREFIX + code, { reliable: true });
        this.conn = c;
        c.on("open", () => {
          this.emit({ type: "host-ready" });
          resolve();
        });
        c.on("error", (e: any) => {
          this.emit({ type: "error", message: String(e?.message || e) });
          reject(e);
        });
        this.bindConn(c);
      });
      this.peer.on("error", (e: any) => {
        const msg = String(e?.type || e?.message || e);
        this.emit({ type: "error", message: msg });
        reject(e);
      });
    });
  }

  private bindConn(c: any) {
    c.on("data", (data: any) => {
      this.emit({ type: "message", message: data as MPMessage });
    });
    c.on("close", () => {
      this.emit({ type: "disconnected" });
    });
  }

  send(message: MPMessage) {
    this.conn?.send(message);
  }

  destroy() {
    try {
      this.conn?.close();
    } catch {}
    try {
      this.peer?.destroy();
    } catch {}
    this.peer = null;
    this.conn = null;
    this.listeners = [];
  }
}
