import { Drawback } from "../drawback";
import { findKing } from "../board";
import { FILE, Move, PieceType, RANK, Square } from "../types";

// A custom drawback is built by ANDing together a small set of primitive rules.
// The shape is JSON-serializable so we can store it in localStorage.

export type CustomRule =
  | { kind: "ban_file"; file: number }
  | { kind: "ban_rank"; rank: number }
  | { kind: "no_capture_piece"; piece: PieceType }
  | { kind: "no_move_piece"; piece: PieceType }
  | { kind: "no_backward" }
  | { kind: "only_captures" }
  | { kind: "no_captures" }
  | { kind: "lose_if_no_piece"; piece: PieceType }
  | { kind: "lose_if_enemy_adjacent_to_king" };

export interface CustomDrawback {
  id: string;
  name: string;
  description?: string;
  rules: CustomRule[];
}

const PIECE_NAMES: Record<PieceType, string> = {
  p: "pawns", n: "knights", b: "bishops", r: "rooks", q: "queens", k: "the king",
};

function ruleText(r: CustomRule): string {
  switch (r.kind) {
    case "ban_file": return `You can't move to the ${"abcdefgh"[r.file]}-file.`;
    case "ban_rank": return `You can't move to rank ${r.rank + 1}.`;
    case "no_capture_piece": return `You can't capture ${PIECE_NAMES[r.piece]}.`;
    case "no_move_piece": return `You can't move ${PIECE_NAMES[r.piece]}.`;
    case "no_backward": return "You can't move backward.";
    case "only_captures": return "Every move must be a capture, if any capture is available.";
    case "no_captures": return "You can't capture at all.";
    case "lose_if_no_piece": return `You lose if you have no ${PIECE_NAMES[r.piece]}.`;
    case "lose_if_enemy_adjacent_to_king":
      return "You lose if any enemy piece is adjacent to your king.";
  }
}

export function describeCustom(d: CustomDrawback): string {
  return d.rules.map(ruleText).join(" ");
}

const adj = (a: Square, b: Square) =>
  a !== b && Math.abs(FILE(a) - FILE(b)) <= 1 && Math.abs(RANK(a) - RANK(b)) <= 1;

export function buildCustomDrawback(spec: CustomDrawback): Drawback {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description || describeCustom(spec),
    flavor: "A homemade curse.",
    tier: 3,
    icon: "wand",
    implemented: true,
    filterMoves: (moves: Move[], _s, ctx) => {
      let out = moves;
      const dir = ctx.me === "w" ? 1 : -1;
      let mustCapture = false;
      for (const r of spec.rules) {
        switch (r.kind) {
          case "ban_file":
            out = out.filter((m) => FILE(m.to) !== r.file);
            break;
          case "ban_rank":
            out = out.filter((m) => RANK(m.to) !== r.rank);
            break;
          case "no_capture_piece":
            out = out.filter((m) => m.captured !== r.piece);
            break;
          case "no_move_piece":
            out = out.filter((m) => m.piece !== r.piece);
            break;
          case "no_backward":
            out = out.filter((m) => (RANK(m.to) - RANK(m.from)) * dir >= 0);
            break;
          case "only_captures":
            mustCapture = true;
            break;
          case "no_captures":
            out = out.filter((m) => !m.captured);
            break;
          default:
            break;
        }
      }
      if (mustCapture) {
        const caps = out.filter((m) => !!m.captured);
        if (caps.length) out = caps;
      }
      return out;
    },
    checkLoss: (_s, ctx) => {
      for (const r of spec.rules) {
        if (r.kind === "lose_if_no_piece") {
          const has = ctx.board.pieces.some((p) => p && p.color === ctx.me && p.type === r.piece);
          if (!has) return { reason: `no ${PIECE_NAMES[r.piece]} remain` };
        }
        if (r.kind === "lose_if_enemy_adjacent_to_king") {
          const ks = findKing(ctx.board, ctx.me);
          if (ks != null) {
            for (let sq = 0; sq < 64; sq++) {
              const p = ctx.board.pieces[sq];
              if (p && p.color !== ctx.me && adj(sq, ks)) {
                return { reason: "enemy adjacent to king" };
              }
            }
          }
        }
      }
      return null;
    },
  };
}

const STORE_KEY = "dc:custom-drawbacks";

export function loadCustomDrawbacks(): CustomDrawback[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is CustomDrawback =>
        typeof d === "object" && d && typeof d.id === "string" && typeof d.name === "string" && Array.isArray(d.rules)
    );
  } catch {
    return [];
  }
}

export function saveCustomDrawback(d: CustomDrawback) {
  if (typeof window === "undefined") return;
  const list = loadCustomDrawbacks().filter((x) => x.id !== d.id);
  list.push(d);
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

export function deleteCustomDrawback(id: string) {
  if (typeof window === "undefined") return;
  const list = loadCustomDrawbacks().filter((x) => x.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
