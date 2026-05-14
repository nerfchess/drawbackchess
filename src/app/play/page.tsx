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

  const start = () => {
    const params = new URLSearchParams({
      mode: "ai",
      difficulty,
      color,
      drawback: drawbackId,
    });
    router.push(`/game?${params.toString()}`);
  };

  return (
    <main className="min-h-screen">
      <nav className="px-6 py-5 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-xl tracking-tight">
          drawback<span className="text-accent">chess</span>
        </Link>
        <Link href="/codex" className="text-sm text-white/60 hover:text-white">Codex</Link>
      </nav>

      <section className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-4xl font-bold">New game</h1>
        <p className="text-white/60 mt-2">Play against the local AI. Multiplayer is coming.</p>

        <div className="mt-8 space-y-6">
          <Group label="Difficulty">
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

          <Group label="Your drawback">
            <Pill selected={drawbackId === "random"} onClick={() => setDrawbackId("random")}>
              Surprise me
            </Pill>
            <Pill selected={drawbackId === "lucky"} onClick={() => setDrawbackId("lucky")}>
              None (Lucky)
            </Pill>
          </Group>

          <div>
            <div className="text-xs uppercase tracking-wide text-white/40 mb-2">
              Or pick a specific drawback to practice
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {PLAYABLE_DRAWBACKS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDrawbackId(d.id)}
                  className={
                    "text-left p-3 rounded-lg border text-sm transition " +
                    (drawbackId === d.id
                      ? `tier-bg-${d.tier} border-2`
                      : "border-white/10 hover:border-white/20")
                  }
                >
                  <div className={`font-semibold tier-${d.tier}`}>{d.name}</div>
                  <div className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{d.description}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={start}
            className="w-full py-3 rounded-xl bg-accent text-ink-950 font-semibold hover:bg-accent-glow transition"
          >
            Start game
          </button>
        </div>
      </section>
    </main>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-white/40 mb-2">{label}</div>
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
        "px-4 py-2 rounded-lg border transition " +
        (selected
          ? "bg-accent/15 border-accent text-accent-glow"
          : "border-white/10 text-white/70 hover:border-white/20")
      }
    >
      {children}
    </button>
  );
}
