"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import { DrawbackCard } from "./DrawbackCard";
import { Drawback } from "@/engine/drawback";
import { GameResult } from "@/engine/game";
import { Color } from "@/engine/types";
import { playGameOver } from "@/lib/sounds";

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
  const headline = draw ? "A Draw" : won ? "Victory" : "Defeat";
  const tone = draw ? "text-bruise-glow" : won ? "text-gold-leaf" : "text-oxblood-glow";

  useEffect(() => {
    playGameOver();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 22 }}
        className="plate gilt p-6 sm:p-10 max-w-3xl w-full relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-72 h-72 sigil opacity-40 animate-sigil pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-72 h-72 sigil opacity-30 animate-sigil pointer-events-none" style={{ animationDirection: "reverse" }} />

        <div className="relative text-center">
          <div className="smallcaps text-[11px] text-parchment-400">The Verdict</div>
          <div className={`mt-1 font-display text-6xl sm:text-7xl italic ${tone} animate-seal`}>
            {headline}
          </div>
          <div className="mt-2 text-sm text-parchment-300 italic">{result.reason}</div>
        </div>

        <div className="mt-7 rule-ornament text-[11px]">
          <span className="font-display italic">The drawbacks unsealed</span>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <DrawbackCard drawback={whiteDrawback} ownerLabel="White's drawback" />
          <DrawbackCard drawback={blackDrawback} ownerLabel="Black's drawback" />
        </div>

        <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onRematch}
            className="px-6 py-2.5 rounded-sm btn-leaf font-display text-base font-semibold"
          >
            New game
          </button>
          <Link
            href="/codex"
            className="px-6 py-2.5 rounded-sm btn-ghost font-display italic text-center"
          >
            The Codex
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-sm btn-ghost font-display italic text-center"
          >
            Return
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
