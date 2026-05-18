// Glicko-2 single-player rating persistence (localStorage).
// One rating per player, updated after every completed game vs the AI.
// Bots get fixed seed ratings by difficulty so the player's rating
// converges toward a stable estimate of their strength.

const STORAGE_KEY = "dc:rating-v1";
const TAU = 0.5;
const SCALE = 173.7178;

export interface Rating {
  rating: number;
  rd: number;
  vol: number;
  games: number;
}

const DEFAULT: Rating = { rating: 1500, rd: 350, vol: 0.06, games: 0 };

export type AILevel = "easy" | "medium" | "hard";

const BOT_RATING: Record<AILevel, { rating: number; rd: number }> = {
  easy: { rating: 1100, rd: 60 },
  medium: { rating: 1500, rd: 60 },
  hard: { rating: 1900, rd: 60 },
};

export function loadRating(): Rating {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.rating === "number" &&
      typeof parsed?.rd === "number" &&
      typeof parsed?.vol === "number"
    ) {
      return { rating: parsed.rating, rd: parsed.rd, vol: parsed.vol, games: parsed.games ?? 0 };
    }
  } catch {}
  return { ...DEFAULT };
}

export function saveRating(r: Rating) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {}
}

function g(phi: number) {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number) {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

// score: 1 = win, 0.5 = draw, 0 = loss
export function applyResult(current: Rating, level: AILevel, score: 0 | 0.5 | 1): Rating {
  const bot = BOT_RATING[level];
  const mu = (current.rating - 1500) / SCALE;
  const phi = current.rd / SCALE;
  const muJ = (bot.rating - 1500) / SCALE;
  const phiJ = bot.rd / SCALE;
  const gJ = g(phiJ);
  const eJ = E(mu, muJ, phiJ);
  const v = 1 / (gJ * gJ * eJ * (1 - eJ));
  const delta = v * gJ * (score - eJ);

  const a = Math.log(current.vol * current.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 30 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const newVol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gJ * (score - eJ);

  return {
    rating: newMu * SCALE + 1500,
    rd: newPhi * SCALE,
    vol: newVol,
    games: current.games + 1,
  };
}
