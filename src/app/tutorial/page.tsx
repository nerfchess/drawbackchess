import Link from "next/link";

const RULES = [
  {
    n: "I",
    t: "No checkmate. No stalemate.",
    d: "The game ends only when a king is physically captured (or a drawback triggers a loss, or a player resigns).",
  },
  {
    n: "II",
    t: "The king is a real piece.",
    d: "He can be captured like anything else. He can move into attacked squares. He can castle through, into, or out of check.",
  },
  {
    n: "III",
    t: "King en passant.",
    d: "If your king moves through an attacked square (typically while castling out of check), your opponent can capture him on their next move by playing any move that lands on a square he passed through.",
  },
  {
    n: "IV",
    t: "Drawbacks are secret.",
    d: "You see yours. You do not see your opponent’s. Infer it from their play.",
  },
  {
    n: "V",
    t: "Illegal-by-drawback moves are pre-filtered.",
    d: "The board only highlights moves you are actually allowed to make. Lose-condition drawbacks (“you lose if X”) still trigger on their own.",
  },
  {
    n: "VI",
    t: "Distances are Chebyshev.",
    d: "When a drawback talks about distance, count the larger of file-difference and rank-difference. Not Euclidean.",
  },
];

export default function TutorialPage() {
  return (
    <main className="min-h-screen pb-20">
      <nav className="px-6 py-6 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="italic text-gold-leaf">chess</span>
        </Link>
        <Link href="/play" className="text-sm font-display italic text-parchment hover:text-gold-leaf">Play</Link>
      </nav>
      <section className="max-w-3xl mx-auto px-6 pt-4">
        <div className="smallcaps text-[11px] text-parchment-400">a brief manual</div>
        <h1 className="font-display text-5xl sm:text-6xl mt-1">House rules.</h1>
        <p className="dropcap mt-5 text-[16px] leading-[1.7] text-parchment-200">
          Drawback Chess is chess; until it isn&apos;t. The six rules below are everything a player
          needs to know to sit down with a fresh hand. Everything else is in the curse you were dealt.
        </p>
        <div className="mt-9 space-y-3">
          {RULES.map((r) => (
            <div key={r.n} className="plate p-5 sm:p-6 relative">
              <span className="card-corner tl" />
              <span className="card-corner tr" />
              <span className="card-corner bl" />
              <span className="card-corner br" />
              <div className="flex items-baseline gap-3">
                <span className="font-display italic text-gold-leaf text-2xl">{r.n}.</span>
                <div className="font-display text-2xl text-parchment leading-tight">{r.t}</div>
              </div>
              <p className="mt-2 ml-9 text-[15px] leading-relaxed text-parchment-200/90">{r.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 flex gap-3">
          <Link
            href="/play"
            className="px-6 py-2.5 rounded-sm btn-leaf font-display font-semibold"
          >
            Sit at the cabinet
          </Link>
          <Link
            href="/codex"
            className="px-6 py-2.5 rounded-sm btn-ghost font-display italic"
          >
            Browse the codex
          </Link>
        </div>
      </section>
    </main>
  );
}
