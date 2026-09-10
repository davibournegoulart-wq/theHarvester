"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CaseFilesDatabank from "./CaseFilesDatabank";
import { LinkIcon } from "@/components/FlatIcons";

type CaseStatus = "OPEN" | "CLOSED" | "COLD" | "ARCHIVED";

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [sourceCaseToMerge, setSourceCaseToMerge] = useState("");

  
  async function handleRename() {
    if (!selected || !editNameValue.trim() || editNameValue === selected.name) {
      setIsEditingName(false);
      return;
    }
    setLoading(true);
    try {
      await apiFetch(`/cases/${selected.id}/name?name=${encodeURIComponent(editNameValue.trim())}&actor=investigator`, { method: "PATCH" });
      await loadCases();
      const updated = { ...selected, name: editNameValue.trim() };
      if (activeCase?.id === updated.id) setActiveCase({ id: updated.id, name: updated.name });
      await openCase(updated);
      setIsEditingName(false);
    } catch(e) {
      alert("Error renaming case");
    } finally {
      setLoading(false);
    }
  }

  async function loadCases() {
    setCases(await apiGet<CaseSummary[]>("/cases/"));
  }

  useEffect(() => {
    loadCases();
  }, []);

  async function handleCreate() {
    if (!newCaseName.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/cases/?name=${encodeURIComponent(newCaseName)}`, { method: "POST" });
      const c = await res.json();
      await loadCases();
      setNewCaseName("");
      setActiveCase({ id: c.id, name: c.name });
    } finally {
      setLoading(false);
    }
  }

  async function openCase(c: CaseSummary) {
    setSelected(c);
    setActiveCase({ id: c.id, name: c.name });
    setAuditLog(await apiGet<AuditLogEntry[]>(`/cases/${c.id}/audit-log`));
    setReport(await apiGet<CaseReport>(`/cases/${c.id}/report`));
  }

  async function handleChangeStatus(c: CaseSummary, newStatus: CaseStatus) {
    setLoading(true);
    try {
      await apiFetch(`/cases/${c.id}/status?status=${newStatus}&actor=investigator`, { method: "PATCH" });
      await loadCases();
      if (selected?.id === c.id) await openCase({ ...c, status: newStatus });
    } finally {
      setLoading(false);
    }
  }

  async function handleMerge() {
    if (!selected || !sourceCaseToMerge) return;
    const sourceObj = cases.find((c) => c.id === sourceCaseToMerge);
    if (!sourceObj) return;

    if (!window.confirm(`Merge all evidence and findings from "${sourceObj.name}" into "${selected.name}"? This will consolidate both cases.`)) {
      return;
    }

    setLoading(true);
    try {
      await apiFetch(`/cases/${selected.id}/merge?source_case_id=${encodeURIComponent(sourceCaseToMerge)}&actor=investigator`, {
        method: "POST",
      });
      await loadCases();
      await openCase(selected);
      setIsMerging(false);
      setSourceCaseToMerge("");
      alert(`Successfully merged "${sourceObj.name}" into "${selected.name}"!`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error merging cases");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(c: CaseSummary) {
    if (!window.confirm(`Are you sure you want to completely delete the case "${c.name}"? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      await apiFetch(`/cases/${c.id}`, { method: "DELETE" });
      if (selected?.id === c.id) setSelected(null);
      if (activeCase?.id === c.id) setActiveCase(null);
      await loadCases();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error deleting case");
    } finally {
      setLoading(false);
    }
  }

  async function generateSTIX() {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await apiGet<any>(`/cases/${selected.id}/stix`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `STIX2_${selected.name.replace(/\s+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error generating STIX bundle");
    } finally {
      setLoading(false);
    }
  }

  async function generatePDF() {
    if (!selected) return;
    const element = document.getElementById("report-content");
    if (!element) return;
    
    setLoading(true);
    try {
      // Create a temporary clone for proper styling during export
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#0a0c12" // our dark theme bg
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Dossier_${selected.name.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 300px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            value={newCaseName}
            onChange={(e) => setNewCaseName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Case name"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={handleCreate} disabled={loading}>
            Create case
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {cases.map((c) => (
            <li
              key={c.id}
              onClick={() => openCase(c)}
              style={{
                padding: 12,
                cursor: "pointer",
                background: selected?.id === c.id ? "rgba(5, 217, 232, 0.08)" : "transparent",
                borderBottom: "1px solid var(--panel-border)",
                transition: "background 0.2s"
              }}
            >
              <strong>{c.name}</strong>{" "}
              <span style={{ fontSize: 12, color: c.status === "OPEN" ? "var(--success)" : c.status === "CLOSED" ? "var(--danger)" : "var(--text-muted)" }}>[{c.status}]</span>
              {activeCase?.id === c.id ? (
                <span style={{ fontSize: 11, color: "var(--cyan)", marginLeft: 6 }}>[active]</span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveCase({ id: c.id, name: c.name });
                  }}
                  style={{ fontSize: 11, marginLeft: 6, padding: "2px 8px" }}
                >
                  activate
                </button>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(c.created_at).toLocaleString()}</div>
            </li>
          ))}
          {cases.length === 0 && <li style={{ color: "var(--text-muted)" }}>No cases yet.</li>}
        </ul>
      </div>

      <div style={{ flex: "2 1 500px" }}>
        {selected ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 8 }}>
                {isEditingName ? (
                  <input
                    autoFocus
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') handleRename(); if(e.key === 'Escape') setIsEditingName(false); }}
                    onBlur={handleRename}
                    style={{ padding: "2px 8px", fontSize: 18, fontWeight: "bold", color: "var(--cyan)", background: "var(--panel)", border: "1px solid var(--cyan)", borderRadius: 4 }}
                  />
                ) : (
                  <>
                    {selected.name}
                    <button 
                      onClick={() => { setEditNameValue(selected.name); setIsEditingName(true); }}
                      style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                      title="Rename case"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                  </>
                )}
                <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: "normal" }}>({selected.status})</span>
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={generateSTIX} disabled={loading} style={{ display: "flex", alignItems: "center", background: "rgba(156,39,176,0.1)", borderColor: "#9C27B0", color: "#9C27B0", fontWeight: "bold" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg> STIX 2.1
                </button>
                <button onClick={generatePDF} disabled={loading} style={{ display: "flex", alignItems: "center", background: "rgba(5,217,232,0.1)", borderColor: "var(--cyan)", fontWeight: "bold" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> PDF
                </button>
                <button
                  onClick={() => setIsMerging(!isMerging)}
                  disabled={loading || cases.filter((c) => c.id !== selected.id).length === 0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: isMerging ? "rgba(0, 255, 100, 0.2)" : "rgba(0, 255, 100, 0.08)",
                    borderColor: "#00ff66",
                    color: "#00ff66",
                    fontWeight: "bold",
                  }}
                  title="Merge findings from another case into this one"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="18" r="3" />
                    <circle cx="6" cy="6" r="3" />
                    <path d="M6 21V9a9 9 0 0 0 9 9" />
                  </svg>
                  Merge Case
                </button>
                {selected.status === "OPEN" && (
                  <>
                    <button onClick={() => handleChangeStatus(selected, "CLOSED")} disabled={loading} style={{ borderColor: "var(--success)", color: "var(--success)" }}>
                      Close Case
                    </button>
                    <button onClick={() => handleChangeStatus(selected, "COLD")} disabled={loading} style={{ borderColor: "var(--text-muted)", color: "var(--text-muted)" }}>
                      Mark as Cold
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(selected)} disabled={loading} style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "rgba(255,0,0,0.1)" }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Merge Case Accordion / Inline Selector */}
            {isMerging && (
              <div style={{ marginBottom: 16, padding: 14, background: "rgba(0,255,100,0.05)", border: "1px solid #00ff66", borderRadius: 6 }}>
                <div style={{ fontWeight: "bold", color: "#00ff66", marginBottom: 8, fontSize: 13 }}>
                  MERGE ANOTHER CASE INTO &quot;{selected.name.toUpperCase()}&quot;
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  Select an existing case to absorb. All of its targets, accounts, findings, and audit trails will be imported into this case.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={sourceCaseToMerge}
                    onChange={(e) => setSourceCaseToMerge(e.target.value)}
                    style={{ flex: 1, padding: 8, background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    <option value="">-- Choose case to merge into this one --</option>
                    {cases
                      .filter((c) => c.id !== selected.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.status})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleMerge}
                    disabled={loading || !sourceCaseToMerge}
                    style={{ background: "#00ff66", color: "#000", fontWeight: "bold", border: "none", padding: "8px 16px" }}
                  >
                    {loading ? "Merging..." : "Confirm Merge"}
                  </button>
                  <button
                    onClick={() => { setIsMerging(false); setSourceCaseToMerge(""); }}
                    style={{ background: "transparent", border: "1px solid var(--border)", padding: "8px 12px" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            <div id="report-content" style={{ padding: 16, border: "1px solid var(--panel-border)", background: "var(--bg)", borderRadius: 4 }}>
              <h1 style={{ color: "var(--cyan)", borderBottom: "1px solid var(--cyan)", paddingBottom: 8 }}>DOSSIER: {selected.name.toUpperCase()}</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Automatically generated by Net Scraper OSINT.</p>
              
              <h3 style={{ marginTop: 24, color: "var(--text)" }}>INVESTIGATION STATISTICS</h3>
              {report && report.by_platform.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  No findings saved yet — engage Auto-Recon or use manual tools.
                </p>
              ) : (
                <div style={{ display: "flex", gap: 32 }}>
                  <div>
                    <strong style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>By platform:</strong>
                    <ul style={{ marginTop: 0, fontSize: 14 }}>
                      {report?.by_platform.map((s) => (
                        <li key={s.label}>{s.label}: <strong>{s.value}</strong></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>By detection method:</strong>
                    <ul style={{ marginTop: 0, fontSize: 14 }}>
                      {report?.by_discovery_source.map((s) => (
                        <li key={s.label}>{s.label}: <strong>{s.value}</strong></li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              <h3 style={{ marginTop: 32, color: "var(--text)" }}>TIMELINE & EVIDENCE</h3>
              <div style={{ borderLeft: "2px solid var(--panel-border)", marginLeft: 8, paddingLeft: 16 }}>
                {auditLog.map((entry) => (
                  <div key={entry.id} style={{ marginBottom: 16, position: "relative" }}>
                    <div style={{ position: "absolute", left: -25, top: 4, width: 14, height: 14, background: "var(--bg)", border: "2px solid var(--cyan)", borderRadius: "50%" }}></div>
                    <div style={{ fontSize: 11, color: "var(--cyan)", fontWeight: "bold" }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <strong>{entry.action.replace(/_/g, " ").toUpperCase()}</strong> — (by: {entry.actor})
                    </div>
                    {entry.action === "evidence_saved" ? (
                      <div style={{ fontSize: 13, marginTop: 4, background: "var(--panel)", padding: 8, border: "1px solid var(--panel-border)", borderRadius: 4 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
                          <LinkIcon size={12} color="var(--cyan)" />
                          <a href={String(entry.payload.url)} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>
                            {String(entry.payload.url)}
                          </a>
                        </span>
                        {!!entry.payload.note && <div style={{ color: "var(--text-muted)", marginTop: 4 }}>Note: {String(entry.payload.note)}</div>}
                      </div>
                    ) : (
                      <pre style={{ fontSize: 12, padding: 8, background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 4, marginTop: 4, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {auditLog.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No evidence records.</p>}
              </div>
            </div>

            {/* Case File Attachments / Secure Databank */}
            <CaseFilesDatabank caseId={selected.id} caseName={selected.name} />
          </div>
        ) : (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", border: "1px dashed var(--panel-border)", borderRadius: 8 }}>
            Select a case from the list to view and export the dossier.
          </div>
        )}
      </div>
    </div>
  );
}
