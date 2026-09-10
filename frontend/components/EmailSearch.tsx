"use client";

import { useState } from "react";
import { apiFetch, apiGet, apiPostJson, apiPostFormData } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import { CheckIcon, CrossIcon, FolderIcon, GlobeIcon } from "@/components/FlatIcons";

type EmailResult = {
  service: string;
  exists: boolean;
  rate_limited: boolean;
  leaked_recovery_hint: string | null;
};

type GoogleAccountResult = {
  gaia_id: string | null;
  profile_photo_url: string | null;
  is_public_profile: boolean;
};

type GravatarResult = {
  exists: boolean;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  location: string | null;
  description: string | null;
  job_title: string | null;
  company: string | null;
  verified_accounts: { url: string; service_label: string }[] | null;
};

type EmailBreachResult = { breaches: string[] };

type BreachDirectoryResult = { breaches: string[]; sources_count: number };
type BreachAnalytics = { risk_score: number | null; breach_count: number; first_breach: string | null; latest_breach: string | null };

type EmailHop = { ip: string | null; hostname: string | null; timestamp: string | null; protocol: string | null; delay_seconds: number | null };
type AuthResult = { mechanism: string; result: string; details: string | null };
type HeaderAnomaly = { type: string; description: string; severity: string };
type EmailHeaderAnalysis = {
  hops: EmailHop[]; auth_results: AuthResult[]; anomalies: HeaderAnomaly[];
  from_address: string | null; return_path: string | null; subject: string | null;
  message_id: string | null; date: string | null; x_mailer: string | null;
};

