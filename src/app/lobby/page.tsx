"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getIdentity, setDisplayName, type Identity } from "@/lib/identity";
import {
  joinLobby,
  makeRoomCode,
  type ChallengeOffer,
  type LobbyHandle,
  type LobbyPlayer,
} from "@/lib/lobby";
import { TimeControlPicker } from "@/components/TimeControlPicker";
import { categoryOf, formatTC, type TimeControl } from "@/lib/timeControl";

interface OutgoingChallenge {
  toId: string;
  toName: string;
  code: string;
  timeSec: number;
  incSec: number;
  at: number;
}

export default function LobbyPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [tc, setTc] = useState<TimeControl>({ sec: 600, inc: 5 });
  const [incoming, setIncoming] = useState<ChallengeOffer | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingChallenge | null>(null);
  const handleRef = useRef<LobbyHandle | null>(null);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  useEffect(() => {
    if (!identity) return;
    let mounted = true;
    (async () => {
      try {
        const handle = await joinLobby({
          identity,
          initialTimeSec: tc.sec,
          initialIncSec: tc.inc,
          onPlayers: (p) => {
            if (!mounted) return;
            setPlayers(p);
          },
          onMessage: (m) => {
            if (!mounted) return;
            if (m.type === "challenge") {
              setIncoming((cur) => cur ?? m);
            } else if (m.type === "challenge-accept") {
              // Our challenge was accepted → navigate as the host.
              setOutgoing((o) => {
                if (o && o.code === m.code) {
                  router.push(`/friend?code=${m.code}&host=1&t=${o.timeSec}&inc=${o.incSec}`);
                }
                return null;
              });
            } else if (m.type === "challenge-decline") {
              setOutgoing((o) => (o && o.code === m.code ? null : o));
            }
          },
          onStatus: (s) => {
            if (!mounted) return;
            setStatus(s);
            if (s === "error") setError("Couldn't reach the lobby. Try refreshing.");
          },
        });
        if (!mounted) {
          await handle.leave();
          return;
        }
        handleRef.current = handle;
      } catch (e: any) {
        if (!mounted) return;
        setStatus("error");
        setError(String(e?.message || e));
      }
    })();
    return () => {
      mounted = false;
      handleRef.current?.leave();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  useEffect(() => {
    handleRef.current?.setTimePref(tc.sec, tc.inc);
  }, [tc]);

  // Auto-expire stale outgoing challenge after 30s with no reply.
  useEffect(() => {
    if (!outgoing) return;
    const t = setTimeout(() => setOutgoing(null), 30000);
    return () => clearTimeout(t);
  }, [outgoing]);

  const saveName = () => {
    const id = setDisplayName(draftName);
    setIdentity(id);
    setEditingName(false);
    // Re-join lobby so the new name propagates immediately.
    handleRef.current?.leave().then(() => {
      handleRef.current = null;
      // Triggering identity state change above re-runs the lobby effect.
    });
  };

  const challenge = async (p: LobbyPlayer) => {
    if (!identity) return;
    if (p.id === identity.id) return;
    if (outgoing) return;
    const code = makeRoomCode();
    setOutgoing({ toId: p.id, toName: p.name, code, timeSec: tc.sec, incSec: tc.inc, at: Date.now() });
    try {
      await handleRef.current?.sendChallenge(p.id, tc.sec, tc.inc, code);
    } catch {
      setOutgoing(null);
      setError("Couldn't send challenge. Try again.");
    }
  };

  const cancelOutgoing = async () => {
    if (!outgoing || !identity) return;
    try {
      await handleRef.current?.reply({
        type: "challenge-decline",
        from: identity.id,
        to: outgoing.toId,
        code: outgoing.code,
      });
    } catch {}
    setOutgoing(null);
  };

  const acceptIncoming = async () => {
    if (!incoming || !identity) return;
    await handleRef.current?.reply({
      type: "challenge-accept",
      from: identity.id,
      to: incoming.from,
      code: incoming.code,
    });
    const { code, timeSec, incSec } = incoming;
    setIncoming(null);
    router.push(`/friend?code=${code}&t=${timeSec}&inc=${incSec}`);
  };

  const declineIncoming = async () => {
    if (!incoming || !identity) return;
    await handleRef.current?.reply({
      type: "challenge-decline",
      from: identity.id,
      to: incoming.from,
      code: incoming.code,
    });
    setIncoming(null);
  };

  const otherPlayers = useMemo(
    () => players.filter((p) => p.id !== identity?.id),
    [players, identity],
  );

  return (
    <main className="min-h-screen pb-12">
      <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="text-gold-leaf">chess</span>
        </Link>
        <div className="flex gap-1 sm:gap-2 text-sm font-display">
          <Link href="/play" className="px-3 py-1.5 rounded-full hover:bg-white/5 text-parchment">vs Bot</Link>
          <Link href="/friend" className="px-3 py-1.5 rounded-full hover:bg-white/5 text-parchment">By code</Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6">
        <h1 className="font-display text-5xl">The Lobby</h1>
        <p className="mt-3 text-parchment-200">
          Pick a name, set your preferred time, and challenge someone here. Whoever&apos;s online shows up below.
        </p>

        <div className="mt-7 plate p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="smallcaps text-[11px] text-parchment-400">You are</div>
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={24}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      else if (e.key === "Escape") setEditingName(false);
                    }}
                    className="bg-ink-900/60 border border-white/15 rounded-full px-3 py-1 text-base font-display focus:outline-none focus:border-gold/60 text-parchment min-w-0 flex-1"
                  />
                  <button onClick={saveName} className="px-3 py-1 rounded-full btn-leaf text-xs font-display">Save</button>
                </div>
              ) : (
                <>
                  <span className="font-display text-lg text-gold-leaf">{identity?.name ?? "…"}</span>
                  <button
                    onClick={() => {
                      setDraftName(identity?.name ?? "");
                      setEditingName(true);
                    }}
                    className="text-xs text-parchment-300/70 hover:text-parchment underline"
                  >
                    rename
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 smallcaps text-[10px] text-parchment-400">
              <span
                className={
                  "w-1.5 h-1.5 rounded-full " +
                  (status === "connected"
                    ? "bg-verdigris animate-flicker"
                    : status === "error"
                    ? "bg-oxblood-glow"
                    : "bg-gold-leaf animate-flicker")
                }
              />
              {status === "connected" ? "Online" : status === "error" ? "Offline" : "Connecting…"}
            </div>
          </div>

          <TimeControlPicker value={tc} onChange={setTc} />
        </div>

        {error && (
          <div className="mt-5 plate p-3 px-4 border-oxblood-glow/60 bg-oxblood/15 text-parchment">
            {error}
          </div>
        )}

        <div className="mt-10 rule-ornament">
          <span>online · {otherPlayers.length}</span>
        </div>

        <div className="mt-6 space-y-2">
          {otherPlayers.length === 0 && status === "connected" && (
            <div className="plate p-5 text-center text-parchment-300/80">
              No one else here yet. Share the link with a friend and wait — or open this in another tab to test.
            </div>
          )}
          {otherPlayers.map((p) => {
            const ptc: TimeControl = { sec: p.timeSec, inc: p.incSec };
            return (
              <div key={p.id} className="plate p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg text-parchment flex items-center gap-2">
                    {p.name}
                    {p.rating !== undefined && (
                      <span className="text-xs font-mono text-parchment-300/80">({Math.round(p.rating)})</span>
                    )}
                  </div>
                  <div className="smallcaps text-[10px] text-parchment-400">
                    prefers {formatTC(ptc)} · {categoryOf(ptc)}
                  </div>
                </div>
                <button
                  onClick={() => challenge(p)}
                  disabled={!!outgoing}
                  className="px-5 py-2 rounded-full btn-leaf font-display text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Challenge
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Incoming challenge dialog */}
      {incoming && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center px-4 z-50">
          <div className="plate p-6 sm:p-8 max-w-md w-full text-center">
            <div className="smallcaps text-[11px] text-parchment-400">Incoming challenge</div>
            <div className="mt-3 font-display text-3xl text-gold-leaf">{incoming.fromName}</div>
            <div className="mt-2 text-parchment-200">
              wants to play — {formatTC({ sec: incoming.timeSec, inc: incoming.incSec })}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={acceptIncoming} className="px-6 py-2 rounded-full btn-leaf font-display">
                Accept
              </button>
              <button onClick={declineIncoming} className="px-6 py-2 rounded-full btn-ghost font-display">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing challenge banner */}
      {outgoing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 plate p-4 px-5 flex items-center gap-4 max-w-md z-40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-leaf animate-flicker" />
            <span className="text-sm">
              Waiting on <span className="text-gold-leaf font-display">{outgoing.toName}</span>…
            </span>
          </div>
          <button
            onClick={cancelOutgoing}
            className="px-3 py-1 rounded-full btn-ghost text-xs font-display"
          >
            Cancel
          </button>
        </div>
      )}
    </main>
  );
}
