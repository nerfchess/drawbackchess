// Glicko-2 rating system (Lichess uses Glicko-2 with τ=0.75; we use τ=0.5 which
// is the value Mark Glickman recommends in the original paper).
//
// http://www.glicko.net/glicko/glicko2.pdf
//
// We update per-game (treating each game as a 1-game rating period). This is
// what Lichess does in practice for live games.

export interface Rating {
  rating: number; // public rating (default 1500)
  rd: number; // rating deviation (default 350)
  vol: number; // volatility (default 0.06)
}

export const DEFAULT_RATING: Rating = { rating: 1500, rd: 350, vol: 0.06 };

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, muOpp: number, phiOpp: number): number {
  return 1 / (1 + Math.exp(-g(phiOpp) * (mu - muOpp)));
}

// score: 1 = win, 0.5 = draw, 0 = loss (for `me`)
export function updateRating(me: Rating, opponent: Rating, score: 0 | 0.5 | 1): Rating {
  // 1. Scale to internal
  const mu = (me.rating - 1500) / SCALE;
  const phi = me.rd / SCALE;
  const muO = (opponent.rating - 1500) / SCALE;
  const phiO = opponent.rd / SCALE;

  // 2. Variance v
  const gO = g(phiO);
  const E = expected(mu, muO, phiO);
  const v = 1 / (gO * gO * E * (1 - E));

  // 3. Δ (estimated improvement)
  const delta = v * gO * (score - E);

  // 4. New volatility via Illinois method
  const a = Math.log(me.vol * me.vol);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
    return num / den - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  let iter = 0;
  while (Math.abs(B - A) > EPSILON && iter < 100) {
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
    iter += 1;
  }
  const newVol = Math.exp(A / 2);

  // 5. New deviation
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  // 6. New rating
  const newMu = mu + newPhi * newPhi * gO * (score - E);

  return {
    rating: SCALE * newMu + 1500,
    rd: SCALE * newPhi,
    vol: newVol,
  };
}

// Convenience: format a rating display with deviation indicator. Lichess shows
// "?" suffix when RD is above 110 to indicate "provisional".
export function formatRating(r: Rating | undefined | null): string {
  if (!r) return "?";
  const main = Math.round(r.rating);
  return r.rd > 110 ? `${main}?` : `${main}`;
}
