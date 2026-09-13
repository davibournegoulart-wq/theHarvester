"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  ShieldIcon,
  AlertIcon,
  CheckIcon,
  CrossIcon,
  UserIcon,
  MailIcon,
  GlobeIcon,
  KeyIcon,
  LockIcon,
  SearchIcon,
  RefreshCwIcon,
  TerminalIcon,
  LayersIcon,
  CpuIcon,
  ExternalLinkIcon,
} from "@/components/FlatIcons";

type DefenderFinding = {
  title: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  remediation: string;
};

type DefendersBrief = {
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";
  risk_summary: string;
  top_findings: DefenderFinding[];
  next_action: string;
  generated_at: string;
};

type NameCandidate = {
  raw_name: string;
  source: string;
  weight: number;
};

type NameConsensusResult = {
  confirmed_name: string | null;
  name_confidence: "CONFIRMED" | "PROBABLE" | "POSSIBLE" | "UNKNOWN";
  confidence_score: number;
  name_sources: string[];
  name_reasoning: string;
  all_candidates: NameCandidate[];
};

type HudsonRockIntel = {
  is_compromised: boolean;
  total_infections: number;
  total_passwords: number;
  stealer_families: string[];
  compromised_domains: string[];
  last_infection_date: string | null;
  raw_summary: string | null;
};

type EmailRepIntel = {
  reputation: string;
  suspicious: boolean;
  references: number;
  blacklisted: boolean;
  malicious_activity: boolean;
  credential_leaked: boolean;
  spam: boolean;
  free_provider: boolean;
  disposable: boolean;
  deliverable: boolean;
  details: string[];
};

type M365TenantIntel = {
  is_m365: boolean;
  name_space_type: string;
  domain_name: string;
  auth_url: string | null;
  federation_brand: string | null;
};

type GoogleAccountIntel = {
  is_google: boolean;
  hosting_kind: string;
  display_name: string | null;
  avatar_url: string | null;
  gaia_presence: boolean;
};

type GravatarIntel = {
  found: boolean;
  display_name: string | null;
  about_me: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  verified_accounts: { platform: string; url: string }[];
};

type PGPIntel = {
  found: boolean;
  key_id: string | null;
  fingerprint: string | null;
  algorithm: string | null;
  created_date: string | null;
  uids: string[];
};

type XposedOrNotIntel = {
  breach_count: number;
  paste_count: number;
  breaches: string[];
  risk_score: number;
};

type MailAccessResult = {
  email: string;
  domain: string;
  is_valid_format: boolean;
  mx_records: string[];
  credibility_score: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";
  hudson_rock: HudsonRockIntel;
  emailrep: EmailRepIntel;
  m365: M365TenantIntel;
  google_account: GoogleAccountIntel;
  gravatar: GravatarIntel;
  pgp: PGPIntel;
  xposedornot: XposedOrNotIntel;
  name_consensus: NameConsensusResult;
  defenders_brief: DefendersBrief;
  key_findings: string[];
  error?: string;
};

type HarvestedEmail = {
  email: string;
  role: string;
  source: string;
  deliverable: boolean;
};

type DomainHarvestResult = {
  domain: string;
  detected_pattern: string;
  patterns: string[];
  harvested_emails: HarvestedEmail[];
  role_accounts_found: string[];
  mx_hosts: string[];
};

