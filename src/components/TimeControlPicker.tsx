"use client";

import { useState } from "react";
import { formatTC, PRESETS, tcKey, TimeControl } from "@/lib/timeControl";

interface Props {
  value: TimeControl;
  onChange: (tc: TimeControl) => void;
}

export function TimeControlPicker({ value, onChange }: Props) {
  const [custom, setCustom] = useState(false);
  const [customMin, setCustomMin] = useState(value.sec === 0 ? 5 : value.sec / 60);
  const [customInc, setCustomInc] = useState(value.inc);

  const applyCustom = (mn: number, inc: number) => {
    const safeMin = Math.max(0, Math.min(180, Math.round(mn * 10) / 10));
    const safeInc = Math.max(0, Math.min(60, Math.round(inc)));
    onChange({ sec: Math.round(safeMin * 60), inc: safeInc });
  };

  const onMinChange = (mn: number) => {
    setCustomMin(mn);
    applyCustom(mn, customInc);
  };
  const onIncChange = (inc: number) => {
    setCustomInc(inc);
    applyCustom(customMin, inc);
  };

  return (
    <div>
      <div className="smallcaps text-[11px] text-parchment-400 mb-2">Time control</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setCustom(false);
            onChange({ sec: 0, inc: 0 });
          }}
          className={
            "px-3 py-1.5 rounded-full text-xs font-display transition border " +
            (!custom && value.sec === 0
              ? "bg-gold/20 border-gold text-gold-leaf"
              : "border-white/15 text-parchment-300 hover:border-white/30")
          }
        >
          Unlimited
        </button>
        {PRESETS.map((p) => {
          const selected = !custom && tcKey(value) === tcKey(p);
          return (
            <button
              key={tcKey(p)}
              onClick={() => {
                setCustom(false);
                onChange(p);
              }}
              className={
                "px-3 py-1.5 rounded-full text-xs font-display transition border " +
                (selected
                  ? "bg-gold/20 border-gold text-gold-leaf"
                  : "border-white/15 text-parchment-300 hover:border-white/30")
              }
            >
              {formatTC(p)}
            </button>
          );
        })}
        <button
          onClick={() => {
            setCustom(true);
            applyCustom(customMin, customInc);
          }}
          className={
            "px-3 py-1.5 rounded-full text-xs font-display transition border " +
            (custom
              ? "bg-gold/20 border-gold text-gold-leaf"
              : "border-white/15 text-parchment-300 hover:border-white/30")
          }
        >
          Custom
        </button>
      </div>
      {custom && (
        <div className="mt-3 plate p-4 space-y-3 bg-ink-900/40">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="smallcaps text-[10px] text-parchment-400">Minutes per side</span>
              <span className="font-mono text-sm text-gold-leaf">{customMin}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="60"
              step="0.5"
              value={customMin}
              onChange={(e) => onMinChange(parseFloat(e.target.value))}
              className="w-full mt-1 accent-gold"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="smallcaps text-[10px] text-parchment-400">Increment in seconds</span>
              <span className="font-mono text-sm text-gold-leaf">{customInc}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={customInc}
              onChange={(e) => onIncChange(parseInt(e.target.value, 10))}
              className="w-full mt-1 accent-gold"
            />
          </div>
        </div>
      )}
    </div>
  );
}
