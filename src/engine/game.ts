import { generateMoves, isInCheck, kingCaptured, makeMove } from "./board";
import { Drawback, DrawbackState, GameContext, Tier } from "./drawback";
import { RNG } from "./rng";
import { BoardState, Color, FILE, Move, PieceType, RANK } from "./types";

export interface PlayerSlot {
  drawback: Drawback;
  state: DrawbackState;
  color: Color;
  rng: RNG;
}

export interface GameResult {
  winner: Color | "draw" | null;
  reason: string;
}

export interface DrawbackGame {
  board: BoardState;
  white: PlayerSlot;
  black: PlayerSlot;
  result: GameResult | null;
  startedAt: number;
  // running counters per color
  captured: Record<Color, { p: number; n: number; b: number; r: number; q: number; k: number }>;
}

function emptyCounts() {
  return { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
}

export function newGame(whiteDrawback: Drawback, blackDrawback: Drawback, seed: number): DrawbackGame {
  const rng = new RNG(seed);
  const wRng = rng.fork();
  const bRng = rng.fork();
  const { initialBoard } = require("./board") as typeof import("./board");
  const board = initialBoard();
  const white: PlayerSlot = {
    drawback: whiteDrawback,
    state: whiteDrawback.init ? whiteDrawback.init(wRng, "w") : {},
    color: "w",
    rng: wRng,
  };
  const black: PlayerSlot = {
    drawback: blackDrawback,
    state: blackDrawback.init ? blackDrawback.init(bRng, "b") : {},
    color: "b",
    rng: bRng,
  };
  const game: DrawbackGame = {
    board,
    white,
    black,
    result: null,
    startedAt: Date.now(),
    captured: { w: emptyCounts(), b: emptyCounts() },
  };
  // Run onTurnStart for the first player
  applyTurnStart(game);
  return game;
}

export function makeContext(game: DrawbackGame, color: Color): GameContext {
  const me = color === "w" ? game.white : game.black;
  const opp = color === "w" ? game.black : game.white;
  // count moves I've made
  const moveNumber = game.board.history.filter((m) => m.color === color).length;
  const myLast = [...game.board.history].reverse().find((m) => m.color === color) ?? null;
  const oppLast = [...game.board.history].reverse().find((m) => m.color !== color) ?? null;
  return {
    board: game.board,
    me: color,
    opponentLastMove: oppLast,
    myLastMove: myLast,
    moveNumber,
    capturedByMe: game.captured[color],
    capturedFromMe: game.captured[color === "w" ? "b" : "w"],
  };
}

export function applyTurnStart(game: DrawbackGame) {
  const slot = game.board.turn === "w" ? game.white : game.black;
  if (slot.drawback.onTurnStart) {
    const ctx = makeContext(game, slot.color);
    slot.state = slot.drawback.onTurnStart(slot.state, ctx, slot.rng);
  }
}

export function legalMoves(game: DrawbackGame): Move[] {
  if (game.result) return [];
  const all = generateMoves(game.board);
  const slot = game.board.turn === "w" ? game.white : game.black;
  if (!slot.drawback.filterMoves) return all;
  const ctx = makeContext(game, slot.color);
  return slot.drawback.filterMoves(all, slot.state, ctx);
}

export function checkLossConditions(game: DrawbackGame): GameResult | null {
  // King capture check first
  const captured = kingCaptured(game.board);
  if (captured) {
    return { winner: captured === "w" ? "b" : "w", reason: "king captured" };
  }
  for (const color of ["w", "b"] as Color[]) {
    const slot = color === "w" ? game.white : game.black;
    if (!slot.drawback.checkLoss) continue;
    const ctx = makeContext(game, color);
    const res = slot.drawback.checkLoss(slot.state, ctx);
    if (res) {
      return { winner: color === "w" ? "b" : "w", reason: `${slot.drawback.name}: ${res.reason}` };
    }
  }
  return null;
}

export function playMove(game: DrawbackGame, move: Move): DrawbackGame {
  if (game.result) return game;
  if (move.captured) {
    game.captured[move.color][move.captured] += 1;
  }
  game.board = makeMove(game.board, move);
  // Check loss conditions
  const result = checkLossConditions(game);
  if (result) {
    game.result = result;
    return game;
  }
  // No moves available = loss for side to move (king will be captured)
  const slot = game.board.turn === "w" ? game.white : game.black;
  // Apply onTurnStart for the new mover BEFORE legal-move evaluation
  applyTurnStart(game);
  const moves = legalMoves(game);
  if (moves.length === 0) {
    game.result = {
      winner: game.board.turn === "w" ? "b" : "w",
      reason: "no legal moves",
    };
  }
  return game;
}

export function resign(game: DrawbackGame, color: Color): DrawbackGame {
  if (game.result) return game;
  game.result = { winner: color === "w" ? "b" : "w", reason: "resignation" };
  return game;
}
