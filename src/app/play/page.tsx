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
      <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="italic text-gold-leaf">chess</span>
        </Link>
        <Link href="/codex" className="text-sm font-display italic text-parchment hover:text-gold-leaf">The Codex</Link>
      </nav>

      <section className="max-w-2xl mx-auto px-6 py-10">
        <div className="smallcaps text-[11px] text-parchment-400">a fresh hand</div>
        <h1 className="font-display text-5xl mt-1">New game.</h1>
        <p className="mt-3 text-parchment-300/85 italic font-display">
          Sit at the cabinet. The dealer will assign your curse, and the AI&apos;s.
        </p>

        <div className="mt-10 plate p-6 sm:p-7 space-y-7 relative">
          <span className="card-corner tl" />
          <span className="card-corner tr" />
          <span className="card-corner bl" />
          <span className="card-corner br" />

          <Group label="Cabinet difficulty">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Pill key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
                {d[0].toUpperCase() + d.slice(1)}
              </Pill>
            ))}
          </Group>

          <Group label="Your colour">
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
            <div className="smallcaps text-[11px] text-parchment-400 mb-2">
              or pick a specific drawback to study
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {PLAYABLE_DRAWBACKS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDrawbackId(d.id)}
                  className={
                    "text-left p-3 rounded-sm border transition " +
                    (drawbackId === d.id
                      ? `tier-bg-${d.tier} border-2`
                      : "border-parchment/15 hover:border-parchment/30 bg-ink-900/40")
                  }
                >
                  <div className={`font-display text-base tier-${d.tier}`}>{d.name}</div>
                  <div className="text-[11px] text-parchment-300/70 mt-0.5 line-clamp-2 leading-snug">{d.description}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={start}
            className="w-full py-3.5 rounded-sm btn-leaf font-display text-lg font-semibold"
          >
            Deal me in
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
        "px-4 py-2 rounded-sm border font-display italic transition " +
        (selected
          ? "bg-gold/15 border-gold text-gold-leaf"
          : "border-parchment/15 text-parchment-200 hover:border-parchment/30")
      }
    >
      {children}
    </button>
  );
}
