"use client";

import { Drawback } from "@/engine/drawback";
import { motion } from "framer-motion";

interface Props {
  drawback: Drawback;
  revealed?: boolean;
  compact?: boolean;
  ownerLabel?: string;
}

const TIER_LABEL = ["", "Trivial", "Easy", "Common", "Severe", "Brutal"];
const TIER_ROMAN = ["", "I", "II", "III", "IV", "V"];

export function DrawbackCard({ drawback, revealed = true, compact = false, ownerLabel }: Props) {
  if (!revealed) {
    return (
      <div className="relative plate p-5 overflow-hidden">
        <Corners />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-gold/40 flex items-center justify-center font-display text-2xl text-gold/70 italic">?</div>
          <div>
            <div className="smallcaps text-[11px] text-parchment-400">{ownerLabel ?? "Opponent"}</div>
            <div className="font-display text-xl text-parchment/80">Hidden rule</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-parchment-300/80 leading-relaxed">
          You'll see their rule when the game ends.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative plate p-5 overflow-hidden tier-bg-${drawback.tier} border`}
    >
      <Corners />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="smallcaps text-[11px] text-parchment-400">
            {ownerLabel ?? "Your drawback"}
          </div>
          <div className={`font-display text-2xl leading-tight tier-${drawback.tier}`}>
            {drawback.name}
          </div>
        </div>
        <span
          className={`font-display italic text-sm px-2.5 py-0.5 rounded-sm border tier-bg-${drawback.tier} tier-${drawback.tier}`}
          title={`Tier ${drawback.tier}: ${TIER_LABEL[drawback.tier]}`}
        >
          {TIER_ROMAN[drawback.tier]}
        </span>
      </div>
      <div className="rule-ornament my-3 text-[10px]">
        <span className="font-display italic">{TIER_LABEL[drawback.tier]}</span>
      </div>
      <p className="text-[15px] leading-relaxed text-parchment/90">
        {drawback.description}
      </p>
      {!compact && drawback.flavor && (
        <p className="mt-3 text-[13px] italic text-parchment-300/80 font-display">
          &ldquo;{drawback.flavor}&rdquo;
        </p>
      )}
      {!drawback.implemented && (
        <div className="mt-3 smallcaps text-[10px] text-gold/80">
          Engine implementation pending
        </div>
      )}
    </motion.div>
  );
}

function Corners() {
  return (
    <>
      <span className="card-corner tl" />
      <span className="card-corner tr" />
      <span className="card-corner bl" />
      <span className="card-corner br" />
    </>
  );
}
