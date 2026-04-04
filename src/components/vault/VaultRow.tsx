"use client";

import React, { useState } from "react";
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
  const [hovered, setHovered] = useState(false);

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

  const initial = (e.site || "?")[0].toUpperCase();
  const domain = e.domain;

  function toggleExpand() {
    setExpandedId((cur) => (cur === e.id ? null : e.id));
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(22,24,32,0.95)" : "rgba(18,20,26,0.95)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)"}`,
        boxShadow: hovered
          ? "0 6px 18px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 10px rgba(0,0,0,0.90)"
          : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -3px 10px rgba(0,0,0,0.90)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.15s ease",
        borderRadius: 2,
        marginBottom: 8,
      }}
    >
      <div className="px-5 py-4">

        {/* ── Main card row ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3">

          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected(e.id)}
            onChange={() => toggleSelected(e.id)}
            className="accent-white shrink-0"
            style={{ marginTop: 1 }}
          />

          {/* Service avatar */}
          <div
            style={{
              width: 44,
              height: 44,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              borderRadius: 2,
            }}
          >
            {domain ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                alt={e.site}
                style={{ width: 22, height: 22, objectFit: "contain" }}
                onError={(ev) => {
                  const img = ev.target as HTMLImageElement;
                  img.style.display = "none";
                  const parent = img.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span style="font-family: Cinzel, serif; font-size: 15px; color: rgba(255,255,255,0.32); user-select: none;">${initial}</span>`;
                  }
                }}
              />
            ) : (
              <span
                className="font-cinzel select-none"
                style={{ fontSize: 15, color: "rgba(255,255,255,0.32)" }}
              >
                {initial}
              </span>
            )}
          </div>

          {/* ── Record content ──────────────────────────────────────── */}
          <button
            type="button"
            onClick={toggleExpand}
            className="flex-1 text-left min-w-0"
          >
            {/* Service name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-cinzel tracking-wide truncate"
                style={{ fontSize: 14, maxWidth: 240, color: "rgba(255,255,255,0.92)", fontWeight: 500 }}
              >
                {view === "active" && e.favorite ? "★ " : ""}
                {e.site || "—"}
              </span>
              {view === "active" && dupCount > 1 && (
                <span
                  style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Duplicate
                </span>
              )}
              <span
                style={{
                  fontSize: 8,
                  padding: "2px 7px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.20)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                SECURED
              </span>
            </div>

            {/* Username */}
            <div style={{ fontSize: 11, marginTop: 3, color: "rgba(255,255,255,0.38)" }} className="truncate">
              {e.username}
            </div>

            {/* Password dots + strength */}
            <div className="flex items-center gap-2" style={{ marginTop: 5 }}>
              <span
                className="font-mono select-none"
                style={{ fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,0.18)" }}
              >
                {revealed ? e.password : "••••••••••••"}
              </span>
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>·</span>
              <span
                style={{
                  fontSize: 10,
                  color: isWeak ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.28)",
                }}
              >
                {entryStrength.label}
                {isWeak && <span style={{ marginLeft: 4 }}>⚠</span>}
              </span>
              {isReused && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>·</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.60)" }}>
                    Reused ({reuseCount})
                  </span>
                </>
              )}
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>·</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>{ageLabel}</span>
            </div>
          </button>

          {/* ── Quick actions (visible on card hover) ───────────────── */}
          <div
            className="flex gap-1 items-center shrink-0 transition-opacity duration-150"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            {view === "active" ? (
              <>
                <button
                  onClick={() => handleCopy(e.id, "username", e.username)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.05em",
                    borderRadius: 1,
                  }}
                  title="Copy username"
                >
                  {userCd > 0 ? `${userCd}s` : "User"}
                </button>
                <button
                  onClick={() => handleCopy(e.id, "password", e.password)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.05em",
                    borderRadius: 1,
                  }}
                  title="Copy password"
                >
                  {passCd > 0 ? `${passCd}s` : "Pass"}
                </button>
                <button
                  onClick={() => startEdit(e)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.40)",
                    borderRadius: 1,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleFavorite(e.id)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: e.favorite ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.30)",
                    borderRadius: 1,
                    lineHeight: 1,
                  }}
                  title={e.favorite ? "Unfavorite" : "Favorite"}
                >
                  {e.favorite ? "★" : "☆"}
                </button>
                <button
                  onClick={() => moveToTrash(e.id)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.28)",
                    borderRadius: 1,
                  }}
                  title="Move to trash"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => restoreFromTrash(e.id)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.40)",
                    borderRadius: 1,
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => deletePermanentlySelected([e.id])}
                  className="hover:brightness-125 transition-[filter]"
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.28)",
                    borderRadius: 1,
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Expand chevron */}
          <button
            type="button"
            onClick={toggleExpand}
            style={{
              color: hovered ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.38)",
              fontSize: 18,
              lineHeight: 1,
              transform: isExpanded
                ? "rotate(90deg)"
                : hovered ? "translateX(3px)" : "translateX(0)",
              transition: "transform 0.15s ease, color 0.15s ease",
              marginLeft: 4,
              flexShrink: 0,
            }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            ›
          </button>
        </div>

        {/* ── Expanded detail ───────────────────────────────────────── */}
        {isExpanded && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.05)",
            }}
            className="space-y-3"
          >
            {view === "active" ? (
              <>
                {/* Password reveal */}
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.30)" }}>Password: </span>
                  <span className="font-mono" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {revealed ? e.password : maskPassword(e.password)}
                  </span>
                  {revealed && (
                    <span style={{ color: "rgba(255,255,255,0.20)", marginLeft: 8, fontSize: 10 }}>
                      (hides in 10s)
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    ["Copy Username" + (userCd > 0 ? ` (${userCd}s)` : ""), () => handleCopy(e.id, "username", e.username)],
                    ["Copy Password" + (passCd > 0 ? ` (${passCd}s)` : ""), () => handleCopy(e.id, "password", e.password)],
                    [revealed ? "Hide" : "Reveal", () => toggleReveal(e.id)],
                    ["Copy Site", () => copyText("Site", e.site)],
                    ["Copy Site+User", () => copyText("Site + Username", `${e.site} • ${e.username}`)],
                    ["Duplicate", () => duplicateEntry(e)],
                  ].map(([label, handler]: any) => (
                    <button
                      key={label}
                      onClick={handler}
                      className="hover:brightness-125 transition-[filter]"
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(255,255,255,0.42)",
                        borderRadius: 1,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tags */}
                {(e.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {e.tags!.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => clickTagChip(t)}
                        className="hover:brightness-125 transition-[filter]"
                        style={{
                          padding: "2px 8px",
                          fontSize: 10,
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.30)",
                          letterSpacing: "0.05em",
                          borderRadius: 1,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {e.notes && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.50)",
                      whiteSpace: "pre-wrap",
                      borderLeft: "2px solid rgba(255,255,255,0.10)",
                      paddingLeft: 10,
                    }}
                  >
                    {e.notes}
                  </div>
                )}

                {/* Meta */}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>
                  Created: {daysAgo(e.createdAt)}
                  <span style={{ margin: "0 6px" }}>·</span>
                  Updated: {daysAgo(e.updatedAt)}
                  {e.category && (
                    <>
                      <span style={{ margin: "0 6px" }}>·</span>
                      <button
                        onClick={() => clickCategoryChip(e.category!)}
                        style={{ color: "rgba(255,255,255,0.30)", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.12)" }}
                      >
                        {e.category}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
                Trashed: {daysAgo(e.deletedAt)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
