"use client";

import { Board } from "@/components/Board";
import { DrawbackCard } from "@/components/DrawbackCard";
import { GameOver } from "@/components/GameOver";
import { MoveList } from "@/components/MoveList";
import { MaterialBar } from "@/components/MaterialBar";
import { AILevel, pickAIMove } from "@/engine/ai";
import { Drawback, DrawbackState, GameContext } from "@/engine/drawback";
import { IMPLEMENTED_BY_ID, PLAYABLE_DRAWBACKS } from "@/engine/drawbacks/library";
import {
  applyTurnStart,
  currentHint,
  DrawbackGame,
  legalMoves,
  makeContext,
  newGame,
  playMove,
  resign,
} from "@/engine/game";
import { makeSeed } from "@/engine/rng";
import { BoardState, Color, Move } from "@/engine/types";
import { cloneBoard, generateMoves, initialBoard, isInCheck, makeMove } from "@/engine/board";
import type { QueuedPremove } from "@/components/Board";
import { buildCustomDrawback, CustomDrawback } from "@/engine/drawbacks/custom";
import { isMuted, playCapture, playCheck, playDrawback, playMove as playMoveSfx, setMuted } from "@/lib/sounds";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

function pickRandomDrawback(): Drawback {
  const playable = PLAYABLE_DRAWBACKS.filter((d) => d.id !== "lucky");
  return playable[Math.floor(Math.random() * playable.length)];
}

// Pseudo-legal premove options on a (turn-flipped) board. Includes synthetic
// "friendly-target" moves: a move that would land on one of your own pieces,
// recorded as if it captures that piece. These let you queue a recapture in
// anticipation of the opponent capturing your piece first; at real-turn
// execute time, the move only fires if the destination is actually playable.
// Base pseudo-legal moves are run through the active drawback's filterMoves so
// you can't queue drawback-illegal moves.
function premoveOptionsFor(
  board: BoardState,
  me: Color,
  drawback: Drawback | null,
  drawbackState: DrawbackState | null,
  ctx: GameContext | null,
): Move[] {
  const base = generateMoves(board);
  const filteredBase =
    drawback?.filterMoves && drawbackState && ctx
      ? (() => {
          try {
            return drawback.filterMoves!(base, drawbackState, ctx);
          } catch {
            return base;
          }
        })()
      : base;
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
  return [...filteredBase, ...extras];
}

export default function GamePageWrapper() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <GamePage />
    </Suspense>
  );
}

function LoadingPanel() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="relative flex flex-col items-center">
        <div className="flex gap-1.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-gold-leaf animate-bob" />
          <span className="w-2 h-2 rounded-full bg-verdigris-glow animate-bob" style={{ animationDelay: "0.15s" }} />
          <span className="w-2 h-2 rounded-full bg-bruise-glow animate-bob" style={{ animationDelay: "0.3s" }} />
        </div>
        <div className="font-display text-xl text-parchment animate-flicker">
          Dealing the cards
        </div>
      </div>
    </main>
  );
}

