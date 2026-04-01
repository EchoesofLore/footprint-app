"use client";

import React from "react";
import type { VaultEntry } from "@/lib/types";
import { passwordStrength, daysAgo, maskPassword, normKey } from "@/lib/vaultUtils";

interface VaultRowProps {
  entry: VaultEntry;
  view: "active" | "trash";
  expandedId: string | null;
  setExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  toggleFavorite: (id: string) => void;
  startEdit: (entry: VaultEntry) => void;
  duplicateEntry: (entry: VaultEntry) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  deletePermanentlySelected: (ids: string[]) => void;
  handleCopy: (id: string, field: "username" | "password", value: string) => void;
  copyText: (label: string, value: string) => void;
  toggleReveal: (id: string) => void;
  clickTagChip: (tag: string) => void;
  clickCategoryChip: (cat: string) => void;
  copyCountdown: Record<string, number>;
  revealMap: Record<string, boolean>;
  passwordCounts: Map<string, number>;
  dupSiteUserCounts: Map<string, number>;
}

export default function VaultRow({
  entry: e,
  view,
  expandedId,
  setExpandedId,
  isSelected,
  toggleSelected,
  toggleFavorite,
  startEdit,
  duplicateEntry,
  moveToTrash,
  restoreFromTrash,
  deletePermanentlySelected,
  handleCopy,
  copyText,
  toggleReveal,
  clickTagChip,
  clickCategoryChip,
  copyCountdown,
  revealMap,
  passwordCounts,
  dupSiteUserCounts,
}: VaultRowProps) {
  const userKey = `${e.id}:username`;
  const passKey = `${e.id}:password`;
  const userCd = copyCountdown[userKey] ?? 0;
  const passCd = copyCountdown[passKey] ?? 0;

  const entryStrength = passwordStrength(e.password ?? "");
  const isWeak = entryStrength.score <= 1;
  const revealed = Boolean(revealMap[e.id]);
  const ageLabel = daysAgo(e.updatedAt ?? e.createdAt);

  const reuseCount = view === "active" ? (passwordCounts.get(e.password ?? "") ?? 0) : 0;
  const isReused = view === "active" ? reuseCount > 1 : false;
  const dupCount = view === "active" ? (dupSiteUserCounts.get(normKey(e.site, e.username)) ?? 0) : 0;
  const isExpanded = expandedId === e.id;

  function toggleExpand() {
    setExpandedId((cur) => (cur === e.id ? null : e.id));
  }

  return (
    <div
      className="border border-b border-[rgba(200,146,42,0.12)] border-b-[#c8922a]/10 last:border-b-0 bg-[#111111] hover:bg-[#161616] hover:border-[#c8922a]/25 transition-all duration-200 active:scale-[0.99]"
    >
      <div className="py-5 px-6 space-y-2">
        <div className="flex items-start justify-between gap-2">

          {/* Left: checkbox + expand content */}
          <div className="flex gap-3 items-start flex-1 min-w-0">
            <input
              type="checkbox"
              checked={isSelected(e.id)}
              onChange={() => toggleSelected(e.id)}
              className="mt-1.5 accent-[#c8922a] shrink-0"
            />
            <button type="button" onClick={toggleExpand} className="text-left flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold tracking-wide text-[#e8e0d0]">
                  {view === "active" && e.favorite ? "⭐ " : ""}
                  {e.site}
                </span>
                {view === "active" && dupCount > 1 && (
                  <span className="text-xs px-1.5 py-0.5 border border-white/10 text-[#e8e0d0]/35">
                    Duplicate
                  </span>
                )}
                <span className="inline-flex items-center border border-[#c8922a]/25 text-[#c8922a]/55 text-[9px] tracking-[0.15em] px-2 py-0.5 rounded-sm">
                  SECURED
                </span>
              </div>
              <div className="text-xs text-[#e8e0d0]/50 mt-0.5">{e.username}</div>
              <div className="text-xs text-[#e8e0d0]/35 mt-1">
                {entryStrength.label}
                {isWeak && <span className="ml-1.5 text-amber-400/65">⚠</span>}
                <span className="mx-1.5 opacity-50">·</span>updated {ageLabel}
                {e.category && (
                  <span className="ml-1.5 opacity-50">
                    ·{" "}
                    <button
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        clickCategoryChip(e.category!);
                      }}
                      className="underline underline-offset-2 decoration-white/20 text-[#e8e0d0]/45"
                    >
                      {e.category}
                    </button>
                  </span>
                )}
              </div>
              {view === "active" && isReused && (
                <div className="text-xs mt-1 text-amber-400/65">
                  ⚠ Reused ({reuseCount} entries)
                </div>
              )}
            </button>
          </div>

          {/* Right: action buttons + expand chevron */}
          <div className="flex gap-1.5 flex-wrap justify-end items-center shrink-0">
            {view === "active" ? (
              <>
                <button
                  onClick={() => toggleFavorite(e.id)}
                  className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                >
                  {e.favorite ? "Unfavorite" : "Favorite"}
                </button>
                <button
                  onClick={() => startEdit(e)}
                  className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                >
                  Edit
                </button>
                <button
                  onClick={() => duplicateEntry(e)}
                  className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => moveToTrash(e.id)}
                  className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                >
                  Trash
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => restoreFromTrash(e.id)}
                  className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                >
                  Restore
                </button>
                <button
                  onClick={() => deletePermanentlySelected([e.id])}
                  className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                >
                  Delete permanently
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleExpand}
              className="ml-1 hover:opacity-80 transition-opacity"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <span className="text-[#c8922a]/50 text-xl leading-none">›</span>
            </button>
          </div>
        </div>

        {/* Expanded detail — preserved exactly from original */}
        {isExpanded && (
          <div className="mt-2 pt-3 border-t border-white/5 space-y-2">
            {view === "active" ? (
              <>
                <div className="text-xs">
                  <span className="text-[#e8e0d0]/35">Password: </span>
                  <span className="font-mono text-[#e8e0d0]/75">
                    {revealed ? e.password : maskPassword(e.password)}
                  </span>
                  {revealed && (
                    <span className="text-[#e8e0d0]/25 ml-2">(hides in 10s)</span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleCopy(e.id, "username", e.username)}
                    className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                  >
                    Copy Username{userCd > 0 ? ` (${userCd}s)` : ""}
                  </button>
                  <button
                    onClick={() => handleCopy(e.id, "password", e.password)}
                    className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                  >
                    Copy Password{passCd > 0 ? ` (${passCd}s)` : ""}
                  </button>
                  <button
                    onClick={() => toggleReveal(e.id)}
                    className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                  >
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                  <button
                    onClick={() => copyText("Site", e.site)}
                    className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                  >
                    Copy Site
                  </button>
                  <button
                    onClick={() => copyText("Site + Username", `${e.site} • ${e.username}`)}
                    className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]"
                  >
                    Copy Site+User
                  </button>
                </div>
                {(e.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {e.tags!.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => clickTagChip(t)}
                        className="px-2 py-0.5 text-xs border border-white/10 text-[#e8e0d0]/35 hover:brightness-125 transition-[filter]"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {e.notes && (
                  <div className="text-xs text-[#e8e0d0]/55 whitespace-pre-wrap">{e.notes}</div>
                )}
                <div className="text-xs text-[#e8e0d0]/25">
                  Created: {daysAgo(e.createdAt)} · Updated: {daysAgo(e.updatedAt)}
                </div>
              </>
            ) : (
              <div className="text-xs text-[#e8e0d0]/35">Trashed: {daysAgo(e.deletedAt)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
