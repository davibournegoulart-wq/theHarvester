"use client";

import { useState, type ReactNode } from "react";

type Tab = { label: string; content: ReactNode; icon?: ReactNode };

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div 
        style={{ 
          display: "flex", 
          gap: 4, 
          flexWrap: "wrap",
          borderBottom: "1px solid var(--panel-border)", 
          marginBottom: 20,
          paddingBottom: 4, // prevent clipping focus rings
        }}
        className="hide-scrollbar"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            style={{
              padding: "10px 16px",
              fontSize: 12,
              letterSpacing: "0.1em",
              border: "none",
              borderBottom: i === active ? "2px solid var(--cyan)" : "2px solid transparent",
              background: i === active ? "rgba(5, 217, 232, 0.08)" : "transparent",
              color: i === active ? "var(--cyan)" : "var(--text-muted)",
              clipPath: "none",
              boxShadow: i === active ? "0 2px 8px rgba(5, 217, 232, 0.3)" : "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {tab.icon && (
              <span style={{ display: "inline-flex", alignItems: "center", opacity: i === active ? 1 : 0.7 }}>
                {tab.icon}
              </span>
            )}
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
