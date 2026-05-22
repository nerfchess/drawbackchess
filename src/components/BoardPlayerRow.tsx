"use client";

import { BoardState, Color, PieceType } from "@/engine/types";
import { Piece } from "@/components/Pieces";

const PIECE_ORDER: PieceType[] = ["p", "n", "b", "r", "q", "k"];
const PIECE_VALUES: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNTS: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

interface Props {
  board: BoardState;
  playerColor: Color;
  myColor: Color;
  name: string;
  elo?: number | null;
}

function opponentOf(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function capturedPiecesFor(board: BoardState, capturer: Color): PieceType[] {
  const opponent = opponentOf(capturer);
  const remaining: Record<PieceType, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (const piece of board.pieces) {
    if (piece?.color === opponent) remaining[piece.type]++;
  }

  const captured: PieceType[] = [];
  for (const type of PIECE_ORDER) {
    const missing = Math.max(0, START_COUNTS[type] - remaining[type]);
    for (let i = 0; i < missing; i++) captured.push(type);
  }
  return captured;
}

function capturedValue(pieces: PieceType[]): number {
  return pieces.reduce((total, piece) => total + PIECE_VALUES[piece], 0);
}

export function BoardPlayerRow({ board, playerColor, myColor, name, elo }: Props) {
  const pieces = capturedPiecesFor(board, playerColor);
  const mineValue = capturedValue(capturedPiecesFor(board, myColor));
  const opponentValue = capturedValue(capturedPiecesFor(board, opponentOf(myColor)));
  const playerValue = playerColor === myColor ? mineValue : opponentValue;
  const otherValue = playerColor === myColor ? opponentValue : mineValue;
  const delta = playerValue - otherValue;
  const isMe = playerColor === myColor;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-[3.25rem] items-center gap-3 px-2 py-2 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-[8.5rem] items-center gap-2 px-0 py-2">
          <div
            className={
              "grid h-8 w-8 shrink-0 place-items-center rounded-md border font-display text-xs font-semibold " +
              (isMe
                ? "border-gold/60 bg-gold/20 text-gold-leaf"
                : "border-bruise/60 bg-bruise/20 text-bruise-glow")
            }
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold text-parchment">
              {name}
              {typeof elo === "number" && (
                <span className="text-parchment-400"> ({Math.round(elo)})</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center">
          {pieces.map((piece, index) => (
            <div
              key={`${piece}-${index}`}
              className={index > 0 && pieces[index - 1] === piece ? "-ml-[15px]" : ""}
            >
              <Piece
                type={piece}
                color={opponentOf(playerColor)}
                size={22}
                className="opacity-90"
              />
            </div>
          ))}
        </div>

        {delta > 0 && (
          <div className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-sm font-semibold text-gold-leaf">
            +{delta}
          </div>
        )}
      </div>
    </div>
  );
}
