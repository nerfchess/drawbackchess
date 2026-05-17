import { findKing, generateMoves, makeMove } from "./board";
import { DrawbackGame, legalMoves } from "./game";
import { BoardState, Color, FILE, Move, PieceType, RANK } from "./types";

// A move is self-losing if making it (a) lets the opponent capture our king for free
// next ply, or (b) trips our own drawback's checkLoss on the resulting board.
function isSelfLosing(game: DrawbackGame, move: Move): boolean {
  const me = game.board.turn;
  const slot = me === "w" ? game.white : game.black;
  const nb = makeMove(game.board, move);
  if (slot.drawback.checkLoss) {
    const ctx = {
      board: nb,
      me,
      opponentLastMove: game.board.history[game.board.history.length - 1] ?? null,
      myLastMove: move,
      moveNumber: nb.history.filter((m) => m.color === me).length,
      capturedByMe: game.captured[me],
      capturedFromMe: game.captured[me === "w" ? "b" : "w"],
    };
    if (slot.drawback.checkLoss(slot.state, ctx)) return true;
  }
  return false;
}

const VAL: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables — white's perspective, indexed by sq (rank 0 = white's back rank).
// Black uses `sq ^ 56` to mirror vertically.
// Standard values adapted from Chess Programming Wiki simplified evaluation.
const PST: Record<PieceType, number[]> = {
  p: [
       0,   0,   0,   0,   0,   0,   0,   0,
       5,  10,  10, -20, -20,  10,  10,   5,
       5,  -5, -10,   0,   0, -10,  -5,   5,
       0,   0,   0,  20,  20,   0,   0,   0,
       5,   5,  10,  25,  25,  10,   5,   5,
      10,  10,  20,  30,  30,  20,  10,  10,
      50,  50,  50,  50,  50,  50,  50,  50,
       0,   0,   0,   0,   0,   0,   0,   0,
  ],
  n: [
     -50, -40, -30, -30, -30, -30, -40, -50,
     -40, -20,   0,   5,   5,   0, -20, -40,
     -30,   5,  10,  15,  15,  10,   5, -30,
     -30,   0,  15,  20,  20,  15,   0, -30,
     -30,   5,  15,  20,  20,  15,   5, -30,
     -30,   0,  10,  15,  15,  10,   0, -30,
     -40, -20,   0,   0,   0,   0, -20, -40,
     -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
     -20, -10, -10, -10, -10, -10, -10, -20,
     -10,   5,   0,   0,   0,   0,   5, -10,
     -10,  10,  10,  10,  10,  10,  10, -10,
     -10,   0,  10,  10,  10,  10,   0, -10,
     -10,   5,   5,  10,  10,   5,   5, -10,
     -10,   0,   5,  10,  10,   5,   0, -10,
     -10,   0,   0,   0,   0,   0,   0, -10,
     -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
       0,   0,   0,   5,   5,   0,   0,   0,
      -5,   0,   0,   0,   0,   0,   0,  -5,
      -5,   0,   0,   0,   0,   0,   0,  -5,
      -5,   0,   0,   0,   0,   0,   0,  -5,
      -5,   0,   0,   0,   0,   0,   0,  -5,
      -5,   0,   0,   0,   0,   0,   0,  -5,
       5,  10,  10,  10,  10,  10,  10,   5,
       0,   0,   0,   0,   0,   0,   0,   0,
  ],
  q: [
     -20, -10, -10,  -5,  -5, -10, -10, -20,
     -10,   0,   5,   0,   0,   0,   0, -10,
     -10,   5,   5,   5,   5,   5,   0, -10,
       0,   0,   5,   5,   5,   5,   0,  -5,
      -5,   0,   5,   5,   5,   5,   0,  -5,
     -10,   0,   5,   5,   5,   5,   0, -10,
     -10,   0,   0,   0,   0,   0,   0, -10,
     -20, -10, -10,  -5,  -5, -10, -10, -20,
  ],
  k: [
      20,  30,  10,   0,   0,  10,  30,  20,
      20,  20,   0,   0,   0,   0,  20,  20,
     -10, -20, -20, -20, -20, -20, -20, -10,
     -20, -30, -30, -40, -40, -30, -30, -20,
     -30, -40, -40, -50, -50, -40, -40, -30,
     -30, -40, -40, -50, -50, -40, -40, -30,
     -30, -40, -40, -50, -50, -40, -40, -30,
     -30, -40, -40, -50, -50, -40, -40, -30,
  ],
};

function evaluate(board: BoardState, me: Color): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board.pieces[sq];
    if (!p) continue;
    const idx = p.color === "w" ? sq : sq ^ 56;
    const v = VAL[p.type] + PST[p.type][idx];
    score += p.color === me ? v : -v;
  }
  return score;
}

// MVV-LVA: most valuable victim, least valuable attacker. Captures of high-value
// pieces by low-value pieces sort first.
function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const ascore = a.captured ? VAL[a.captured] * 10 - VAL[a.piece] : 0;
    const bscore = b.captured ? VAL[b.captured] * 10 - VAL[b.piece] : 0;
    return bscore - ascore;
  });
}

export type AILevel = "easy" | "medium" | "hard";

export function pickAIMove(game: DrawbackGame, level: AILevel): Move | null {
  const all = legalMoves(game);
  if (!all.length) return null;
  const safe = all.filter((m) => !isSelfLosing(game, m));
  const moves = safe.length ? safe : all;

  if (level === "easy") {
    const caps = moves.filter((m) => m.captured);
    const pool = caps.length ? caps : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const depth = level === "hard" ? 4 : 3;
  const me = game.board.turn;
  const opp: Color = me === "w" ? "b" : "w";

  let bestScore = -Infinity;
  let best: Move | null = null;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of orderMoves(moves)) {
    const nb = makeMove(game.board, m);
    const score = -negamax(nb, depth - 1, -beta, -alpha, opp, me);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
    if (score > alpha) alpha = score;
  }
  return best ?? moves[0];
}

function negamax(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  side: Color,
  root: Color,
): number {
  const wk = findKing(board, "w");
  const bk = findKing(board, "b");
  if (!wk) return side === root ? -100000 : 100000;
  if (!bk) return side === root ? 100000 : -100000;
  if (depth === 0) return quiesce(board, alpha, beta, side, 6);

  const moves = orderMoves(generateMoves(board));
  const opp: Color = side === "w" ? "b" : "w";
  let best = -Infinity;
  for (const m of moves) {
    const nb = makeMove(board, m);
    const v = -negamax(nb, depth - 1, -beta, -alpha, opp, root);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (best === -Infinity) return evaluate(board, side);
  return best;
}

// Quiescence search: only consider captures so the leaf eval isn't called on a
// position where the side to move can immediately win/lose material.
function quiesce(
  board: BoardState,
  alpha: number,
  beta: number,
  side: Color,
  depth: number,
): number {
  const wk = findKing(board, "w");
  const bk = findKing(board, "b");
  if (!wk) return side === "w" ? -100000 : 100000;
  if (!bk) return side === "b" ? -100000 : 100000;

  const standPat = evaluate(board, side);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  if (depth === 0) return alpha;

  const captures = orderMoves(generateMoves(board).filter((m) => m.captured));
  const opp: Color = side === "w" ? "b" : "w";
  for (const m of captures) {
    const nb = makeMove(board, m);
    const score = -quiesce(nb, -beta, -alpha, opp, depth - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}
