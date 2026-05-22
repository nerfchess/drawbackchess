import type { QueuedPremove } from "@/components/Board";
import { Drawback } from "@/engine/drawback";
import { buildCustomDrawback, CustomDrawback } from "@/engine/drawbacks/custom";
import { IMPLEMENTED_BY_ID } from "@/engine/drawbacks/library";
import { DrawbackGame, PlayerSlot } from "@/engine/game";
import { RNG } from "@/engine/rng";
import { Color } from "@/engine/types";

export const ACTIVE_AI_GAME_KEY = "dc:active-ai-game";

type SavedDrawback =
  | { kind: "implemented"; id: string }
  | { kind: "custom"; spec: CustomDrawback };

type SavedPlayerSlot = {
  drawback: SavedDrawback;
  state: PlayerSlot["state"];
  color: Color;
  rngState: number;
};

export type SavedAiGame = {
  version: 1;
  query: string;
  myColor: Color;
  whiteMs: number;
  blackMs: number;
  premoves: QueuedPremove[];
  game: {
    board: DrawbackGame["board"];
    white: SavedPlayerSlot;
    black: SavedPlayerSlot;
    result: DrawbackGame["result"];
    startedAt: number;
    captured: DrawbackGame["captured"];
  };
};

function drawbackRef(drawback: Drawback, customSpec?: CustomDrawback | null): SavedDrawback | null {
  if (customSpec && customSpec.id === drawback.id) return { kind: "custom", spec: customSpec };
  if (IMPLEMENTED_BY_ID[drawback.id]) return { kind: "implemented", id: drawback.id };
  return null;
}

function restoreDrawback(saved: SavedDrawback): Drawback | null {
  if (saved.kind === "custom") return buildCustomDrawback(saved.spec);
  return IMPLEMENTED_BY_ID[saved.id] ?? null;
}

function saveSlot(slot: PlayerSlot, customSpec?: CustomDrawback | null): SavedPlayerSlot | null {
  const drawback = drawbackRef(slot.drawback, customSpec);
  if (!drawback) return null;
  return {
    drawback,
    state: slot.state,
    color: slot.color,
    rngState: slot.rng.getState(),
  };
}

function restoreSlot(saved: SavedPlayerSlot): PlayerSlot | null {
  const drawback = restoreDrawback(saved.drawback);
  if (!drawback) return null;
  return {
    drawback,
    state: saved.state ?? {},
    color: saved.color,
    rng: RNG.fromState(saved.rngState),
  };
}

export function loadSavedAiGame(query: string): SavedAiGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_AI_GAME_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedAiGame;
    if (saved.version !== 1 || saved.query !== query) return null;
    if (saved.myColor !== "w" && saved.myColor !== "b") return null;
    return saved;
  } catch {
    return null;
  }
}

export function restoreSavedAiGame(saved: SavedAiGame): DrawbackGame | null {
  const white = restoreSlot(saved.game.white);
  const black = restoreSlot(saved.game.black);
  if (!white || !black) return null;
  return {
    board: saved.game.board,
    white,
    black,
    result: saved.game.result,
    startedAt: saved.game.startedAt,
    captured: saved.game.captured,
  };
}

export function saveAiGame(input: {
  query: string;
  myColor: Color;
  game: DrawbackGame;
  whiteMs: number;
  blackMs: number;
  premoves: QueuedPremove[];
  whiteCustomSpec?: CustomDrawback | null;
  blackCustomSpec?: CustomDrawback | null;
}) {
  if (typeof window === "undefined") return;
  const white = saveSlot(input.game.white, input.whiteCustomSpec);
  const black = saveSlot(input.game.black, input.blackCustomSpec);
  if (!white || !black) return;
  const saved: SavedAiGame = {
    version: 1,
    query: input.query,
    myColor: input.myColor,
    whiteMs: input.whiteMs,
    blackMs: input.blackMs,
    premoves: input.premoves,
    game: {
      board: input.game.board,
      white,
      black,
      result: input.game.result,
      startedAt: input.game.startedAt,
      captured: input.game.captured,
    },
  };
  window.localStorage.setItem(ACTIVE_AI_GAME_KEY, JSON.stringify(saved));
}

export function clearSavedAiGame() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_AI_GAME_KEY);
}
