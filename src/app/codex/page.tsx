"use client";

import { DrawbackCard } from "@/components/DrawbackCard";
import { ALL_DRAWBACKS } from "@/engine/drawbacks/library";
import Link from "next/link";
import { useMemo, useState } from "react";

const TIER_LABEL = ["", "Trivial", "Easy", "Common", "Severe", "Brutal"];
const TIER_ROMAN = ["", "I", "II", "III", "IV", "V"];

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
      <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="italic text-gold-leaf">chess</span>
        </Link>
        <Link href="/play" className="text-sm font-display italic text-parchment hover:text-gold-leaf">Play</Link>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-4">
        <div className="smallcaps text-[11px] text-parchment-400">vol. I</div>
        <h1 className="font-display text-5xl sm:text-6xl mt-1">The Codex.</h1>
        <p className="mt-3 text-parchment-300/85 italic font-display">
          {ALL_DRAWBACKS.length} drawbacks cataloged. {implementedCount} are presently playable.
        </p>

        <div className="mt-7 plate p-4 sm:p-5 flex flex-wrap items-center gap-2 relative">
          <span className="card-corner tl" />
          <span className="card-corner tr" />
          <span className="card-corner bl" />
          <span className="card-corner br" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the index…"
            className="bg-ink-900/60 border border-parchment/15 rounded-sm px-3 py-2 text-sm font-body w-full sm:w-64 focus:outline-none focus:border-gold/60 text-parchment placeholder:text-parchment-400/60"
          />
          <div className="flex gap-1 flex-wrap">
            <FilterPill onClick={() => setTier(null)} active={tier === null}>
              All
            </FilterPill>
            {[1, 2, 3, 4, 5].map((t) => (
              <FilterPill
                key={t}
                onClick={() => setTier(t)}
                active={tier === t}
                tone={`tier-${t}`}
              >
                <span className="font-display italic mr-1">{TIER_ROMAN[t]}</span>
                {TIER_LABEL[t]}
              </FilterPill>
            ))}
          </div>
          <button
            onClick={() => setOnlyPlayable((p) => !p)}
            className={
              "px-3 py-1.5 rounded-sm border text-xs font-display italic " +
              (onlyPlayable ? "bg-verdigris/20 border-verdigris-glow text-verdigris-glow" : "border-parchment/15 text-parchment-300 hover:border-parchment/30")
            }
          >
            Playable only
          </button>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <DrawbackCard key={d.id} drawback={d} ownerLabel={`${TIER_ROMAN[d.tier]} · ${TIER_LABEL[d.tier]}`} />
          ))}
          {filtered.length === 0 && (
            <div className="text-parchment-300/60 italic font-display">
              The index has nothing to show under those filters.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  tone,
}: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-sm border text-xs font-display italic transition " +
        (active
          ? `bg-gold/15 border-gold text-gold-leaf ${tone ?? ""}`
          : `border-parchment/15 text-parchment-300 hover:border-parchment/30 ${tone ?? ""}`)
      }
    >
      {children}
    </button>
  );
}
