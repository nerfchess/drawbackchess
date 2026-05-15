"use client";

import { Board } from "@/components/Board";
import { generateMoves, makeMove } from "@/engine/board";
import { BoardState, Color, Move, PieceType, SQ } from "@/engine/types";
import Link from "next/link";
import { useMemo, useState } from "react";

function blankBoard(turn: Color = "w"): BoardState {
  return {
    pieces: Array(64).fill(null),
    turn,
    castling: { wk: false, wq: false, bk: false, bq: false },
    epTarget: null,
    kingPassThrough: [],
    kingPassColor: null,
    halfmove: 0,
    fullmove: 1,
    history: [],
  };
}

function place(b: BoardState, sq: number, type: PieceType, color: Color) {
  b.pieces[sq] = { type, color };
}

interface Step {
  title: string;
  intro: string;
  setup: () => BoardState;
  goalText: string;
  isComplete: (move: Move, board: BoardState) => boolean;
  // optional follow-up move from the "opponent" to demo a rule
  reply?: (board: BoardState) => Move | null;
  closing: string;
}

const STEPS: Step[] = [
  {
    title: "I. Capture the king.",
    intro:
      "There is no checkmate. The king is just another piece on the board: when you can take him, you take him. Your white rook stands on e1. The black king awaits on e4.",
    setup: () => {
      const b = blankBoard("w");
      place(b, SQ(4, 0), "r", "w"); // e1
      place(b, SQ(4, 3), "k", "b"); // e4
      place(b, SQ(0, 0), "k", "w"); // a1 (so neither side has a missing king)
      return b;
    },
    goalText: "Move the rook to e4 and capture the king.",
    isComplete: (m) => m.captured === "k",
    closing:
      "The game ends the instant a king is captured. No mate, no stalemate; only a body on the floor.",
  },
  {
    title: "II. Castle through anything.",
    intro:
      "Standard chess forbids castling through check. Drawback Chess does not. Your kingside is being raked by a black rook. Castle anyway.",
    setup: () => {
      const b = blankBoard("w");
      // white setup, kingside castling rights only
      place(b, SQ(4, 0), "k", "w"); // e1
      place(b, SQ(7, 0), "r", "w"); // h1
      place(b, SQ(0, 0), "r", "w"); // a1 (decorative)
      // black king
      place(b, SQ(4, 7), "k", "b"); // e8
      // black rook attacking f-file
      place(b, SQ(5, 6), "r", "b"); // f7 attacks f1..f6
      b.castling.wk = true;
      return b;
    },
    goalText: "Castle kingside (O-O). The king strolls through fire.",
    isComplete: (m) => m.castle === "k",
    closing:
      "His majesty walked through an attacked square. In any other variant, that's illegal. Here, it is simply Tuesday.",
  },
  {
    title: "III. King en passant.",
    intro:
      "Because a king can pass through an attacked square, the opponent gets one chance to punish him. Any move that lands on a square he passed through captures him.",
    setup: () => {
      const b = blankBoard("b");
      // The white king just walked from e1 to e3, passing through e2.
      // Black has a knight on c1 that attacks e2: kep-territory.
      place(b, SQ(4, 2), "k", "w"); // e3 (the king's current square)
      place(b, SQ(0, 0), "r", "w"); // a1 (just for ambience)
      place(b, SQ(2, 0), "n", "b"); // c1 attacks e2
      place(b, SQ(4, 7), "k", "b"); // e8
      b.kingPassThrough = [SQ(4, 1)]; // e2
      b.kingPassColor = "w";
      return b;
    },
    goalText:
      "Black to play. The white king passed through e2. Capture him there with the knight.",
    isComplete: (m) => m.isKingEnPassant === true || m.captured === "k",
    closing:
      "Any move landing on a square the king passed through captures him, even though he is no longer on it.",
  },
];

export default function TutorialWalkthroughPage() {
  const [stepIx, setStepIx] = useState(0);
  const [board, setBoard] = useState<BoardState>(() => STEPS[0].setup());
  const [done, setDone] = useState(false);

  const step = STEPS[stepIx];

  const moves = useMemo(() => {
    if (done) return [];
    return generateMoves(board).filter((m) => step.isComplete(m, board));
  }, [board, done, step]);

  const onMove = (m: Move) => {
    if (!step.isComplete(m, board)) return;
    setBoard(makeMove(board, m));
    setDone(true);
  };

  const nextStep = () => {
    const i = stepIx + 1;
    if (i >= STEPS.length) {
      window.location.href = "/play";
      return;
    }
    setStepIx(i);
    setBoard(STEPS[i].setup());
    setDone(false);
  };

  const restart = () => {
    setBoard(step.setup());
    setDone(false);
  };

  return (
    <main className="min-h-screen pb-20">
      <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="text-gold-leaf">chess</span>
        </Link>
        <Link href="/tutorial" className="px-3 py-1.5 rounded-full text-sm font-display hover:bg-white/5 text-parchment">
          ← House rules
        </Link>
      </nav>

      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="smallcaps text-[11px] text-parchment-400">
          interactive walkthrough · step {stepIx + 1} of {STEPS.length}
        </div>
        <h1 className="font-display text-3xl sm:text-5xl mt-1">{step.title}</h1>
        <p className="mt-3 max-w-2xl text-parchment-200/95 leading-relaxed">{step.intro}</p>
        <div className="mt-4 plate p-3 px-4 inline-block border-gold/50 bg-gold/10">
          <span className="font-display text-[15px] text-gold-leaf">{step.goalText}</span>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-6">
          <Board
            board={board}
            legalMoves={done ? [] : moves}
            orientation={board.turn}
            onMove={onMove}
            myColor={board.turn}
            disabled={done}
          />
          <aside className="space-y-3">
            {done && (
              <div className="plate p-5 border-verdigris-glow/50 bg-verdigris/10">
                <div className="smallcaps text-[11px] text-verdigris-glow">well played</div>
                <p className="mt-2 text-parchment leading-relaxed">{step.closing}</p>
                <button
                  onClick={nextStep}
                  className="mt-4 w-full py-3 rounded-full btn-leaf font-display"
                >
                  {stepIx + 1 < STEPS.length ? "Next lesson →" : "Play a real game →"}
                </button>
              </div>
            )}
            {!done && (
              <div className="plate p-5">
                <div className="smallcaps text-[11px] text-parchment-400">hint</div>
                <p className="mt-2 text-parchment-200/95 text-sm leading-relaxed">
                  The board only highlights moves that complete this lesson.
                  Click a piece, then its destination.
                </p>
                <button
                  onClick={restart}
                  className="mt-4 w-full py-2 rounded-full btn-ghost font-display text-sm"
                >
                  Reset the position
                </button>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
