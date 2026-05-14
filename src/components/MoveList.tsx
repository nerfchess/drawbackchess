"use client";

import { moveToSAN } from "@/engine/board";
import { Move } from "@/engine/types";

export function MoveList({ moves }: { moves: Move[] }) {
  const rows: { w: string; b: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      w: moveToSAN(moves[i]),
      b: moves[i + 1] ? moveToSAN(moves[i + 1]) : "",
    });
  }
  return (
    <div className="card-glass rounded-xl p-3 max-h-72 overflow-y-auto text-sm font-mono">
      {rows.length === 0 && (
        <div className="text-white/30">No moves yet.</div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-2 py-0.5">
          <span className="text-white/30">{i + 1}.</span>
          <span>{row.w}</span>
          <span className="text-white/70">{row.b}</span>
        </div>
      ))}
    </div>
  );
}
