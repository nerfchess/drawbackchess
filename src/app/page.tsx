"use client";

import Link from "next/link";
import { DrawbackCard } from "@/components/DrawbackCard";
import { COWARDLY, FOG_OF_WAR, PACMAN, RISING_WATER } from "@/engine/drawbacks/implemented";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-display font-bold text-xl tracking-tight">
          drawback<span className="text-accent">chess</span>
        </Link>
        <div className="flex gap-1 sm:gap-3 text-sm">
          <Link href="/play" className="px-3 py-1.5 rounded-lg hover:bg-white/5">Play</Link>
          <Link href="/codex" className="px-3 py-1.5 rounded-lg hover:bg-white/5">Codex</Link>
          <Link href="/tutorial" className="px-3 py-1.5 rounded-lg hover:bg-white/5">How to play</Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-20 sm:pt-20 sm:pb-32 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-xs text-white/60 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            150+ drawbacks · single-player MVP live
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
            Chess,
            <br />
            <span className="text-accent glow-text">with secrets.</span>
          </h1>
          <p className="mt-6 text-lg text-white/70 max-w-lg leading-relaxed">
            Every game, you're assigned a hidden rule that restricts how you can play.
            So is your opponent. Win the game — and figure out their drawback before they figure out yours.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/play"
              className="px-6 py-3 rounded-xl bg-accent text-ink-950 font-semibold hover:bg-accent-glow transition shadow-glow"
            >
              Play vs AI
            </Link>
            <Link
              href="/codex"
              className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition"
            >
              Browse the codex
            </Link>
          </div>
          <div className="mt-6 flex items-center gap-6 text-xs text-white/40">
            <span>· No checkmate.</span>
            <span>· King can be captured.</span>
            <span>· King en passant.</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-tr from-accent/20 via-transparent to-violet-glow/20 blur-3xl rounded-full" />
          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 animate-float">
            <DrawbackCard drawback={FOG_OF_WAR} />
            <DrawbackCard drawback={COWARDLY} />
            <DrawbackCard drawback={RISING_WATER} />
            <DrawbackCard drawback={PACMAN} />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-5">
        {[
          {
            t: "Hidden information",
            d: "You see your drawback. They see theirs. Misreads are punished. Bluffs are rewarded.",
          },
          {
            t: "Modified rules",
            d: "Forget checkmate. The king is just another piece — capture it. Castle through check. King en passant exists.",
          },
          {
            t: "150+ drawbacks",
            d: "From “you can't move to the h-file” to “if any opponent pawn touches your half, you lose.”",
          },
        ].map((f) => (
          <div key={f.t} className="card-glass rounded-2xl p-5">
            <div className="font-display font-semibold text-lg">{f.t}</div>
            <p className="mt-2 text-sm text-white/60">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="px-6 py-10 text-center text-xs text-white/30">
        A reimagining of Drawback Chess, with a brand-new UI. Not affiliated with the original.
      </footer>
    </main>
  );
}
