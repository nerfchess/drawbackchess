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
    <div className="plate p-4 max-h-72 overflow-y-auto">
      <div className="smallcaps text-[10px] text-parchment-400 mb-3">Move history</div>
      {rows.length === 0 && (
        <div className="text-parchment-300/60 text-sm">No moves yet.</div>
      )}
      <div className="font-mono text-[13px] space-y-0.5">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr] gap-2">
            <span className="text-parchment-400/70">{i + 1}.</span>
            <span className="text-parchment">{row.w}</span>
            <span className="text-parchment-300/80">{row.b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
