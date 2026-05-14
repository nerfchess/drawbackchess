export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Square = number; // 0..63, file = sq % 8, rank = sq >> 3 (rank 0 = white's 1st rank)

export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  color: Color;
  captured?: PieceType;
  capturedSquare?: Square; // for en passant / king en passant
  promotion?: PieceType;
  castle?: "k" | "q";
  kingPath?: Square[]; // squares the king passed through (for king en passant)
  isDoublePawn?: boolean;
  isEnPassant?: boolean;
  isKingEnPassant?: boolean;
}

export interface BoardState {
  pieces: (Piece | null)[]; // 64
  turn: Color;
  castling: {
    wk: boolean;
    wq: boolean;
    bk: boolean;
    bq: boolean;
  };
  // pawn en passant target square (the square skipped over)
  epTarget: Square | null;
  // squares the opponent's king passed through last turn (king en passant targets)
  kingPassThrough: Square[];
  kingPassColor: Color | null; // color of the king that passed through
  halfmove: number;
  fullmove: number;
  history: Move[];
}

export const FILE = (sq: Square) => sq & 7;
export const RANK = (sq: Square) => sq >> 3;
export const SQ = (file: number, rank: number) => rank * 8 + file;
export const inBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

export const PIECE_VALUE: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 1000,
};

export function squareName(sq: Square): string {
  return "abcdefgh"[FILE(sq)] + (RANK(sq) + 1);
}

export function parseSquare(name: string): Square {
  return SQ(name.charCodeAt(0) - 97, parseInt(name[1]) - 1);
}
