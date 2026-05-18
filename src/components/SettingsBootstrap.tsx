"use client";

import { useEffect } from "react";
import { applyBoardTheme, loadSettings } from "@/lib/settings";
import { setVolume } from "@/lib/sounds";

export function SettingsBootstrap() {
  useEffect(() => {
    const s = loadSettings();
    applyBoardTheme(s.boardTheme);
    setVolume(s.volume);
  }, []);
  return null;
}
