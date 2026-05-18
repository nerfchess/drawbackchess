// Per-user settings stored in localStorage. Currently covers board theme and
// sound volume. Plain functions, no React; pages subscribe via small hooks.

export type BoardTheme = "wood" | "green" | "blue" | "slate";

export interface Settings {
  boardTheme: BoardTheme;
  volume: number; // 0..1
}

const STORAGE_KEY = "dc:settings-v1";
const DEFAULT: Settings = { boardTheme: "wood", volume: 0.8 };

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; label: string }> = {
  wood:  { light: "#e8dcc0", dark: "#8d6e4b", label: "Wood" },
  green: { light: "#eeeed2", dark: "#769656", label: "Green" },
  blue:  { light: "#dee3e6", dark: "#788a94", label: "Blue" },
  slate: { light: "#cfd1d5", dark: "#52525b", label: "Slate" },
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      boardTheme: (parsed.boardTheme as BoardTheme) ?? DEFAULT.boardTheme,
      volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : DEFAULT.volume,
    };
  } catch {}
  return { ...DEFAULT };
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
  applyBoardTheme(s.boardTheme);
}

export function applyBoardTheme(theme: BoardTheme) {
  if (typeof document === "undefined") return;
  const t = BOARD_THEMES[theme] ?? BOARD_THEMES.wood;
  document.documentElement.style.setProperty("--sq-light", t.light);
  document.documentElement.style.setProperty("--sq-dark", t.dark);
}
