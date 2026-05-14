"use client";

import { DrawbackCard } from "@/components/DrawbackCard";
import { ALL_DRAWBACKS } from "@/engine/drawbacks/library";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function CodexPage() {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<number | null>(null);
  const [onlyPlayable, setOnlyPlayable] = useState(false);

  const filtered = useMemo(() => {
    return ALL_DRAWBACKS.filter((d) => {
      if (tier && d.tier !== tier) return false;
      if (onlyPlayable && !d.implemented) return false;
      if (q && !(`${d.name} ${d.description}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [q, tier, onlyPlayable]);

  const implementedCount = ALL_DRAWBACKS.filter((d) => d.implemented).length;

  return (
    <main className="min-h-screen pb-20">
      <nav className="px-6 py-5 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-xl tracking-tight">
          drawback<span className="text-accent">chess</span>
        </Link>
        <Link href="/play" className="text-sm text-white/60 hover:text-white">Play</Link>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-6">
        <h1 className="font-display text-4xl sm:text-5xl font-bold">The Codex</h1>
        <p className="mt-2 text-white/60">
          {ALL_DRAWBACKS.length} drawbacks cataloged · {implementedCount} playable in the MVP.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search drawbacks…"
            className="bg-ink-800 border border-white/10 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:border-accent/50"
          />
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setTier(null)}
              className={
                "px-3 py-1.5 rounded-lg border text-xs " +
                (tier === null ? "bg-accent/15 border-accent" : "border-white/10 hover:border-white/20")
              }
            >
              All tiers
            </button>
            {[1, 2, 3, 4, 5].map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={
                  "px-3 py-1.5 rounded-lg border text-xs " +
                  (tier === t ? `tier-bg-${t} border-2` : "border-white/10 hover:border-white/20") +
                  ` tier-${t}`
                }
              >
                {["", "Trivial", "Easy", "Medium", "Hard", "Brutal"][t]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOnlyPlayable((p) => !p)}
            className={
              "px-3 py-1.5 rounded-lg border text-xs " +
              (onlyPlayable ? "bg-emerald-500/15 border-emerald-400 text-emerald-300" : "border-white/10")
            }
          >
            Playable only
          </button>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <DrawbackCard key={d.id} drawback={d} ownerLabel={`Tier ${d.tier}`} />
          ))}
          {filtered.length === 0 && (
            <div className="text-white/40">No drawbacks match those filters.</div>
          )}
        </div>
      </section>
    </main>
  );
}
