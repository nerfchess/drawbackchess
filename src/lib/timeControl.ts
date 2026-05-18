// Lichess-style time controls: base minutes + per-move increment in seconds.
// `sec=0` means unlimited (no clock).

export interface TimeControl {
  sec: number; // base time per side, seconds. 0 = unlimited.
  inc: number; // per-move increment, seconds.
}

export const PRESETS: TimeControl[] = [
  { sec: 60, inc: 0 },
  { sec: 60, inc: 1 },
  { sec: 120, inc: 1 },
  { sec: 180, inc: 0 },
  { sec: 180, inc: 2 },
  { sec: 300, inc: 0 },
  { sec: 300, inc: 3 },
  { sec: 600, inc: 0 },
  { sec: 600, inc: 5 },
  { sec: 900, inc: 10 },
  { sec: 1800, inc: 0 },
  { sec: 1800, inc: 20 },
];

export function tcKey(tc: TimeControl): string {
  return `${tc.sec}+${tc.inc}`;
}

export function formatTC(tc: TimeControl): string {
  if (tc.sec === 0) return "Unlimited";
  const min = tc.sec / 60;
  const minStr = Number.isInteger(min) ? String(min) : min.toFixed(1).replace(/\.0$/, "");
  return `${minStr}+${tc.inc}`;
}

// Classify by total time (base + 40*inc) the way Lichess does for category names.
export function categoryOf(tc: TimeControl): "bullet" | "blitz" | "rapid" | "classical" | "unlimited" {
  if (tc.sec === 0) return "unlimited";
  const total = tc.sec + 40 * tc.inc;
  if (total < 180) return "bullet";
  if (total < 480) return "blitz";
  if (total < 1500) return "rapid";
  return "classical";
}
