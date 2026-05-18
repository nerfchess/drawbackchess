"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { DrawbackCard } from "@/components/DrawbackCard";
import { COWARDLY, FOG_OF_WAR, PACMAN, RISING_WATER } from "@/engine/drawbacks/implemented";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteNav />

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
        <div className="animate-rise">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 border-y border-gold/30">
            <span className="w-1 h-1 rounded-full bg-gold-leaf animate-flicker" />
            <span className="smallcaps text-[10px] text-gold-leaf">
              150+ secret rules
            </span>
          </div>

          <h1 className="mt-7 font-display font-normal text-5xl sm:text-7xl leading-[1.02] tracking-[-0.02em]">
            <span className="block text-parchment">Chess,</span>
            <span className="block italic text-gold-leaf">with secrets.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-parchment-200">
            Every game, you get a secret rule that changes how you can move.
            So does your opponent. Win the game, and figure out their rule before they figure out yours.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/play" className="px-7 py-3 rounded-sm btn-leaf font-body text-base">
              Play now
            </Link>
            <Link href="/friend" className="px-7 py-3 rounded-sm btn-ghost font-body">
              Play a friend
            </Link>
            <Link href="/codex" className="px-7 py-3 rounded-sm btn-ghost font-body">
              Browse the rules
            </Link>
          </div>

          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm text-parchment-200/90 border-t border-parchment/10 pt-5">
            <li className="flex items-baseline gap-2"><span className="font-display italic text-gold-leaf text-xs">i.</span> No checkmate</li>
            <li className="flex items-baseline gap-2"><span className="font-display italic text-gold-leaf text-xs">ii.</span> Capture the king</li>
            <li className="flex items-baseline gap-2"><span className="font-display italic text-gold-leaf text-xs">iii.</span> King en passant</li>
          </ul>
        </div>

        <div className="relative h-[440px] sm:h-[520px] overflow-hidden lg:overflow-visible">
          <div className="absolute -inset-16 sigil opacity-90 pointer-events-none" />
          <FloatCard className="absolute top-0 left-2 sm:left-8 -rotate-6">
            <DrawbackCard drawback={FOG_OF_WAR} />
          </FloatCard>
          <FloatCard className="absolute top-12 right-0 sm:right-2 rotate-3" delay={0.1}>
            <DrawbackCard drawback={COWARDLY} />
          </FloatCard>
          <FloatCard className="absolute bottom-12 left-6 sm:left-10 -rotate-2" delay={0.2}>
            <DrawbackCard drawback={RISING_WATER} />
          </FloatCard>
          <FloatCard className="absolute bottom-0 right-0 sm:right-2 rotate-6" delay={0.3}>
            <DrawbackCard drawback={PACMAN} />
          </FloatCard>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rule-ornament mb-12">
          <span>Three things to know</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              n: "I",
              t: "Hidden information",
              d: "You see your rule. They see theirs. A misread is punished. A bluff is rewarded.",
            },
            {
              n: "II",
              t: "Modified rules",
              d: "Forget checkmate. The king is just another piece you can capture. Castle through check. King en passant exists.",
            },
            {
              n: "III",
              t: "150+ rules",
              d: "From “you can't move to the h-file” to “if any enemy pawn touches your half, you lose.”",
            },
          ].map((f) => (
            <article key={f.t} className="plate p-7 relative overflow-hidden">
              <div className="font-display italic text-gold-leaf text-4xl leading-none tracking-tight">{f.n}</div>
              <div className="mt-5 font-display text-2xl text-parchment leading-tight">{f.t}</div>
              <p className="mt-3 text-[14px] leading-relaxed text-parchment-200/90">{f.d}</p>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SiteNav() {
  return (
    <nav className="px-6 py-6 flex items-center justify-between max-w-6xl mx-auto">
      <Link href="/" className="font-display text-2xl tracking-tight">
        drawback<span className="text-gold-leaf">chess</span>
      </Link>
      <div className="flex gap-1 sm:gap-2 text-sm font-display">
        <Link href="/play" className="px-3 py-1.5 rounded-full hover:bg-white/5 text-parchment">Play</Link>
        <Link href="/codex" className="px-3 py-1.5 rounded-full hover:bg-white/5 text-parchment">Rules</Link>
        <Link href="/tutorial" className="px-3 py-1.5 rounded-full hover:bg-white/5 text-parchment">How to play</Link>
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-parchment-400">
        <span>A reimagining of Drawback Chess. Not affiliated with the original.</span>
        <span className="font-mono text-[10px] opacity-70">made with ♥</span>
      </div>
    </footer>
  );
}

function FloatCard({
  children,
  className = "",
  delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={"w-[260px] " + className}
    >
      {children}
    </motion.div>
  );
}
