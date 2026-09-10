"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFetch, apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

type CaseSummary = { id: string; name: string; status: "open" | "archived"; created_at: string };

export default function CaseGate({ children }: { children: ReactNode }) {
  const { activeCase, setActiveCase, hydrated } = useActiveCase();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [newCaseName, setNewCaseName] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCases() {
    setCases((await apiGet<CaseSummary[]>("/cases/")).filter((c) => c.status.toUpperCase() === "OPEN"));
  }

  useEffect(() => {
    if (hydrated && !activeCase) loadCases();
  }, [hydrated, activeCase]);

  if (!hydrated) return null;
  if (activeCase) return <>{children}</>;

  async function handleCreate() {
    if (!newCaseName) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/cases/?name=${encodeURIComponent(newCaseName)}`, { method: "POST" });
      const created = await response.json();
      setActiveCase({ id: created.id, name: created.name });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        Every search finding automatically becomes evidence linked to a case — so before investigating, create
        or select a case.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newCaseName}
          onChange={(e) => setNewCaseName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New case name"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleCreate} disabled={loading || !newCaseName}>
          Create & Activate
        </button>
      </div>
      {cases.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Or continue an open case:</p>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {cases.map((c) => (
              <li
                key={c.id}
                onClick={() => setActiveCase({ id: c.id, name: c.name })}
                style={{ padding: 8, cursor: "pointer", borderBottom: "1px solid var(--panel-border)" }}
              >
                <strong>{c.name}</strong>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
