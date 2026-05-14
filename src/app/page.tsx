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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-gold/30 bg-ink-900/50">
            <span className="w-1.5 h-1.5 rounded-full bg-verdigris-glow animate-flicker" />
            <span className="smallcaps text-[10px] text-parchment-300">
              the almanac · MMXXVI · vol. I
            </span>
          </div>

          <h1 className="mt-6 font-display text-[3.4rem] sm:text-[5.5rem] leading-[0.95] tracking-tight">
            <span className="block text-parchment">Chess.</span>
            <span className="block italic text-gold-leaf">With secrets.</span>
          </h1>

          <p className="dropcap mt-8 max-w-xl text-[17px] leading-[1.7] text-parchment-200">
            Each game, the dealer slips you a private rule. It restricts how you play. It will not be
            shown to your opponent, and theirs will not be shown to you. Win the game; deduce their
            curse before they deduce yours.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/play" className="px-7 py-3 rounded-sm btn-leaf font-display text-base font-semibold">
              Enter the parlour
            </Link>
            <Link href="/codex" className="px-7 py-3 rounded-sm btn-ghost font-display italic text-base">
              Browse the codex
            </Link>
          </div>

          <div className="mt-8 rule-ornament text-[11px] text-parchment-400">
            <span className="font-display italic">house rules</span>
          </div>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px] text-parchment-300/85 font-display italic">
            <li className="flex items-baseline gap-2"><span className="text-gold/70 not-italic">i.</span> No checkmate.</li>
            <li className="flex items-baseline gap-2"><span className="text-gold/70 not-italic">ii.</span> Capture the king.</li>
            <li className="flex items-baseline gap-2"><span className="text-gold/70 not-italic">iii.</span> King en passant.</li>
          </ul>
        </div>

        <div className="relative h-[440px] sm:h-[520px] overflow-hidden lg:overflow-visible">
          <div className="absolute -inset-12 sigil opacity-20 animate-sigil pointer-events-none" />
          <FloatCard className="absolute top-0 left-2 sm:left-8 -rotate-6">
            <DrawbackCard drawback={FOG_OF_WAR} />
          </FloatCard>
          <FloatCard className="absolute top-12 right-0 sm:right-2 rotate-3" delay={0.15}>
            <DrawbackCard drawback={COWARDLY} />
          </FloatCard>
          <FloatCard className="absolute bottom-12 left-6 sm:left-10 -rotate-2" delay={0.3}>
            <DrawbackCard drawback={RISING_WATER} />
          </FloatCard>
          <FloatCard className="absolute bottom-0 right-2 sm:right-12 rotate-6" delay={0.45}>
            <DrawbackCard drawback={PACMAN} />
          </FloatCard>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="rule-ornament text-[11px] text-parchment-400 mb-10">
          <span className="font-display italic">three things to know</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              n: "I",
              t: "Hidden information",
              d: "You see your drawback. They see theirs. A misread is punished. A bluff is rewarded.",
            },
            {
              n: "II",
              t: "Modified rules",
              d: "Forget checkmate. The king is just another piece; capture it. Castle through check. King en passant exists.",
            },
            {
              n: "III",
              t: "150+ drawbacks",
              d: "From “you cannot enter the h‑file” to “if any opponent pawn touches your half, you lose.”",
            },
          ].map((f) => (
            <article key={f.t} className="plate p-6 relative overflow-hidden">
              <span className="card-corner tl" />
              <span className="card-corner tr" />
              <span className="card-corner bl" />
              <span className="card-corner br" />
              <div className="font-display italic text-gold-leaf text-3xl leading-none">{f.n}</div>
              <div className="mt-3 font-display text-2xl text-parchment">{f.t}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-parchment-300/85">{f.d}</p>
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
        drawback<span className="italic text-gold-leaf">chess</span>
      </Link>
      <div className="flex gap-1 sm:gap-2 text-sm font-display italic">
        <Link href="/play" className="px-3 py-1.5 rounded-sm hover:bg-parchment/5 text-parchment">Play</Link>
        <Link href="/codex" className="px-3 py-1.5 rounded-sm hover:bg-parchment/5 text-parchment">Codex</Link>
        <Link href="/tutorial" className="px-3 py-1.5 rounded-sm hover:bg-parchment/5 text-parchment">House rules</Link>
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="max-w-6xl mx-auto px-6 py-10">
      <div className="rule-ornament text-[11px] text-parchment-400 mb-4">
        <span className="font-display italic">finis</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-parchment-400">
        <span className="font-display italic">A reimagining of Drawback Chess. Not affiliated with the original.</span>
        <span className="font-mono text-[10px] opacity-70">MMXXVI · printed on a Vercel press</span>
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
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={"w-[260px] " + className}
    >
      {children}
    </motion.div>
  );
}
