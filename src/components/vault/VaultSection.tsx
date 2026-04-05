"use client";

import React from "react";

interface VaultSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function VaultSection({ title, children }: VaultSectionProps) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundImage: "url(/texture-panel.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: "2px solid rgba(255,255,255,0.10)",
        borderTop: "1px solid rgba(255,255,255,0.09)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 2px 8px rgba(0,0,0,0.40), 0 8px 28px rgba(0,0,0,0.70), 0 0 0 1px rgba(0,0,0,0.40)",
        borderRadius: 3,
        marginBottom: 40,
      }}
    >
      {/* Module surface overlay — lighter than page scrim so module reads above the wall */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(14,14,18,0.55) 0%, rgba(8,8,12,0.68) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content layer */}
      <div style={{ position: "relative" }}>
        {/* Module header — mounted label plate, brighter than body */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px 6px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
            boxShadow:
              "0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              width: 1,
              height: 8,
              flexShrink: 0,
              background: "rgba(255,255,255,0.22)",
              boxShadow: "0 0 3px rgba(255,255,255,0.08)",
            }}
          />
          <span
            className="font-cinzel"
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.32)",
              textTransform: "uppercase",
              fontWeight: 400,
            }}
          >
            {title}
          </span>
        </div>

        {/* Slot rows — darker recess below the label plate */}
        <div
          style={{ padding: "10px 10px 4px", background: "rgba(0,0,0,0.22)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
