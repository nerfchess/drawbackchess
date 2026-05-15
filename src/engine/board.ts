import {
  BoardState,
  Color,
  FILE,
  Move,
  Piece,
  PieceType,
  RANK,
  SQ,
  Square,
  inBoard,
} from "./types";

export function initialBoard(): BoardState {
  const pieces: (Piece | null)[] = Array(64).fill(null);
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let f = 0; f < 8; f++) {
    pieces[SQ(f, 0)] = { type: back[f], color: "w" };
    pieces[SQ(f, 1)] = { type: "p", color: "w" };
    pieces[SQ(f, 6)] = { type: "p", color: "b" };
    pieces[SQ(f, 7)] = { type: back[f], color: "b" };
  }
  return {
    pieces,
    turn: "w",
    castling: { wk: true, wq: true, bk: true, bq: true },
    epTarget: null,
    kingPassThrough: [],
    kingPassColor: null,
    halfmove: 0,
    fullmove: 1,
    history: [],
  };
}

export function cloneBoard(b: BoardState): BoardState {
  return {
    pieces: b.pieces.slice(),
    turn: b.turn,
    castling: { ...b.castling },
    epTarget: b.epTarget,
    kingPassThrough: b.kingPassThrough.slice(),
    kingPassColor: b.kingPassColor,
    halfmove: b.halfmove,
    fullmove: b.fullmove,
    history: b.history.slice(),
  };
}

const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KING_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];

// Squares attacked by `color`; used for detecting check (informational) and "passes through attacked square" for king en passant.
export function attackedBy(board: BoardState, color: Color): Set<Square> {
  const attacked = new Set<Square>();
  for (let sq = 0; sq < 64; sq++) {
    const p = board.pieces[sq];
    if (!p || p.color !== color) continue;
    const f = FILE(sq), r = RANK(sq);
    switch (p.type) {
      case "p": {
        const dir = color === "w" ? 1 : -1;
        for (const df of [-1, 1]) {
          const nf = f + df, nr = r + dir;
          if (inBoard(nf, nr)) attacked.add(SQ(nf, nr));
        }
        break;
      }
      case "n":
        for (const [df, dr] of KNIGHT_OFFSETS) {
          const nf = f + df, nr = r + dr;
          if (inBoard(nf, nr)) attacked.add(SQ(nf, nr));
        }
        break;
      case "k":
        for (const [df, dr] of KING_DIRS) {
          const nf = f + df, nr = r + dr;
          if (inBoard(nf, nr)) attacked.add(SQ(nf, nr));
        }
        break;
      default: {
        const dirs =
          p.type === "b" ? BISHOP_DIRS :
          p.type === "r" ? ROOK_DIRS :
          [...BISHOP_DIRS, ...ROOK_DIRS];
        for (const [df, dr] of dirs) {
          let nf = f + df, nr = r + dr;
          while (inBoard(nf, nr)) {
            const tsq = SQ(nf, nr);
            attacked.add(tsq);
            if (board.pieces[tsq]) break;
            nf += df; nr += dr;
          }
        }
      }
    }
  }
  return attacked;
}

export function findKing(board: BoardState, color: Color): Square | null {
  for (let sq = 0; sq < 64; sq++) {
    const p = board.pieces[sq];
    if (p && p.type === "k" && p.color === color) return sq;
  }
  return null;
}

export function isInCheck(board: BoardState, color: Color): boolean {
  const ks = findKing(board, color);
  if (ks == null) return false;
  return attackedBy(board, color === "w" ? "b" : "w").has(ks);
}

/**
 * Generate all pseudo-legal moves for the side to move.
 * In Drawback Chess, kings CAN move into check, castle through check, etc.
 * However, a king en passant capture is allowed for one ply after the opponent's king
 * passed through an attacked square.
 */
