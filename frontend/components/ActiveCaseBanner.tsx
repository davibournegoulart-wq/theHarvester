"use client";

import { useActiveCase } from "@/lib/activeCase";

export default function ActiveCaseBanner() {
  const { activeCase } = useActiveCase();
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: activeCase ? "var(--success)" : "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 4,
        background: activeCase ? "rgba(10, 255, 10, 0.08)" : "rgba(255, 255, 255, 0.03)",
        border: activeCase ? "1px solid rgba(10, 255, 10, 0.25)" : "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: activeCase ? "var(--success)" : "var(--text-muted)",
          boxShadow: activeCase ? "0 0 8px var(--success)" : "none",
          display: "inline-block",
        }}
      />
      {activeCase ? `Active case: ${activeCase.name}` : 'No active case'}
    </div>
  );
}

