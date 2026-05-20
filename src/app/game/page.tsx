"use client";

import { Board } from "@/components/Board";
import { DrawbackCard } from "@/components/DrawbackCard";
import { GameOver } from "@/components/GameOver";
import { MoveList } from "@/components/MoveList";
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
import { cloneBoard, generateMoves, isInCheck, makeMove } from "@/engine/board";
import type { QueuedPremove } from "@/components/Board";
import { buildCustomDrawback, CustomDrawback } from "@/engine/drawbacks/custom";
import { isMuted, playCapture, playCheck, playDrawback, playMove as playMoveSfx, setMuted } from "@/lib/sounds";
import { applyResult, loadRating, saveRating } from "@/lib/rating";
import { SettingsPanel } from "@/components/SettingsPanel";
import { loadSavedAiGame, restoreSavedAiGame, saveAiGame } from "@/lib/gamePersistence";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  // Under 10s, show 1 decimal so the user can feel the rush.
  if (clamped < 10000) {
    return `0:0${(clamped / 1000).toFixed(1)}`;
  }
  const totalSec = Math.ceil(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pickRandomDrawback(): Drawback {
  const playable = PLAYABLE_DRAWBACKS.filter((d) => d.id !== "lucky");
  return playable[Math.floor(Math.random() * playable.length)];
}

// Pseudo-legal premove options on a (turn-flipped) board. The active drawback's
// filterMoves is applied to the base move list so drawback-illegal premoves
// aren't queueable. On top of that we synthesize "friendly-target" moves —
// moves that would land on one of our own non-king pieces — so the user can
// premove anticipating an opponent capture. These synthetics aren't passed
// through the drawback filter at queue-time; the real legal-move list at
// execute-time decides whether they actually play.
function premoveOptionsFor(
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
  const querySignature = params.toString();
  const difficulty = (params.get("difficulty") ?? "medium") as AILevel;
  const myColorParam = params.get("color") ?? "random";
  const myDrawbackId = params.get("drawback") ?? "random";
  // t = seconds per side; 0 (or missing) disables the clock entirely.
  const initialTimeMs = useMemo(() => {
    const t = parseInt(params.get("t") ?? "0", 10);
    return Number.isFinite(t) && t > 0 ? t * 1000 : 0;
  }, [params]);
  const incrementMs = useMemo(() => {
    const inc = parseInt(params.get("inc") ?? "0", 10);
    return Number.isFinite(inc) && inc > 0 ? inc * 1000 : 0;
  }, [params]);
  const clockEnabled = initialTimeMs > 0;

  const [myColor, setMyColor] = useState<Color>(() => {
    if (myColorParam === "w") return "w";
    if (myColorParam === "b") return "b";
    return Math.random() < 0.5 ? "w" : "b";
  });

  const [game, setGame] = useState<DrawbackGame | null>(null);
  const [, force] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [premoves, setPremoves] = useState<QueuedPremove[]>([]);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [drawOfferStatus, setDrawOfferStatus] = useState<"idle" | "offering" | "declined">("idle");
  const [whiteMs, setWhiteMs] = useState(initialTimeMs);
  const [blackMs, setBlackMs] = useState(initialTimeMs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const aiThinking = useRef(false);
  const whiteCustomSpec = useRef<CustomDrawback | null>(null);
  const blackCustomSpec = useRef<CustomDrawback | null>(null);

  const addIncrement = (color: Color) => {
    if (!clockEnabled || incrementMs <= 0) return;
    if (color === "w") setWhiteMs((t) => t + incrementMs);
    else setBlackMs((t) => t + incrementMs);
  };

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  useEffect(() => {
    const saved = loadSavedAiGame(querySignature);
    if (saved) {
      const restored = restoreSavedAiGame(saved);
      if (restored) {
        setMyColor(saved.myColor);
        setGame(restored);
        setWhiteMs(saved.whiteMs);
        setBlackMs(saved.blackMs);
        setPremoves(saved.premoves ?? []);
        whiteCustomSpec.current =
          saved.game.white.drawback.kind === "custom" ? saved.game.white.drawback.spec : null;
        blackCustomSpec.current =
          saved.game.black.drawback.kind === "custom" ? saved.game.black.drawback.spec : null;
        lastSeenMoveCount.current = restored.board.history.length;
        sawResult.current = !!restored.result;
        return;
      }
    }

    let myDb: Drawback;
    let myCustomSpec: CustomDrawback | null = null;
    if (myDrawbackId === "__custom__") {
      try {
        const raw = sessionStorage.getItem("dc:active-custom");
        const spec = raw ? (JSON.parse(raw) as CustomDrawback) : null;
        myCustomSpec = spec;
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
    whiteCustomSpec.current = myColor === "w" ? myCustomSpec : null;
    blackCustomSpec.current = myColor === "w" ? null : myCustomSpec;
    setGame(newGame(wDb, bDb, makeSeed()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!game) return;
    saveAiGame({
      query: querySignature,
      myColor,
      game,
      whiteMs,
      blackMs,
      premoves,
      whiteCustomSpec: whiteCustomSpec.current,
      blackCustomSpec: blackCustomSpec.current,
    });
  }, [game, querySignature, myColor, whiteMs, blackMs, premoves]);

  const moves = useMemo(() => (game ? legalMoves(game) : []), [game]);

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
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null);
  useEffect(() => {
    if (!game?.result || sawResult.current) return;
    sawResult.current = true;
    if (game.result.reason && game.result.reason.includes(":")) {
      playDrawback();
    }
    const before = loadRating();
    const score: 0 | 0.5 | 1 =
      game.result.winner === "draw" ? 0.5 : game.result.winner === myColor ? 1 : 0;
    const after = applyResult(before, difficulty, score);
    saveRating(after);
    setRatingChange({ before: before.rating, after: after.rating });
  }, [game?.result, myColor, difficulty]);

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
        // If the user premoved a capture (real or friendly-target), the
        // matching legal move must also be a capture — otherwise a planned
        // Nxe5 silently downgrades to a quiet Ne5 when the target ran away,
        // and a friendly-target premove fires only when the opponent
        // actually took our piece.
        (!head.capture || !!lm.captured),
    );
    if (!m) {
      setPremoves([]);
      return;
    }
    const tid = setTimeout(() => {
      const next = playMove(game, m);
      setGame({ ...next });
      addIncrement(myColor);
      setPremoves((q) => q.slice(1));
    }, 90);
    return () => clearTimeout(tid);
  }, [game, premoves, moves, myColor, clockEnabled, incrementMs]);

  // Clock tick — decrement the active side's clock at 100ms intervals while the
  // game is live. The actual loss check is in a separate effect so we don't
  // schedule state updates inside the tick callback.
  useEffect(() => {
    if (!clockEnabled || !game || game.result) return;
    const id = setInterval(() => {
      const dec = (t: number) => Math.max(0, t - 100);
      if (game.board.turn === "w") setWhiteMs(dec);
      else setBlackMs(dec);
    }, 100);
    return () => clearInterval(id);
  }, [game, clockEnabled]);

  // Timeout: when a clock hits 0, the side whose clock ran out loses.
  useEffect(() => {
    if (!clockEnabled || !game || game.result) return;
    if (whiteMs <= 0) {
      game.result = { winner: "b", reason: "white ran out of time" };
      setGame({ ...game });
    } else if (blackMs <= 0) {
      game.result = { winner: "w", reason: "black ran out of time" };
      setGame({ ...game });
    }
  }, [whiteMs, blackMs, clockEnabled, game]);

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
        const mover = game.board.turn;
        const next = playMove(game, m);
        setGame({ ...next });
        addIncrement(mover);
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
  }, [game, myColor, difficulty, clockEnabled, incrementMs]);

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
    addIncrement(myColor);
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
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
            className="w-9 h-9 inline-flex items-center justify-center rounded-full btn-ghost"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
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
          {clockEnabled && (
            <ClockPill
              label="Opponent"
              ms={myColor === "w" ? blackMs : whiteMs}
              active={!game.result && game.board.turn !== myColor}
            />
          )}
          <Board
            board={virtualBoard ?? game.board}
            legalMoves={game.board.turn === myColor && !premovePending ? moves : premoveOptions}
            orientation={myColor}
            onMove={handleMove}
            myColor={myColor}
            visual={{ ...(visual ?? {}), highlightSquares: forcedSquares }}
            lastMove={lastMove}
            disabled={!!game.result || premovePending}
            premoveMode={premoveMode}
            premoves={validPremoves}
            onCancelPremove={cancelPremove}
          />
          <MaterialBar board={virtualBoard ?? game.board} myColor={myColor} />
          {clockEnabled && (
            <ClockPill
              label="You"
              ms={myColor === "w" ? whiteMs : blackMs}
              active={!game.result && game.board.turn === myColor}
            />
          )}
        </div>
        <aside className="space-y-4">
          <DrawbackCard
            drawback={myDrawback}
            progress={myDrawback.progress?.(myState, myCtx) ?? null}
          />
          <DrawbackCard drawback={opponentDrawback} revealed={!!game.result} />
          <MoveList moves={game.board.history} />
        </aside>
      </div>

      {game.result && (
        <GameOver
          result={game.result}
          whiteDrawback={game.white.drawback}
          blackDrawback={game.black.drawback}
          myColor={myColor}
          onRematch={handleRematch}
          ratingChange={ratingChange}
        />
      )}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

