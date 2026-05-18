"use client";

import { Piece } from "./Pieces";
import type { BoardState, Color, PieceType } from "@/engine/types";

const VALUES: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: PieceType[] = ["q", "r", "b", "n", "p"];

interface Props {
  board: BoardState;
  side: Color; // which side's view to render (their captures shown)
}

/**
 * Lichess-style captured-pieces strip with the material imbalance shown to
 * the right. We compute imbalance by counting per-piece-type diffs of pieces
 * present on the board (a captured piece doesn't exist anymore, so the side
 * that captured it shows up as having a +1 of that type — equivalent to
 * showing the captured pieces themselves).
 */
export function MaterialBar({ board, side }: Props) {
  const counts: Record<Color, Record<PieceType, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const p of board.pieces) {
    if (!p) continue;
    counts[p.color][p.type] += 1;
  }
  // Starting counts: 8 pawns, 2 N, 2 B, 2 R, 1 Q
  const start: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const opp: Color = side === "w" ? "b" : "w";
  // Pieces that `side` has captured = starting count minus surviving count
  // of the opponent's pieces.
  const captured: Array<{ type: PieceType; n: number }> = [];
  for (const t of ORDER) {
    const n = start[t] - counts[opp][t];
    if (n > 0) captured.push({ type: t, n });
  }
  // Material imbalance from `side`'s perspective in pawn-equivalent units.
  let imbalance = 0;
  for (const t of ORDER) {
    imbalance += (start[t] - counts[opp][t]) * VALUES[t];
    imbalance -= (start[t] - counts[side][t]) * VALUES[t];
  }

  return (
    <div className="flex items-center gap-1 h-6 px-1 text-xs font-mono">
      {captured.flatMap(({ type, n }) =>
        Array.from({ length: n }).map((_, i) => (
          <span
            key={`${type}-${i}`}
            className="opacity-90"
            style={{ width: 18, height: 18, display: "inline-flex" }}
          >
            <Piece type={type} color={opp} size={18} />
          </span>
        )),
      )}
      {imbalance > 0 && (
        <span className="ml-1 text-gold-leaf">+{imbalance}</span>
      )}
    </div>
  );
}
