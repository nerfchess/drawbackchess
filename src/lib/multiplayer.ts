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
    const { default: Peer } = await import("peerjs");

    // Try up to 5 codes — collisions on the free cloud are rare but possible.
    let lastErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const peer = new Peer(ID_PREFIX + code, { debug: 1 });
          this.peer = peer;
          // Safety timeout — if the signaling server never responds, fail fast
          // so the UI can show an error instead of hanging silently.
          const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            const msg = "Couldn't reach the matchmaking server. Check your connection and try again.";
            console.error("[multiplayer] host open timeout for code:", code);
            this.emit({ type: "error", message: msg });
            try { peer.destroy(); } catch {}
            reject(new Error(msg));
          }, 8000);
          peer.on("open", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            this.code = code;
            this.emit({ type: "open", code });
            resolve();
          });
          peer.on("error", (e: any) => {
            const msg = String(e?.type || e?.message || e);
            console.error("[multiplayer] host peer error:", msg, e);
            this.emit({ type: "error", message: msg });
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              reject(e);
            }
          });
          peer.on("connection", (c: any) => {
            this.conn = c;
            c.on("open", () => {
              this.emit({ type: "guest-connected" });
            });
            this.bindConn(c);
          });
        });
        return code; // success
      } catch (e: any) {
        lastErr = e;
        // Only retry on "unavailable-id" (someone has that code). Other errors
        // (network, browser-incompatible) bubble up immediately.
        const type = e?.type || "";
        if (type !== "unavailable-id") break;
        try {
          this.peer?.destroy();
        } catch {}
        this.peer = null;
      }
    }
    throw lastErr ?? new Error("Could not create game");
  }

  async join(code: string): Promise<void> {
    this.isHost = false;
    this.code = code;
    const { default: Peer } = await import("peerjs");

    return new Promise((resolve, reject) => {
      let settled = false;
      const peer = new Peer(undefined as any, { debug: 1 });
      this.peer = peer;

      // Safety timeout — public PeerJS sometimes silently fails on bad
      // codes (host disconnected, code never existed). After 8 seconds
      // surface a "couldn't reach host" error instead of hanging.
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        const msg = `No response — check the code, or have your friend re-create the game.`;
        console.error("[multiplayer] join timeout for code:", code);
        this.emit({ type: "error", message: msg });
        reject(new Error(msg));
      }, 8000);

      peer.on("open", () => {
        const c = peer.connect(ID_PREFIX + code, { reliable: true });
        this.conn = c;
        c.on("open", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.emit({ type: "host-ready" });
          resolve();
        });
        c.on("error", (e: any) => {
          console.error("[multiplayer] join conn error:", e);
          this.emit({ type: "error", message: String(e?.message || e) });
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(e);
          }
        });
        this.bindConn(c);
      });
      peer.on("error", (e: any) => {
        const msg = String(e?.type || e?.message || e);
        console.error("[multiplayer] join peer error:", msg, e);
        let friendly = msg;
        if (e?.type === "peer-unavailable") {
          friendly = "That code isn't active. Ask your friend to re-create the game.";
        }
        this.emit({ type: "error", message: friendly });
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(friendly));
        }
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
