"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Piece } from "./Pieces";
import { BoardState, Color, FILE, Move, PieceType, RANK, SQ, Square } from "@/engine/types";
import { playSelect } from "@/lib/sounds";

interface Visual {
  fogged?: boolean;
  waterRank?: number;
  duckSquare?: number;
  bannedSquares?: number[];
  highlightSquares?: number[];
}

export interface QueuedPremove {
  from: Square;
  to: Square;
  promotion?: PieceType;
  // True if the user picked a square that had a piece (opponent OR friendly).
  // The premove only fires if the matching legal move when our turn comes is
  // also a capture. A planned Nxe5 won't silently downgrade to a quiet Ne5
  // when the e5 target ran away, and a friendly-target premove fires only if
  // the opponent captures our piece first.
  capture?: boolean;
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
  premoveMode?: boolean;
  premoves?: QueuedPremove[];
  onCancelPremove?: () => void;
}

function castleRookSquare(color: Color, side: "k" | "q"): Square {
  if (side === "k") return color === "w" ? 7 : 63;
  return color === "w" ? 0 : 56;
}

interface DragState {
  from: Square;
  pointerId: number;
  cell: number; // pixel size of one square
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
  premoveMode = false,
  premoves,
  onCancelPremove,
}: Props) {
  const premoveSquares = useMemo(() => {
    const s = new Set<Square>();
    for (const pm of premoves ?? []) {
      s.add(pm.from);
      s.add(pm.to);
    }
    return s;
  }, [premoves]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotionMove, setPromotionMove] = useState<Move[] | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverSq, setHoverSq] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const gridRectRef = useRef<DOMRect | null>(null);
  const lastHoverRef = useRef<Square | null>(null);

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
        if (m.castle) {
          const rookSq = castleRookSquare(m.color, m.castle);
          if (!t[rookSq]) t[rookSq] = [];
          t[rookSq].push(m);
        }
      }
    }
    return t;
  }, [selected, movesFrom]);

  const castleHintSquares = useMemo(() => {
    const set = new Set<Square>();
    if (selected != null) {
      for (const m of movesFrom.get(selected) ?? []) {
        if (!m.castle) continue;
        set.add(castleRookSquare(m.color, m.castle));
      }
    }
    return set;
  }, [selected, movesFrom]);

  const orderedSquares: Square[] = [];
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      orderedSquares.push(SQ(f, r));
    }
  }
  if (orientation === "b") orderedSquares.reverse();

  const squareAtClient = (clientX: number, clientY: number): Square | null => {
    const rect = gridRectRef.current ?? (() => {
      const grid = boardRef.current?.querySelector("[data-board-grid]") as HTMLElement | null;
      return grid?.getBoundingClientRect() ?? null;
    })();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const col = Math.min(7, Math.max(0, Math.floor((x / rect.width) * 8)));
    const row = Math.min(7, Math.max(0, Math.floor((y / rect.height) * 8)));
    const file = orientation === "w" ? col : 7 - col;
    const rank = orientation === "w" ? 7 - row : row;
    return SQ(file, rank);
  };

  const tryPlay = (sq: Square): boolean => {
    if (selected != null && targets[sq]) {
      const candidates = targets[sq];
      if (candidates.length > 1 && candidates[0].promotion) {
        if (premoveMode) {
          // auto-queen premove promotions; the user can't be asked mid-opponent-turn
          const q = candidates.find((c) => c.promotion === "q") ?? candidates[0];
          onMove(q);
          setSelected(null);
          return true;
        }
        setPromotionMove(candidates);
        return true;
      }
      onMove(candidates[0]);
      setSelected(null);
      return true;
    }
    return false;
  };

  // Plain click / tap: keep a selected piece's legal moves visible until the
  // user selects another movable piece or plays a legal destination.
  const handleSquareClick = (sq: Square) => {
    if (disabled) return;
    if (tryPlay(sq)) return;
    const piece = board.pieces[sq];
    if (piece && piece.color === myColor && movesFrom.has(sq) && selected !== sq) {
      setSelected(sq);
      playSelect();
    }
  };

  // --- Drag & drop via pointer events ---
  const onPointerDownPiece = (e: React.PointerEvent, sq: Square) => {
    if (disabled) return;
    if (e.button !== undefined && e.button !== 0) return;
    const piece = board.pieces[sq];
    if (!piece || piece.color !== myColor || !movesFrom.has(sq)) return;
    const grid = boardRef.current?.querySelector("[data-board-grid]") as HTMLElement | null;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    gridRectRef.current = rect;
    const cell = rect.width / 8;

    setSelected(sq);
    playSelect();
    setDrag({ from: sq, pointerId: e.pointerId, cell });
    setHoverSq(sq);
    lastHoverRef.current = sq;
    // Pre-position the ghost so the first frame is right
    requestAnimationFrame(() => {
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(${e.clientX - cell / 2}px, ${e.clientY - cell / 2}px, 0)`;
      }
    });
    e.preventDefault();
  };

  useEffect(() => {
    if (!drag) return;
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let pending = false;

    const flush = () => {
      pending = false;
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(${pendingX - drag.cell / 2}px, ${pendingY - drag.cell / 2}px, 0)`;
      }
      const sq = squareAtClient(pendingX, pendingY);
      if (sq !== lastHoverRef.current) {
        lastHoverRef.current = sq;
        setHoverSq(sq);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(flush);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const sq = squareAtClient(e.clientX, e.clientY);
      if (sq != null && sq !== drag.from && targets[sq]) {
        tryPlay(sq);
      } else if (sq != null && sq !== drag.from) {
        setSelected(null);
      }
      setDrag(null);
      setHoverSq(null);
      lastHoverRef.current = null;
      gridRectRef.current = null;
    };
    const onCancel = () => {
      setDrag(null);
      setHoverSq(null);
      lastHoverRef.current = null;
      gridRectRef.current = null;
    };
    const onScroll = () => {
      // Re-measure if the page scrolls during a drag.
      const grid = boardRef.current?.querySelector("[data-board-grid]") as HTMLElement | null;
      if (grid) gridRectRef.current = grid.getBoundingClientRect();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const inKingPass = (sq: Square) =>
    board.kingPassThrough.includes(sq) && board.kingPassColor !== myColor;

  const draggedPiece = drag ? board.pieces[drag.from] : null;

  const handleContextMenu = (e: React.MouseEvent) => {
    // right-click cancels the whole premove queue (chess.com convention)
    if (premoves && premoves.length > 0 && onCancelPremove) {
      e.preventDefault();
      onCancelPremove();
      setSelected(null);
    }
  };

  return (
    <div ref={boardRef} className="relative w-full max-w-[min(92vw,720px)] aspect-square mx-auto">
      {/* Outer frame: aged gilt border + plate */}
      <div className="absolute inset-0 plate gilt rounded-md" />
      <div className="absolute inset-2 sm:inset-3 rounded-sm overflow-hidden border border-black/40">
        <div
          data-board-grid
          className="grid grid-cols-8 grid-rows-8 w-full h-full select-none"
          onContextMenu={handleContextMenu}
        >
          {orderedSquares.map((sq) => {
            const f = FILE(sq), r = RANK(sq);
            const isLight = (f + r) % 2 === 1;
            const piece = board.pieces[sq];
            const isSelected = selected === sq;
            const isCastleHint = castleHintSquares.has(sq);
            const isTarget = !!targets[sq] && !isCastleHint;
            const isCapture = isTarget && targets[sq].some((m) => !!m.captured);
            const banned = visual?.bannedSquares?.includes(sq);
            const isDuck = visual?.duckSquare === sq;
            const underwater = visual?.waterRank ? RANK(sq) < visual.waterRank : false;
            const lastFrom = lastMove?.from === sq;
            const lastTo = lastMove?.to === sq;
            const kep = inKingPass(sq);
            const isHover = hoverSq === sq && drag != null;
            const isDragging = drag?.from === sq;
            const isForced = visual?.highlightSquares?.includes(sq);
            const isPremoveSquare = premoveSquares.has(sq);

            const fogHide =
              !!visual?.fogged && piece && piece.color !== myColor && !lastTo;

            const classes = [
              "relative flex items-center justify-center",
              isLight ? "sq-light" : "sq-dark",
              isSelected ? "sq-sel" : "",
              (lastFrom || lastTo) ? "sq-last" : "",
              isHover && (isTarget || isCastleHint) ? "sq-hover" : "",
            ].join(" ");

            return (
              <div
                key={sq}
                onClick={() => handleSquareClick(sq)}
                onPointerDown={(e) => piece && onPointerDownPiece(e, sq)}
                className={classes}
                style={{ cursor: piece && piece.color === myColor && !disabled ? "grab" : "default" }}
                role="gridcell"
                aria-label={`square ${"abcdefgh"[f]}${r + 1}`}
              >
                {underwater && (
                  <div className="absolute inset-0 bg-cyan-500/25 mix-blend-screen pointer-events-none" />
                )}
                {kep && (
                  <div className="absolute inset-0 bg-oxblood/25 pointer-events-none" />
                )}
                {banned && (
                  <div className="absolute inset-0 bg-red-900/45 pointer-events-none" />
                )}
                {isDuck && (
                  <div className="absolute inset-0 flex items-center justify-center text-3xl pointer-events-none">🦆</div>
                )}
                {isForced && !isDragging && (
                  <div className="absolute inset-0 pointer-events-none rounded-sm ring-2 ring-inset ring-gold-leaf/80 shadow-[inset_0_0_24px_-4px_rgba(230,191,106,0.55)] animate-flicker" />
                )}
                {fogHide ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-stone-700/85 to-stone-900/95 backdrop-blur-sm pointer-events-none" />
                ) : piece ? (
                  <div
                    className={"w-[88%] h-[88%] pointer-events-none " + (isDragging ? "opacity-30" : "")}
                  >
                    <Piece type={piece.type} color={piece.color} size="100%" />
                  </div>
                ) : null}

                {isTarget && (
                  isCapture ? (
                    <div className="dot-capture pointer-events-none" />
                  ) : (
                    <div className="dot-target pointer-events-none" />
                  )
                )}
                {isCastleHint && (
                  <div className="absolute inset-0 pointer-events-none ring-2 ring-inset ring-gold/70 rounded-sm" />
                )}
                {isPremoveSquare && (
                  <div className="absolute inset-0 pointer-events-none bg-oxblood/45" />
                )}

                {f === (orientation === "w" ? 0 : 7) && (
                  <span
                    className={
                      "absolute top-0.5 left-1 text-[10px] font-mono font-semibold pointer-events-none " +
                      (isLight ? "text-[#4a3826]" : "text-[#eeeed2]/85")
                    }
                  >
                    {r + 1}
                  </span>
                )}
                {r === (orientation === "w" ? 0 : 7) && (
                  <span
                    className={
                      "absolute bottom-0.5 right-1 text-[10px] font-mono font-semibold pointer-events-none " +
                      (isLight ? "text-[#4a3826]" : "text-[#eeeed2]/85")
                    }
                  >
                    {"abcdefgh"[f]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag ghost — position is written directly via ref to avoid React re-renders */}
      {drag && draggedPiece && (
        <div
          ref={ghostRef}
          className="drag-ghost"
          style={{
            left: 0,
            top: 0,
            width: drag.cell,
            height: drag.cell,
            willChange: "transform",
          }}
        >
          <Piece type={draggedPiece.type} color={draggedPiece.color} size="100%" />
        </div>
      )}

      <AnimatePresence>
        {promotionMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-md z-20"
          >
            <div className="plate gilt p-4 flex gap-2">
              {promotionMove.map((m) => (
                <button
                  key={m.promotion}
                  onClick={() => {
                    onMove(m);
                    setPromotionMove(null);
                    setSelected(null);
                  }}
                  className="w-16 h-16 rounded-sm bg-ink-800 hover:bg-ink-700 flex items-center justify-center border border-gold/30"
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
