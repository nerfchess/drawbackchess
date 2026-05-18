"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Board } from "@/components/Board";
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
import { MPMessage, MPSession, SUPABASE_CONFIGURED } from "@/lib/multiplayer";
import { usePremoves } from "@/lib/premoves";
import { isMuted, playCapture, playCheck, playMove as playMoveSfx, setMuted } from "@/lib/sounds";
import { TimeControlPicker } from "@/components/TimeControlPicker";
import { TimeControl } from "@/lib/timeControl";
import { getIdentity, type Identity } from "@/lib/identity";
import { recordGameResult, type PlayerRating } from "@/lib/ratings";

type View = "setup" | "lobby" | "joining" | "game";

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

export default function FriendPageWrapper() {
  return (
    <Suspense fallback={null}>
      <FriendPage />
    </Suspense>
  );
}

function FriendPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("setup");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [tc, setTc] = useState<TimeControl>({ sec: 600, inc: 5 });
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);

  const [game, setGame] = useState<DrawbackGame | null>(null);
  const [myColor, setMyColor] = useState<Color>("w");
  const [whiteMs, setWhiteMs] = useState(0);
  const [blackMs, setBlackMs] = useState(0);
  const [incSec, setIncSec] = useState(0);
  const [rematchState, setRematchState] = useState<"idle" | "offered" | "incoming" | "declined">("idle");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [opponentMeta, setOpponentMeta] = useState<{ id?: string; name?: string }>({});
  const [ratingDelta, setRatingDelta] = useState<{ before: number; after: number } | null>(null);
  const ratedRef = useRef(false);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  const sessionRef = useRef<MPSession | null>(null);
  const clockEnabledRef = useRef(false);
  const initHandledRef = useRef(false);
  const lastInitSeedRef = useRef<number | null>(null);
  const myColorRef = useRef<Color>("w");
  const lastTcRef = useRef<TimeControl>({ sec: 600, inc: 0 });
  const rematchStateRef = useRef<"idle" | "offered" | "incoming" | "declined">("idle");
  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);
  useEffect(() => {
    rematchStateRef.current = rematchState;
  }, [rematchState]);

  useEffect(() => setMutedState(isMuted()), []);

  // If opened with ?code=XXXXX, auto-join. If also `host=1` (challenge-host),
  // auto-create with the provided time control. Plain `?code=XXXXX&t=600&inc=3`
  // (challenge guest) auto-joins.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = searchParams.get("code");
    const isHost = searchParams.get("host") === "1";
    const tParam = searchParams.get("t");
    const incParam = searchParams.get("inc");
    let parsedTc: TimeControl | null = null;
    if (tParam) {
      const t = parseInt(tParam, 10);
      const inc = incParam ? parseInt(incParam, 10) : 0;
      if (Number.isFinite(t) && t >= 0) {
        parsedTc = { sec: t, inc: Number.isFinite(inc) ? inc : 0 };
        setTc(parsedTc);
      }
    }
    if (!c) return;
    const clean = c.trim().toUpperCase().slice(0, 6);
    if (!clean) return;
    if (isHost) {
      setTimeout(() => handleCreateWithCode(clean, parsedTc ?? tc), 0);
    } else {
      setJoinCode(clean);
      setTimeout(() => handleJoinWith(clean), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    myColorRef.current = asColor;
    setWhiteMs(msg.timeSec * 1000);
    setBlackMs(msg.timeSec * 1000);
    setIncSec(msg.incSec ?? 0);
    clockEnabledRef.current = msg.timeSec > 0;
    lastTcRef.current = { sec: msg.timeSec, inc: msg.incSec ?? 0 };
    lastSentCount.current = 0;
    lastInitSeedRef.current = msg.seed;
    setRematchState("idle");
    initHandledRef.current = true;
    ratedRef.current = false;
    setRatingDelta(null);
    // Remember the opponent's identity (sent in the init via whiteId/blackId)
    // so we can record a rated result when the game ends.
    const oppColor = asColor === "w" ? "b" : "w";
    const oppId = oppColor === "w" ? msg.whiteId : msg.blackId;
    const oppName = (msg as any)[oppColor === "w" ? "whiteName" : "blackName"];
    setOpponentMeta({ id: oppId, name: oppName });
    setView("game");
  };

  // Either side of a finished game initiates the rematch by sending an offer.
  // When agreed, whichever side just played black generates the next init so
  // colors swap (their old guest becomes the new white).
  const startRematchAsBlackSide = () => {
    setRematchState("idle");
    if (myColorRef.current !== "b") return;
    const me = identity ?? getIdentity();
    const tcc = lastTcRef.current;
    const init: Extract<MPMessage, { type: "init" }> = {
      type: "init",
      whiteDrawbackId: pickRandomDrawback().id,
      blackDrawbackId: pickRandomDrawback().id,
      seed: makeSeed(),
      timeSec: tcc.sec,
      incSec: tcc.inc,
      // I just played black; now I'm white. Opponent goes in black.
      whiteId: me.id,
      whiteName: me.name,
      blackId: opponentMeta.id,
      blackName: opponentMeta.name,
    };
    sessionRef.current?.send(init);
    startGameFromInit(init, "w");
  };

  const offerRematch = () => {
    if (rematchStateRef.current !== "idle") return;
    setRematchState("offered");
    sessionRef.current?.send({ type: "rematch-offer" });
  };
  const acceptRematch = () => {
    sessionRef.current?.send({ type: "rematch-accept" });
    startRematchAsBlackSide();
  };
  const declineRematch = () => {
    sessionRef.current?.send({ type: "rematch-decline" });
    setRematchState("idle");
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
        // Host generates the entire game setup and sends it. We blast init
        // a few times because the data channel can briefly drop messages
        // right after onPeerJoin fires; the guest dedupes by checking if
        // game state already exists.
        const initMsg = payload as Extract<MPMessage, { type: "init" }>;
        const blast = (n: number) => {
          sess.send(initMsg);
          if (n > 0) setTimeout(() => blast(n - 1), 500);
        };
        blast(4);
        startGameFromInit(initMsg, "w");
      } else if (e.type === "host-ready" && role === "guest") {
        // Guest pings the host as soon as it sees them; the host re-sends
        // init in response, in case the host's first burst didn't land.
        sess.send({ type: "ping" });
      } else if (e.type === "message" && role === "host" && e.message.type === "ping") {
        // Guest is asking for init — re-send (first-game flow).
        if (payload) sess.send(payload as Extract<MPMessage, { type: "init" }>);
      } else if (e.type === "message" && e.message.type === "init") {
        // First-game guest path AND rematch receiver path. Dedupe by seed
        // because the original-game host blasts the same init 4 times.
        if (lastInitSeedRef.current === e.message.seed) return;
        startGameFromInit(e.message, "b");
        // Echo our identity back so the white side learns who we are.
        const me = identity ?? getIdentity();
        sess.send({ type: "peer-info", id: me.id, name: me.name });
      } else if (e.type === "message" && e.message.type === "peer-info") {
        setOpponentMeta({ id: e.message.id, name: e.message.name });
      } else if (e.type === "message" && e.message.type === "move") {
        // Opponent's move — apply locally, give them their increment.
        const incoming = e.message.move;
        setGame((g) => {
          if (!g) return g;
          const lm = legalMoves(g).find(
            (x) =>
              x.from === incoming.from &&
              x.to === incoming.to &&
              (x.promotion ?? null) === (incoming.promotion ?? null),
          );
          if (!lm) return g;
          const next = playMove(g, lm);
          if (lm.captured) playCapture();
          else playMoveSfx();
          if (isInCheck(next.board, next.board.turn)) setTimeout(playCheck, 80);
          if (clockEnabledRef.current && incSec > 0) {
            const add = incSec * 1000;
            // The moving side is the opponent of *my* color
            if (myColor === "w") setBlackMs((t) => t + add);
            else setWhiteMs((t) => t + add);
          }
          return { ...next };
        });
      } else if (e.type === "message" && e.message.type === "rematch-offer") {
        setRematchState((s) => (s === "offered" ? "idle" : "incoming"));
        // If both offered simultaneously, treat as mutual accept.
        if (rematchStateRef.current === "offered") {
          startRematchAsBlackSide();
        }
      } else if (e.type === "message" && e.message.type === "rematch-accept") {
        if (rematchStateRef.current === "offered") {
          startRematchAsBlackSide();
        }
      } else if (e.type === "message" && e.message.type === "rematch-decline") {
        setRematchState("declined");
        setTimeout(() => setRematchState("idle"), 2500);
      } else if (e.type === "message" && e.message.type === "resign") {
        setGame((g) => {
          if (!g) return g;
          g.result = { winner: myColor, reason: "opponent resigned" };
          return { ...g };
        });
      }
    });
  };

  const handleCreate = async () => handleCreateWithCode(null, tc);

  const handleCreateWithCode = async (presetCode: string | null, useTc: TimeControl) => {
    setError(null);
    setCode("");
    setView("lobby");
    const me = identity ?? getIdentity();
    const sess = new MPSession();
    sessionRef.current = sess;
    const init: Extract<MPMessage, { type: "init" }> = {
      type: "init",
      whiteDrawbackId: pickRandomDrawback().id,
      blackDrawbackId: pickRandomDrawback().id,
      seed: makeSeed(),
      timeSec: useTc.sec,
      incSec: useTc.inc,
      // Host plays white the first game; identity goes in the white slot.
      whiteId: me.id,
      whiteName: me.name,
    };
    wireSession(sess, "host", init);
    try {
      const c = await sess.host(presetCode ?? undefined);
      setCode(c);
    } catch (e: any) {
      setError(String(e?.message || e) || "Could not create a game.");
      setView("setup");
    }
  };

  const handleJoinWith = async (rawCode: string) => {
    setError(null);
    const trimmed = rawCode.trim().toUpperCase();
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
  const handleJoin = () => handleJoinWith(joinCode);

  // Apply one of our own legal moves: update local state, give us back our
  // increment, and send to peer.
  const applyMyMove = (m: Move) => {
    if (!game || game.result) return;
    const next = playMove(game, m);
    setGame({ ...next });
    if (clockEnabledRef.current && incSec > 0) {
      const add = incSec * 1000;
      if (myColor === "w") setWhiteMs((t) => t + add);
      else setBlackMs((t) => t + add);
    }
    sessionRef.current?.send({ type: "move", move: m });
    if (m.captured) playCapture();
    else playMoveSfx();
    if (isInCheck(next.board, next.board.turn)) setTimeout(playCheck, 80);
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

  const handleLocalMove = (m: Move) => {
    if (!game || game.result) return;
    if (game.board.turn !== myColor) {
      queuePremove(m);
      return;
    }
    const lm = moves.find(
      (x) => x.from === m.from && x.to === m.to && (x.promotion ?? null) === (m.promotion ?? null),
    );
    if (!lm) return;
    applyMyMove(lm);
  };

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

  // Apply Glicko-2 rating update once when a friend game ends. We only rate
  // games where we have both identities (lobby-initiated games always do).
  useEffect(() => {
    if (!game?.result || ratedRef.current) return;
    if (!identity || !opponentMeta.id || !opponentMeta.name) return;
    ratedRef.current = true;
    let score: 0 | 0.5 | 1;
    if (game.result.winner === "draw") score = 0.5;
    else if (game.result.winner === myColor) score = 1;
    else score = 0;
    recordGameResult(identity.id, identity.name, opponentMeta.id, opponentMeta.name, score)
      .then((r: { me: PlayerRating; opp: PlayerRating; oldMe: { rating: number } }) => {
        setRatingDelta({ before: r.oldMe.rating, after: r.me.rating });
      })
      .catch(() => {});
  }, [game?.result, identity, opponentMeta, myColor]);

  const onResign = () => {
    if (!game || game.result) return;
    sessionRef.current?.send({ type: "resign" });
    game.result = { winner: myColor === "w" ? "b" : "w", reason: "resignation" };
    setGame({ ...game });
  };

  const handleRematch = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    initHandledRef.current = false;
    setGame(null);
    clearPremoves();
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

          {!SUPABASE_CONFIGURED && (
            <div className="mt-5 plate p-4 px-5 border-gold/40 bg-gold/10 text-parchment text-sm leading-relaxed">
              <div className="font-display text-gold-leaf mb-1">Multiplayer needs setup</div>
              This site is missing its Supabase config, so friend games can&apos;t connect.
              Create a free project at <span className="font-mono">supabase.com</span>, then set
              <span className="font-mono"> NEXT_PUBLIC_SUPABASE_URL</span> and
              <span className="font-mono"> NEXT_PUBLIC_SUPABASE_ANON_KEY</span> in your deployment&apos;s env vars.
            </div>
          )}

          {error && (
            <div className="mt-5 plate p-3 px-4 border-oxblood-glow/60 bg-oxblood/15 text-parchment">
              {error}
            </div>
          )}

          <div className="mt-8 plate p-6 sm:p-7 space-y-6">
            <TimeControlPicker value={tc} onChange={setTc} />

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
          <div className="smallcaps text-[11px] text-parchment-400">
            {code ? "Share this code" : "Generating code…"}
          </div>
          <div className="mt-3 font-mono text-5xl tracking-[0.2em] text-gold-leaf min-h-[1.2em]">
            {code || "·····"}
          </div>
          <p className="mt-6 text-parchment-200">
            {code
              ? "Send the code to your friend — or just send them this link:"
              : "Setting up a private room. This usually takes a couple of seconds."}
          </p>
          {code && <ShareLink code={code} />}
          <div className="mt-8 flex items-center justify-center gap-2 smallcaps text-[11px] text-parchment-400">
            <span className="w-1.5 h-1.5 rounded-full bg-verdigris animate-flicker" />
            {code ? "Waiting for opponent…" : "Connecting to matchmaker…"}
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
          {clockEnabledRef.current && (
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
            onMove={handleLocalMove}
            myColor={myColor}
            lastMove={lastMove}
            disabled={!!game.result || premovePending}
            premoveMode={premoveMode}
            premoves={validPremoves}
            onCancelPremove={clearPremoves}
          />
          {clockEnabledRef.current && (
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
          onRematch={rematchState === "incoming" ? acceptRematch : offerRematch}
          rematchLabel={
            rematchState === "incoming"
              ? "Accept rematch"
              : rematchState === "offered"
              ? "Rematch offered…"
              : "Rematch"
          }
          rematchStatus={rematchState}
          onAcceptRematch={acceptRematch}
          onDeclineRematch={declineRematch}
          ratingDelta={ratingDelta}
        />
      )}
    </main>
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

function ShareLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined"
      ? `/friend?code=${code}`
      : `${window.location.origin}/friend?code=${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <div className="mt-4 flex items-center gap-2 max-w-md mx-auto">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 bg-ink-900/60 border border-white/15 rounded-sm px-3 py-2 text-xs font-mono text-parchment-200 focus:outline-none focus:border-gold/60"
      />
      <button
        onClick={copy}
        className="px-4 py-2 rounded-sm btn-ghost font-body text-xs whitespace-nowrap"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
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
        (active ? "border-gold/70 bg-gold/10 shadow-leaf" : "opacity-70")
      }
    >
      <span className="smallcaps text-[10px] text-parchment-400">{label}</span>
      <span
        className={
          "font-mono text-xl tabular-nums font-semibold " +
          (critical ? "text-oxblood-glow" : low ? "text-gold-leaf" : "text-parchment")
        }
      >
        {formatClock(ms)}
      </span>
    </div>
  );
}
