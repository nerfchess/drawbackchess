"use client";

import { Board } from "@/components/Board";
import { DrawbackCard } from "@/components/DrawbackCard";
import { GameOver } from "@/components/GameOver";
import { MaterialBar } from "@/components/MaterialBar";
import { MoveList } from "@/components/MoveList";
import { AILevel, pickAIMove } from "@/engine/ai";
import { Drawback } from "@/engine/drawback";
import { IMPLEMENTED_BY_ID, PLAYABLE_DRAWBACKS } from "@/engine/drawbacks/library";
import {
  currentHint,
  DrawbackGame,
  makeContext,
  newGame,
  playMove,
  resign,
} from "@/engine/game";
import { makeSeed } from "@/engine/rng";
import { Color, Move } from "@/engine/types";
import { isInCheck } from "@/engine/board";
import { buildCustomDrawback, CustomDrawback } from "@/engine/drawbacks/custom";
import { usePremoves } from "@/lib/premoves";
import { isMuted, playCapture, playCheck, playDrawback, playMove as playMoveSfx, setMuted } from "@/lib/sounds";
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
  // t = seconds per side; 0 (or missing) disables the clock entirely.
  const initialTimeMs = useMemo(() => {
    const t = parseInt(params.get("t") ?? "0", 10);
    return Number.isFinite(t) && t > 0 ? t * 1000 : 0;
  }, [params]);
  const incSec = useMemo(() => {
    const i = parseInt(params.get("inc") ?? "0", 10);
    return Number.isFinite(i) && i > 0 ? i : 0;
  }, [params]);
  const clockEnabled = initialTimeMs > 0;

  const myColor: Color = useMemo(() => {
    if (myColorParam === "w") return "w";
    if (myColorParam === "b") return "b";
    return Math.random() < 0.5 ? "w" : "b";
  }, [myColorParam]);

  const [game, setGame] = useState<DrawbackGame | null>(null);
  const [, force] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [drawOfferStatus, setDrawOfferStatus] = useState<"idle" | "offering" | "declined">("idle");
  const [whiteMs, setWhiteMs] = useState(initialTimeMs);
  const [blackMs, setBlackMs] = useState(initialTimeMs);
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

  const applyMyMove = (m: Move) => {
    if (!game || game.result) return;
    const next = playMove(game, m);
    setGame({ ...next });
    if (clockEnabled && incSec > 0) {
      const add = incSec * 1000;
      if (myColor === "w") setWhiteMs((t) => t + add);
      else setBlackMs((t) => t + add);
    }
  };

  const {
    queue: queuePremove,
    clear: clearPremoves,
    moves,
    virtualBoard,
    validPremoves,
    premoveOptions,
    premoveMode,
    premovePending,
  } = usePremoves(game, myColor, applyMyMove);

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
        const next = playMove(game, m);
        setGame({ ...next });
        if (clockEnabled && incSec > 0) {
          const add = incSec * 1000;
          // AI just moved; AI is the opponent's color
          if (myColor === "w") setBlackMs((t) => t + add);
          else setWhiteMs((t) => t + add);
        }
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
      queuePremove(m);
      return;
    }
    const next = playMove(game, m);
    setGame({ ...next });
  };

  const cancelPremove = clearPremoves;

  const handleRematch = () => router.push("/play");

  const onResign = () => {
    if (!game.result) {
      resign(game, myColor);
      setGame({ ...game });
      clearPremoves();
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
        clearPremoves();
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
          {clockEnabled && (
            <ClockPill
              label="Opponent"
              ms={myColor === "w" ? blackMs : whiteMs}
              active={!game.result && game.board.turn !== myColor}
            />
          )}
          <MaterialBar board={game.board} side={myColor === "w" ? "b" : "w"} />
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
          <MaterialBar board={game.board} side={myColor} />
          {clockEnabled && (
            <ClockPill
              label="You"
              ms={myColor === "w" ? whiteMs : blackMs}
              active={!game.result && game.board.turn === myColor}
            />
          )}
        </div>
        <aside className="space-y-4">
          <DrawbackCard drawback={myDrawback} />
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
        />
      )}
    </main>
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
