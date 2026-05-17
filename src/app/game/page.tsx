"use client";

import { Board } from "@/components/Board";
import { DrawbackCard } from "@/components/DrawbackCard";
import { GameOver } from "@/components/GameOver";
import { MoveList } from "@/components/MoveList";
import { AILevel, pickAIMove } from "@/engine/ai";
import { Drawback } from "@/engine/drawback";
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

function pickRandomDrawback(): Drawback {
  const playable = PLAYABLE_DRAWBACKS.filter((d) => d.id !== "lucky");
  return playable[Math.floor(Math.random() * playable.length)];
}

// Pseudo-legal premove options on a (turn-flipped) board, including moves that
// would land on a friendly piece. The friendly-target moves get `captured` set
// to the friendly's type as a placeholder, so the QueuedPremove records the
// user's capture intent. At real-turn execute time we re-validate against
// actual legal moves; the move only plays if the destination is actually an
// enemy piece by then.
function premoveOptionsFor(board: BoardState, me: Color): Move[] {
  const base = generateMoves(board);
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
  return [...base, ...extras];
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
  const { virtualBoard, validPremoves } = useMemo(() => {
    if (!game || game.result || game.board.turn === myColor) {
      return { virtualBoard: null as BoardState | null, validPremoves: [] as QueuedPremove[] };
    }
    let board = cloneBoard(game.board);
    board.turn = myColor;
    board.epTarget = null;
    const valid: QueuedPremove[] = [];
    for (const pm of premoves) {
      const options = premoveOptionsFor(board, myColor);
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
  }, [game, myColor, premoves]);

  const premoveOptions = useMemo<Move[]>(() => {
    if (!virtualBoard) return [];
    return premoveOptionsFor(virtualBoard, myColor);
  }, [virtualBoard, myColor]);

  const premoveMode = !!virtualBoard;

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
            <button
              onClick={onResign}
              className="px-4 py-1.5 rounded-full border border-oxblood/40 bg-oxblood/10 text-oxblood-glow hover:bg-oxblood/20 hover:border-oxblood/70 transition text-xs font-display font-semibold tracking-wide"
            >
              Resign
            </button>
          </div>
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
          <Board
            board={virtualBoard ?? game.board}
            legalMoves={game.board.turn === myColor ? moves : premoveOptions}
            orientation={myColor}
            onMove={handleMove}
            myColor={myColor}
            visual={{ ...(visual ?? {}), highlightSquares: forcedSquares }}
            lastMove={lastMove}
            disabled={!!game.result}
            premoveMode={premoveMode}
            premoves={validPremoves}
            onCancelPremove={cancelPremove}
          />
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
