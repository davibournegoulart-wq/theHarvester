"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

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

type ChartSeries = { label: string; value: number };

type CaseReport = {
  by_platform: ChartSeries[];
  by_discovery_source: ChartSeries[];
};

export default function CaseManagement() {
  const { activeCase, setActiveCase } = useActiveCase();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [newCaseName, setNewCaseName] = useState("");
  const [selected, setSelected] = useState<CaseSummary | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [report, setReport] = useState<CaseReport | null>(null);
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
      await apiFetch(`/cases/?name=${encodeURIComponent(newCaseName)}`, { method: "POST" });
      setNewCaseName("");
      await loadCases();
    } finally {
      setLoading(false);
    }
  }

  async function openCase(c: CaseSummary) {
    setSelected(c);
    setAuditLog(await apiGet<AuditLogEntry[]>(`/cases/${c.id}/audit-log`));
    setReport(await apiGet<CaseReport>(`/cases/${c.id}/report`));
  }

  async function handleArchive(c: CaseSummary) {
    setLoading(true);
    try {
      await apiFetch(`/cases/${c.id}/archive?actor=investigador`, { method: "POST" });
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
              {activeCase?.id === c.id ? (
                <span style={{ fontSize: 11, color: "var(--cyan)", marginLeft: 6 }}>[ativo]</span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveCase({ id: c.id, name: c.name });
                  }}
                  style={{ fontSize: 11, marginLeft: 6, padding: "1px 6px" }}
                >
                  marcar como ativo
                </button>
              )}
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
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Relatório (achados salvos neste caso):</p>
            {report && report.by_platform.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhum achado salvo ainda — use "salvar no caso" nas abas Username/Email/Telefone.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Por plataforma:</p>
                <ul style={{ marginTop: 0 }}>
                  {report?.by_platform.map((s) => (
                    <li key={s.label}>
                      {s.label}: {s.value}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Por fonte de descoberta:</p>
                <ul style={{ marginTop: 0 }}>
                  {report?.by_discovery_source.map((s) => (
                    <li key={s.label}>
                      {s.label}: {s.value}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>Trilha de auditoria (imutável):</p>
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
