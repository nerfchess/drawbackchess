"use client";

import {
  CustomDrawback,
  CustomRule,
  buildCustomDrawback,
  deleteCustomDrawback,
  describeCustom,
  loadCustomDrawbacks,
  saveCustomDrawback,
} from "@/engine/drawbacks/custom";
import { PieceType } from "@/engine/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PIECES: { v: PieceType; label: string }[] = [
  { v: "p", label: "Pawn" },
  { v: "n", label: "Knight" },
  { v: "b", label: "Bishop" },
  { v: "r", label: "Rook" },
  { v: "q", label: "Queen" },
  { v: "k", label: "King" },
];

const RULE_TEMPLATES: { kind: CustomRule["kind"]; label: string; needs?: "piece" | "file" | "rank" }[] = [
  { kind: "ban_file", label: "You can't move to a file…", needs: "file" },
  { kind: "ban_rank", label: "You can't move to a rank…", needs: "rank" },
  { kind: "no_capture_piece", label: "You can't capture a piece type…", needs: "piece" },
  { kind: "no_move_piece", label: "You can't move a piece type…", needs: "piece" },
  { kind: "no_backward", label: "You can't move backward." },
  { kind: "only_captures", label: "Every move must be a capture if available." },
  { kind: "no_captures", label: "You can't capture at all." },
  { kind: "lose_if_no_piece", label: "Lose if you have no…", needs: "piece" },
  { kind: "lose_if_enemy_adjacent_to_king", label: "Lose if any enemy piece is adjacent to your king." },
];

