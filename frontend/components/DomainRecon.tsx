"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import GhostTrackIpTool from "./GhostTrackIpTool";
import { 
  GlobeIcon, 
  CameraIcon, 
  TerminalIcon, 
  ShieldIcon, 
  CheckIcon, 
  CrossIcon, 
  AlertIcon,
  LinkIcon,
  RadarIcon
} from "@/components/FlatIcons";

type DnsRecord = { type: string; value: string };
type Subdomain = { subdomain: string; ip: string };

type DomainResult = {
  dns_records: DnsRecord[];
  subdomains: Subdomain[];
};

type VisualAuditResult = {
  target_input: string;
  final_url: string;
  status_code: number;
  title: string;
  description: string;
  security_score: number;
  security_headers: { header: string; status: string; value: string; is_present: boolean }[];
  detected_technologies: string[];
  server_banner: string;
  content_type: string;
  redirect_chain: string[];
  text_preview: string;
  headers: Record<string, string>;
  error?: string;
};

type ExposureFinding = {
  path: string;
  url: string;
  status_code: number;
  is_accessible: boolean;
  content_length: number;
  risk_level: string;
  redirect_location?: string;
};

type ExposureResult = {
  target: string;
  base_url: string;
  total_probed: number;
  endpoints_found: number;
  discovered: ExposureFinding[];
  error?: string;
};

