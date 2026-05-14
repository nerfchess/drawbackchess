"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DrawbackCard } from "./DrawbackCard";
import { Drawback } from "@/engine/drawback";
import { GameResult } from "@/engine/game";
import { Color } from "@/engine/types";

interface Props {
  result: GameResult;
  whiteDrawback: Drawback;
  blackDrawback: Drawback;
  myColor: Color;
  onRematch: () => void;
}

export function GameOver({ result, whiteDrawback, blackDrawback, myColor, onRematch }: Props) {
  const won = result.winner === myColor;
  const draw = result.winner === "draw";
  const headline = draw ? "Draw" : won ? "Victory" : "Defeat";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 22 }}
        className="card-glass rounded-3xl p-6 sm:p-8 max-w-3xl w-full"
      >
        <div className="text-center">
          <div
            className={
              "font-display text-5xl sm:text-6xl font-bold glow-text " +
              (won ? "text-emerald-300" : draw ? "text-sky-300" : "text-rose-300")
            }
          >
            {headline}
          </div>
          <div className="mt-2 text-sm text-white/60">{result.reason}</div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <DrawbackCard drawback={whiteDrawback} ownerLabel="White's drawback" />
          <DrawbackCard drawback={blackDrawback} ownerLabel="Black's drawback" />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onRematch}
            className="px-5 py-2.5 rounded-xl bg-accent text-ink-950 font-semibold hover:bg-accent-glow transition"
          >
            New game
          </button>
          <Link
            href="/codex"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 text-center transition"
          >
            Browse codex
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 text-center transition"
          >
            Home
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
