"use client";

import { useEffect, useState } from "react";
import { BOARD_THEMES, BoardTheme, loadSettings, saveSettings } from "@/lib/settings";
import { setVolume } from "@/lib/sounds";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const [theme, setTheme] = useState<BoardTheme>("wood");
  const [vol, setVol] = useState(0.8);

  useEffect(() => {
    const s = loadSettings();
    setTheme(s.boardTheme);
    setVol(s.volume);
  }, [open]);

  if (!open) return null;

  const update = (next: { boardTheme?: BoardTheme; volume?: number }) => {
    const merged = { boardTheme: next.boardTheme ?? theme, volume: next.volume ?? vol };
    saveSettings(merged);
    if (next.boardTheme) setTheme(next.boardTheme);
    if (next.volume != null) {
      setVol(next.volume);
      setVolume(next.volume);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="plate gilt p-6 w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-2xl text-parchment">Settings</div>
          <button
            onClick={onClose}
            className="text-parchment-400 hover:text-parchment text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <div className="smallcaps text-[11px] text-parchment-400 mb-2">Board theme</div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((k) => {
                const t = BOARD_THEMES[k];
                const selected = theme === k;
                return (
                  <button
                    key={k}
                    onClick={() => update({ boardTheme: k })}
                    className={
                      "flex items-center gap-3 p-2 border transition " +
                      (selected ? "border-gold/70 bg-gold/10" : "border-white/10 hover:border-white/25")
                    }
                  >
                    <span className="grid grid-cols-2 grid-rows-2 w-8 h-8 overflow-hidden">
                      <span style={{ background: t.light }} />
                      <span style={{ background: t.dark }} />
                      <span style={{ background: t.dark }} />
                      <span style={{ background: t.light }} />
                    </span>
                    <span className="font-display text-sm text-parchment">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="smallcaps text-[11px] text-parchment-400">Volume</span>
              <span className="font-mono text-[11px] text-parchment-300">{Math.round(vol * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={vol}
              onChange={(e) => update({ volume: parseFloat(e.target.value) })}
              className="w-full accent-gold-leaf"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
