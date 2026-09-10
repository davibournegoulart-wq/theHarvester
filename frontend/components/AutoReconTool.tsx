"use client";

import { useState } from "react";
import { apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import { RadarIcon, AlertIcon, CheckIcon, GlobeIcon, UserIcon, ShieldIcon } from "@/components/FlatIcons";

type AutoReconResult = {
  seed_type: string;
  target: string;
  extracted_username?: string;
  holehe_sites?: string[];
  social_accounts?: any[];
  breaches?: any;
  subdomains?: any[];
  visual_audit?: any;
  exposure?: any;
};

export default function AutoReconTool() {
  const { activeCase } = useActiveCase();
  const [targetType, setTargetType] = useState<"email" | "domain">("email");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<AutoReconResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEngage() {
    if (!target.trim() || !activeCase) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiPostJson<AutoReconResult>(`/recon/auto-recon`, {
        target: target.trim(),
        target_type: targetType,
        case_id: activeCase.id,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error running Auto-Recon");
    } finally {
      setLoading(false);
    }
  }

  if (!activeCase) {
    return (
      <div style={{ color: "var(--warning)", marginTop: 32, display: "flex", alignItems: "center", gap: 8 }}>
        <AlertIcon size={16} color="var(--warning)" />
        Select an active case first in the top right corner to engage Auto-Recon.
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 24,
        background: "var(--panel)",
        padding: 24,
        border: "1px solid var(--cyan)",
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: 2,
            background: "var(--cyan)",
            width: "100%",
            animation: "glitch-shift-1 1s infinite linear",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <RadarIcon size={20} color="var(--cyan)" />
        <h2 style={{ color: "var(--cyan)", margin: 0, fontSize: 18, letterSpacing: "0.05em" }}>
          AUTO-RECON PIPELINE (reconFTW + ReconSpider + SpiderFoot)
        </h2>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 850, lineHeight: 1.5 }}>
        Automated multi-asset intelligence orchestrator. Provide an initial seed (Email or Domain); the engine
        executes concurrent cross-correlation checks, analyzes credential exposures, maps social footprints or
        subdomain surfaces, and automatically injects all validated findings into case &quot;{activeCase.name}&quot; graph.
      </p>

      {/* Target Type Selector */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => {
            setTargetType("email");
            setTarget("");
            setResult(null);
          }}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            background: targetType === "email" ? "rgba(5, 217, 232, 0.18)" : "transparent",
            border: targetType === "email" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: targetType === "email" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
            fontWeight: targetType === "email" ? "bold" : "normal",
          }}
        >
          Email Seed (Holehe + Breach + Social)
        </button>

        <button
          onClick={() => {
            setTargetType("domain");
            setTarget("");
            setResult(null);
          }}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            background: targetType === "domain" ? "rgba(5, 217, 232, 0.18)" : "transparent",
            border: targetType === "domain" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: targetType === "domain" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
            fontWeight: targetType === "domain" ? "bold" : "normal",
          }}
        >
          Domain Seed (theHarvester + EyeWitness + Breacher)
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, maxWidth: 650, marginTop: 16 }}>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEngage()}
          placeholder={targetType === "email" ? "target@company.com" : "target-domain.com"}
          style={{ flex: 1, padding: 12, fontSize: 14 }}
        />
        <button
          onClick={handleEngage}
          disabled={loading || !target.trim()}
          style={{
            width: 180,
            fontWeight: "bold",
            background: loading ? "transparent" : "var(--cyan)",
            color: "#000",
            cursor: loading || !target.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "CORRELATING..." : "ENGAGE PIPELINE"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", marginTop: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertIcon size={14} color="var(--danger)" />
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 24, borderTop: "1px solid var(--panel-border)", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: "bold", fontSize: 14 }}>
            <CheckIcon size={16} color="var(--success)" />
            Auto-Recon correlation pipeline completed for &quot;{result.target}&quot;!
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            All correlated nodes have been pinned directly to the active investigation graph.
          </p>

          {/* EMAIL SEED RESULTS */}
          {result.seed_type === "email" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>Breached Accounts</h4>
                {result.breaches?.breaches_found > 0 ? (
                  <p style={{ margin: 0, color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertIcon size={14} color="var(--danger)" />
                    Identified in {result.breaches.breaches_found} public credential leak(s).
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckIcon size={14} color="var(--success)" />
                    No public breach records found.
                  </p>
                )}
              </div>

              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>Derived Handle / Username</h4>
                <p style={{ margin: 0, fontSize: 15, fontFamily: "monospace", color: "#fff" }}>
                  @{result.extracted_username}
                </p>
              </div>

              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>
                  Registered Platforms (Holehe) — {result.holehe_sites?.length || 0}
                </h4>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 150, overflowY: "auto" }}>
                  {result.holehe_sites?.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                  {(!result.holehe_sites || result.holehe_sites.length === 0) && (
                    <li style={{ color: "var(--text-muted)" }}>No registered accounts found.</li>
                  )}
                </ul>
              </div>

              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>
                  Correlated Social Profiles — {result.social_accounts?.length || 0}
                </h4>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 150, overflowY: "auto" }}>
                  {result.social_accounts?.map((acc: any, i: number) => (
                    <li key={i}>
                      <strong>{acc.platform}</strong>:{" "}
                      {acc.url ? (
                        <a href={acc.url} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                          {acc.url}
                        </a>
                      ) : (
                        "Confirmed"
                      )}
                    </li>
                  ))}
                  {(!result.social_accounts || result.social_accounts.length === 0) && (
                    <li style={{ color: "var(--text-muted)" }}>No social handles resolved.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* DOMAIN SEED RESULTS */}
          {result.seed_type === "domain" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>
                  Subdomain Infrastructure (theHarvester) — {result.subdomains?.length || 0}
                </h4>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 150, overflowY: "auto" }}>
                  {result.subdomains?.map((s: any, idx: number) => (
                    <li key={idx}>
                      <strong>{typeof s === "object" ? s.subdomain : s}</strong>
                    </li>
                  ))}
                  {(!result.subdomains || result.subdomains.length === 0) && (
                    <li style={{ color: "var(--text-muted)" }}>No passive subdomains resolved.</li>
                  )}
                </ul>
              </div>

              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>
                  Web Stack &amp; Banners (EyeWitness)
                </h4>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Server: <strong style={{ color: "#fff" }}>{result.visual_audit?.server_banner || "N/A"}</strong>
                  <br />
                  Title: <strong style={{ color: "#fff" }}>{result.visual_audit?.title || "N/A"}</strong>
                  <br />
                  Security Score:{" "}
                  <strong style={{ color: "var(--cyan)" }}>{result.visual_audit?.security_score || 0} / 100</strong>
                </div>
              </div>

              <div style={{ background: "var(--bg)", padding: 14, borderRadius: 4, border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--cyan)" }}>
                  Discovered Exposure Endpoints (Breacher &amp; RED_HAWK) — {result.exposure?.endpoints_found || 0}
                </h4>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {result.exposure?.discovered?.slice(0, 8).map((exp: any, i: number) => (
                    <span
                      key={i}
                      style={{
                        padding: "3px 8px",
                        background: exp.is_accessible ? "rgba(255, 0, 85, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        border: exp.is_accessible ? "1px solid #ff0055" : "1px solid var(--panel-border)",
                        color: exp.is_accessible ? "#ff5577" : "var(--text-muted)",
                        fontSize: 11,
                        fontFamily: "monospace",
                        borderRadius: 3,
                      }}
                    >
                      {exp.path} (HTTP {exp.status_code})
                    </span>
                  ))}
                  {(!result.exposure?.discovered || result.exposure.discovered.length === 0) && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No exposed paths found.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