export default function BuilderPage() {
  const router = useRouter();
  const [name, setName] = useState("My Curse");
  const [rules, setRules] = useState<CustomRule[]>([{ kind: "ban_file", file: 7 }]);
  const [saved, setSaved] = useState<CustomDrawback[]>([]);

  useEffect(() => {
    setSaved(loadCustomDrawbacks());
  }, []);

  const addRule = (kind: CustomRule["kind"]) => {
    const tmpl = RULE_TEMPLATES.find((t) => t.kind === kind)!;
    let r: CustomRule;
    if (tmpl.needs === "piece") r = { kind, piece: "p" } as CustomRule;
    else if (tmpl.needs === "file") r = { kind, file: 0 } as CustomRule;
    else if (tmpl.needs === "rank") r = { kind, rank: 0 } as CustomRule;
    else r = { kind } as CustomRule;
    setRules((rs) => [...rs, r]);
  };

  const updateRule = (i: number, r: CustomRule) => {
    setRules((rs) => rs.map((x, ix) => (ix === i ? r : x)));
  };

  const removeRule = (i: number) => setRules((rs) => rs.filter((_, ix) => ix !== i));

  const save = () => {
    const id = "custom_" + Date.now().toString(36);
    const d: CustomDrawback = { id, name: name.trim() || "Untitled Curse", rules };
    saveCustomDrawback(d);
    setSaved(loadCustomDrawbacks());
  };

  const play = (d: CustomDrawback) => {
    // Stash the spec under a key the game page can read back.
    try {
      sessionStorage.setItem("dc:active-custom", JSON.stringify(d));
    } catch {}
    router.push(`/game?mode=ai&difficulty=medium&color=random&drawback=__custom__`);
  };

  const erase = (id: string) => {
    deleteCustomDrawback(id);
    setSaved(loadCustomDrawbacks());
  };

  const preview: CustomDrawback = { id: "preview", name: name || "My Curse", rules };

  return (
    <main className="min-h-screen pb-20">
      <nav className="px-6 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          drawback<span className="italic text-gold-leaf">chess</span>
        </Link>
        <Link href="/codex" className="text-sm font-display italic text-parchment hover:text-gold-leaf">
          ← Back to codex
        </Link>
      </nav>

      <section className="max-w-4xl mx-auto px-6">
        <div className="smallcaps text-[11px] text-parchment-400">workshop</div>
        <h1 className="font-display text-5xl mt-1">Forge a drawback.</h1>
        <p className="mt-3 italic font-display text-parchment-200/90">
          Combine primitive rules. Save and play it in a sandbox game against the AI. Unrated.
        </p>

        <div className="mt-7 plate p-5 sm:p-6 space-y-5 relative">
          <span className="card-corner tl" /><span className="card-corner tr" />
          <span className="card-corner bl" /><span className="card-corner br" />

          <div>
            <div className="smallcaps text-[11px] text-parchment-400 mb-1">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              className="bg-ink-900/60 border border-parchment/15 rounded-sm px-3 py-2 text-base font-display w-full focus:outline-none focus:border-gold/60 text-parchment"
            />
          </div>

          <div>
            <div className="smallcaps text-[11px] text-parchment-400 mb-2">Rules ({rules.length})</div>
            <div className="space-y-2">
              {rules.length === 0 && (
                <div className="text-parchment-300/60 italic text-sm">No rules yet — add one below.</div>
              )}
              {rules.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 bg-ink-900/40 border border-parchment/10 rounded-sm">
                  <span className="font-display italic text-sm text-parchment-200/90 flex-1 min-w-[180px]">
                    {describeCustom({ id: "_", name: "_", rules: [r] })}
                  </span>
                  {"piece" in r && (
                    <select
                      value={r.piece}
                      onChange={(e) =>
                        updateRule(i, { ...(r as { kind: typeof r.kind; piece: PieceType }), piece: e.target.value as PieceType })
                      }
                      className="bg-ink-800 border border-parchment/15 text-parchment text-sm rounded-sm px-2 py-1"
                    >
                      {PIECES.map((p) => (
                        <option key={p.v} value={p.v}>{p.label}</option>
                      ))}
                    </select>
                  )}
                  {"file" in r && (
                    <select
                      value={r.file}
                      onChange={(e) =>
                        updateRule(i, { ...(r as { kind: "ban_file"; file: number }), file: parseInt(e.target.value) })
                      }
                      className="bg-ink-800 border border-parchment/15 text-parchment text-sm rounded-sm px-2 py-1"
                    >
                      {Array.from({ length: 8 }).map((_, f) => (
                        <option key={f} value={f}>{"abcdefgh"[f]}</option>
                      ))}
                    </select>
                  )}
                  {"rank" in r && (
                    <select
                      value={r.rank}
                      onChange={(e) =>
                        updateRule(i, { ...(r as { kind: "ban_rank"; rank: number }), rank: parseInt(e.target.value) })
                      }
                      className="bg-ink-800 border border-parchment/15 text-parchment text-sm rounded-sm px-2 py-1"
                    >
                      {Array.from({ length: 8 }).map((_, k) => (
                        <option key={k} value={k}>{k + 1}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => removeRule(i)}
                    className="text-xs font-display italic text-oxblood-glow hover:text-parchment"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {RULE_TEMPLATES.map((t) => (
                <button
                  key={t.kind}
                  onClick={() => addRule(t.kind)}
                  className="px-3 py-1.5 rounded-sm border border-parchment/15 hover:border-gold/50 text-xs font-display italic text-parchment-200"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rule-ornament text-[10px]">
            <span className="font-display italic">preview</span>
          </div>

          <div className="plate p-4 border-gold/30">
            <div className="font-display text-xl text-gold-leaf">{preview.name}</div>
            <p className="mt-1 text-sm text-parchment-200/95">
              {rules.length ? describeCustom(preview) : <span className="italic text-parchment-300/60">No rules yet.</span>}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={!rules.length}
              className="px-5 py-2.5 rounded-sm btn-leaf font-display font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save curse
            </button>
            <button
              onClick={() => play(preview)}
              disabled={!rules.length}
              className="px-5 py-2.5 rounded-sm btn-ghost font-display italic disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Test in sandbox
            </button>
          </div>
        </div>

        {saved.length > 0 && (
          <>
            <div className="mt-10 rule-ornament text-[11px] text-parchment-400">
              <span className="font-display italic">your saved curses</span>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {saved.map((d) => (
                <div key={d.id} className="plate p-4 relative">
                  <div className="font-display text-xl text-gold-leaf">{d.name}</div>
                  <p className="text-sm text-parchment-200/95 mt-1">{describeCustom(d)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => play(d)}
                      className="px-3 py-1.5 rounded-sm btn-leaf text-xs font-display font-semibold"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => erase(d.id)}
                      className="px-3 py-1.5 rounded-sm btn-ghost text-xs font-display italic"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
