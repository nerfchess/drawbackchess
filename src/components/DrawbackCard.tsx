"use client";

import { Drawback } from "@/engine/drawback";
import { motion } from "framer-motion";

interface Props {
  drawback: Drawback;
  revealed?: boolean;
  compact?: boolean;
  ownerLabel?: string;
}

const TIER_LABEL = ["", "Trivial", "Easy", "Medium", "Hard", "Brutal"];

export function DrawbackCard({ drawback, revealed = true, compact = false, ownerLabel }: Props) {
  if (!revealed) {
    return (
      <div className="card-glass rounded-2xl p-5 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ink-800 flex items-center justify-center text-xl">
            ?
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">
              {ownerLabel ?? "Opponent"}
            </div>
            <div className="font-display font-semibold text-white/70">
              Hidden drawback
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/40 italic">
          Their secret rule is revealed when the game ends.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-glass rounded-2xl p-5 border tier-bg-${drawback.tier}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">
            {ownerLabel ?? "Your drawback"}
          </div>
          <div className={`font-display text-xl font-semibold tier-${drawback.tier}`}>
            {drawback.name}
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full tier-bg-${drawback.tier} tier-${drawback.tier} border`}
        >
          {TIER_LABEL[drawback.tier]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        {drawback.description}
      </p>
      {!compact && drawback.flavor && (
        <p className="mt-2 text-xs italic text-white/50">"{drawback.flavor}"</p>
      )}
      {!drawback.implemented && (
        <div className="mt-3 text-[10px] uppercase tracking-wider text-amber-400/80">
          ⚙ Engine implementation coming soon
        </div>
      )}
    </motion.div>
  );
}
