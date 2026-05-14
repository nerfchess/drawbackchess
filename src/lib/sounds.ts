// Tiny synthesized sounds. No assets, no network, no licensing — generated with Web Audio.
// Each sound is a short tonal motif that fits the editorial / occult mood:
// move = soft wood-knock, capture = brittle break, check = bell triad, drawback = bowed glass.

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("dc:muted", v ? "1" : "0"); } catch {}
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return muted;
  try {
    const s = localStorage.getItem("dc:muted");
    if (s !== null) muted = s === "1";
  } catch {}
  return muted;
}

interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  delay?: number;
  sweep?: number; // freq at end (linear)
}

function play(tones: Tone[]) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.value = 0.6;
  master.connect(a.destination);

  for (const t of tones) {
    const start = now + (t.delay ?? 0);
    const osc = a.createOscillator();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.sweep) osc.frequency.linearRampToValueAtTime(t.sweep, start + t.dur);

    const g = a.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(t.gain ?? 0.18, start + (t.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur + (t.release ?? 0.05));

    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + t.dur + (t.release ?? 0.05) + 0.02);
  }
}

// Soft wood-block knock for ordinary moves.
export function playMove() {
  play([
    { freq: 220, dur: 0.05, type: "triangle", gain: 0.18, sweep: 140 },
    { freq: 90, dur: 0.10, type: "sine", gain: 0.10, sweep: 60, delay: 0.005 },
  ]);
}

// Brittle, slightly metallic break for captures.
export function playCapture() {
  play([
    { freq: 520, dur: 0.07, type: "square", gain: 0.10, sweep: 180 },
    { freq: 330, dur: 0.10, type: "triangle", gain: 0.14, sweep: 110, delay: 0.01 },
    { freq: 60, dur: 0.18, type: "sine", gain: 0.18, sweep: 30, delay: 0.02 },
  ]);
}

// Bell triad for check / king-en-passant openings.
export function playCheck() {
  play([
    { freq: 880, dur: 0.30, type: "sine", gain: 0.12, attack: 0.002, release: 0.25 },
    { freq: 1320, dur: 0.30, type: "sine", gain: 0.08, attack: 0.002, release: 0.25, delay: 0.02 },
    { freq: 660, dur: 0.40, type: "sine", gain: 0.10, attack: 0.004, release: 0.35, delay: 0.05 },
  ]);
}

// Bowed glass / harmonium swell for drawback triggers.
export function playDrawback() {
  play([
    { freq: 174, dur: 0.45, type: "sawtooth", gain: 0.07, attack: 0.06, release: 0.4 },
    { freq: 261, dur: 0.55, type: "triangle", gain: 0.10, attack: 0.08, release: 0.45, delay: 0.04 },
    { freq: 392, dur: 0.65, type: "sine", gain: 0.08, attack: 0.10, release: 0.55, delay: 0.10 },
  ]);
}

// Final low gong for game-end.
export function playGameOver() {
  play([
    { freq: 110, dur: 0.8, type: "sine", gain: 0.22, attack: 0.01, release: 0.7 },
    { freq: 165, dur: 0.9, type: "triangle", gain: 0.12, attack: 0.02, release: 0.8, delay: 0.04 },
    { freq: 55, dur: 1.0, type: "sine", gain: 0.18, attack: 0.02, release: 0.9, delay: 0.08 },
  ]);
}

// Lighter "select" tick for picking up a piece.
export function playSelect() {
  play([{ freq: 660, dur: 0.04, type: "sine", gain: 0.06, sweep: 880 }]);
}
