"use client";

import { useState, type ReactNode } from "react";

type Tab = { label: string; content: ReactNode };

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--panel-border)", marginBottom: 20 }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              border: "none",
              borderBottom: i === active ? "2px solid var(--cyan)" : "2px solid transparent",
              background: i === active ? "rgba(5, 217, 232, 0.08)" : "transparent",
              color: i === active ? "var(--cyan)" : "var(--text-muted)",
              clipPath: "none",
              boxShadow: i === active ? "0 2px 8px rgba(5, 217, 232, 0.3)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          padding: 20,
          clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
        }}
      >
        {tabs[active].content}
      </div>
    </div>
  );
}
