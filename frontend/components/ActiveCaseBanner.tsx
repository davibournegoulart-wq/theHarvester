"use client";

import { useEffect, useState } from "react";
import { useActiveCase } from "@/lib/activeCase";
import { apiGet } from "@/lib/api";

type CaseItem = {
  id: string;
  name: string;
  status: string;
};

export default function ActiveCaseBanner() {
  const { activeCase, setActiveCase } = useActiveCase();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    apiGet<CaseItem[]>("/cases/")
      .then((list) => {
        setCases(list || []);
        // Auto-select latest active case if none is selected
        if (!activeCase && list && list.length > 0) {
          setActiveCase({ id: list[0].id, name: list[0].name });
        }
      })
      .catch((err) => console.error("Error loading cases for banner:", err));
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: activeCase ? "var(--cyan)" : "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 6,
          background: activeCase ? "rgba(5, 217, 232, 0.1)" : "rgba(255, 255, 255, 0.03)",
          border: activeCase ? "1px solid rgba(5, 217, 232, 0.35)" : "1px solid var(--border)",
          whiteSpace: "nowrap",
          cursor: "pointer",
          boxShadow: activeCase ? "0 0 10px rgba(5, 217, 232, 0.15)" : "none",
        }}
        title="Click to switch active investigation case"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: activeCase ? "var(--cyan)" : "var(--text-muted)",
            boxShadow: activeCase ? "0 0 8px var(--cyan)" : "none",
            display: "inline-block",
          }}
        />
        <span>
          {activeCase ? `Active Case: ${activeCase.name}` : "Select Case ▾"}
        </span>
        <span style={{ fontSize: 10, color: "var(--cyan)", marginLeft: 2 }}>▾</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "115%",
            right: 0,
            width: 320,
            background: "rgba(10, 14, 24, 0.98)",
            border: "1px solid var(--cyan)",
            borderRadius: 8,
            boxShadow: "0 8px 30px rgba(0,0,0,0.8)",
            backdropFilter: "blur(12px)",
            padding: 8,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--cyan)", padding: "4px 8px", fontFamily: "monospace", letterSpacing: "0.1em" }}>
            SWITCH ACTIVE INVESTIGATION:
          </div>
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setActiveCase({ id: c.id, name: c.name });
                setIsOpen(false);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: activeCase?.id === c.id ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: activeCase?.id === c.id ? "var(--cyan)" : "#fff",
                fontSize: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: activeCase?.id === c.id ? "bold" : "normal" }}>{c.name}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


