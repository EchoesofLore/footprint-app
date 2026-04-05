"use client";

import React, { useState, useEffect } from "react";
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
  const [pressed, setPressed] = useState(false);
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);
  const [siteCopied, setSiteCopied] = useState(false);
  const [passVisible, setPassVisible] = useState(true);

  const userKey = `${e.id}:username`;
  const passKey = `${e.id}:password`;
  const userCd = copyCountdown[userKey] ?? 0;
  const passCd = copyCountdown[passKey] ?? 0;

  const entryStrength = passwordStrength(e.password ?? "");
  const isWeak = entryStrength.score <= 1;
  const revealed = Boolean(revealMap[e.id]);

  // Fade password text on reveal toggle
  useEffect(() => {
    setPassVisible(false);
    const t = setTimeout(() => setPassVisible(true), 160);
    return () => clearTimeout(t);
  }, [revealed]);

  function handleCopySite() {
    copyText("Site", e.site);
    setSiteCopied(true);
    setTimeout(() => setSiteCopied(false), 1200);
  }

  function btnPressProps(key: string) {
    return {
      onMouseDown: () => setPressedBtn(key),
      onMouseUp: () => setPressedBtn(null),
      onMouseLeave: () => setPressedBtn(null),
    };
  }
  const ageLabel = daysAgo(e.updatedAt ?? e.createdAt);

  const reuseCount = view === "active" ? (passwordCounts.get(e.password ?? "") ?? 0) : 0;
  const isReused = view === "active" ? reuseCount > 1 : false;
  const dupCount = view === "active" ? (dupSiteUserCounts.get(normKey(e.site, e.username)) ?? 0) : 0;
  const isExpanded = expandedId === e.id;
  const isDimmed = expandedId !== null && !isExpanded;

  const initial = (e.site || "?")[0].toUpperCase();
  const domain = e.domain;

  function toggleExpand() {
    setExpandedId((cur) => (cur === e.id ? null : e.id));
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: hovered ? "rgba(22,24,32,0.95)" : "rgba(18,20,26,0.95)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)"}`,
        boxShadow: pressed
          ? "0 2px 8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -3px 10px rgba(0,0,0,0.90)"
          : hovered
          ? "0 6px 18px rgba(0,0,0,0.60), 0 0 20px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 10px rgba(0,0,0,0.90)"
          : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -3px 10px rgba(0,0,0,0.90)",
        transform: pressed ? "translateY(1px) scale(0.99)" : hovered ? "translateY(-2px) scale(1.01)" : "translateY(0) scale(1)",
        filter: hovered && !pressed ? "brightness(1.08)" : "brightness(1)",
        opacity: isDimmed && !hovered ? 0.85 : 1,
        transition: pressed
          ? "transform 0.08s cubic-bezier(0.4,0,0.2,1), filter 0.08s cubic-bezier(0.4,0,0.2,1), box-shadow 0.08s cubic-bezier(0.4,0,0.2,1)"
          : "transform 0.2s cubic-bezier(0.4,0,0.2,1), filter 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s cubic-bezier(0.4,0,0.2,1), background 0.2s cubic-bezier(0.4,0,0.2,1), border-color 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        cursor: "pointer",
        borderRadius: 2,
        marginBottom: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gradient light sweep — fades in on hover */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(120deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 50%, transparent 100%)",
          opacity: hovered && !pressed ? 1 : 0,
          transition: "opacity 0.2s ease",
          pointerEvents: "none",
          borderRadius: 2,
        }}
      />
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
              color: "rgba(255,255,255,0.80)",
              opacity: hovered && !pressed ? 1 : 0.6,
              fontSize: 18,
              lineHeight: 1,
              transform: isExpanded
                ? "rotate(90deg)"
                : pressed ? "translateX(6px)" : hovered ? "translateX(4px)" : "translateX(0)",
              transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s cubic-bezier(0.4,0,0.2,1)",
              marginLeft: 4,
              flexShrink: 0,
            }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            ›
          </button>
        </div>

        {/* ── Expanded detail ───────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            transition: "grid-template-rows 0.25s ease",
          }}
        >
          <div style={{ overflow: "hidden" }}>
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 2,
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s",
            }}
            className="space-y-3"
          >
            {view === "active" ? (
              <>
                {/* ── Summary info ──────────────────────────────────────── */}
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {/* Username */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 4 }}>Username</div>
                    <div className="font-mono" style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.username || "—"}
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 4 }}>Password</div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.68)",
                        opacity: passVisible ? 1 : 0,
                        transition: "opacity 0.16s ease",
                      }}
                    >
                      {revealed ? e.password : maskPassword(e.password)}
                      {revealed && (
                        <span style={{ color: "rgba(255,255,255,0.18)", marginLeft: 8, fontSize: 10 }}>(hides in 10s)</span>
                      )}
                    </div>
                  </div>

                  {/* Meta — pushed right */}
                  <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>Updated {daysAgo(e.updatedAt)}</div>
                    {e.category && (
                      <button
                        onClick={() => clickCategoryChip(e.category!)}
                        style={{ fontSize: 10, color: "rgba(255,255,255,0.26)", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.10)", marginTop: 2 }}
                      >
                        {e.category}
                      </button>
                    )}
                  </div>
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
                        style={{ padding: "2px 8px", fontSize: 10, border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em", borderRadius: 1 }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {e.notes && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", whiteSpace: "pre-wrap", borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: 10 }}>
                    {e.notes}
                  </div>
                )}

                {/* ── Divider ───────────────────────────────────────────── */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

                {/* ── Actions — delayed entrance ─────────────────────────── */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    opacity: isExpanded ? 1 : 0,
                    transform: isExpanded ? "translateY(0)" : "translateY(4px)",
                    transition: "opacity 0.18s ease 0.17s, transform 0.18s ease 0.17s",
                  }}
                >
                  {/* Primary: Edit Entry */}
                  <button
                    onClick={() => startEdit(e)}
                    {...btnPressProps("edit")}
                    className="hover:brightness-110"
                    style={{
                      padding: "5px 14px",
                      fontSize: 11,
                      border: "1px solid rgba(255,255,255,0.22)",
                      color: "rgba(255,255,255,0.80)",
                      borderRadius: 1,
                      letterSpacing: "0.06em",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 8px rgba(255,255,255,0.03)",
                      transform: pressedBtn === "edit" ? "scale(0.97)" : "scale(1)",
                      transition: "transform 0.08s ease, filter 0.15s ease",
                    }}
                  >
                    Edit Entry
                  </button>

                  {/* Copy Username */}
                  <button
                    onClick={() => handleCopy(e.id, "username", e.username)}
                    {...btnPressProps("copy-user")}
                    className="hover:brightness-125"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 1,
                      border: userCd > 0 ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
                      color: userCd > 0 ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.36)",
                      transform: pressedBtn === "copy-user" ? "scale(0.97)" : "scale(1)",
                      transition: "transform 0.08s ease, color 0.15s ease, border-color 0.15s ease, filter 0.15s ease",
                    }}
                  >
                    {userCd > 0 ? "✓ Copied" : "Copy Username"}
                  </button>

                  {/* Copy Password */}
                  <button
                    onClick={() => handleCopy(e.id, "password", e.password)}
                    {...btnPressProps("copy-pass")}
                    className="hover:brightness-125"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 1,
                      border: passCd > 0 ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
                      color: passCd > 0 ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.36)",
                      transform: pressedBtn === "copy-pass" ? "scale(0.97)" : "scale(1)",
                      transition: "transform 0.08s ease, color 0.15s ease, border-color 0.15s ease, filter 0.15s ease",
                    }}
                  >
                    {passCd > 0 ? "✓ Copied" : "Copy Password"}
                  </button>

                  {/* Reveal / Hide */}
                  <button
                    onClick={() => toggleReveal(e.id)}
                    {...btnPressProps("reveal")}
                    className="hover:brightness-125"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.36)",
                      borderRadius: 1,
                      transform: pressedBtn === "reveal" ? "scale(0.97)" : "scale(1)",
                      transition: "transform 0.08s ease, filter 0.15s ease",
                    }}
                  >
                    {revealed ? "Hide" : "Reveal"}
                  </button>

                  {/* Copy Site */}
                  <button
                    onClick={handleCopySite}
                    {...btnPressProps("copy-site")}
                    className="hover:brightness-125"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 1,
                      border: siteCopied ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
                      color: siteCopied ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.36)",
                      transform: pressedBtn === "copy-site" ? "scale(0.97)" : "scale(1)",
                      transition: "transform 0.08s ease, color 0.15s ease, border-color 0.15s ease, filter 0.15s ease",
                    }}
                  >
                    {siteCopied ? "✓ Copied" : "Copy Site"}
                  </button>

                  {/* Duplicate */}
                  <button
                    onClick={() => duplicateEntry(e)}
                    {...btnPressProps("duplicate")}
                    className="hover:brightness-125"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.36)",
                      borderRadius: 1,
                      transform: pressedBtn === "duplicate" ? "scale(0.97)" : "scale(1)",
                      transition: "transform 0.08s ease, filter 0.15s ease",
                    }}
                  >
                    Duplicate
                  </button>
                </div>

                {/* Created timestamp — very quiet */}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.16)" }}>
                  Created {daysAgo(e.createdAt)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
                Trashed: {daysAgo(e.deletedAt)}
              </div>
            )}
          </div>
          </div>
          </div>
      </div>
    </div>
  );
}