export function generateMoves(board: BoardState): Move[] {
  const moves: Move[] = [];
  const me = board.turn;
  const opp: Color = me === "w" ? "b" : "w";

  // King en passant: if it's our turn and opponent's king passed through attacked squares,
  // any move of ours that LANDS on one of those squares captures the king.
  // We add these as flagged moves on top of normal generation.
  const kepTargets =
    board.kingPassColor === opp && board.kingPassThrough.length
      ? new Set(board.kingPassThrough)
      : null;
  const oppKingSq = kepTargets ? findKing(board, opp) : null;

  for (let sq = 0; sq < 64; sq++) {
    const p = board.pieces[sq];
    if (!p || p.color !== me) continue;
    const f = FILE(sq), r = RANK(sq);

    const add = (to: Square, extra: Partial<Move> = {}) => {
      const target = board.pieces[to];
      const move: Move = {
        from: sq,
        to,
        piece: p.type,
        color: me,
        ...(target ? { captured: target.type, capturedSquare: to } : {}),
        ...extra,
      };
      // king en passant: if `to` is a kep target, we also capture the opponent king
      if (kepTargets && kepTargets.has(to) && oppKingSq != null && oppKingSq !== to) {
        move.captured = "k";
        move.capturedSquare = oppKingSq;
        move.isKingEnPassant = true;
      }
      moves.push(move);
    };

    switch (p.type) {
      case "p": {
        const dir = me === "w" ? 1 : -1;
        const startRank = me === "w" ? 1 : 6;
        const promoRank = me === "w" ? 7 : 0;
        const oneR = r + dir;
        if (inBoard(f, oneR)) {
          const oneSq = SQ(f, oneR);
          if (!board.pieces[oneSq]) {
            if (oneR === promoRank) {
              for (const promo of ["q", "r", "b", "n"] as PieceType[]) {
                add(oneSq, { promotion: promo });
              }
            } else {
              add(oneSq);
              // two squares
              if (r === startRank) {
                const twoR = r + 2 * dir;
                const twoSq = SQ(f, twoR);
                if (!board.pieces[twoSq]) {
                  add(twoSq, { isDoublePawn: true });
                }
              }
            }
          }
        }
        // captures
        for (const df of [-1, 1]) {
          const nf = f + df, nr = r + dir;
          if (!inBoard(nf, nr)) continue;
          const tsq = SQ(nf, nr);
          const tp = board.pieces[tsq];
          if (tp && tp.color === opp) {
            if (nr === promoRank) {
              for (const promo of ["q", "r", "b", "n"] as PieceType[]) {
                add(tsq, { promotion: promo });
              }
            } else {
              add(tsq);
            }
          } else if (board.epTarget === tsq) {
            const capSq = SQ(nf, r);
            moves.push({
              from: sq,
              to: tsq,
              piece: "p",
              color: me,
              captured: "p",
              capturedSquare: capSq,
              isEnPassant: true,
            });
          }
        }
        break;
      }
      case "n":
        for (const [df, dr] of KNIGHT_OFFSETS) {
          const nf = f + df, nr = r + dr;
          if (!inBoard(nf, nr)) continue;
          const tsq = SQ(nf, nr);
          const tp = board.pieces[tsq];
          if (!tp || tp.color === opp) add(tsq);
        }
        break;
      case "k": {
        for (const [df, dr] of KING_DIRS) {
          const nf = f + df, nr = r + dr;
          if (!inBoard(nf, nr)) continue;
          const tsq = SQ(nf, nr);
          const tp = board.pieces[tsq];
          if (!tp || tp.color === opp) add(tsq);
        }
        // castling; in drawback chess, can castle through/into/out of check
        const homeR = me === "w" ? 0 : 7;
        if (r === homeR && f === 4) {
          const ck = me === "w" ? board.castling.wk : board.castling.bk;
          const cq = me === "w" ? board.castling.wq : board.castling.bq;
          if (ck && !board.pieces[SQ(5, homeR)] && !board.pieces[SQ(6, homeR)]) {
            const rookSq = SQ(7, homeR);
            const rook = board.pieces[rookSq];
            if (rook && rook.type === "r" && rook.color === me) {
              add(SQ(6, homeR), { castle: "k", kingPath: [SQ(4, homeR), SQ(5, homeR), SQ(6, homeR)] });
            }
          }
          if (
            cq &&
            !board.pieces[SQ(1, homeR)] &&
            !board.pieces[SQ(2, homeR)] &&
            !board.pieces[SQ(3, homeR)]
          ) {
            const rookSq = SQ(0, homeR);
            const rook = board.pieces[rookSq];
            if (rook && rook.type === "r" && rook.color === me) {
              add(SQ(2, homeR), { castle: "q", kingPath: [SQ(4, homeR), SQ(3, homeR), SQ(2, homeR)] });
            }
          }
        }
        break;
      }
      default: {
        const dirs =
          p.type === "b" ? BISHOP_DIRS :
          p.type === "r" ? ROOK_DIRS :
          [...BISHOP_DIRS, ...ROOK_DIRS];
        for (const [df, dr] of dirs) {
          let nf = f + df, nr = r + dr;
          while (inBoard(nf, nr)) {
            const tsq = SQ(nf, nr);
            const tp = board.pieces[tsq];
            if (!tp) {
              add(tsq);
            } else {
              if (tp.color === opp) add(tsq);
              break;
            }
            nf += df; nr += dr;
          }
        }
      }
    }
  }
  return moves;
}

