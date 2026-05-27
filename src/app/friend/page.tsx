"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board, QueuedPremove } from "@/components/Board";
import { DrawbackCard } from "@/components/DrawbackCard";
import { GameOver } from "@/components/GameOver";
import { MoveList } from "@/components/MoveList";
import { isInCheck } from "@/engine/board";
import { IMPLEMENTED_BY_ID, PLAYABLE_DRAWBACKS } from "@/engine/drawbacks/library";
import {
  DrawbackGame,
  legalMoves,
  newGame,
  playMove,
} from "@/engine/game";
import { makeSeed } from "@/engine/rng";
import { Color, Move } from "@/engine/types";
import { MPMessage, MPSession } from "@/lib/multiplayer";
import { isMuted, playCapture, playCheck, playMove as playMoveSfx, setMuted } from "@/lib/sounds";

type View = "setup" | "lobby" | "joining" | "game";

const TIME_STEPS_SEC = [
  5,
  10,
  15,
  20,
  30,
  45,
  60,
  90,
  120,
  150,
  180,
  ...range(5 * 60, 10 * 60, 60),
  ...range(12 * 60, 30 * 60, 2 * 60),
  ...range(35 * 60, 2 * 60 * 60, 5 * 60),
];

function pickRandomDrawback() {
  const pool = PLAYABLE_DRAWBACKS.filter((d) => d.id !== "lucky");
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10000) return `0:0${(clamped / 1000).toFixed(1)}`;
  const totalSec = Math.ceil(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FriendPage() {
  const [view, setView] = useState<View>("setup");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [baseSec, setBaseSec] = useState(600);
  const [incrementSec, setIncrementSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);

  const [game, setGame] = useState<DrawbackGame | null>(null);
  const [myColor, setMyColor] = useState<Color>("w");
  const [whiteMs, setWhiteMs] = useState(0);
  const [blackMs, setBlackMs] = useState(0);
  const [premoves, setPremoves] = useState<QueuedPremove[]>([]);

  const sessionRef = useRef<MPSession | null>(null);
  const clockEnabledRef = useRef(false);
  const incrementMsRef = useRef(0);

  useEffect(() => setMutedState(isMuted()), []);

  // Outgoing move signal — when the local game gets a move from our side, send
  // it to the peer. We dedupe by move count: only send moves we just played.
  const lastSentCount = useRef(0);

  useEffect(() => {
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  const startGameFromInit = (msg: Extract<MPMessage, { type: "init" }>, asColor: Color) => {
    const w = IMPLEMENTED_BY_ID[msg.whiteDrawbackId] ?? pickRandomDrawback();
    const b = IMPLEMENTED_BY_ID[msg.blackDrawbackId] ?? pickRandomDrawback();
    setGame(newGame(w, b, msg.seed));
    setMyColor(asColor);
    setWhiteMs(msg.timeSec * 1000);
    setBlackMs(msg.timeSec * 1000);
    clockEnabledRef.current = msg.timeSec > 0;
    incrementMsRef.current = (msg.incrementSec ?? 0) * 1000;
    lastSentCount.current = 0;
    setView("game");
  };

  const addIncrement = (color: Color) => {
    if (!clockEnabledRef.current || incrementMsRef.current <= 0) return;
    if (color === "w") setWhiteMs((t) => t + incrementMsRef.current);
    else setBlackMs((t) => t + incrementMsRef.current);
  };

  // Set up the session event handler. We do this once a session exists so we
  // can react to guest joining / host init / opponent moves / disconnect.
  const wireSession = (sess: MPSession, role: "host" | "guest", payload?: any) => {
    sess.on((e) => {
      if (e.type === "error") {
        setError(e.message);
      } else if (e.type === "disconnected") {
        setError("Opponent disconnected.");
      } else if (e.type === "guest-connected" && role === "host") {
        // Host generates the entire game setup and sends it.
        const initMsg = payload as Extract<MPMessage, { type: "init" }>;
        sess.send(initMsg);
        startGameFromInit(initMsg, "w");
      } else if (e.type === "message" && role === "guest" && e.message.type === "init") {
        startGameFromInit(e.message, "b");
      } else if (e.type === "message" && e.message.type === "move") {
        // Opponent's move — apply locally
        const incoming = e.message.move;
        setGame((g) => {
          if (!g) return g;
          // Find the matching legal move (so engine state is consistent)
          const lm = legalMoves(g).find(
            (x) =>
              x.from === incoming.from &&
              x.to === incoming.to &&
              (x.promotion ?? null) === (incoming.promotion ?? null),
          );
          if (!lm) return g;
          const mover = g.board.turn;
          const next = playMove(g, lm);
          addIncrement(mover);
          if (lm.captured) playCapture();
          else playMoveSfx();
          if (isInCheck(next.board, next.board.turn)) setTimeout(playCheck, 80);
          return { ...next };
        });
      } else if (e.type === "message" && e.message.type === "resign") {
        setGame((g) => {
          if (!g) return g;
          g.result = { winner: myColor, reason: "opponent resigned" };
          return { ...g };
        });
      }
    });
  };

  const handleCreate = async () => {
    setError(null);
    const sess = new MPSession();
    sessionRef.current = sess;
    // Pre-generate game setup so it's ready when the guest joins.
    const init: Extract<MPMessage, { type: "init" }> = {
      type: "init",
      whiteDrawbackId: pickRandomDrawback().id,
      blackDrawbackId: pickRandomDrawback().id,
      seed: makeSeed(),
      timeSec: baseSec,
      incrementSec,
    };
    wireSession(sess, "host", init);
    try {
      const c = await sess.host();
      setCode(c);
      setView("lobby");
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const handleJoin = async () => {
    setError(null);
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a code.");
      return;
    }
    const sess = new MPSession();
    sessionRef.current = sess;
    wireSession(sess, "guest");
    setView("joining");
    try {
      await sess.join(trimmed);
      // game starts on receipt of `init` from host
    } catch (e: any) {
      setError(String(e?.message || e) || "Failed to connect — check the code.");
      setView("setup");
    }
  };

  const moves = useMemo(() => (game ? legalMoves(game) : []), [game]);

  const handleLocalMove = (m: Move) => {
    if (!game || game.result) return;
    if (game.board.turn !== myColor) {
      setPremoves((q) => [
        ...q,
        { from: m.from, to: m.to, promotion: m.promotion, capture: !!m.captured },
      ]);
      return;
    }
    const lm = moves.find(
      (x) => x.from === m.from && x.to === m.to && (x.promotion ?? null) === (m.promotion ?? null),
    );
    if (!lm) return;
    const next = playMove(game, lm);
    setGame({ ...next });
    addIncrement(myColor);
    sessionRef.current?.send({ type: "move", move: lm });
    if (lm.captured) playCapture();
    else playMoveSfx();
    if (isInCheck(next.board, next.board.turn)) setTimeout(playCheck, 80);
  };

  // Execute queued premove when our turn comes
  useEffect(() => {
    if (!game || game.result || premoves.length === 0) return;
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
      addIncrement(myColor);
      setPremoves((q) => q.slice(1));
      sessionRef.current?.send({ type: "move", move: m });
      if (m.captured) playCapture();
      else playMoveSfx();
    }, 90);
    return () => clearTimeout(tid);
  }, [game, premoves, moves, myColor]);

  // Clock tick
  useEffect(() => {
    if (!clockEnabledRef.current || !game || game.result) return;
    const id = setInterval(() => {
      const dec = (t: number) => Math.max(0, t - 100);
      if (game.board.turn === "w") setWhiteMs(dec);
      else setBlackMs(dec);
    }, 100);
    return () => clearInterval(id);
  }, [game]);

  // Timeout loss
  useEffect(() => {
    if (!clockEnabledRef.current || !game || game.result) return;
    if (whiteMs <= 0) {
      game.result = { winner: "b", reason: "white ran out of time" };
      setGame({ ...game });
    } else if (blackMs <= 0) {
      game.result = { winner: "w", reason: "black ran out of time" };
      setGame({ ...game });
    }
  }, [whiteMs, blackMs, game]);

  const onResign = () => {
    if (!game || game.result) return;
    sessionRef.current?.send({ type: "resign" });
    game.result = { winner: myColor === "w" ? "b" : "w", reason: "resignation" };
    setGame({ ...game });
  };

  const handleRematch = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setGame(null);
    setPremoves([]);
    setView("setup");
    setCode("");
    setJoinCode("");
    setError(null);
  };

  // -------- Setup view --------
  if (view === "setup") {
    return (
      <main className="min-h-screen">
        <SiteNav />
        <section className="max-w-2xl mx-auto px-6 py-8">
          <h1 className="font-display text-5xl">Play a Friend</h1>
          <p className="mt-3 text-parchment-200">
            Create a game and share the code, or join one with a code your friend sent you.
            Both players get a random secret rule.
          </p>

          {error && (
            <div className="mt-5 plate p-3 px-4 border-oxblood-glow/60 bg-oxblood/15 text-parchment">
              {error}
            </div>
          )}

          <div className="mt-8 plate p-6 sm:p-7 space-y-6">
            <div className="space-y-4">
              <TimeSlider
                label="Time per Side"
                value={baseSec}
                values={[0, ...TIME_STEPS_SEC]}
                display={baseSec === 0 ? "Unlimited" : formatTimeControl(baseSec)}
                formatEdgeLabel={formatTimeControl}
                onChange={setBaseSec}
              />
              <TimeSlider
                label="Increment (Seconds)"
                value={incrementSec}
                values={range(0, 30, 1)}
                display={String(incrementSec)}
                disabled={baseSec === 0}
                onChange={setIncrementSec}
              />
            </div>

            <button
              onClick={handleCreate}
              className="w-full py-3.5 rounded-sm btn-leaf font-body text-lg"
            >
              Create game
            </button>

            <div className="rule-ornament">
              <span>or</span>
            </div>

            <div>
              <div className="smallcaps text-[11px] text-parchment-400 mb-2">Join with a code</div>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCDE"
                  maxLength={6}
                  className="flex-1 bg-ink-900/60 border border-white/15 rounded-sm px-4 py-3 text-lg font-mono tracking-widest uppercase focus:outline-none focus:border-gold/60 text-parchment placeholder:text-parchment-400/40"
                />
                <button
                  onClick={handleJoin}
                  disabled={!joinCode.trim()}
                  className="px-5 rounded-sm btn-ghost font-body disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // -------- Lobby (host waiting) --------
  if (view === "lobby") {
    return (
      <main className="min-h-screen">
        <SiteNav />
        <section className="max-w-xl mx-auto px-6 py-12 text-center">
          <div className="smallcaps text-[11px] text-parchment-400">Share this code</div>
          <div className="mt-3 font-mono text-5xl tracking-[0.2em] text-gold-leaf">{code}</div>
          <p className="mt-6 text-parchment-200">
            Send the code to your friend. They open this page and tap “Join”.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 smallcaps text-[11px] text-parchment-400">
            <span className="w-1.5 h-1.5 rounded-full bg-verdigris animate-flicker" />
            Waiting for opponent…
          </div>
          {error && (
            <div className="mt-6 plate p-3 px-4 border-oxblood-glow/60 bg-oxblood/15 text-parchment">
              {error}
            </div>
          )}
          <button
            onClick={handleRematch}
            className="mt-8 px-5 py-2 rounded-sm btn-ghost font-body"
          >
            Cancel
          </button>
        </section>
      </main>
    );
  }

  // -------- Joining (guest connecting) --------
  if (view === "joining") {
    return (
      <main className="min-h-screen">
        <SiteNav />
        <section className="max-w-xl mx-auto px-6 py-12 text-center">
          <div className="smallcaps text-[11px] text-parchment-400">Connecting…</div>
          <div className="mt-3 font-mono text-4xl tracking-[0.2em] text-gold-leaf">{joinCode}</div>
          {error && (
            <div className="mt-6 plate p-3 px-4 border-oxblood-glow/60 bg-oxblood/15 text-parchment">
              {error}
            </div>
          )}
        </section>
      </main>
    );
  }

  // -------- Game view --------
  if (!game) return null;
  const myDrawback = myColor === "w" ? game.white.drawback : game.black.drawback;
  const opponentDrawback = myColor === "w" ? game.black.drawback : game.white.drawback;
  const lastMove = game.board.history[game.board.history.length - 1] ?? null;

  return (
    <main className="min-h-screen pb-12">
      <SiteNav />
      <div className="max-w-6xl mx-auto px-3 sm:px-6 grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-display text-parchment-200">
              <span className="smallcaps text-[11px] text-parchment-400 mr-2">vs Friend</span>
              <span className="text-gold-leaf font-semibold">{code || joinCode}</span>
            </span>
            <button
              onClick={onResign}
              className="px-4 py-1.5 rounded-full border border-oxblood/40 bg-oxblood/10 text-oxblood-glow hover:bg-oxblood/20 transition text-xs font-display font-semibold tracking-wide"
            >
              Resign
            </button>
          </div>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_8.5rem] gap-3 sm:gap-4 items-stretch">
            <Board
              board={game.board}
              legalMoves={game.board.turn === myColor ? moves : []}
              orientation={myColor}
              onMove={handleLocalMove}
              myColor={myColor}
              lastMove={lastMove}
              disabled={!!game.result}
              premoveMode={game.board.turn !== myColor && !game.result}
              premoves={premoves}
              onCancelPremove={() => setPremoves([])}
            />
            {clockEnabledRef.current && (
              <div className="grid grid-cols-2 sm:grid-cols-1 sm:grid-rows-[auto_1fr_auto] gap-3 sm:h-full">
                <ClockPill
                  label="Opponent"
                  ms={myColor === "w" ? blackMs : whiteMs}
                  active={!game.result && game.board.turn !== myColor}
                />
                <div className="hidden sm:block" />
                <ClockPill
                  label="You"
                  ms={myColor === "w" ? whiteMs : blackMs}
                  active={!game.result && game.board.turn === myColor}
                />
              </div>
            )}
          </div>
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

function range(start: number, end: number, step: number) {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(value);
  }
  return values;
}

function formatTimeControl(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  return `${minutes}:${remainingSec.toString().padStart(2, "0")}`;
}

function TimeSlider({
  label,
  value,
  values,
  display,
  disabled = false,
  formatEdgeLabel = String,
  onChange,
}: {
  label: string;
  value: number;
  values: number[];
  display: string;
  disabled?: boolean;
  formatEdgeLabel?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const index = Math.max(0, values.indexOf(value));

  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="flex items-center justify-between mb-2">
        <div className="smallcaps text-[11px] text-parchment-400">{label}</div>
        <div className="font-mono text-sm text-gold-leaf tabular-nums">{display}</div>
      </div>
      <input
        type="range"
        min={0}
        max={values.length - 1}
        step={1}
        value={index}
        disabled={disabled}
        onChange={(e) => onChange(values[Number(e.target.value)])}
        className="w-full accent-gold-leaf disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-parchment-400">
        <span>{formatEdgeLabel(values[0])}</span>
        <span>{formatEdgeLabel(values[values.length - 1])}</span>
      </div>
    </div>
  );
}

function SiteNav() {
  return (
    <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
      <Link href="/" className="font-display text-2xl tracking-tight">
        drawback<span className="text-gold-leaf">chess</span>
      </Link>
      <Link href="/play" className="px-3 py-1.5 rounded-full text-sm font-display hover:bg-white/5 text-parchment">
        vs Bot
      </Link>
    </nav>
  );
}

function ClockPill({ ms, active }: { label: string; ms: number; active: boolean }) {
  const low = ms < 30000;
  const critical = ms < 10000;
  return (
    <div
      className={
        "plate px-3 py-1 flex items-center justify-center transition " +
        (active ? "border-gold/70 bg-gold/10 shadow-leaf" : "opacity-70")
      }
    >
      <span
        className={
          "font-mono text-xl sm:text-2xl tabular-nums font-semibold " +
          (critical ? "text-oxblood-glow" : low ? "text-gold-leaf" : "text-parchment")
        }
      >
        {formatClock(ms)}
      </span>
    </div>
  );
}