function MaterialBar({ board, myColor }: { board: BoardState; myColor: Color }) {
  const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const counts: Record<Color, Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const p of board.pieces) {
    if (!p) continue;
    counts[p.color][p.type]++;
  }
  const opp: Color = myColor === "w" ? "b" : "w";
  let myAdv = 0;
  for (const t of ["p", "n", "b", "r", "q"]) {
    myAdv += (counts[myColor][t] - counts[opp][t]) * VAL[t];
  }
  const myCaptured: string[] = [];
  const oppCaptured: string[] = [];
  for (const t of ["q", "r", "b", "n", "p"]) {
    const myLost = Math.max(0, START[t] - counts[myColor][t]);
    const oppLost = Math.max(0, START[t] - counts[opp][t]);
    const symMap: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" };
    for (let i = 0; i < oppLost; i++) myCaptured.push(symMap[t]);
    for (let i = 0; i < myLost; i++) oppCaptured.push(symMap[t]);
  }
  const label = myAdv === 0 ? "even" : myAdv > 0 ? `+${myAdv}` : `${myAdv}`;
  return (
    <div className="plate p-2 px-3 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="smallcaps text-[10px] text-parchment-400">You</span>
        <span className="text-parchment-200 truncate font-mono text-base leading-none">{myCaptured.join("")}</span>
      </div>
      <span className={"font-mono font-semibold text-base " + (myAdv > 0 ? "text-gold-leaf" : myAdv < 0 ? "text-oxblood-glow" : "text-parchment-400")}>
        {label}
      </span>
      <div className="flex items-center gap-2 min-w-0 justify-end">
        <span className="text-parchment-200 truncate font-mono text-base leading-none">{oppCaptured.join("")}</span>
        <span className="smallcaps text-[10px] text-parchment-400">Opp</span>
      </div>
    </div>
  );
}

function ClockPill({ label, ms, active }: { label: string; ms: number; active: boolean }) {
  const low = ms < 30000;
  const critical = ms < 10000;
  return (
    <div
      className={
        "plate p-3 flex items-center justify-between gap-3 transition " +
        (active
          ? "border-gold/70 bg-gold/10 shadow-leaf"
          : "opacity-70")
      }
    >
      <span className="smallcaps text-[10px] text-parchment-400">{label}</span>
      <span
        className={
          "font-mono text-xl tabular-nums font-semibold " +
          (critical
            ? "text-oxblood-glow"
            : low
            ? "text-gold-leaf"
            : "text-parchment")
        }
      >
        {formatClock(ms)}
      </span>
    </div>
  );
}
