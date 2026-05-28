import { initialBoard, makeMove } from "@/engine/board";
import { BoardState, Move } from "@/engine/types";

export function boardAtPly(moves: Move[], ply: number): BoardState {
  let board = initialBoard();
  const clamped = Math.max(0, Math.min(ply, moves.length));
  for (let i = 0; i < clamped; i++) {
    board = makeMove(board, moves[i]);
  }
  return board;
}
