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
        border: "1px solid rgba(255,255,255,0.10)",
        borderLeft: "3px solid rgba(255,255,255,0.14)",
        borderTop: "2px solid rgba(255,255,255,0.11)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 2px 10px rgba(0,0,0,0.50), 0 18px 60px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.60), 0 0 0 1px rgba(0,0,0,0.50)",
        borderRadius: 4,
        marginBottom: 64,
      }}
    >
      {/* Module surface overlay — lighter than page scrim so module reads above the wall */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(14,14,18,0.72) 0%, rgba(8,8,12,0.84) 100%)",
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
            gap: 10,
            padding: "13px 18px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
            boxShadow:
              "0 3px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              width: 2,
              height: 10,
              flexShrink: 0,
              background: "rgba(255,255,255,0.32)",
              boxShadow: "0 0 4px rgba(255,255,255,0.12)",
            }}
          />
          <span
            className="font-cinzel"
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.42)",
              opacity: 0.7,
              textTransform: "uppercase",
              fontWeight: 400,
            }}
          >
            ▪ {title}
          </span>
        </div>

        {/* Slot rows — darker recess below the label plate */}
        <div
          style={{ padding: "14px 14px 6px", background: "rgba(0,0,0,0.30)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
