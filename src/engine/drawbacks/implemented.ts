import { Drawback } from "../drawback";
import { findKing } from "../board";
import { FILE, Move, PieceType, RANK, SQ, Square } from "../types";

const cheb = (a: Square, b: Square) =>
  Math.max(Math.abs(FILE(a) - FILE(b)), Math.abs(RANK(a) - RANK(b)));

const adj = (a: Square, b: Square) =>
  a !== b && Math.abs(FILE(a) - FILE(b)) <= 1 && Math.abs(RANK(a) - RANK(b)) <= 1;

const PIECE_VAL: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Helpers to make defining a drawback less verbose
function db(d: Drawback): Drawback {
  return { ...d, implemented: true };
}

export const LUCKY: Drawback = db({
  id: "lucky",
  name: "Lucky",
  description: "You have no drawback. A rare gift from the gods of chess.",
  flavor: "Today, fortune smiles upon you.",
  tier: 1,
  icon: "sparkles",
  implemented: true,
});

export const CESS: Drawback = db({
  id: "cess",
  name: "Cess",
  description: "You can't move to the h-file.",
  flavor: "An invisible wall hugs the right edge of your world.",
  tier: 1,
  icon: "ban",
  implemented: true,
  filterMoves: (moves) => moves.filter((m) => FILE(m.to) !== 7),
});

export const VEGAN: Drawback = db({
  id: "vegan",
  name: "Vegan",
  description: "You can't capture knights.",
  flavor: "Horses are friends, not food.",
  tier: 1,
  icon: "leaf",
  implemented: true,
  filterMoves: (moves) => moves.filter((m) => m.captured !== "n"),
});

export const TRUE_GENTLEMAN: Drawback = db({
  id: "true_gentleman",
  name: "True Gentleman",
  description: "You can't capture queens.",
  flavor: "It simply isn't done.",
  tier: 1,
  icon: "crown",
  implemented: true,
  filterMoves: (moves) => moves.filter((m) => m.captured !== "q"),
});

export const TROPHY_WIFE: Drawback = db({
  id: "trophy_wife",
  name: "Trophy Wife",
  description: "Your queen can't capture.",
  flavor: "She is for display only.",
  tier: 2,
  icon: "gem",
  implemented: true,
  filterMoves: (moves) => moves.filter((m) => !(m.piece === "q" && m.captured)),
});

export const LAME_DUCK: Drawback = db({
  id: "lame_duck",
  name: "Lame Duck",
  description: "You can't move your king at all.",
  flavor: "His majesty is paralyzed with indecision.",
  tier: 2,
  icon: "lock",
  implemented: true,
  filterMoves: (moves) => moves.filter((m) => m.piece !== "k"),
});

export const OUT_OF_BREATH: Drawback = db({
  id: "out_of_breath",
  name: "Out of Breath",
  description: "You can only move your king once the entire game.",
  flavor: "Royal cardio is not what it used to be.",
  tier: 2,
  icon: "wind",
  implemented: true,
  init: () => ({ kingMoves: 0 }),
  filterMoves: (moves, state) => {
    const s = state as { kingMoves: number };
    if (s.kingMoves >= 1) return moves.filter((m) => m.piece !== "k");
    return moves;
  },
  // Increment when we make a king move; done in onTurnStart of the SAME color (next turn we see history).
  onTurnStart: (state, ctx) => {
    const s = state as { kingMoves: number };
    const kingMoves = ctx.board.history.filter((m) => m.color === ctx.me && m.piece === "k").length;
    return { ...s, kingMoves };
  },
});

export const THREE_CHECK: Drawback = db({
  id: "three_check",
  name: "Three Check",
  description: "If you have been checked three times total, you lose.",
  flavor: "Three strikes and you're out.",
  tier: 1,
  icon: "alert-triangle",
  implemented: true,
  init: () => ({ checks: 0 }),
  onTurnStart: (state, ctx) => {
    // If we start a turn in check, increment.
    const s = state as { checks: number };
    const { isInCheck } = require("../board");
    if (isInCheck(ctx.board, ctx.me)) {
      return { checks: s.checks + 1 };
    }
    return s;
  },
  checkLoss: (state) => {
    const s = state as { checks: number };
    return s.checks >= 3 ? { reason: "checked 3 times" } : null;
  },
});

