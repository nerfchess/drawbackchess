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
  // Optional inline rematch flow for multiplayer: shows a different label and
  // a status banner while waiting for the opponent to respond.
  rematchLabel?: string;
  rematchStatus?: "idle" | "offered" | "incoming" | "declined";
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
}

export function GameOver({
  result,
  whiteDrawback,
  blackDrawback,
  myColor,
  onRematch,
  rematchLabel,
  rematchStatus,
  onAcceptRematch,
  onDeclineRematch,
}: Props) {
  const won = result.winner === myColor;
  const draw = result.winner === "draw";
  const headline = draw ? "Draw" : won ? "You win!" : "You lose";
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
        <div className="absolute -top-24 -right-24 w-72 h-72 sigil opacity-30 animate-sigil pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-72 h-72 sigil opacity-20 animate-sigil pointer-events-none" style={{ animationDirection: "reverse" }} />

        <div className="relative text-center">
          <div className="smallcaps text-[11px] text-parchment-400">Game over</div>
          <div className={`mt-1 font-display text-6xl sm:text-7xl font-bold ${tone} animate-seal`}>
            {headline}
          </div>
          <div className="mt-2 text-sm text-parchment-300">{result.reason}</div>
        </div>

        <div className="mt-7 rule-ornament text-[11px]">
          <span className="font-display">The secret rules</span>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <DrawbackCard drawback={whiteDrawback} ownerLabel="White's drawback" />
          <DrawbackCard drawback={blackDrawback} ownerLabel="Black's drawback" />
        </div>

        {rematchStatus === "incoming" && onAcceptRematch && onDeclineRematch ? (
          <div className="mt-7 plate p-4 text-center border-gold/40 bg-gold/10">
            <div className="smallcaps text-[11px] text-parchment-300">Opponent wants a rematch</div>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={onAcceptRematch}
                className="px-5 py-2 rounded-full btn-leaf font-display text-sm"
              >
                Accept rematch
              </button>
              <button
                onClick={onDeclineRematch}
                className="px-5 py-2 rounded-full btn-ghost font-display text-sm"
              >
                Decline
              </button>
            </div>
          </div>
        ) : rematchStatus === "offered" ? (
          <div className="mt-7 text-center text-sm text-parchment-300 italic">
            Waiting for opponent to respond…
          </div>
        ) : rematchStatus === "declined" ? (
          <div className="mt-7 text-center text-sm text-oxblood-glow">
            Opponent declined the rematch.
          </div>
        ) : null}

        <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onRematch}
            disabled={rematchStatus === "offered"}
            className="px-6 py-3 rounded-full btn-leaf font-display text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rematchLabel ?? "New game"}
          </button>
          <Link
            href="/codex"
            className="px-6 py-3 rounded-full btn-ghost font-display text-center"
          >
            All the rules
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-full btn-ghost font-display text-center"
          >
            Home
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
