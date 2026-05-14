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
  DrawbackGame,
  legalMoves,
  makeContext,
  newGame,
  playMove,
  resign,
} from "@/engine/game";
import { makeSeed } from "@/engine/rng";
import { Color, Move } from "@/engine/types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

function pickRandomDrawback(): Drawback {
  const playable = PLAYABLE_DRAWBACKS.filter((d) => d.id !== "lucky");
  return playable[Math.floor(Math.random() * playable.length)];
}

export default function GamePageWrapper() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-white/60">Loading…</main>}>
      <GamePage />
    </Suspense>
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
  const aiThinking = useRef(false);

  useEffect(() => {
    const myDb =
      myDrawbackId === "random"
        ? pickRandomDrawback()
        : IMPLEMENTED_BY_ID[myDrawbackId] ?? pickRandomDrawback();
    const aiDb = pickRandomDrawback();
    const wDb = myColor === "w" ? myDb : aiDb;
    const bDb = myColor === "w" ? aiDb : myDb;
    setGame(newGame(wDb, bDb, makeSeed()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moves = useMemo(() => (game ? legalMoves(game) : []), [game]);

  // AI move
  useEffect(() => {
    if (!game || game.result) return;
    if (game.board.turn === myColor) return;
    if (aiThinking.current) return;
    aiThinking.current = true;
    const delay = difficulty === "easy" ? 300 : difficulty === "medium" ? 500 : 700;
    const tid = setTimeout(() => {
      const m = pickAIMove(game, difficulty);
      if (m) {
        const next = playMove(game, m);
        setGame({ ...next });
      } else {
        // No legal moves — game.result will be set already by playMove flow; force a result here too
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
    return (
      <main className="min-h-screen flex items-center justify-center text-white/60">
        Loading…
      </main>
    );
  }

  const myDrawback = myColor === "w" ? game.white.drawback : game.black.drawback;
  const myState = myColor === "w" ? game.white.state : game.black.state;
  const myCtx = makeContext(game, myColor);
  const visual = myDrawback.visual?.(myState, myCtx);
  const opponentDrawback = myColor === "w" ? game.black.drawback : game.white.drawback;
  const lastMove = game.board.history[game.board.history.length - 1] ?? null;

  const handleMove = (m: Move) => {
    if (game.result) return;
    if (game.board.turn !== myColor) return;
    const next = playMove(game, m);
    setGame({ ...next });
  };

  const handleRematch = () => router.push("/play");

  const onResign = () => {
    if (!game.result) {
      resign(game, myColor);
      setGame({ ...game });
    }
  };

  return (
    <main className="min-h-screen pb-12">
      <nav className="px-4 sm:px-6 py-4 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-lg tracking-tight">
          drawback<span className="text-accent">chess</span>
        </Link>
        <div className="text-xs text-white/40">
          You play {myColor === "w" ? "White" : "Black"} · AI: {difficulty}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>
              Turn: <span className={game.board.turn === myColor ? "text-emerald-300" : "text-rose-300"}>
                {game.board.turn === myColor ? "You" : "AI"}
              </span>
            </span>
            <button
              onClick={onResign}
              className="px-3 py-1 rounded-md border border-white/10 hover:bg-white/5 text-xs"
            >
              Resign
            </button>
          </div>
          <Board
            board={game.board}
            legalMoves={game.board.turn === myColor ? moves : []}
            orientation={myColor}
            onMove={handleMove}
            myColor={myColor}
            visual={visual}
            lastMove={lastMove}
            disabled={!!game.result || game.board.turn !== myColor}
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
