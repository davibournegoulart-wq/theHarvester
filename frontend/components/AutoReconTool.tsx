"use client";

import { useState } from "react";
import { apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

type AutoReconResult = {
  email: string;
  extracted_username: string;
  holehe_sites: string[];
  social_accounts: any[];
  breaches: any;
};

export default function AutoReconTool() {
  const { activeCase } = useActiveCase();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<AutoReconResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEngage() {
    if (!email || !activeCase) return;
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const data = await apiPostJson<AutoReconResult>(`/recon/auto-recon`, {
        email,
        case_id: activeCase.id
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error running Auto-Recon");
    } finally {
      setLoading(false);
    }
  }

  if (!activeCase) {
    return <div style={{ color: "var(--warning)", marginTop: 32 }}>Select an active case first in the top right corner to engage Auto-Recon.</div>;
  }

  return (
    <div style={{ marginTop: 24, background: "var(--panel)", padding: 24, border: "1px solid var(--cyan)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
      {loading && (
        <div style={{ position: "absolute", top: 0, left: 0, height: 2, background: "var(--cyan)", width: "100%", animation: "glitch-shift-1 1s infinite linear" }} />
      )}
      
      <h2 style={{ color: "var(--cyan)", marginTop: 0 }}>Auto-Recon (Cross-Correlation)</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 800 }}>
        Input a seed email. The engine will extract the nickname, cross-reference with 120+ sites (Holehe), check for password breaches, and scan social networks. All positive findings will be injected <strong>automatically into the graph</strong> for case "{activeCase.name}".
      </p>

      <div style={{ display: "flex", gap: 16, maxWidth: 600, marginTop: 24 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEngage()}
          placeholder="target@email.com"
          style={{ flex: 1, padding: 12, fontSize: 16 }}
        />
        <button onClick={handleEngage} disabled={loading} style={{ width: 180, fontWeight: "bold", background: loading ? "transparent" : "rgba(5,217,232,0.1)" }}>
          {loading ? "PROCESSING..." : "ENGAGE ENGINE"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 32, borderTop: "1px solid var(--panel-border)", paddingTop: 24 }}>
          <h3 style={{ color: "var(--success)" }}>Auto-Recon verdict completed!</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>All items below have been injected into the Case database.</p>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 16 }}>
            <div style={{ background: "var(--bg)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Breaches</h4>
              {result.breaches?.breaches_found > 0 ? (
                <p style={{ margin: 0, color: "var(--danger)" }}>⚠️ Found in {result.breaches.breaches_found} breach(es).</p>
              ) : (
                <p style={{ margin: 0, color: "var(--success)" }}>No breaches detected.</p>
              )}
            </div>
            
            <div style={{ background: "var(--bg)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Extracted Username</h4>
              <p style={{ margin: 0, fontSize: 16, fontFamily: "monospace", color: "var(--cyan)" }}>@{result.extracted_username}</p>
            </div>

            <div style={{ background: "var(--bg)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Registrations (Holehe) - {result.holehe_sites.length} sites</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, maxHeight: 150, overflowY: "auto" }} className="hide-scrollbar">
                {result.holehe_sites.map(s => <li key={s}>{s}</li>)}
              </ul>
            </div>

            <div style={{ background: "var(--bg)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Positive Social Accounts</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, maxHeight: 150, overflowY: "auto" }} className="hide-scrollbar">
                {result.social_accounts.map(a => (
                  <li key={a.platform}><a href={a.url} target="_blank" rel="noreferrer">{a.platform}</a></li>
                ))}
                {result.social_accounts.length === 0 && <li>No exact social accounts found.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