export default function DomainRecon() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"dns" | "eyewitness" | "breacher" | "ghosttrack">("dns");

  // Domain DNS / Subdomain states (theHarvester)
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<DomainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSubdomains, setSavingSubdomains] = useState(false);
  const [savedSubdomainsCount, setSavedSubdomainsCount] = useState<number | null>(null);

  // EyeWitness / Gowitness states
  const [visualTarget, setVisualTarget] = useState("");
  const [visualUseTor, setVisualUseTor] = useState(false);
  const [visualResult, setVisualResult] = useState<VisualAuditResult | null>(null);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);

  // Breacher / RED_HAWK states
  const [exposureTarget, setExposureTarget] = useState("");
  const [exposureUseTor, setExposureUseTor] = useState(false);
  const [exposureResult, setExposureResult] = useState<ExposureResult | null>(null);
  const [exposureLoading, setExposureLoading] = useState(false);
  const [exposureError, setExposureError] = useState<string | null>(null);

  async function handleSearchDns() {
    if (!domain || !activeCase) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedSubdomainsCount(null);
    try {
      const data = await apiGet<DomainResult>(`/identifiers/domain/recon?domain=${encodeURIComponent(domain)}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error querying domain");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAllSubdomains() {
    if (!activeCase || !result?.subdomains?.length) return;
    setSavingSubdomains(true);
    const investigator = localStorage.getItem("investigator_name") || "anonymous_investigator";
    try {
      let count = 0;
      for (const s of result.subdomains) {
        await apiPostJson(`/cases/${activeCase.id}/findings`, {
          identifier_type: "domain",
          identifier_value: s.subdomain,
          platform: "theharvester.subdomain",
          exists: true,
          discovered_by: `theHarvester (${investigator})`,
          metadata_json: { ip: s.ip, parent_domain: domain },
        });
        count++;
      }
      setSavedSubdomainsCount(count);
    } catch {
      alert("Error saving subdomains to case.");
    } finally {
      setSavingSubdomains(false);
    }
  }

  async function handleVisualAudit() {
    if (!visualTarget.trim()) return;
    setVisualLoading(true);
    setVisualError(null);
    setVisualResult(null);
    try {
      const data = await apiGet<VisualAuditResult>(
        `/recon/visual/audit?target=${encodeURIComponent(visualTarget.trim())}&use_tor=${visualUseTor}`
      );
      setVisualResult(data);
    } catch (e) {
      setVisualError(e instanceof Error ? e.message : "Visual inspection failed");
    } finally {
      setVisualLoading(false);
    }
  }

  async function handleExposureScan() {
    if (!exposureTarget.trim()) return;
    setExposureLoading(true);
    setExposureError(null);
    setExposureResult(null);
    try {
      const data = await apiGet<ExposureResult>(
        `/recon/web/exposure?target=${encodeURIComponent(exposureTarget.trim())}&use_tor=${exposureUseTor}`
      );
      setExposureResult(data);
    } catch (e) {
      setExposureError(e instanceof Error ? e.message : "Exposure scan failed");
    } finally {
      setExposureLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Sub-tab navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--panel-border)", paddingBottom: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("dns")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: activeTab === "dns" ? "bold" : "normal",
            background: activeTab === "dns" ? "rgba(5, 217, 232, 0.15)" : "transparent",
            border: activeTab === "dns" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeTab === "dns" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <GlobeIcon size={13} color={activeTab === "dns" ? "var(--cyan)" : "var(--text-muted)"} />
          1. DNS & Subdomains (theHarvester)
        </button>

        <button
          onClick={() => setActiveTab("eyewitness")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: activeTab === "eyewitness" ? "bold" : "normal",
            background: activeTab === "eyewitness" ? "rgba(5, 217, 232, 0.15)" : "transparent",
            border: activeTab === "eyewitness" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeTab === "eyewitness" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <CameraIcon size={13} color={activeTab === "eyewitness" ? "var(--cyan)" : "var(--text-muted)"} />
          2. Visual Inspector & Headers (EyeWitness / Gowitness)
        </button>

        <button
          onClick={() => setActiveTab("breacher")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: activeTab === "breacher" ? "bold" : "normal",
            background: activeTab === "breacher" ? "rgba(5, 217, 232, 0.15)" : "transparent",
            border: activeTab === "breacher" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeTab === "breacher" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <TerminalIcon size={13} color={activeTab === "breacher" ? "var(--cyan)" : "var(--text-muted)"} />
          3. Admin Panel & Surface Hunter (Breacher / RED_HAWK)
        </button>

        <button
          onClick={() => setActiveTab("ghosttrack")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: activeTab === "ghosttrack" ? "bold" : "normal",
            background: activeTab === "ghosttrack" ? "rgba(5, 217, 232, 0.15)" : "transparent",
            border: activeTab === "ghosttrack" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeTab === "ghosttrack" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <RadarIcon size={13} color={activeTab === "ghosttrack" ? "var(--cyan)" : "var(--text-muted)"} />
          4. IP &amp; Network Intelligence (GhostTrack)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. DNS & SUBDOMAINS (theHarvester) */}
      {/* ========================================================================= */}
      {activeTab === "dns" && (
        <div>
          <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchDns()}
              placeholder="example.com"
              style={{ flex: 1, padding: 8 }}
            />
            <button onClick={handleSearchDns} disabled={loading || !domain.trim()}>
              {loading ? "Scanning..." : "Recon DNS"}
            </button>
          </div>

          {error && <p style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>}

          {result && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 600, margin: "16px 0 8px 0" }}>
                <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  DNS Records
                </h4>
                <SaveToCaseButton
                  key={`${activeCase?.id}-${domain}`}
                  identifierType="domain"
                  identifierValue={domain}
                  platform="dns"
                  exists={true}
                  discoveredBy="theHarvester.dns"
                  metadata={{ dns_records: result.dns_records.length, subdomains: result.subdomains.length }}
                />
              </div>

              <table style={{ width: "100%", maxWidth: 600, textAlign: "left", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ width: "90px", padding: "6px 0", color: "var(--text-muted)" }}>Type</th>
                    <th style={{ padding: "6px 0", color: "var(--text-muted)" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.dns_records.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "6px 0", color: "var(--cyan)", fontWeight: "bold" }}>{r.type}</td>
                      <td style={{ padding: "6px 0", fontFamily: "monospace", wordBreak: "break-all" }}>{r.value}</td>
                    </tr>
                  ))}
                  {result.dns_records.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ padding: 10, color: "var(--text-muted)" }}>No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 8px 0" }}>
                <h4 style={{ margin: 0, color: "var(--cyan)" }}>
                  Subdomains Discovered ({result.subdomains.length})
                </h4>
                {result.subdomains.length > 0 && (
                  <button
                    onClick={handleSaveAllSubdomains}
                    disabled={savingSubdomains || !activeCase}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      background: savedSubdomainsCount !== null ? "rgba(0, 255, 159, 0.2)" : "var(--cyan)",
                      color: savedSubdomainsCount !== null ? "var(--success)" : "#000",
                      border: "1px solid var(--border)",
                      fontWeight: "bold",
                      cursor: activeCase ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {savedSubdomainsCount !== null ? (
                      <>
                        <CheckIcon size={12} color="var(--success)" /> Added {savedSubdomainsCount} to Case
                      </>
                    ) : savingSubdomains ? (
                      "Saving to Case..."
                    ) : (
                      `+ Add All (${result.subdomains.length}) to Case`
                    )}
                  </button>
                )}
              </div>
              <ul style={{ paddingLeft: 0, listStyle: "none", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                {result.subdomains.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(0,0,0,0.2)",
                      padding: "6px 10px",
                      borderRadius: 4,
                      border: "1px solid var(--panel-border)",
                    }}
                  >
                    <div>
                      <strong>{s.subdomain}</strong> <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>({s.ip})</span>
                    </div>
                    <SaveToCaseButton
                      key={`${activeCase?.id}-${s.subdomain}`}
                      identifierType="domain"
                      identifierValue={s.subdomain}
                      platform="theharvester.subdomain"
                      exists={true}
                      discoveredBy="theHarvester"
                      metadata={{ ip: s.ip, parent_domain: domain }}
                    />
                  </li>
                ))}
                {result.subdomains.length === 0 && <li style={{ color: "var(--text-muted)" }}>No subdomains found.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VISUAL INSPECTOR & HEADERS (EyeWitness + Gowitness) */}
      {/* ========================================================================= */}
      {activeTab === "eyewitness" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "rgba(0,0,0,0.3)", padding: 16, border: "1px solid var(--panel-border)", borderRadius: 4 }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--cyan)", marginBottom: 6 }}>
              TARGET HOST OR URL TO PROBE (EyeWitness &amp; Gowitness Engine)
            </label>
            <div style={{ display: "flex", gap: 8, maxWidth: 650 }}>
              <input
                value={visualTarget}
                onChange={(e) => setVisualTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVisualAudit()}
                placeholder="https://example.com or example.com"
                style={{ flex: 1, padding: 10, fontSize: 13 }}
              />
              <button
                onClick={handleVisualAudit}
                disabled={visualLoading || !visualTarget.trim()}
                style={{ padding: "10px 18px", fontWeight: "bold" }}
              >
                {visualLoading ? "AUDITING..." : "INSPECT TARGET"}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={visualUseTor}
                  onChange={(e) => setVisualUseTor(e.target.checked)}
                />
                Route probe via Tor SOCKS5
              </label>
            </div>
          </div>

          {visualError && <p style={{ color: "var(--danger)" }}>{visualError}</p>}

          {visualResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Top Banner */}
              <div
                style={{
                  background: "#080c14",
                  border: "1px solid var(--panel-border)",
                  padding: 16,
                  borderRadius: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>RESPONSE CODE / TARGET:</div>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: visualResult.status_code === 200 ? "var(--success)" : "var(--cyan)" }}>
                    HTTP {visualResult.status_code} — {visualResult.final_url}
                  </div>
                  <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                    Title: <strong>{visualResult.title}</strong>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SECURITY POSTURE SCORE:</div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: "bold",
                      color: visualResult.security_score >= 60 ? "#00ffcc" : "#ffaa33",
                    }}
                  >
                    {visualResult.security_score} / 100
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Server: {visualResult.server_banner}
                  </div>
                </div>
              </div>

              {/* Technologies identified */}
              {visualResult.detected_technologies.length > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold" }}>TECHNOLOGY STACK:</span>
                  {visualResult.detected_technologies.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        background: "rgba(5, 217, 232, 0.12)",
                        border: "1px solid rgba(5, 217, 232, 0.3)",
                        color: "var(--cyan)",
                        borderRadius: 3,
                        fontWeight: "bold",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Security Headers Table */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: 14 }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--cyan)", letterSpacing: "0.05em" }}>
                  SECURITY HEADERS COMPLIANCE AUDIT
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {visualResult.security_headers.map((sh, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        padding: "6px 8px",
                        background: sh.is_present ? "rgba(0, 255, 159, 0.05)" : "rgba(255, 0, 85, 0.05)",
                        borderLeft: sh.is_present ? "3px solid #00ff9f" : "3px solid #ff0055",
                      }}
                    >
                      <span style={{ fontWeight: "bold" }}>{sh.header}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sh.value}
                        </span>
                        {sh.is_present ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#00ff9f", fontSize: 11, fontWeight: "bold" }}>
                            <CheckIcon size={12} color="#00ff9f" /> PASS
                          </span>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#ff5577", fontSize: 11, fontWeight: "bold" }}>
                            <CrossIcon size={12} color="#ff5577" /> MISSING
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Text Excerpt preview */}
              {visualResult.text_preview && (
                <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 12, borderRadius: 4 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>RENDERED VIEWPORT TEXT PREVIEW:</div>
                  <div style={{ fontSize: 12, color: "var(--text-main)", fontStyle: "italic", lineHeight: 1.4 }}>
                    &ldquo;{visualResult.text_preview}&rdquo;
                  </div>
                </div>
              )}

              {/* Save to case */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveToCaseButton
                  identifierType="domain"
                  identifierValue={visualResult.final_url}
                  platform="eyewitness.visual"
                  url={visualResult.final_url}
                  discoveredBy="eyewitness"
                  metadata={{
                    title: visualResult.title,
                    server: visualResult.server_banner,
                    security_score: visualResult.security_score,
                    technologies: visualResult.detected_technologies,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ADMIN PANEL & SURFACE HUNTER (Breacher + RED_HAWK) */}
      {/* ========================================================================= */}
      {activeTab === "breacher" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "rgba(0,0,0,0.3)", padding: 16, border: "1px solid var(--panel-border)", borderRadius: 4 }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--cyan)", marginBottom: 6 }}>
              TARGET DOMAIN FOR ADMINISTRATIVE SURFACE DISCOVERY (Breacher &amp; RED_HAWK Engine)
            </label>
            <div style={{ display: "flex", gap: 8, maxWidth: 650 }}>
              <input
                value={exposureTarget}
                onChange={(e) => setExposureTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExposureScan()}
                placeholder="example.com"
                style={{ flex: 1, padding: 10, fontSize: 13 }}
              />
              <button
                onClick={handleExposureScan}
                disabled={exposureLoading || !exposureTarget.trim()}
                style={{ padding: "10px 18px", fontWeight: "bold" }}
              >
                {exposureLoading ? "SCANNING SURFACE..." : "HUNT ADMIN PANELS"}
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={exposureUseTor}
                  onChange={(e) => setExposureUseTor(e.target.checked)}
                />
                Route requests via Tor SOCKS5
              </label>
            </div>
          </div>

          {exposureError && <p style={{ color: "var(--danger)" }}>{exposureError}</p>}

          {exposureResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "rgba(5, 217, 232, 0.05)",
                  border: "1px solid rgba(5, 217, 232, 0.2)",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>
                  IDENTIFIED {exposureResult.endpoints_found} ACTIVE PATHS (PROBED {exposureResult.total_probed} STANDARD ENDPOINTS)
                </span>
                <span style={{ color: "var(--text-muted)" }}>Target: {exposureResult.base_url}</span>
              </div>

              {exposureResult.discovered.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  No open or exposed administrative entrypoints discovered across standard probes.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {exposureResult.discovered.map((item, idx) => {
                    const isHigh = item.risk_level === "HIGH";
                    const isMed = item.risk_level === "MEDIUM";
                    const riskBg = isHigh ? "rgba(255, 0, 85, 0.15)" : isMed ? "rgba(255, 170, 51, 0.15)" : "rgba(0, 255, 159, 0.08)";
                    const riskColor = isHigh ? "#ff5577" : isMed ? "#ffaa33" : "#00ff9f";

                    return (
                      <div
                        key={idx}
                        style={{
                          background: "#080c14",
                          border: item.is_accessible ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
                          padding: 12,
                          borderRadius: 4,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "var(--cyan)" }}>
                            {item.path}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: "bold",
                              padding: "1px 6px",
                              borderRadius: 3,
                              background: riskBg,
                              color: riskColor,
                            }}
                          >
                            {item.risk_level} RISK
                          </span>
                        </div>

                        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                          Status: <strong style={{ color: item.status_code === 200 ? "#00ff9f" : "#ffaa33" }}>HTTP {item.status_code}</strong>
                          {item.is_accessible ? " (Open / Accessible)" : " (Restricted / Auth Required)"}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: "var(--cyan)",
                              textDecoration: "underline",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <LinkIcon size={11} color="var(--cyan)" /> Direct Link
                          </a>

                          <SaveToCaseButton
                            identifierType="domain"
                            identifierValue={`${exposureResult.target}${item.path}`}
                            platform="breacher.panel"
                            url={item.url}
                            discoveredBy="breacher"
                            metadata={{
                              path: item.path,
                              status_code: item.status_code,
                              risk_level: item.risk_level,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. IP & NETWORK INTELLIGENCE (GhostTrack) */}
      {/* ========================================================================= */}
      {activeTab === "ghosttrack" && <GhostTrackIpTool />}
    </div>
  );
}