export default function MailAccessSuite({ initialEmail = "" }: { initialEmail?: string }) {
  const { activeCase } = useActiveCase();
  const [emailInput, setEmailInput] = useState(initialEmail || "security@microsoft.com");
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MailAccessResult | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<"BRIEF" | "IDENTITY" | "BREACHES" | "INFRA" | "HARVEST">("BRIEF");

  // Harvester state
  const [harvestDomain, setHarvestDomain] = useState("");
  const [harvestLoading, setHarvestLoading] = useState(false);
  const [harvestData, setHarvestData] = useState<DomainHarvestResult | null>(null);

  async function handleInvestigate(targetEmail?: string) {
    const toSearch = (targetEmail || emailInput).trim();
    if (!toSearch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<MailAccessResult>(
        `/recon/email/mailaccess?email=${encodeURIComponent(toSearch)}&use_tor=${useTor}`
      );
      setData(res);
      if (res.domain && !harvestDomain) {
        setHarvestDomain(res.domain);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to execute MailAccess deep reconnaissance");
    } finally {
      setLoading(false);
    }
  }

  async function handleHarvest(targetDomain?: string) {
    const dom = (targetDomain || harvestDomain || (data?.domain ?? "")).trim();
    if (!dom) return;
    setHarvestLoading(true);
    try {
      const res = await apiGet<DomainHarvestResult>(
        `/recon/email/mailaccess/harvest?domain=${encodeURIComponent(dom)}&use_tor=${useTor}`
      );
      setHarvestData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to harvest domain emails");
    } finally {
      setHarvestLoading(false);
    }
  }

  const getRiskColor = (level?: string) => {
    switch (level) {
      case "CRITICAL":
        return "#ff0055";
      case "HIGH":
        return "#ff7700";
      case "MEDIUM":
        return "#ffcc00";
      case "LOW":
        return "var(--cyan)";
      case "CLEAN":
      default:
        return "var(--success)";
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "rgba(10, 15, 25, 0.95)",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldIcon size={22} color="var(--cyan)" />
          <div>
            <h3 style={{ margin: 0, fontSize: 16, letterSpacing: 0.5, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              MAILACCESS PRO RECON ENGINE
              <span
                style={{
                  fontSize: 10,
                  background: "rgba(0, 240, 255, 0.15)",
                  color: "var(--cyan)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "1px solid rgba(0, 240, 255, 0.3)",
                }}
              >
                KatrielMoses/MailAccess v0.15.0
              </span>
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              Defender&apos;s Brief, Name Consensus Engine, Infostealer Malware Logs, PGP, Google/M365 &amp; Email Harvester
            </p>
          </div>
        </div>

        {data && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 4,
                background: `${getRiskColor(data.defenders_brief?.risk_level)}20`,
                color: getRiskColor(data.defenders_brief?.risk_level),
                border: `1px solid ${getRiskColor(data.defenders_brief?.risk_level)}60`,
              }}
            >
              RISK: {data.defenders_brief?.risk_level || "UNKNOWN"}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--cyan)",
                border: "1px solid var(--border)",
              }}
            >
              CREDIBILITY: {data.credibility_score} / 100
            </span>
            <SaveToCaseButton
              identifierType="email"
              identifierValue={data.email}
              platform="mailaccess.pro"
              discoveredBy="mailaccess"
              metadata={{
                title: `MailAccess Brief: ${data.email}`,
                credibility_score: data.credibility_score,
                risk_level: data.defenders_brief?.risk_level,
                risk_summary: data.defenders_brief?.risk_summary,
                next_action: data.defenders_brief?.next_action,
                confirmed_name: data.name_consensus?.confirmed_name,
                hudson_rock: data.hudson_rock,
                m365: data.m365,
              }}
            />
          </div>
        )}
      </div>

      {/* Target input bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="target@organization.com"
          onKeyDown={(e) => e.key === "Enter" && handleInvestigate()}
          style={{
            flex: 1,
            minWidth: 260,
            background: "rgba(0, 0, 0, 0.5)",
            border: "1px solid var(--border)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
          }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={useTor}
            onChange={(e) => setUseTor(e.target.checked)}
          />
          Route Tor Onion
        </label>

        <button
          onClick={() => handleInvestigate()}
          disabled={loading}
          style={{
            background: "var(--cyan)",
            color: "#000",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {loading ? <RefreshCwIcon size={14} className="spin" /> : <SearchIcon size={14} />}
          {loading ? "SCANNING..." : "DEEP INVESTIGATE"}
        </button>
      </div>

      {/* Presets */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Targets:</span>
        {["security@microsoft.com", "satya.nadella@microsoft.com", "elon.musk@x.com", "investigations@sec.gov"].map((p) => (
          <button
            key={p}
            onClick={() => {
              setEmailInput(p);
              handleInvestigate(p);
            }}
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontSize: 10,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(255, 0, 85, 0.15)", border: "1px solid #ff0055", borderRadius: 6, color: "#ff5577", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: 16, overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("BRIEF")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "BRIEF" ? "rgba(0, 240, 255, 0.15)" : "transparent",
            color: activeTab === "BRIEF" ? "var(--cyan)" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "BRIEF" ? "2px solid var(--cyan)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ShieldIcon size={12} /> DEFENDER&apos;S BRIEF
        </button>

        <button
          onClick={() => setActiveTab("IDENTITY")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "IDENTITY" ? "rgba(0, 240, 255, 0.15)" : "transparent",
            color: activeTab === "IDENTITY" ? "var(--cyan)" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "IDENTITY" ? "2px solid var(--cyan)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <UserIcon size={12} /> NAME CONSENSUS &amp; ID {data?.name_consensus?.confirmed_name && "✓"}
        </button>

        <button
          onClick={() => setActiveTab("BREACHES")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "BREACHES" ? "rgba(0, 240, 255, 0.15)" : "transparent",
            color: activeTab === "BREACHES" ? "var(--cyan)" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "BREACHES" ? "2px solid var(--cyan)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertIcon size={12} /> INFOSTEALERS &amp; BREACHES {data?.hudson_rock?.is_compromised && "⚠️"}
        </button>

        <button
          onClick={() => setActiveTab("INFRA")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "INFRA" ? "rgba(0, 240, 255, 0.15)" : "transparent",
            color: activeTab === "INFRA" ? "var(--cyan)" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "INFRA" ? "2px solid var(--cyan)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CpuIcon size={12} /> M365 &amp; CLOUD REALM
        </button>

        <button
          onClick={() => {
            setActiveTab("HARVEST");
            if (!harvestData && (data?.domain || emailInput.includes("@"))) {
              const dom = data?.domain || emailInput.split("@")[1];
              setHarvestDomain(dom);
              handleHarvest(dom);
            }
          }}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "HARVEST" ? "rgba(0, 240, 255, 0.15)" : "transparent",
            color: activeTab === "HARVEST" ? "var(--cyan)" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "HARVEST" ? "2px solid var(--cyan)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <GlobeIcon size={12} /> DOMAIN EMAIL HARVESTER
        </button>
      </div>

      {/* Tab 1: DEFENDER'S BRIEF */}
      {activeTab === "BRIEF" && data && (
        <div>
          {/* Executive Risk Summary Card */}
          <div
            style={{
              padding: 16,
              background: "rgba(0, 0, 0, 0.4)",
              border: `1px solid ${getRiskColor(data.defenders_brief.risk_level)}40`,
              borderLeft: `4px solid ${getRiskColor(data.defenders_brief.risk_level)}`,
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: getRiskColor(data.defenders_brief.risk_level), letterSpacing: 0.5 }}>
                EXECUTIVE RISK POSTURE
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {data.defenders_brief.generated_at}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#fff", lineHeight: 1.5, margin: "0 0 12px 0" }}>
              {data.defenders_brief.risk_summary}
            </p>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px dashed rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertIcon size={14} color="var(--cyan)" />
              <span style={{ fontSize: 12, color: "var(--cyan)", fontWeight: 600 }}>
                Next Action:
              </span>
              <span style={{ fontSize: 12, color: "#ddd" }}>
                {data.defenders_brief.next_action}
              </span>
            </div>
          </div>

          {/* Top Prioritized Findings */}
          <h4 style={{ fontSize: 12, color: "var(--text-muted)", margin: "16px 0 10px 0", letterSpacing: 0.5 }}>
            PRIORITIZED DEFENDER FINDINGS ({data.defenders_brief.top_findings.length})
          </h4>

          <div style={{ display: "grid", gap: 10 }}>
            {data.defenders_brief.top_findings.map((f, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {f.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: `${getRiskColor(f.severity)}20`,
                      color: getRiskColor(f.severity),
                      border: `1px solid ${getRiskColor(f.severity)}50`,
                    }}
                  >
                    {f.severity}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#ccc", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                  {f.detail}
                </p>
                <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckIcon size={12} color="var(--success)" />
                  <span>Remediation: {f.remediation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: NAME CONSENSUS & IDENTITY */}
      {activeTab === "IDENTITY" && data && (
        <div>
          {/* Confirmed Name Resolution Card */}
          <div
            style={{
              padding: 16,
              background: "rgba(0, 240, 255, 0.04)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: 6,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                NAME CONSENSUS ENGINE (MAILACCESS)
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {data.name_consensus.confirmed_name || "Uncorroborated Identity"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {data.name_consensus.name_reasoning}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>CONFIDENCE</div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      data.name_consensus.name_confidence === "CONFIRMED"
                        ? "var(--success)"
                        : data.name_consensus.name_confidence === "PROBABLE"
                        ? "var(--cyan)"
                        : "#ffaa00",
                  }}
                >
                  {data.name_consensus.name_confidence} ({Math.round(data.name_consensus.confidence_score * 100)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Identity Sources Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {/* Gravatar Profile */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <UserIcon size={14} color="var(--cyan)" />
                <strong style={{ fontSize: 12, color: "#fff" }}>Gravatar Public Profile</strong>
                <span style={{ fontSize: 10, color: data.gravatar.found ? "var(--success)" : "var(--text-muted)", marginLeft: "auto" }}>
                  {data.gravatar.found ? "ACTIVE" : "NOT FOUND"}
                </span>
              </div>

              {data.gravatar.found ? (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {data.gravatar.avatar_url && (
                    <img
                      src={data.gravatar.avatar_url}
                      alt="Avatar"
                      style={{ width: 48, height: 48, borderRadius: "50%", border: "1px solid var(--cyan)" }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{data.gravatar.display_name}</div>
                    {data.gravatar.about_me && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0" }}>{data.gravatar.about_me}</div>
                    )}
                    {data.gravatar.verified_accounts.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        {data.gravatar.verified_accounts.map((acc, i) => (
                          <a
                            key={i}
                            href={acc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 10,
                              color: "var(--cyan)",
                              background: "rgba(0, 240, 255, 0.1)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {acc.platform} <ExternalLinkIcon size={10} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                  No public Gravatar bio or custom avatar attached to this email hash.
                </p>
              )}
            </div>

            {/* PGP Keyserver */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <KeyIcon size={14} color="var(--cyan)" />
                <strong style={{ fontSize: 12, color: "#fff" }}>OpenPGP Keyserver Index</strong>
                <span style={{ fontSize: 10, color: data.pgp.found ? "var(--success)" : "var(--text-muted)", marginLeft: "auto" }}>
                  {data.pgp.found ? "KEY ATTACHED" : "NO PUBLIC KEY"}
                </span>
              </div>

              {data.pgp.found ? (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    Key ID: <span style={{ color: "#fff", fontFamily: "monospace" }}>{data.pgp.key_id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    Algo: <span style={{ color: "#fff" }}>{data.pgp.algorithm}</span> | Created: <span style={{ color: "#fff" }}>{data.pgp.created_date}</span>
                  </div>
                  {data.pgp.uids.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--cyan)", marginTop: 6 }}>
                      UID: {data.pgp.uids.join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                  No published cryptographic public keys found on keys.openpgp.org or Ubuntu SKS.
                </p>
              )}
            </div>

            {/* Google Account Intel */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <GlobeIcon size={14} color="var(--cyan)" />
                <strong style={{ fontSize: 12, color: "#fff" }}>Google Cloud / GAIA Presence</strong>
                <span style={{ fontSize: 10, color: data.google_account.is_google ? "var(--cyan)" : "var(--text-muted)", marginLeft: "auto" }}>
                  {data.google_account.is_google ? data.google_account.hosting_kind.toUpperCase() : "NON-GOOGLE"}
                </span>
              </div>

              <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.4 }}>
                {data.google_account.is_google ? (
                  <>
                    Account is hosted on Google infrastructure ({data.google_account.hosting_kind}).
                    GAIA profile query enabled.
                  </>
                ) : (
                  <>Email domain is not directly routed through Google Workspace or Gmail.</>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: INFOSTEALERS & BREACHES */}
      {activeTab === "BREACHES" && data && (
        <div>
          {/* Hudson Rock Malware telemetry */}
          <div
            style={{
              background: data.hudson_rock.is_compromised ? "rgba(255, 0, 85, 0.08)" : "rgba(0, 0, 0, 0.3)",
              border: `1px solid ${data.hudson_rock.is_compromised ? "#ff0055" : "rgba(255, 255, 255, 0.08)"}`,
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertIcon size={16} color={data.hudson_rock.is_compromised ? "#ff0055" : "var(--success)"} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  Hudson Rock Cavalier Infostealer Telemetry
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: data.hudson_rock.is_compromised ? "#ff0055" : "var(--success)",
                  color: "#000",
                }}
              >
                {data.hudson_rock.is_compromised ? "COMPROMISED ENDPOINT" : "CLEAN"}
              </span>
            </div>

            <p style={{ fontSize: 12, color: "#ccc", margin: "0 0 10px 0" }}>
              {data.hudson_rock.raw_summary}
            </p>

            {data.hudson_rock.is_compromised && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Malware Families:{" "}
                  <span style={{ color: "#ff5577", fontWeight: 700 }}>
                    {data.hudson_rock.stealer_families.join(", ") || "Unknown"}
                  </span>
                </div>
                {data.hudson_rock.compromised_domains.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      Compromised Target Domains ({data.hudson_rock.compromised_domains.length}):
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {data.hudson_rock.compromised_domains.map((dom, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            background: "rgba(255, 0, 85, 0.15)",
                            color: "#ff5577",
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid rgba(255, 0, 85, 0.3)",
                          }}
                        >
                          {dom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* XposedOrNot Public Breaches */}
          <div
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LayersIcon size={16} color="var(--cyan)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  XposedOrNot Verified Data Breaches ({data.xposedornot.breach_count})
                </span>
              </div>
            </div>

            {data.xposedornot.breach_count > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.xposedornot.breaches.map((b, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      background: "rgba(255, 170, 0, 0.1)",
                      color: "#ffaa00",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid rgba(255, 170, 0, 0.3)",
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                No verified records found in XposedOrNot breach catalog.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: M365 & CLOUD INFRA */}
      {activeTab === "INFRA" && data && (
        <div style={{ display: "grid", gap: 14 }}>
          {/* M365 Tenant Discovery */}
          <div
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <CpuIcon size={16} color="var(--cyan)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                Microsoft 365 Azure AD Tenant Discovery
              </span>
              <span style={{ fontSize: 10, color: data.m365.is_m365 ? "var(--cyan)" : "var(--text-muted)", marginLeft: "auto" }}>
                {data.m365.is_m365 ? data.m365.name_space_type.toUpperCase() : "NON-M365"}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "#ccc", display: "grid", gap: 6 }}>
              <div>Domain Name: <span style={{ fontFamily: "monospace", color: "#fff" }}>{data.m365.domain_name || data.domain}</span></div>
              <div>Namespace Type: <span style={{ color: "#fff", fontWeight: 600 }}>{data.m365.name_space_type}</span></div>
              {data.m365.federation_brand && (
                <div>Federation Brand: <span style={{ color: "var(--cyan)" }}>{data.m365.federation_brand}</span></div>
              )}
              {data.m365.auth_url && (
                <div>
                  Auth URL:{" "}
                  <a
                    href={data.m365.auth_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--cyan)", textDecoration: "none", fontSize: 11, fontFamily: "monospace" }}
                  >
                    {data.m365.auth_url.slice(0, 50)}...
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* MX Mail Exchangers */}
          <div
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MailIcon size={16} color="var(--cyan)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                DNS Mail Exchanger Handshake ({data.mx_records.length} MX Records)
              </span>
            </div>

            {data.mx_records.length > 0 ? (
              <div style={{ display: "grid", gap: 4 }}>
                {data.mx_records.map((mx, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: "4px 8px",
                      borderRadius: 4,
                      color: "#eee",
                    }}
                  >
                    {mx}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#ff5577", margin: 0 }}>
                No MX records configured. Domain cannot receive inbound mail.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: DOMAIN EMAIL HARVESTER */}
      {activeTab === "HARVEST" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={harvestDomain}
              onChange={(e) => setHarvestDomain(e.target.value)}
              placeholder="company.com"
              onKeyDown={(e) => e.key === "Enter" && handleHarvest()}
              style={{
                flex: 1,
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--border)",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "monospace",
              }}
            />
            <button
              onClick={() => handleHarvest()}
              disabled={harvestLoading}
              style={{
                background: "var(--cyan)",
                color: "#000",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: harvestLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {harvestLoading ? <RefreshCwIcon size={14} className="spin" /> : <GlobeIcon size={14} />}
              HARVEST DOMAIN
            </button>
          </div>

          {harvestData && (
            <div>
              {/* Pattern Detected */}
              <div
                style={{
                  background: "rgba(0, 240, 255, 0.05)",
                  border: "1px solid rgba(0, 240, 255, 0.2)",
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontSize: 10, color: "var(--cyan)", fontWeight: 700 }}>DETECTED CORPORATE SYNTAX</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
                    {harvestData.detected_pattern}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {harvestData.patterns.slice(0, 3).map((p, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 10,
                        background: "rgba(255, 255, 255, 0.05)",
                        padding: "2px 6px",
                        borderRadius: 3,
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Harvested emails table */}
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>HARVESTED ROLE &amp; SERVICE ACCOUNTS ({harvestData.harvested_emails.length})</span>
                <SaveToCaseButton
                  identifierType="domain"
                  identifierValue={harvestData.domain}
                  platform="mailaccess.harvester"
                  discoveredBy="mailaccess"
                  metadata={{
                    title: `Harvested Emails: ${harvestData.domain}`,
                    detected_pattern: harvestData.detected_pattern,
                    harvested_count: harvestData.harvested_emails.length,
                    accounts: harvestData.harvested_emails.map((e) => e.email),
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 8,
                }}
              >
                {harvestData.harvested_emails.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 6,
                      padding: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
                        {h.email}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{h.role}</div>
                    </div>
                    <button
                      onClick={() => {
                        setEmailInput(h.email);
                        setActiveTab("BRIEF");
                        handleInvestigate(h.email);
                      }}
                      title="Investigate this email"
                      style={{
                        background: "rgba(0, 240, 255, 0.1)",
                        border: "1px solid rgba(0, 240, 255, 0.3)",
                        borderRadius: 4,
                        color: "var(--cyan)",
                        fontSize: 10,
                        padding: "2px 6px",
                        cursor: "pointer",
                      }}
                    >
                      SCAN
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
