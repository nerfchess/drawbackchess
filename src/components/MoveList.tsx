"use client";

import { moveToSAN } from "@/engine/board";
import { Move } from "@/engine/types";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { type MutableRefObject, useEffect, useRef } from "react";

export function MoveList({
  moves,
  currentPly = moves.length,
  onPlyChange,
  compact = false,
}: {
  moves: Move[];
  currentPly?: number;
  onPlyChange?: (ply: number) => void;
  compact?: boolean;
}) {
  const rows: { w: string; b: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      w: moveToSAN(moves[i]),
      b: moves[i + 1] ? moveToSAN(moves[i + 1]) : "",
    });
  }
  const canBack = currentPly > 0;
  const canForward = currentPly < moves.length;
  const jumpTo = (ply: number) => onPlyChange?.(Math.max(0, Math.min(ply, moves.length)));
  const rootClass = compact ? "plate p-2 min-h-0 h-full flex flex-col" : "plate p-4";
  const titleClass = compact
    ? "smallcaps text-[9px] text-parchment-400 truncate"
    : "smallcaps text-[10px] text-parchment-400";
  const selectedMoveRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedMoveRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPly]);

  useEffect(() => {
    if (!onPlyChange) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isTyping) return;
      if (event.key === "ArrowLeft" && canBack) {
        event.preventDefault();
        jumpTo(currentPly - 1);
      } else if (event.key === "ArrowRight" && canForward) {
        event.preventDefault();
        jumpTo(currentPly + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canBack, canForward, currentPly, jumpTo, onPlyChange]);

  return (
    <div className={rootClass + (compact ? " overflow-hidden" : "")}>
      <div className="flex shrink-0 items-center justify-between gap-2 mb-2">
        <div className={titleClass}>{compact ? "History" : "Move history"}</div>
        <div className="font-mono text-[11px] text-parchment-400 tabular-nums">
          {currentPly}/{moves.length}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-1 mb-2">
        <HistoryButton label="To start" disabled={!canBack} onClick={() => jumpTo(0)}>
          <ChevronsLeft size={15} />
        </HistoryButton>
        <HistoryButton label="Previous move" disabled={!canBack} onClick={() => jumpTo(currentPly - 1)}>
          <ChevronLeft size={15} />
        </HistoryButton>
        <HistoryButton label="Next move" disabled={!canForward} onClick={() => jumpTo(currentPly + 1)}>
          <ChevronRight size={15} />
        </HistoryButton>
        <HistoryButton label="To latest" disabled={!canForward} onClick={() => jumpTo(moves.length)}>
          <ChevronsRight size={15} />
        </HistoryButton>
      </div>
      {rows.length === 0 && (
        <div className="min-h-0 text-parchment-300/60 text-sm">No moves yet.</div>
      )}
      <div
        className={
          "font-mono space-y-0.5 overflow-y-auto pr-1 " +
          (compact ? "min-h-0 flex-1 text-[11px]" : "max-h-72 text-[13px]")
        }
      >
        {rows.map((row, i) => (
          <div
            key={i}
            className={
              "grid gap-1 " +
              (compact ? "grid-cols-[1.35rem_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-[2.2rem_1fr_1fr]")
            }
          >
            <span className="text-parchment-400/70">{i + 1}.</span>
            <MoveCell
              ply={i * 2 + 1}
              selected={currentPly === i * 2 + 1}
              onSelect={onPlyChange}
              selectedRef={selectedMoveRef}
            >
              {row.w}
            </MoveCell>
            <MoveCell
              ply={i * 2 + 2}
              selected={currentPly === i * 2 + 2}
              onSelect={onPlyChange}
              selectedRef={selectedMoveRef}
            >
              {row.b}
            </MoveCell>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-7 inline-flex items-center justify-center border border-parchment-300/10 bg-white/[0.03] text-parchment-200 hover:border-gold/50 hover:text-gold-leaf disabled:opacity-35 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}

function MoveCell({
  ply,
  selected,
  onSelect,
  selectedRef,
  children,
}: {
  ply: number;
  selected: boolean;
  onSelect?: (ply: number) => void;
  selectedRef?: MutableRefObject<HTMLButtonElement | null>;
  children: string;
}) {
  if (!children) return <span />;
  return (
    <button
      ref={selected ? selectedRef : undefined}
      type="button"
      onClick={() => onSelect?.(ply)}
      className={
        "min-w-0 text-left px-1 py-0.5 truncate transition " +
        (selected
          ? "bg-gold/15 text-gold-leaf"
          : "text-parchment hover:bg-white/[0.04]")
      }
    >
      {children}
    </button>
  );
}