export const SIMP: Drawback = db({
  id: "simp",
  name: "Simp",
  description: "You lose if you have no queen.",
  flavor: "Without her, what is the point of anything?",
  tier: 2,
  icon: "heart",
  implemented: true,
  checkLoss: (state, ctx) => {
    const hasQueen = ctx.board.pieces.some((p) => p && p.type === "q" && p.color === ctx.me);
    return hasQueen ? null : { reason: "queen lost" };
  },
});

export const IVORY_TOWER: Drawback = db({
  id: "ivory_tower",
  name: "Ivory Tower",
  description: "You lose if any opponent piece is adjacent to your king.",
  flavor: "Royalty does not mingle.",
  tier: 2,
  icon: "tower-control",
  implemented: true,
  checkLoss: (state, ctx) => {
    const ks = findKing(ctx.board, ctx.me);
    if (ks == null) return null;
    for (let sq = 0; sq < 64; sq++) {
      const p = ctx.board.pieces[sq];
      if (!p || p.color === ctx.me) continue;
      if (adj(sq, ks)) return { reason: "enemy adjacent to king" };
    }
    return null;
  },
});

export const PACMAN: Drawback = db({
  id: "pacman",
  name: "Pacman",
  description: "If you can capture a pawn, you must.",
  flavor: "Waka waka waka.",
  tier: 3,
  icon: "circle-dot",
  implemented: true,
  filterMoves: (moves) => {
    const pawnCaptures = moves.filter((m) => m.captured === "p");
    return pawnCaptures.length ? pawnCaptures : moves;
  },
  hint: (_s, _c, legal) => {
    const caps = legal.filter((m) => m.captured === "p");
    if (!caps.length) return null;
    return {
      text: "You must capture a pawn this turn.",
      squares: Array.from(new Set(caps.map((m) => m.from))),
      tone: "warn",
    };
  },
});

export const GREEDY: Drawback = db({
  id: "greedy",
  name: "Greedy",
  description: "If you can capture a higher-value piece, you must (can't capture a lesser piece when a greater is available).",
  flavor: "Eyes always on the biggest prize.",
  tier: 1,
  icon: "coins",
  implemented: true,
  filterMoves: (moves) => {
    let max = 0;
    for (const m of moves) if (m.captured && m.captured !== "k") max = Math.max(max, PIECE_VAL[m.captured]);
    if (max === 0) return moves;
    return moves.filter((m) => {
      if (!m.captured || m.captured === "k") return true;
      return PIECE_VAL[m.captured] >= max;
    });
  },
  hint: (_s, _c, legal) => {
    let max = 0;
    for (const m of legal) if (m.captured && m.captured !== "k") max = Math.max(max, PIECE_VAL[m.captured]);
    if (max === 0) return null;
    const names: Record<number, string> = { 1: "pawn", 3: "minor piece", 5: "rook", 9: "queen" };
    const must = legal.filter((m) => m.captured && PIECE_VAL[m.captured] >= max);
    return {
      text: `You must capture the ${names[max] ?? `${max}-point piece`}.`,
      squares: Array.from(new Set(must.map((m) => m.from))),
      tone: "warn",
    };
  },
});

export const TRUANT: Drawback = db({
  id: "truant",
  name: "Truant",
  description: "You can't move the same piece twice in a row.",
  flavor: "Pieces demand a fair rotation.",
  tier: 2,
  icon: "shuffle",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    const last = ctx.myLastMove;
    if (!last) return moves;
    return moves.filter((m) => m.from !== last.to);
  },
});

export const HIPSTER: Drawback = db({
  id: "hipster",
  name: "Hipster",
  description: "You can't move the same piece type as your opponent's last move.",
  flavor: "If they did it, it's already over.",
  tier: 2,
  icon: "glasses",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    const last = ctx.opponentLastMove;
    if (!last) return moves;
    return moves.filter((m) => m.piece !== last.piece);
  },
});

export const FORWARD_MARCH: Drawback = db({
  id: "forward_march",
  name: "Forward March",
  description: "You can't move backward.",
  flavor: "There is no looking back. There is only forward.",
  tier: 3,
  icon: "arrow-up",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    const dir = ctx.me === "w" ? 1 : -1;
    return moves.filter((m) => (RANK(m.to) - RANK(m.from)) * dir >= 0);
  },
});