function GamePage() {
  const router = useRouter();
  const params = useSearchParams();
  const difficulty = (params.get("difficulty") ?? "medium") as AILevel;
  const myColorParam = params.get("color") ?? "random";
  const myDrawbackId = params.get("drawback") ?? "random";

  const myColor: Color = useMemo(() => {
    if (myColorParam === "w") return "w";
    if (myColorParam === "b") return "b";
    return Math.random() < 0.5 ? "w" : "b";
  }, [myColorParam]);

  const [game, setGame] = useState<DrawbackGame | null>(null);
  const [, force] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [premoves, setPremoves] = useState<QueuedPremove[]>([]);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [drawOfferStatus, setDrawOfferStatus] = useState<"idle" | "offering" | "declined">("idle");
  // null = viewing the live position; otherwise an index into board.history
  // showing the position AFTER that move was played. The user navigates with
  // arrow keys; live play (AI moves, premoves) resumes when they return to
  // the live position.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const aiThinking = useRef(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  useEffect(() => {
    let myDb: Drawback;
    if (myDrawbackId === "__custom__") {
      try {
        const raw = sessionStorage.getItem("dc:active-custom");
        const spec = raw ? (JSON.parse(raw) as CustomDrawback) : null;
        myDb = spec ? buildCustomDrawback(spec) : pickRandomDrawback();
      } catch {
        myDb = pickRandomDrawback();
      }
    } else if (myDrawbackId === "random") {
      myDb = pickRandomDrawback();
    } else {
      myDb = IMPLEMENTED_BY_ID[myDrawbackId] ?? pickRandomDrawback();
    }
    const aiDb = pickRandomDrawback();
    const wDb = myColor === "w" ? myDb : aiDb;
    const bDb = myColor === "w" ? aiDb : myDb;
    setGame(newGame(wDb, bDb, makeSeed()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moves = useMemo(() => (game ? legalMoves(game) : []), [game]);

  // Reconstruct historical board by replaying moves from the initial position.
  // The viewIndex points to the move after which we want to see the board;
  // -1 means the starting position (before any move).
  const viewedBoard = useMemo(() => {
    if (!game || viewIndex === null) return null;
    let b = initialBoard();
    for (let i = 0; i <= viewIndex && i < game.board.history.length; i++) {
      b = makeMove(b, game.board.history[i]);
    }
    return b;
  }, [game, viewIndex]);

  const isViewingHistory = viewIndex !== null;

  // Snap back to live whenever new moves are appended past the current view.
  // If the user is sitting on an old position, leave them there.
  const lastHistLen = useRef(0);
  useEffect(() => {
    if (!game) return;
    const len = game.board.history.length;
    if (len < lastHistLen.current) {
      // game reset
      setViewIndex(null);
    }
    lastHistLen.current = len;
  }, [game]);

  // Reset the dismissed flag when a new game begins.
  useEffect(() => {
    setGameOverDismissed(false);
  }, [game?.startedAt]);

  // Arrow key navigation through history. Left/Right step by one ply, Home
  // jumps to the start, End jumps back to live.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const histLen = game.board.history.length;
      if (histLen === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewIndex((v) => {
          if (v === null) return Math.max(-1, histLen - 2);
          return Math.max(-1, v - 1);
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewIndex((v) => {
          if (v === null) return null;
          const next = v + 1;
          return next >= histLen - 1 ? null : next;
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        setViewIndex(-1);
      } else if (e.key === "End" || e.key === "ArrowDown") {
        e.preventDefault();
        setViewIndex(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  // Build a "virtual" board that reflects the current actual board with every
  // queued premove applied in sequence. Pseudo-legal options for further
  // premoves are generated against this virtual board, so chained premoves
  // (move A then move B with A already applied) work naturally.
  //
  // We also synthesize "friendly-target" moves: moves that would land on one
  // of our own pieces. The user can premove these in anticipation of the
  // opponent capturing first; at execute time, if the friendly piece is still
  // there the real legal-move list won't include the move and the premove is
  // discarded.
  const myDrawbackForPremove = game ? (myColor === "w" ? game.white.drawback : game.black.drawback) : null;
  const myStateForPremove = game ? (myColor === "w" ? game.white.state : game.black.state) : null;

  const { virtualBoard, validPremoves } = useMemo(() => {
    if (!game || game.result || premoves.length === 0) {
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
      const options = premoveOptionsFor(board, myColor, myDrawbackForPremove, myStateForPremove, ctx);
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
  }, [game, myColor, premoves, myDrawbackForPremove, myStateForPremove]);

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
    return premoveOptionsFor(virtualBoard, myColor, myDrawbackForPremove, myStateForPremove, ctx);
  }, [virtualBoard, myColor, game, myDrawbackForPremove, myStateForPremove]);

  // The board is in true premove mode only when it's the opponent's turn. When
  // it's our turn and premoves are still pending, the head is about to commit;
  // we keep showing the virtual board so the piece doesn't flicker back to its
  // original square between the AI move landing and our queued move firing.
  const premoveMode = !!game && !game.result && game.board.turn !== myColor && !!virtualBoard;
  const premovePending = !!game && !game.result && game.board.turn === myColor && premoves.length > 0;

  // Played-move sound effects: react to history change.
  const lastSeenMoveCount = useRef(0);
  useEffect(() => {
    if (!game) return;
    const hist = game.board.history;
    if (hist.length === lastSeenMoveCount.current) return;
    const last = hist[hist.length - 1];
    if (last) {
      if (last.captured) playCapture();
      else playMoveSfx();
      // play check / king-en-passant flag
      if (last.isKingEnPassant || isInCheck(game.board, game.board.turn)) {
        setTimeout(playCheck, 80);
      }
    }
    lastSeenMoveCount.current = hist.length;
  }, [game]);

  // Drawback-triggered loss sound when game ends with a non-mundane reason.
  const sawResult = useRef(false);
  useEffect(() => {
    if (!game?.result || sawResult.current) return;
    sawResult.current = true;
    if (game.result.reason && game.result.reason.includes(":")) {
      playDrawback();
    }
  }, [game?.result]);

  // Execute the head of the premove queue when our turn returns. If the head
  // is no longer playable (target ran away, piece pinned, friendly target
  // still standing) we clear the whole queue — subsequent links assumed the
  // head would land, so they can't be salvaged.
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
      const next = playMove(game, m);
      setGame({ ...next });
      setPremoves((q) => q.slice(1));
    }, 90);
    return () => clearTimeout(tid);
  }, [game, premoves, moves, myColor]);

  // AI move
  useEffect(() => {
    if (!game || game.result) return;
    if (game.board.turn === myColor) return;
    if (aiThinking.current) return;
    aiThinking.current = true;
    // Visual minimum wait; the engine's iterative-deepening search budget runs
    // inside this window, so the move appears deliberate even when the search
    // finishes early.
    const delay = difficulty === "easy" ? 600 : difficulty === "medium" ? 1200 : 2000;
    const tid = setTimeout(() => {
      const m = pickAIMove(game, difficulty);
      if (m) {
        const next = playMove(game, m);
        setGame({ ...next });
      } else {
        game.result = { winner: myColor, reason: "AI has no legal moves" };
        setGame({ ...game });
      }
      aiThinking.current = false;
      force((x) => x + 1);
    }, delay);
    return () => {
      clearTimeout(tid);
      aiThinking.current = false;
    };
  }, [game, myColor, difficulty]);

  if (!game) {
    return <LoadingPanel />;
  }

  const myDrawback = myColor === "w" ? game.white.drawback : game.black.drawback;
  const myState = myColor === "w" ? game.white.state : game.black.state;
  const myCtx = makeContext(game, myColor);
  const visual = myDrawback.visual?.(myState, myCtx);
  const opponentDrawback = myColor === "w" ? game.black.drawback : game.white.drawback;
  const lastMove = game.board.history[game.board.history.length - 1] ?? null;
  const hint = currentHint(game, myColor);
  const forcedSquares = hint?.squares ?? [];

  const handleMove = (m: Move) => {
    if (game.result) return;
    if (game.board.turn !== myColor) {
      // append to the premove queue; chained premoves are evaluated against
      // the virtual board derived from any prior queued moves
      setPremoves((q) => [
        ...q,
        { from: m.from, to: m.to, promotion: m.promotion, capture: !!m.captured },
      ]);
      return;
    }
    const next = playMove(game, m);
    setGame({ ...next });
  };

  const cancelPremove = () => setPremoves([]);

  const handleRematch = () => router.push("/play");

  const onResign = () => {
    if (!game.result) {
      resign(game, myColor);
      setGame({ ...game });
      setPremoves([]);
    }
  };

  const onOfferDraw = () => {
    if (game.result || drawOfferStatus !== "idle") return;
    setDrawOfferStatus("offering");
    // Simple AI policy: accept if its material isn't ahead. Otherwise decline.
    const vals: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let mine = 0, theirs = 0;
    for (const p of game.board.pieces) {
      if (!p) continue;
      const v = vals[p.type] ?? 0;
      if (p.color === myColor) mine += v;
      else theirs += v;
    }
    // AI accepts if it isn't ahead by more than 2.
    const aiAhead = theirs - mine;
    window.setTimeout(() => {
      if (aiAhead <= 2) {
        game.result = { winner: "draw", reason: "draw by agreement" };
        setGame({ ...game });
        setPremoves([]);
        setDrawOfferStatus("idle");
      } else {
        setDrawOfferStatus("declined");
        window.setTimeout(() => setDrawOfferStatus("idle"), 2500);
      }
    }, 800);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const whoseTurn = game.board.turn === myColor ? "Yours" : "Theirs";

  return (
    <main className="min-h-screen pb-12">
      <nav className="px-4 sm:px-6 py-5 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="text-gold-leaf">chess</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="smallcaps text-[11px] text-parchment-400 hidden sm:block">
            playing {myColor === "w" ? "White" : "Black"} · bot on {difficulty}
          </div>
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Sound off" : "Sound on"}
            className="w-9 h-9 inline-flex items-center justify-center rounded-full btn-ghost"
          >
            {muted ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-display text-parchment-200">
              <span className="smallcaps text-[11px] text-parchment-400 mr-2">Turn</span>
              <span className={game.board.turn === myColor ? "text-gold-leaf font-semibold" : "text-bruise-glow font-semibold"}>
                {whoseTurn}
              </span>
            </span>
            {confirmingResign ? (
              <div className="flex items-center gap-2">
                <span className="smallcaps text-[10px] text-parchment-300">Resign the game?</span>
                <button
                  onClick={() => { onResign(); setConfirmingResign(false); }}
                  className="px-3 py-1.5 rounded-full border border-oxblood/70 bg-oxblood/25 text-oxblood-glow hover:bg-oxblood/40 transition text-xs font-display font-semibold tracking-wide"
                >
                  Yes, resign
                </button>
                <button
                  onClick={() => setConfirmingResign(false)}
                  className="px-3 py-1.5 rounded-full btn-ghost text-xs font-display tracking-wide"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {drawOfferStatus === "declined" && (
                  <span className="smallcaps text-[10px] text-parchment-300">Draw declined.</span>
                )}
                <button
                  onClick={onOfferDraw}
                  disabled={drawOfferStatus !== "idle"}
                  className="px-4 py-1.5 rounded-full border border-gold/40 bg-gold/10 text-gold-leaf hover:bg-gold/20 hover:border-gold/70 transition text-xs font-display font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {drawOfferStatus === "offering" ? "Offering…" : "Offer Draw"}
                </button>
                <button
                  onClick={() => setConfirmingResign(true)}
                  className="px-4 py-1.5 rounded-full border border-oxblood/40 bg-oxblood/10 text-oxblood-glow hover:bg-oxblood/20 hover:border-oxblood/70 transition text-xs font-display font-semibold tracking-wide"
                >
                  Resign
                </button>
              </div>
            )}
          </div>
          {/* Reserve a fixed slot for the hint so its appearance/disappearance
              doesn't push the board down. The plate fades in when there's a hint. */}
          <div className="min-h-[3.25rem]">
            {hint && (
              <div
                role="status"
                aria-live="polite"
                className={
                  "plate p-3 px-4 flex items-center gap-3 " +
                  (hint.tone === "warn"
                    ? "border-oxblood-glow/60 bg-oxblood/15"
                    : "border-gold/40 bg-gold/10")
                }
              >
                <span aria-hidden="true" className="text-gold-leaf font-display font-bold text-xl leading-none">!</span>
                <span className="font-display text-[15px] text-parchment">
                  {hint.text}
                </span>
              </div>
            )}
          </div>
          <Board
            board={isViewingHistory ? viewedBoard! : (virtualBoard ?? game.board)}
            legalMoves={isViewingHistory ? [] : (game.board.turn === myColor && !premovePending ? moves : premoveOptions)}
            orientation={myColor}
            onMove={handleMove}
            myColor={myColor}
            visual={isViewingHistory ? {} : { ...(visual ?? {}), highlightSquares: forcedSquares }}
            lastMove={
              isViewingHistory
                ? (viewIndex !== null && viewIndex >= 0 ? game.board.history[viewIndex] : null)
                : lastMove
            }
            disabled={!!game.result || premovePending || isViewingHistory}
            premoveMode={!isViewingHistory && premoveMode}
            premoves={isViewingHistory ? [] : validPremoves}
            onCancelPremove={cancelPremove}
          />
          <MaterialBar
            board={isViewingHistory ? viewedBoard! : game.board}
            myColor={myColor}
          />
          {isViewingHistory && (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="smallcaps text-[11px] text-parchment-300">
                Viewing move {viewIndex === -1 ? "start" : `${viewIndex! + 1} / ${game.board.history.length}`}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewIndex(-1)}
                  className="px-3 py-1 rounded-full btn-ghost text-[11px] font-display"
                  aria-label="Jump to start"
                >
                  ⏮
                </button>
                <button
                  onClick={() => setViewIndex((v) => Math.max(-1, (v ?? game.board.history.length) - 1))}
                  className="px-3 py-1 rounded-full btn-ghost text-[11px] font-display"
                  aria-label="Previous move"
                >
                  ◀
                </button>
                <button
                  onClick={() => setViewIndex((v) => {
                    if (v === null) return null;
                    const next = v + 1;
                    return next >= game.board.history.length - 1 ? null : next;
                  })}
                  className="px-3 py-1 rounded-full btn-ghost text-[11px] font-display"
                  aria-label="Next move"
                >
                  ▶
                </button>
                <button
                  onClick={() => setViewIndex(null)}
                  className="px-3 py-1 rounded-full btn-leaf text-[11px] font-display"
                  aria-label="Return to live"
                >
                  Live
                </button>
              </div>
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <DrawbackCard drawback={myDrawback} />
          <DrawbackCard drawback={opponentDrawback} revealed={!!game.result} />
          <MoveList moves={game.board.history} />
        </aside>
      </div>

      {game.result && !gameOverDismissed && (
        <GameOver
          result={game.result}
          whiteDrawback={game.white.drawback}
          blackDrawback={game.black.drawback}
          myColor={myColor}
          onRematch={handleRematch}
          onClose={() => setGameOverDismissed(true)}
        />
      )}
    </main>
  );
}
