"use client";

import { Piece } from "./Pieces";
import { BoardState, Color, PieceType } from "@/engine/types";

const INITIAL_COUNTS: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const VAL: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
// Display order: pawns first then minor → major.
const ORDER: PieceType[] = ["p", "n", "b", "r", "q"];

function countByType(board: BoardState, color: Color): Record<PieceType, number> {
  const c: Record<PieceType, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (const p of board.pieces) {
    if (p && p.color === color) c[p.type]++;
  }
  return c;
}

interface Props {
  board: BoardState;
  myColor: Color;
}

// Renders captured pieces and the running material delta, chess.com style.
// The strip is anchored beneath the board; my captures of the opponent are
// drawn ascending, and the material delta is shown to the right.
export function MaterialBar({ board, myColor }: Props) {
  const opp: Color = myColor === "w" ? "b" : "w";
  const mine = countByType(board, myColor);
  const theirs = countByType(board, opp);

  // "Captured FROM color" = initial - current pieces of that color.
  const lostByMe: PieceType[] = [];
  const lostByThem: PieceType[] = [];
  for (const t of ORDER) {
    const missingMine = Math.max(0, INITIAL_COUNTS[t] - mine[t]);
    const missingTheirs = Math.max(0, INITIAL_COUNTS[t] - theirs[t]);
    for (let i = 0; i < missingMine; i++) lostByMe.push(t);
    for (let i = 0; i < missingTheirs; i++) lostByThem.push(t);
  }

  let myMat = 0, theirMat = 0;
  for (const t of ORDER) {
    myMat += mine[t] * VAL[t];
    theirMat += theirs[t] * VAL[t];
  }
  const delta = myMat - theirMat;

  const renderStrip = (lost: PieceType[], color: Color, key: string) => (
    <div key={key} className="flex items-center gap-0.5 flex-wrap min-h-[20px]">
      {lost.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-block w-5 h-5 -ml-1.5 first:ml-0"
          style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }}
        >
          <Piece type={t} color={color} size="100%" />
        </span>
      ))}
    </div>
  );

  return (
    <div className="px-1 flex items-center justify-between gap-3 text-[12px] text-parchment-300">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Pieces I've captured (their color) */}
        {renderStrip(lostByThem, opp, "mine")}
        {delta > 0 && (
          <span className="smallcaps text-[11px] text-gold-leaf font-semibold ml-1">
            +{delta}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        {delta < 0 && (
          <span className="smallcaps text-[11px] text-oxblood-glow font-semibold mr-1">
            +{-delta}
          </span>
        )}
        {/* Pieces opponent has captured (my color) */}
        {renderStrip(lostByMe, myColor, "theirs")}
      </div>
    </div>
  );
}