export const WHITES_OF_THEIR_EYES: Drawback = db({
  id: "whites_of_their_eyes",
  name: "Whites of Their Eyes",
  description: "Capturing moves must be at distance ≤ 2 (Chebyshev).",
  flavor: "Don't shoot until you see the whites of their eyes.",
  tier: 2,
  icon: "eye",
  implemented: true,
  filterMoves: (moves) => moves.filter((m) => !m.captured || cheb(m.from, m.to) <= 2),
});

export const CHAMPING_AT_THE_BIT: Drawback = db({
  id: "champing_at_the_bit",
  name: "Champing at the Bit",
  description: "All pawn moves must be distance 2.",
  flavor: "Why walk when you can sprint?",
  tier: 1,
  icon: "fast-forward",
  implemented: true,
  filterMoves: (moves) =>
    moves.filter((m) => m.piece !== "p" || Math.abs(RANK(m.to) - RANK(m.from)) === 2),
});

export const UNTITLED_DUCK: Drawback = db({
  id: "untitled_duck",
  name: "Untitled duck drawback",
  description: "A duck sits on a random square at game start. You can't pass through it or land on it.",
  flavor: "Quack.",
  tier: 1,
  icon: "bird",
  implemented: true,
  init: (rng) => {
    // pick a non-back-rank, non-piece square
    const candidates: number[] = [];
    for (let r = 2; r <= 5; r++) for (let f = 0; f < 8; f++) candidates.push(SQ(f, r));
    return { duck: rng.pick(candidates) };
  },
  filterMoves: (moves, state) => {
    const s = state as { duck: number };
    return moves.filter((m) => {
      if (m.to === s.duck) return false;
      // sliders must not pass through; we approximate by checking interior squares of straight-line moves
      const df = Math.sign(FILE(m.to) - FILE(m.from));
      const dr = Math.sign(RANK(m.to) - RANK(m.from));
      const steps = Math.max(Math.abs(FILE(m.to) - FILE(m.from)), Math.abs(RANK(m.to) - RANK(m.from)));
      // Only check pass-through for sliders & pawns/king straight lines (knight jumps over)
      if (m.piece === "n") return true;
      for (let i = 1; i < steps; i++) {
        if (SQ(FILE(m.from) + df * i, RANK(m.from) + dr * i) === s.duck) return false;
      }
      return true;
    });
  },
  visual: (state) => ({ duckSquare: (state as { duck: number }).duck }),
});

export const RISING_WATER: Drawback = db({
  id: "rising_water",
  name: "Rising Water",
  description: "Every 10 of your turns, water rises one rank from rank 1. You can't move underwater pieces or to underwater squares.",
  flavor: "The tide is rising.",
  tier: 3,
  icon: "waves",
  implemented: true,
  init: () => ({ level: 0 }),
  onTurnStart: (state, ctx) => {
    const turn = ctx.moveNumber; // number of my moves played so far
    const level = Math.min(7, Math.floor(turn / 10));
    return { level };
  },
  filterMoves: (moves, state, ctx) => {
    const s = state as { level: number };
    if (s.level <= 0) return moves;
    // Water rises from white's side (rank 1, rank 2, ...) regardless of color; universal water layer
    const underwater = (sq: number) => RANK(sq) < s.level;
    return moves.filter((m) => !underwater(m.from) && !underwater(m.to));
  },
  visual: (state) => ({ waterRank: (state as { level: number }).level }),
});

export const FOG_OF_WAR: Drawback = db({
  id: "fog_of_war",
  name: "Fog of War",
  description: "You can't see opponent's pieces (except when capturing, captures, or check).",
  flavor: "Shapes in the mist.",
  tier: 4,
  icon: "cloud-fog",
  implemented: true,
  visual: () => ({ fogged: true }),
});

export const COWARDLY: Drawback = db({
  id: "cowardly",
  name: "Cowardly",
  description: "When opponent captures, you must move backward, or lose.",
  flavor: "Run away! Run away!",
  tier: 5,
  icon: "rewind",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    const last = ctx.opponentLastMove;
    if (!last || !last.captured) return moves;
    const dir = ctx.me === "w" ? -1 : 1; // backward for me
    const backward = moves.filter((m) => (RANK(m.to) - RANK(m.from)) * (dir > 0 ? 1 : -1) > 0);
    return backward;
  },
  hint: (_s, ctx, legal) => {
    if (!ctx.opponentLastMove?.captured) return null;
    return {
      text: "They captured. You must retreat this turn or lose.",
      squares: Array.from(new Set(legal.map((m) => m.from))),
      tone: "warn",
    };
  },
});