export function makeMove(board: BoardState, move: Move): BoardState {
  const nb = cloneBoard(board);
  const piece = nb.pieces[move.from]!;

  // Remove any captured piece first (handles en passant / king en passant)
  if (move.capturedSquare != null) {
    nb.pieces[move.capturedSquare] = null;
  } else if (nb.pieces[move.to]) {
    nb.pieces[move.to] = null;
  }
  nb.pieces[move.from] = null;
  nb.pieces[move.to] = move.promotion
    ? { type: move.promotion, color: piece.color }
    : piece;

  // Castling: move the rook
  if (move.castle) {
    const homeR = piece.color === "w" ? 0 : 7;
    if (move.castle === "k") {
      nb.pieces[SQ(5, homeR)] = nb.pieces[SQ(7, homeR)];
      nb.pieces[SQ(7, homeR)] = null;
    } else {
      nb.pieces[SQ(3, homeR)] = nb.pieces[SQ(0, homeR)];
      nb.pieces[SQ(0, homeR)] = null;
    }
  }

  // Update castling rights
  if (piece.type === "k") {
    if (piece.color === "w") { nb.castling.wk = false; nb.castling.wq = false; }
    else { nb.castling.bk = false; nb.castling.bq = false; }
  }
  if (piece.type === "r") {
    if (move.from === SQ(0, 0)) nb.castling.wq = false;
    if (move.from === SQ(7, 0)) nb.castling.wk = false;
    if (move.from === SQ(0, 7)) nb.castling.bq = false;
    if (move.from === SQ(7, 7)) nb.castling.bk = false;
  }
  if (move.captured === "r") {
    if (move.capturedSquare === SQ(0, 0)) nb.castling.wq = false;
    if (move.capturedSquare === SQ(7, 0)) nb.castling.wk = false;
    if (move.capturedSquare === SQ(0, 7)) nb.castling.bq = false;
    if (move.capturedSquare === SQ(7, 7)) nb.castling.bk = false;
  }

  // En passant target
  nb.epTarget = null;
  if (move.isDoublePawn) {
    nb.epTarget = (move.from + move.to) >> 1;
  }

  // King passthrough tracking; only set when castling, and only if king path passed through an attacked square OR started in check.
  // We always set the king-pass-through for the squares EXCLUDING the start and end? Actually rule: opponent can capture on any square the king passed through. Include start if king was in check.
  nb.kingPassThrough = [];
  nb.kingPassColor = null;
  if (move.castle && move.kingPath) {
    // Check if any of those squares were attacked at start of move
    const enemyAttacks = attackedBy(board, piece.color === "w" ? "b" : "w");
    const dangerous = move.kingPath.filter((s, i) => i < move.kingPath!.length - 1 && enemyAttacks.has(s));
    // Include final square too only if attacked (king moved INTO check).
    if (enemyAttacks.has(move.kingPath[move.kingPath.length - 1])) {
      dangerous.push(move.kingPath[move.kingPath.length - 1]);
    }
    if (dangerous.length) {
      nb.kingPassThrough = dangerous;
      nb.kingPassColor = piece.color;
    }
  } else if (piece.type === "k") {
    // Normal king move out of an attacked square: opponent gets king en passant on the from-square
    const enemyAttacks = attackedBy(board, piece.color === "w" ? "b" : "w");
    if (enemyAttacks.has(move.from)) {
      nb.kingPassThrough = [move.from];
      nb.kingPassColor = piece.color;
    }
  }

  nb.turn = piece.color === "w" ? "b" : "w";
  if (piece.color === "b") nb.fullmove++;
  nb.halfmove = piece.type === "p" || move.captured ? 0 : nb.halfmove + 1;
  nb.history.push(move);
  return nb;
}

export function kingCaptured(board: BoardState): Color | null {
  // Returns color of the king that was captured (i.e. is missing).
  const w = findKing(board, "w");
  const b = findKing(board, "b");
  if (!w) return "w";
  if (!b) return "b";
  return null;
}

export function moveToUCI(m: Move): string {
  const files = "abcdefgh";
  const a = files[FILE(m.from)] + (RANK(m.from) + 1);
  const b = files[FILE(m.to)] + (RANK(m.to) + 1);
  return a + b + (m.promotion ?? "");
}

export function moveToSAN(m: Move): string {
  const files = "abcdefgh";
  const dest = files[FILE(m.to)] + (RANK(m.to) + 1);
  if (m.castle === "k") return "O-O";
  if (m.castle === "q") return "O-O-O";
  let s = "";
  if (m.piece !== "p") s += m.piece.toUpperCase();
  if (m.captured) {
    if (m.piece === "p") s += files[FILE(m.from)];
    s += "x";
  }
  s += dest;
  if (m.promotion) s += "=" + m.promotion.toUpperCase();
  if (m.isKingEnPassant) s += "!K";
  return s;
}