export default function EmailSearch() {
  const { activeCase } = useActiveCase();
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [googleResult, setGoogleResult] = useState<GoogleAccountResult | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [gravatarResult, setGravatarResult] = useState<GravatarResult | null>(null);
  
  const [breachResult, setBreachResult] = useState<EmailBreachResult | null>(null);
  const [bdResult, setBdResult] = useState<BreachDirectoryResult | null>(null);
  const [analyticsResult, setAnalyticsResult] = useState<BreachAnalytics | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [rawHeaders, setRawHeaders] = useState("");
  const [headerAnalysis, setHeaderAnalysis] = useState<EmailHeaderAnalysis | null>(null);
  const [headerLoading, setHeaderLoading] = useState(false);

  async function handleSearch() {
    if (!email || !activeCase) return;
    setLoading(true);
    setGoogleError(null);
    setGoogleResult(null);
    setBreachResult(null);
    setBdResult(null);
    setAnalyticsResult(null);

    try {
      const data = await apiGet<{ services: EmailResult[] }>(`/identifiers/email/${encodeURIComponent(email)}`);
      const services = data.services ?? [];
      setResults(services);
      setSearched(true);

      await Promise.all(
        services
          .filter((r) => r.exists)
          .map((r) =>
            apiPostJson(`/cases/${activeCase.id}/findings`, {
              identifier_type: "email",
              identifier_value: email,
              platform: r.service,
              exists: r.exists,
              discovered_by: "checkers.email",
              metadata_json: { rate_limited: r.rate_limited, leaked_recovery_hint: r.leaked_recovery_hint },
            }).catch(() => {})
          )
      );

      // Google Account
      try {
        const googleResponse = await apiFetch(`/identifiers/google-account/${encodeURIComponent(email)}`);
        if (googleResponse.ok) {
          const google: GoogleAccountResult = await googleResponse.json();
          setGoogleResult(google);
        } else {
          const body = await googleResponse.json().catch(() => null);
          setGoogleError(body?.detail ?? `Error ${googleResponse.status}`);
        }
      } catch (e) {
        setGoogleError(e instanceof Error ? e.message : "Error querying Google account");
      }

      // Gravatar
      apiGet<GravatarResult>(`/identifiers/gravatar/${encodeURIComponent(email)}`).then((res) => {
        setGravatarResult(res);
      }).catch(() => {});

      // Breaches (XposedOrNot, Analytics, BreachDirectory)
      apiGet<EmailBreachResult>(`/identifiers/breach/email?email=${encodeURIComponent(email)}`).then(setBreachResult).catch(() => {});
      apiGet<BreachDirectoryResult>(`/recon/breach/directory?email=${encodeURIComponent(email)}`).then(setBdResult).catch(() => {});
      apiGet<BreachAnalytics>(`/recon/breach/analytics?email=${encodeURIComponent(email)}`).then(setAnalyticsResult).catch(() => {});

    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeHeaders() {
    if (!rawHeaders.trim()) return;
    setHeaderLoading(true);
    try {
      const res = await apiPostJson<EmailHeaderAnalysis>("/email-forensics/headers/analyze", { raw_headers: rawHeaders });
      setHeaderAnalysis(res);
    } catch (e) {
      alert("Error analyzing headers");
    } finally {
      setHeaderLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeaderLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiPostFormData<EmailHeaderAnalysis>("/email-forensics/headers/analyze-eml", formData);
      setHeaderAnalysis(res);
    } catch (err) {
      alert("Error processing .eml file");
    } finally {
      setHeaderLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      {/* SECTION 1: EMAIL SEARCH */}
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <GlobeIcon size={18} color="var(--cyan)" /> Email Search (OSINT)
      </h3>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="email@domain.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {searched && !loading && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Registrations and Platforms (Login/Recovery Test)</h4>
          <ul style={{ margin: 0 }}>
            {results.map((r) => (
              <li key={r.service} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <strong>{r.service}</strong>:{" "}
                {r.exists ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                    <CheckIcon size={12} color="var(--success)" /> Registered
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                    <CrossIcon size={12} color="var(--danger)" /> Not registered
                  </span>
                )}
              </li>
            ))}
            {results.length === 0 && <li>No service available.</li>}
          </ul>

          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Breaches (Breach Intelligence)</h4>
          <ul>
            <li>
              <strong>XposedOrNot:</strong>{" "}
              {breachResult?.breaches.length ? `Found in ${breachResult.breaches.length} breach(es) (${breachResult.breaches.slice(0, 5).join(", ")}...)` : "No breaches found"}
            </li>
            <li>
              <strong>BreachDirectory:</strong>{" "}
              {bdResult?.sources_count ? `Found in ${bdResult.sources_count} public breach(es)` : "No breaches found"}
            </li>
            {analyticsResult && analyticsResult.breach_count > 0 && (
              <li>
                <strong>Metrics:</strong> Risk {analyticsResult.risk_score ?? "?"}/10. 
                First: {analyticsResult.first_breach}, Latest: {analyticsResult.latest_breach}
              </li>
            )}
          </ul>

          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Accounts and Public Profiles</h4>
          {googleError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{googleError}</p>}
          {googleResult && (
            <ul>
              <li><strong>Google:</strong> Gaia ID: {googleResult.gaia_id ?? "N/A"} (Public: {googleResult.is_public_profile ? "Yes" : "No"})</li>
            </ul>
          )}
          {gravatarResult?.exists && (
            <ul>
              <li><strong>Gravatar:</strong> {gravatarResult.display_name} ({gravatarResult.location})</li>
            </ul>
          )}
        </>
      )}

      {/* SECTION 2: EMAIL HEADER FORENSICS */}
      <hr style={{ margin: "24px 0", borderColor: "var(--panel-border)" }} />
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <FolderIcon size={18} color="var(--cyan)" /> Header Forensics (Header Analysis)
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        Paste raw message headers or upload a .eml file to extract hops, anomalies, and SPF/DKIM/DMARC failures.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <textarea
          value={rawHeaders}
          onChange={(e) => setRawHeaders(e.target.value)}
          placeholder="Return-Path: <spoofed@domain.com>
Received: from mx.domain.com..."
          style={{ flex: 1, minHeight: 120, padding: 8, fontFamily: "monospace", fontSize: 12 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
          <button onClick={handleAnalyzeHeaders} disabled={headerLoading}>
            {headerLoading ? "Analyzing..." : "Analyze Text"}
          </button>
          <label style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 16px", background: "var(--surface)", 
            border: "1px solid var(--border)", cursor: "pointer", textAlign: "center", fontSize: 13, borderRadius: 4
          }}>
            <FolderIcon size={14} color="var(--cyan)" />
            Upload .eml
            <input type="file" accept=".eml" style={{ display: "none" }} onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {headerAnalysis && (
        <div style={{ marginTop: 16, background: "var(--surface)", padding: 16, borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Analysis Results</h4>
          <ul style={{ fontSize: 13 }}>
            <li><strong>From:</strong> {headerAnalysis.from_address}</li>
            <li><strong>Return-Path:</strong> {headerAnalysis.return_path}</li>
            <li><strong>Subject:</strong> {headerAnalysis.subject}</li>
            <li><strong>Date:</strong> {headerAnalysis.date}</li>
            <li><strong>X-Mailer:</strong> {headerAnalysis.x_mailer || "N/A"}</li>
          </ul>

          {headerAnalysis.anomalies.length > 0 && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: 12, borderRadius: 4, marginTop: 12 }}>
              <strong>Detected Anomalies:</strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {headerAnalysis.anomalies.map((a, i) => <li key={i}>{a.description}</li>)}
              </ul>
            </div>
          )}

          {headerAnalysis.auth_results.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Authentication (SPF/DKIM/DMARC):</strong>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                {headerAnalysis.auth_results.map((auth, i) => (
                  <li key={i}>{auth.mechanism.toUpperCase()}: {auth.result} {auth.details ? `(${auth.details})` : ""}</li>
                ))}
              </ul>
            </div>
          )}

          {headerAnalysis.hops.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Server Route (Hops):</strong>
              <table style={{ width: "100%", fontSize: 12, textAlign: "left", marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>Hostname</th>
                    <th>Protocol</th>
                    <th>Timestamp</th>
                    <th>Delay</th>
                  </tr>
                </thead>
                <tbody>
                  {headerAnalysis.hops.map((hop, i) => (
                    <tr key={i}>
                      <td>{hop.ip || "-"}</td>
                      <td>{hop.hostname || "-"}</td>
                      <td>{hop.protocol || "-"}</td>
                      <td>{hop.timestamp ? new Date(hop.timestamp).toLocaleString() : "-"}</td>
                      <td>{hop.delay_seconds !== null ? `${hop.delay_seconds}s` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
