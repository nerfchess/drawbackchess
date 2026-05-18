// Chess.com-style synthesized sounds. Short, percussive wood-knock clicks
// generated with Web Audio (filtered noise burst + low body thump).
// No assets, no licensing.

let ctx: AudioContext | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let volume = 0.8;

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("dc:volume", String(volume));
    } catch {}
  }
}

export function getVolume(): number {
  if (typeof window === "undefined") return volume;
  try {
    const s = localStorage.getItem("dc:volume");
    if (s !== null) volume = Math.max(0, Math.min(1, parseFloat(s) || 0));
  } catch {}
  return volume;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf;
  const len = Math.floor(a.sampleRate * 0.25);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

export function setMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("dc:muted", v ? "1" : "0");
    } catch {}
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

interface KnockOpts {
  /** Bandpass center for the noise burst — higher = crisper, sharper. */
  filterFreq: number;
  /** Bandpass Q — higher = more tonal/resonant. */
  filterQ?: number;
  /** Duration of the noise transient in seconds. */
  dur: number;
  /** Peak gain for the noise transient. */
  gain?: number;
  /** Optional body thump (low sine) frequency. */
  bodyFreq?: number;
  /** Body thump gain. */
  bodyGain?: number;
  /** Body thump duration. */
  bodyDur?: number;
  /** Delay before this knock starts (seconds). */
  delay?: number;
  /** Master gain multiplier. */
  master?: number;
}

function knock(opts: KnockOpts) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);

  const master = a.createGain();
  master.gain.value = (opts.master ?? 1.0) * getVolume();
  master.connect(a.destination);

  // --- Filtered noise burst (the "click") ---
  const src = a.createBufferSource();
  src.buffer = noise(a);

  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = opts.filterFreq;
  bp.Q.value = opts.filterQ ?? 4;

  const g = a.createGain();
  const peak = opts.gain ?? 0.55;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);

  // --- Optional low body thump for capture / bigger clicks ---
  if (opts.bodyFreq) {
    const osc = a.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(opts.bodyFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, opts.bodyFreq * 0.55),
      t0 + (opts.bodyDur ?? 0.07)
    );

    const bg = a.createGain();
    const bGain = opts.bodyGain ?? 0.4;
    bg.gain.setValueAtTime(0, t0);
    bg.gain.linearRampToValueAtTime(bGain, t0 + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.bodyDur ?? 0.07));

    osc.connect(bg);
    bg.connect(master);
    osc.start(t0);
    osc.stop(t0 + (opts.bodyDur ?? 0.07) + 0.02);
  }
}

function tone(opts: {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  delay?: number;
  sweep?: number;
  master?: number;
}) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const m = a.createGain();
  m.gain.value = opts.master ?? 1.0;
  m.connect(a.destination);

  const osc = a.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.sweep) osc.frequency.linearRampToValueAtTime(opts.sweep, t0 + opts.dur);

  const g = a.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain ?? 0.18, t0 + (opts.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur + (opts.release ?? 0.05));

  osc.connect(g);
  g.connect(m);
  osc.start(t0);
  osc.stop(t0 + opts.dur + (opts.release ?? 0.05) + 0.02);
}

// --- Public API: chess.com-shaped sounds ---

// Standard move: a single short, mid-frequency wood click.
export function playMove() {
  knock({
    filterFreq: 1100,
    filterQ: 3.5,
    dur: 0.05,
    gain: 0.55,
    bodyFreq: 220,
    bodyGain: 0.22,
    bodyDur: 0.06,
  });
}

// Capture: lower, thicker click with a slight "thud" body.
export function playCapture() {
  knock({
    filterFreq: 700,
    filterQ: 2.5,
    dur: 0.07,
    gain: 0.6,
    bodyFreq: 140,
    bodyGain: 0.45,
    bodyDur: 0.10,
  });
}

// Check: a brighter, bell-like ping (two-note overtone).
export function playCheck() {
  tone({ freq: 1320, dur: 0.18, type: "sine", gain: 0.18, attack: 0.002, release: 0.18 });
  tone({ freq: 1980, dur: 0.18, type: "sine", gain: 0.08, attack: 0.002, release: 0.18, delay: 0.01 });
}

// Drawback trigger: soft two-note descending notification.
export function playDrawback() {
  tone({ freq: 660, dur: 0.18, type: "triangle", gain: 0.14, attack: 0.005, release: 0.18 });
  tone({ freq: 494, dur: 0.22, type: "triangle", gain: 0.12, attack: 0.005, release: 0.22, delay: 0.13 });
}

// Game over: chess.com-style two-note descending chime.
export function playGameOver() {
  tone({ freq: 880, dur: 0.18, type: "sine", gain: 0.18, attack: 0.005, release: 0.18 });
  tone({ freq: 698, dur: 0.30, type: "sine", gain: 0.18, attack: 0.005, release: 0.28, delay: 0.13 });
  tone({ freq: 1318, dur: 0.30, type: "sine", gain: 0.06, attack: 0.005, release: 0.28, delay: 0.13 });
}

// Select: very brief, soft pickup tick.
export function playSelect() {
  knock({ filterFreq: 1600, filterQ: 5, dur: 0.025, gain: 0.18 });
}
