import Link from "next/link";

const RULES = [
  {
    t: "No checkmate. No stalemate.",
    d: "The game ends only when a king is physically captured (or a drawback triggers a loss, or a player resigns).",
  },
  {
    t: "The king is a real piece.",
    d: "He can be captured like anything else. He can move into attacked squares. He can castle through, into, or out of check.",
  },
  {
    t: "King en passant.",
    d: "If your king moves through or out of an attacked square (typically while castling out of check), your opponent can capture him on their next move by playing any move that lands on a square he passed through.",
  },
  {
    t: "Drawbacks are secret.",
    d: "You see yours. You don't see your opponent's. Infer it from their play.",
  },
  {
    t: "Illegal-by-drawback moves are pre-filtered.",
    d: "The board only highlights moves you're actually allowed to make. Lose-condition drawbacks (\"you lose if X\") still trigger on their own.",
  },
  {
    t: "Distances are Chebyshev.",
    d: "When a drawback talks about distance, count the larger of file-difference and rank-difference — not Euclidean distance.",
  },
];

export default function TutorialPage() {
  return (
    <main className="min-h-screen pb-20">
      <nav className="px-6 py-5 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-xl tracking-tight">
          drawback<span className="text-accent">chess</span>
        </Link>
        <Link href="/play" className="text-sm text-white/60 hover:text-white">Play</Link>
      </nav>
      <section className="max-w-3xl mx-auto px-6 pt-6">
        <h1 className="font-display text-4xl sm:text-5xl font-bold">How to play</h1>
        <p className="mt-2 text-white/60">
          Drawback Chess is chess — until it isn't. The six rules below are everything you need to know.
        </p>
        <div className="mt-8 space-y-3">
          {RULES.map((r, i) => (
            <div key={i} className="card-glass rounded-2xl p-5">
              <div className="font-display text-lg font-semibold">
                <span className="text-accent mr-2">{i + 1}.</span>
                {r.t}
              </div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">{r.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <Link
            href="/play"
            className="px-5 py-2.5 rounded-xl bg-accent text-ink-950 font-semibold hover:bg-accent-glow transition"
          >
            Try a game
          </Link>
          <Link
            href="/codex"
            className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition"
          >
            Browse the codex
          </Link>
        </div>
      </section>
    </main>
  );
}
