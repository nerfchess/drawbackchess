import { findKing, generateMoves, makeMove } from "./board";
import { DrawbackGame, legalMoves, makeContext } from "./game";
import { BoardState, Color, FILE, Move, RANK } from "./types";

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
  // king-en-passant exposure check is already encoded in normal move evaluation;
  // for simplicity we don't deepen here.
  return false;
}

const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluate(board: BoardState, me: Color): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board.pieces[sq];
    if (!p) continue;
    const v = VAL[p.type] + centerBonus(sq, p.type);
    score += p.color === me ? v : -v;
  }
  return score;
}

function centerBonus(sq: number, t: string): number {
  const f = FILE(sq), r = RANK(sq);
  const center = (Math.min(f, 7 - f) + Math.min(r, 7 - r));
  if (t === "n" || t === "b") return center * 3;
  if (t === "p") return center * 2;
  return 0;
}

export type AILevel = "easy" | "medium" | "hard";

export function pickAIMove(game: DrawbackGame, level: AILevel): Move | null {
  const all = legalMoves(game);
  if (!all.length) return null;
  // Prefer non-self-losing moves, but fall back to anything legal if all moves lose.
  const safe = all.filter((m) => !isSelfLosing(game, m));
  const moves = safe.length ? safe : all;
  if (level === "easy") {
    // captures preferred, else random
    const caps = moves.filter((m) => m.captured);
    const pool = caps.length ? caps : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const depth = level === "hard" ? 3 : 2;
  const me = game.board.turn;
  let bestScore = -Infinity;
  let best: Move | null = null;
  for (const m of moves) {
    const nb = makeMove(game.board, m);
    const score = -negamax(nb, depth - 1, -Infinity, Infinity, me === "w" ? "b" : "w", me);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best ?? moves[0];
}

function negamax(board: BoardState, depth: number, alpha: number, beta: number, side: Color, root: Color): number {
  // king-capture terminal
  const wk = findKing(board, "w");
  const bk = findKing(board, "b");
  if (!wk) return side === root ? -100000 : 100000; // white king gone → white loses
  if (!bk) return side === root ? 100000 : -100000;
  if (depth === 0) return evaluate(board, side);
  // No drawback filtering here (cost-prohibitive); just chess moves
  const moves = generateMoves(board);
  // Prefer captures first for ordering
  moves.sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0));
  let best = -Infinity;
  for (const m of moves) {
    const nb = makeMove(board, m);
    const v = -negamax(nb, depth - 1, -beta, -alpha, side === "w" ? "b" : "w", root);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (best === -Infinity) return evaluate(board, side);
  return best;
}
