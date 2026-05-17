"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PLAYABLE_DRAWBACKS } from "@/engine/drawbacks/library";

export default function PlayPage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [color, setColor] = useState<"w" | "b" | "random">("random");
  const [drawbackId, setDrawbackId] = useState<string>("random");
  // Time control in seconds per side; 0 = unlimited (no clock)
  const [timeSec, setTimeSec] = useState<number>(600);

  const start = () => {
    const params = new URLSearchParams({
      mode: "ai",
      difficulty,
      color,
      drawback: drawbackId,
      t: String(timeSec),
    });
    router.push(`/game?${params.toString()}`);
  };

  return (
    <main className="min-h-screen">
      <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="text-gold-leaf">chess</span>
        </Link>
        <Link href="/codex" className="px-3 py-1.5 rounded-full text-sm font-display hover:bg-white/5 text-parchment">Rules</Link>
      </nav>

      <section className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-display text-5xl">New game</h1>
        <p className="mt-3 text-parchment-200">
          Pick how you want to play. You'll get a random secret rule (or pick one to practice).
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/friend"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-sm btn-ghost font-body text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Play a Friend
          </Link>
        </div>

        <div className="mt-8 plate p-6 sm:p-7 space-y-6">
          <Group label="Bot strength">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Pill key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
                {d[0].toUpperCase() + d.slice(1)}
              </Pill>
            ))}
          </Group>

          <Group label="Your color">
            <Pill selected={color === "w"} onClick={() => setColor("w")}>White</Pill>
            <Pill selected={color === "random"} onClick={() => setColor("random")}>Random</Pill>
            <Pill selected={color === "b"} onClick={() => setColor("b")}>Black</Pill>
          </Group>

          <Group label="Time per side">
            {([
              { s: 0, l: "Unlimited" },
              { s: 180, l: "3 min" },
              { s: 300, l: "5 min" },
              { s: 600, l: "10 min" },
              { s: 1800, l: "30 min" },
            ] as const).map(({ s, l }) => (
              <Pill key={s} selected={timeSec === s} onClick={() => setTimeSec(s)}>
                {l}
              </Pill>
            ))}
          </Group>

          <Group label="Your secret rule">
            <Pill selected={drawbackId === "random"} onClick={() => setDrawbackId("random")}>
              Surprise me
            </Pill>
            <Pill selected={drawbackId === "lucky"} onClick={() => setDrawbackId("lucky")}>
              None (Lucky)
            </Pill>
          </Group>

          <div>
            <div className="smallcaps text-[11px] text-parchment-400 mb-2">
              Or pick a specific rule to practice
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {PLAYABLE_DRAWBACKS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDrawbackId(d.id)}
                  className={
                    "text-left p-3 rounded-2xl border transition " +
                    (drawbackId === d.id
                      ? `tier-bg-${d.tier} border-2 shadow-leaf`
                      : "border-white/10 hover:border-white/25 bg-ink-900/40")
                  }
                >
                  <div className={`font-display text-base tier-${d.tier}`}>{d.name}</div>
                  <div className="text-[11px] text-parchment-300/80 mt-0.5 line-clamp-2 leading-snug">{d.description}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={start}
            className="w-full py-3.5 rounded-full btn-leaf font-display text-lg flex items-center justify-center gap-2"
          >
            Start game
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </section>
    </main>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="smallcaps text-[11px] text-parchment-400 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 rounded-full border font-display transition " +
        (selected
          ? "bg-gold/20 border-gold text-gold-leaf shadow-leaf"
          : "border-white/15 text-parchment-200 hover:border-white/30 hover:bg-white/5")
      }
    >
      {children}
    </button>
  );
}
