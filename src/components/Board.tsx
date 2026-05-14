"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Piece } from "./Pieces";
import { BoardState, Color, FILE, Move, RANK, SQ, Square } from "@/engine/types";

interface Visual {
  fogged?: boolean;
  waterRank?: number;
  duckSquare?: number;
  bannedSquares?: number[];
  highlightSquares?: number[];
}

interface Props {
  board: BoardState;
  legalMoves: Move[];
  orientation: Color;
  onMove: (m: Move) => void;
  myColor: Color;
  visual?: Visual;
  disabled?: boolean;
  lastMove?: Move | null;
}

export function Board({
  board,
  legalMoves,
  orientation,
  onMove,
  myColor,
  visual,
  disabled,
  lastMove,
}: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotionMove, setPromotionMove] = useState<Move[] | null>(null);

  const movesFrom = useMemo(() => {
    const m = new Map<Square, Move[]>();
    for (const mv of legalMoves) {
      const list = m.get(mv.from) ?? [];
      list.push(mv);
      m.set(mv.from, list);
    }
    return m;
  }, [legalMoves]);

  const targets: Record<Square, Move[]> = useMemo(() => {
    const t: Record<Square, Move[]> = {};
    if (selected != null) {
      for (const m of movesFrom.get(selected) ?? []) {
        if (!t[m.to]) t[m.to] = [];
        t[m.to].push(m);
      }
    }
    return t;
  }, [selected, movesFrom]);

  const handleSquare = (sq: Square) => {
    if (disabled) return;
    if (selected != null && targets[sq]) {
      const candidates = targets[sq];
      if (candidates.length > 1 && candidates[0].promotion) {
        setPromotionMove(candidates);
        return;
      }
      onMove(candidates[0]);
      setSelected(null);
      return;
    }
    const piece = board.pieces[sq];
    if (piece && piece.color === board.turn && movesFrom.has(sq)) {
      setSelected(sq);
    } else {
      setSelected(null);
    }
  };

  const orderedSquares: Square[] = [];
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      orderedSquares.push(SQ(f, r));
    }
  }
  if (orientation === "b") orderedSquares.reverse();

  const inKingPass = (sq: Square) =>
    board.kingPassThrough.includes(sq) && board.kingPassColor !== myColor;

  return (
    <div className="relative w-full max-w-[min(92vw,720px)] aspect-square mx-auto card-glass rounded-2xl p-2 shadow-card">
      <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full rounded-xl overflow-hidden">
        {orderedSquares.map((sq) => {
          const f = FILE(sq), r = RANK(sq);
          const isLight = (f + r) % 2 === 1;
          const piece = board.pieces[sq];
          const isSelected = selected === sq;
          const isTarget = !!targets[sq];
          const isCapture = isTarget && targets[sq].some((m) => !!m.captured);
          const banned = visual?.bannedSquares?.includes(sq);
          const isDuck = visual?.duckSquare === sq;
          const underwater = visual?.waterRank ? RANK(sq) < visual.waterRank : false;
          const lastFrom = lastMove?.from === sq;
          const lastTo = lastMove?.to === sq;
          const kep = inKingPass(sq);

          // Fog: hide opponent pieces when fogged, except if they are giving check / they just moved
          const fogHide =
            !!visual?.fogged &&
            piece &&
            piece.color !== myColor &&
            !lastTo;

          return (
            <button
              key={sq}
              onClick={() => handleSquare(sq)}
              className={
                "relative flex items-center justify-center transition-colors " +
                (isLight ? "bg-[#3a3a52]" : "bg-[#23232e]") +
                (lastFrom || lastTo ? " ring-2 ring-inset ring-accent/50" : "") +
                (isSelected ? " outline outline-2 outline-accent" : "")
              }
              aria-label={`square ${"abcdefgh"[f]}${r + 1}`}
            >
              {underwater && (
                <div className="absolute inset-0 bg-cyan-500/30 mix-blend-screen animate-shimmer pointer-events-none" />
              )}
              {kep && (
                <div className="absolute inset-0 bg-red-500/20 pointer-events-none" />
              )}
              {banned && (
                <div className="absolute inset-0 bg-red-900/40 pointer-events-none" />
              )}
              {isDuck && (
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🦆</div>
              )}
              {fogHide ? (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700/80 to-gray-900/90 backdrop-blur-sm" />
              ) : piece ? (
                <motion.div
                  layoutId={`piece-${piece.color}-${piece.type}-${sq}`}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="w-[88%] h-[88%]"
                >
                  <Piece type={piece.type} color={piece.color} size="100%" />
                </motion.div>
              ) : null}
              {isTarget && (
                <div
                  className={
                    "absolute pointer-events-none " +
                    (isCapture
                      ? "inset-0 ring-4 ring-inset ring-accent/60 rounded-md"
                      : "w-3 h-3 rounded-full bg-accent/60")
                  }
                />
              )}
              {/* coordinate labels */}
              {f === (orientation === "w" ? 0 : 7) && (
                <span className="absolute top-0.5 left-1 text-[10px] text-white/30">
                  {r + 1}
                </span>
              )}
              {r === (orientation === "w" ? 0 : 7) && (
                <span className="absolute bottom-0.5 right-1 text-[10px] text-white/30">
                  {"abcdefgh"[f]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {promotionMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl"
          >
            <div className="card-glass rounded-xl p-4 flex gap-2">
              {promotionMove.map((m) => (
                <button
                  key={m.promotion}
                  onClick={() => {
                    onMove(m);
                    setPromotionMove(null);
                    setSelected(null);
                  }}
                  className="w-16 h-16 rounded-lg bg-ink-800 hover:bg-ink-700 flex items-center justify-center"
                >
                  <Piece type={m.promotion!} color={m.color} size={56} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
