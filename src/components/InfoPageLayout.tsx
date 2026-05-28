import Link from "next/link";
import type { ReactNode } from "react";

type InfoPageLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function InfoPageLayout({
  eyebrow,
  title,
  intro,
  children,
}: InfoPageLayoutProps) {
  return (
    <main className="min-h-screen pb-20">
      <nav className="px-6 py-6 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="text-gold-leaf">chess</span>
        </Link>
        <Link
          href="/play"
          className="px-3 py-1.5 rounded-full text-sm font-display hover:bg-white/5 text-parchment"
        >
          Play
        </Link>
      </nav>

      <section className="max-w-3xl mx-auto px-6 pt-4">
        <div className="smallcaps text-[11px] text-parchment-400">{eyebrow}</div>
        <h1 className="font-display text-5xl sm:text-6xl mt-1">{title}</h1>
        <p className="mt-5 text-[16px] leading-[1.7] text-parchment-200">{intro}</p>
        <div className="mt-9 space-y-4">{children}</div>
      </section>
    </main>
  );
}

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="plate p-6 sm:p-7">
      <h2 className="font-display text-2xl text-parchment">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-parchment-200/90">
        {children}
      </div>
    </section>
  );
}
