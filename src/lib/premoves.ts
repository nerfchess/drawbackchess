// Shared premove logic. Both the AI game (vs bot) and the friend game use this
// to support multi-premove stacking and "friendly-target" premoves (queueing a
// move onto one of your own pieces, anticipating that the opponent will
// capture it first). The hook validates each queued premove against a virtual
// board with prior premoves applied, so chained premoves stay coherent.

import { useEffect, useMemo, useState } from "react";
import type { QueuedPremove } from "@/components/Board";
import { cloneBoard, generateMoves, makeMove } from "@/engine/board";
import type { Drawback, DrawbackState, GameContext } from "@/engine/drawback";
import { DrawbackGame, legalMoves } from "@/engine/game";
import type { BoardState, Color, Move } from "@/engine/types";

export function premoveOptionsFor(
  board: BoardState,
  me: Color,
  drawback: Drawback | null,
  drawbackState: DrawbackState | null,
  ctx: GameContext | null,
): Move[] {
  const base = generateMoves(board);
  let filtered: Move[] = base;
  if (drawback?.filterMoves && drawbackState && ctx) {
    try {
      filtered = drawback.filterMoves(base, drawbackState, ctx);
    } catch {
      filtered = base;
    }
  }
  // Friendly-target: synthesize moves that would land on one of our own
  // non-king pieces. The user can queue these anticipating an opponent
  // capture; at execute-time the real legal-move list decides whether they
  // actually fire.
  const extras: Move[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board.pieces[sq];
    if (!p || p.color !== me || p.type === "k") continue;
    const tmp = cloneBoard(board);
    tmp.pieces[sq] = null;
    const all = generateMoves(tmp);
    for (const m of all) {
      if (m.to !== sq) continue;
      extras.push({ ...m, captured: p.type });
    }
  }
  return [...filtered, ...extras];
}

export interface UsePremovesResult {
  premoves: QueuedPremove[];
  queue: (m: Move) => void;
  clear: () => void;
  moves: Move[];
  virtualBoard: BoardState | null;
  validPremoves: QueuedPremove[];
  premoveOptions: Move[];
  premoveMode: boolean;
  premovePending: boolean;
}

/**
 * Manages the premove queue for a given game + side. When it's our turn and
 * a premove is queued, the head is automatically applied via `applyMove`
 * after a short delay. If the head is no longer playable, the entire queue
 * is dropped (chained links assumed the head would land).
 */
export function usePremoves(
  game: DrawbackGame | null,
  myColor: Color,
  applyMove: (m: Move) => void,
): UsePremovesResult {
  const [premoves, setPremoves] = useState<QueuedPremove[]>([]);
  const moves = useMemo(() => (game ? legalMoves(game) : []), [game]);

  const myDrawback = game ? (myColor === "w" ? game.white.drawback : game.black.drawback) : null;
  const myState = game ? (myColor === "w" ? game.white.state : game.black.state) : null;

  const { virtualBoard, validPremoves } = useMemo(() => {
    if (!game || game.result || game.board.turn === myColor) {
      return { virtualBoard: null as BoardState | null, validPremoves: [] as QueuedPremove[] };
    }
    let board = cloneBoard(game.board);
    board.turn = myColor;
    board.epTarget = null;
    const valid: QueuedPremove[] = [];
    for (const pm of premoves) {
      const ctx: GameContext = {
        board,
        me: myColor,
        opponentLastMove: [...board.history].reverse().find((m) => m.color !== myColor) ?? null,
        myLastMove: [...board.history].reverse().find((m) => m.color === myColor) ?? null,
        moveNumber: board.history.filter((m) => m.color === myColor).length,
        capturedByMe: game.captured[myColor],
        capturedFromMe: game.captured[myColor === "w" ? "b" : "w"],
      };
      const options = premoveOptionsFor(board, myColor, myDrawback, myState, ctx);
      const match = options.find(
        (c) =>
          c.from === pm.from &&
          c.to === pm.to &&
          (c.promotion ?? undefined) === (pm.promotion ?? undefined) &&
          (!pm.capture || !!c.captured),
      );
      if (!match) break;
      board = makeMove(board, match);
      board.turn = myColor;
      board.epTarget = null;
      valid.push(pm);
    }
    return { virtualBoard: board, validPremoves: valid };
  }, [game, myColor, premoves, myDrawback, myState]);

  const premoveOptions = useMemo<Move[]>(() => {
    if (!virtualBoard || !game) return [];
    const ctx: GameContext = {
      board: virtualBoard,
      me: myColor,
      opponentLastMove: [...virtualBoard.history].reverse().find((m) => m.color !== myColor) ?? null,
      myLastMove: [...virtualBoard.history].reverse().find((m) => m.color === myColor) ?? null,
      moveNumber: virtualBoard.history.filter((m) => m.color === myColor).length,
      capturedByMe: game.captured[myColor],
      capturedFromMe: game.captured[myColor === "w" ? "b" : "w"],
    };
    return premoveOptionsFor(virtualBoard, myColor, myDrawback, myState, ctx);
  }, [virtualBoard, myColor, game, myDrawback, myState]);

  useEffect(() => {
    if (premoves.length === 0 || !game || game.result) return;
    if (game.board.turn !== myColor) return;
    const head = premoves[0];
    const m = moves.find(
      (lm) =>
        lm.from === head.from &&
        lm.to === head.to &&
        (lm.promotion ?? undefined) === (head.promotion ?? undefined) &&
        (!head.capture || !!lm.captured),
    );
    if (!m) {
      setPremoves([]);
      return;
    }
    const tid = setTimeout(() => {
      applyMove(m);
      setPremoves((q) => q.slice(1));
    }, 90);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, premoves, moves, myColor]);

  const queue = (m: Move) =>
    setPremoves((q) => [
      ...q,
      { from: m.from, to: m.to, promotion: m.promotion, capture: !!m.captured },
    ]);
  const clear = () => setPremoves([]);

  const premoveMode = !!game && !game.result && game.board.turn !== myColor && !!virtualBoard;
  const premovePending = !!game && !game.result && game.board.turn === myColor && premoves.length > 0;

  return {
    premoves,
    queue,
    clear,
    moves,
    virtualBoard,
    validPremoves,
    premoveOptions,
    premoveMode,
    premovePending,
  };
}
