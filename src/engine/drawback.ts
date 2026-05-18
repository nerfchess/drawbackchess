import { BoardState, Color, Move } from "./types";
import { RNG } from "./rng";

export type Tier = 1 | 2 | 3 | 4 | 5; // 1 = trivial, 5 = brutal

export interface GameContext {
  board: BoardState;
  me: Color; // the side whose drawback this is
  opponentLastMove: Move | null;
  myLastMove: Move | null;
  moveNumber: number; // full move number from my perspective (turns I've made)
  capturedByMe: { p: number; n: number; b: number; r: number; q: number; k: number };
  capturedFromMe: { p: number; n: number; b: number; r: number; q: number; k: number };
}

export type DrawbackState = Record<string, unknown>;

export interface Drawback {
  id: string;
  name: string;
  description: string;
  flavor?: string;
  tier: Tier;
  icon?: string;
  implemented: boolean;

  init?: (rng: RNG, color: Color) => DrawbackState;
  onTurnStart?: (state: DrawbackState, ctx: GameContext, rng: RNG) => DrawbackState;
  filterMoves?: (moves: Move[], state: DrawbackState, ctx: GameContext) => Move[];
  checkLoss?: (
    state: DrawbackState,
    ctx: GameContext
  ) => null | { reason: string };

  // Optional hint surfaced in the UI when the drawback narrows or forces moves
  // this turn. Returned squares (if any) will be highlighted on the board.
  hint?: (
    state: DrawbackState,
    ctx: GameContext,
    legalMoves: Move[]
  ) => null | { text: string; squares?: number[]; tone?: "info" | "warn" };

  // Hooks for visualization
  visual?: (state: DrawbackState, ctx: GameContext) => {
    fogged?: boolean;
    waterRank?: number; // ranks 1..8 underwater
    duckSquare?: number;
    bannedSquares?: number[];
    highlightSquares?: number[];
  };

  // Trackable progress for drawbacks tied to a counter (captures, moves, etc.).
  // Returned as 0..1 fraction plus a short label like "2/3 pawns eaten".
  progress?: (state: DrawbackState, ctx: GameContext) => null | {
    value: number;
    max: number;
    label: string;
  };
}