export const HAND_AND_BRAINLESS: Drawback = db({
  id: "hand_and_brainless",
  name: "Hand and Brainless",
  description: "Each turn, a random piece type. You must move that type if possible.",
  flavor: "A voice in your head names a piece. You obey.",
  tier: 5,
  icon: "dice-5",
  implemented: true,
  init: () => ({ piece: "p" as PieceType }),
  onTurnStart: (_state, _ctx, rng) => {
    const types: PieceType[] = ["p", "n", "b", "r", "q", "k"];
    return { piece: rng.pick(types) };
  },
  filterMoves: (moves, state) => {
    const s = state as { piece: PieceType };
    const filtered = moves.filter((m) => m.piece === s.piece);
    return filtered.length ? filtered : moves;
  },
  hint: (state, _c, legal) => {
    const s = state as { piece: PieceType };
    const names: Record<PieceType, string> = {
      p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
    };
    const matching = legal.filter((m) => m.piece === s.piece);
    if (matching.length === 0) {
      return { text: `The voice says ${names[s.piece]}, but none can move. Pick anything.`, tone: "info" };
    }
    return {
      text: `The voice says: move a ${names[s.piece]}.`,
      squares: Array.from(new Set(matching.map((m) => m.from))),
      tone: "warn",
    };
  },
});

export const PACK_MENTALITY: Drawback = db({
  id: "pack_mentality",
  name: "Pack Mentality",
  description: "Pieces must move to squares adjacent to another of your pieces.",
  flavor: "Never alone, never.",
  tier: 3,
  icon: "users",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    return moves.filter((m) => {
      for (let sq = 0; sq < 64; sq++) {
        if (sq === m.from) continue;
        const p = ctx.board.pieces[sq];
        if (p && p.color === ctx.me && adj(sq, m.to)) return true;
      }
      return false;
    });
  },
});

export const SLEEPY_KING: Drawback = db({
  id: "sleepy_king",
  name: "Sleepy King",
  description: "Your king can only move when in check.",
  flavor: "Don't wake him unless you must.",
  tier: 1,
  icon: "moon",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    const { isInCheck } = require("../board");
    if (isInCheck(ctx.board, ctx.me)) return moves;
    return moves.filter((m) => m.piece !== "k");
  },
  hint: (_s, ctx) => {
    const { isInCheck } = require("../board");
    if (isInCheck(ctx.board, ctx.me)) {
      return { text: "The king stirs. He can move while in check.", tone: "info" };
    }
    return null;
  },
});

export const SCORCHED_EARTH: Drawback = db({
  id: "scorched_earth",
  name: "Scorched Earth",
  description: "You can't move to a square you've previously moved FROM.",
  flavor: "Burn the bridges. There is no return.",
  tier: 4,
  icon: "flame",
  implemented: true,
  filterMoves: (moves, _s, ctx) => {
    const burned = new Set<number>();
    for (const m of ctx.board.history) if (m.color === ctx.me) burned.add(m.from);
    return moves.filter((m) => !burned.has(m.to));
  },
});

export const ALL_IMPLEMENTED: Drawback[] = [
  LUCKY,
  CESS,
  VEGAN,
  TRUE_GENTLEMAN,
  TROPHY_WIFE,
  LAME_DUCK,
  OUT_OF_BREATH,
  THREE_CHECK,
  SIMP,
  IVORY_TOWER,
  PACMAN,
  GREEDY,
  TRUANT,
  HIPSTER,
  FORWARD_MARCH,
  WHITES_OF_THEIR_EYES,
  CHAMPING_AT_THE_BIT,
  UNTITLED_DUCK,
  RISING_WATER,
  FOG_OF_WAR,
  COWARDLY,
  HAND_AND_BRAINLESS,
  PACK_MENTALITY,
  SLEEPY_KING,
  SCORCHED_EARTH,
];

export const IMPLEMENTED_BY_ID: Record<string, Drawback> = Object.fromEntries(
  ALL_IMPLEMENTED.map((d) => [d.id, d])
);
