"use client";

import { useEffect, useState } from "react";
import { apiGet, API_URL } from "@/lib/api";

type CaseStatus = "open" | "archived";

type CaseSummary = {
  id: string;
  name: string;
  status: CaseStatus;
  created_at: string;
};

type AuditLogEntry = {
  id: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export default function CaseManagement() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [newCaseName, setNewCaseName] = useState("");
  const [selected, setSelected] = useState<CaseSummary | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadCases() {
    setCases(await apiGet<CaseSummary[]>("/cases/"));
  }

  useEffect(() => {
    loadCases();
  }, []);

  async function handleCreate() {
    if (!newCaseName) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/cases/?name=${encodeURIComponent(newCaseName)}`, { method: "POST" });
      setNewCaseName("");
      await loadCases();
    } finally {
      setLoading(false);
    }
  }

  async function openCase(c: CaseSummary) {
    setSelected(c);
    setAuditLog(await apiGet<AuditLogEntry[]>(`/cases/${c.id}/audit-log`));
  }

  async function handleArchive(c: CaseSummary) {
    setLoading(true);
    try {
      await fetch(`${API_URL}/cases/${c.id}/archive?actor=investigador`, { method: "POST" });
      await loadCases();
      if (selected?.id === c.id) await openCase({ ...c, status: "archived" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={newCaseName}
            onChange={(e) => setNewCaseName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nome do caso"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={handleCreate} disabled={loading}>
            Criar caso
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {cases.map((c) => (
            <li
              key={c.id}
              onClick={() => openCase(c)}
              style={{
                padding: 8,
                cursor: "pointer",
                background: selected?.id === c.id ? "rgba(5, 217, 232, 0.08)" : "transparent",
                borderBottom: "1px solid var(--panel-border)",
              }}
            >
              <strong>{c.name}</strong>{" "}
              <span style={{ fontSize: 12, color: c.status === "archived" ? "var(--text-muted)" : "var(--success)" }}>[{c.status}]</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleString()}</div>
            </li>
          ))}
          {cases.length === 0 && <li style={{ color: "var(--text-muted)" }}>Nenhum caso ainda.</li>}
        </ul>
      </div>

      <div style={{ flex: 1 }}>
        {selected ? (
          <>
            <h3>
              {selected.name}{" "}
              {selected.status === "open" && (
                <button onClick={() => handleArchive(selected)} style={{ fontSize: 12 }}>
                  Arquivar
                </button>
              )}
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Trilha de auditoria (imutável):</p>
            <ul>
              {auditLog.map((entry) => (
                <li key={entry.id} style={{ marginBottom: 8 }}>
                  <div>
                    <strong>{entry.action}</strong> — {entry.actor}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(entry.created_at).toLocaleString()}</div>
                  <pre style={{ fontSize: 11, padding: 4 }}>{JSON.stringify(entry.payload)}</pre>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ color: "var(--text-muted)" }}>Selecione um caso pra ver a trilha de auditoria.</p>
        )}
      </div>
    </div>
  );
}
