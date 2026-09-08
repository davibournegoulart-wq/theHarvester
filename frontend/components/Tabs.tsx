"use client";

import { useState, type ReactNode } from "react";

type Tab = { label: string; content: ReactNode };

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #ddd", marginBottom: 16 }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: i === active ? "2px solid #333" : "2px solid transparent",
              background: "none",
              fontWeight: i === active ? "bold" : "normal",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[active].content}
    </div>
  );
}
