"use client";

import React from "react";

interface VaultSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function VaultSection({ title, children }: VaultSectionProps) {
  return (
    <div
      className="mb-8"
      style={{
        background: "#0d0d0d",
        border: "1px solid rgba(200,146,42,0.10)",
        boxShadow: "inset 0 1px 0 rgba(200,146,42,0.06)",
      }}
    >
      <div className="px-4 pt-3 pb-2">
        <div className="text-[11px] tracking-[0.2em] text-[#c8922a]/50 uppercase mb-3">
          {title}
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}
