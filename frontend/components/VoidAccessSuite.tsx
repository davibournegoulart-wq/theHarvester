"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  SpiderIcon,
  ShieldIcon,
  AlertIcon,
  CheckIcon,
  SearchIcon,
  RefreshCwIcon,
  TerminalIcon,
  KeyIcon,
  LockIcon,
  GlobeIcon,
  LayersIcon,
  ExternalLinkIcon,
  FileTextIcon,
  DownloadIcon,
  CopyIcon,
} from "@/components/FlatIcons";

type ExtractedEntities = {
  cryptocurrency: { type: string; address: string }[];
  onion_urls: string[];
  cves: string[];
  mitre_techniques: string[];
  hashes: { type: string; hash: string }[];
  messaging: { platform: string; handle: string }[];
  credentials: { type: string; value: string }[];
  network: { type: string; value: string }[];
  threat_actors: string[];
};

type ThreatActorProfile = {
  name: string;
  aliases: string[];
  threat_level: "CRITICAL" | "HIGH" | "ELEVATED";
  active_status: "ACTIVE" | "DISRUPTED" | "DORMANT";
  first_seen: string;
  extortion_onions: string[];
  malware_extensions: string[];
  targeted_sectors: string[];
  mitre_techniques: string[];
  description: string;
  known_iocs: string[];
};

type LiveThreatItem = {
  source: string;
  title: string;
  indicator: string;
  threat_type: string;
  date_discovered: string;
  severity: string;
  victim_organization?: string;
  victim_domain?: string;
  victim_country?: string;
  victim_sector?: string;
  threat_actor?: string;
  leak_source_url?: string;
  exfiltrated_data_size?: string;
  compromised_fields?: string[];
  status?: string;
};

type VoidAccessInvestigationResult = {
  investigation_id: string;
  query: string;
  category: string;
  timestamp: string;
  onion_results: { name: string; url: string; category: string; description: string }[];
  extracted_entities: ExtractedEntities;
  matched_actors: ThreatActorProfile[];
  threat_feed_hits: LiveThreatItem[];
  risk_summary: string;
  overall_severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

export default function VoidAccessSuite() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"INVESTIGATE" | "ACTORS" | "EXTRACTOR" | "FEEDS" | "EXPORTS">("INVESTIGATE");

  // Investigation state
  const [query, setQuery] = useState("LockBit");
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invResult, setInvResult] = useState<VoidAccessInvestigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Actor Dossiers state
  const [actorSearch, setActorSearch] = useState("");
  const [actorsList, setActorsList] = useState<ThreatActorProfile[]>([]);
  const [selectedActor, setSelectedActor] = useState<ThreatActorProfile | null>(null);

  // Deep Entity Extractor state
  const [extractorText, setExtractorText] = useState(
    "Target breach notice:\n" +
    "Victim files encrypted with Akira Ransomware (.akira extension).\n" +
    "Pay 12.5 BTC to wallet: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq or ETH 0x71C634C26b331E0cd51a0457F5633F53e5e7C1B2\n" +
    "Negotiation portal: http://akiral2iz6a7qgd3ayp3l6dffknooxapbm2xap6xqytbvwtfo2d62746zpm.onion\n" +
    "Contact negotiator on Telegram: @akira_support_ops\n" +
    "Exploited SonicWall VPN CVE-2024-40766 and MITRE T1133 technique.\n" +
    "Payload hash SHA256: a6e4d2f8e91c7849e83716d123456789abcdef0123456789abcdef0123456789\n" +
    "Exfiltrated DB dump: admin@corporate.com:SuperP@ssw0rd123!"
  );
  const [extractedData, setExtractedData] = useState<ExtractedEntities | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Live Threat Feeds state
  const [feeds, setFeeds] = useState<LiveThreatItem[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);

  // Exports state
  const [exportFormat, setExportFormat] = useState<"yara" | "sigma" | "stix" | "csv">("yara");
  const [generatedRule, setGeneratedRule] = useState<string>("");
  const [ruleLoading, setRuleLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  function copyFeedUrl(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  }

  // Initial load of actors and feeds
  useEffect(() => {
    loadActors("");
    loadFeeds();
  }, []);

  async function loadActors(search: string) {
    try {
      const data = await apiGet<ThreatActorProfile[]>(`/recon/voidaccess/actors?search=${encodeURIComponent(search)}`);
      setActorsList(data);
      if (!selectedActor && data.length > 0) {
        setSelectedActor(data[0]);
      }
    } catch (e) {}
  }

  async function loadFeeds() {
    setFeedsLoading(true);
    try {
      const data = await apiGet<LiveThreatItem[]>("/recon/voidaccess/feeds");
      setFeeds(data);
    } catch (e) {}
    finally {
      setFeedsLoading(false);
    }
  }

  async function handleInvestigate(targetQuery?: string) {
    const q = (targetQuery || query).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<VoidAccessInvestigationResult>(
        `/recon/voidaccess/investigate?query=${encodeURIComponent(q)}&use_tor=${useTor}`
      );
      setInvResult(res);
      if (res.matched_actors.length > 0) {
        setSelectedActor(res.matched_actors[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to execute VoidAccess dark web investigation");
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    if (!extractorText.trim()) return;
    setExtracting(true);
    try {
      const res = await apiPostJson<ExtractedEntities>("/recon/voidaccess/extract", {
        text: extractorText,
      });
      setExtractedData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Entity extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleGenerateExport(fmt?: "yara" | "sigma" | "stix" | "csv") {
    const targetFmt = fmt || exportFormat;
    setRuleLoading(true);
    setCopied(false);
    try {
      const textToAnalyze = extractorText || query || "sample threat";
      const res = await apiPostJson<{ format: string; content: any }>("/recon/voidaccess/export", {
        format: targetFmt,
        title: query ? `${query}_Detection` : "Threat_IOC_Detection",
        text: textToAnalyze,
      });
      if (typeof res.content === "object") {
        setGeneratedRule(JSON.stringify(res.content, null, 2));
      } else {
        setGeneratedRule(String(res.content));
      }
    } catch (e) {
      setGeneratedRule("// Error generating detection rule");
    } finally {
      setRuleLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const getSevColor = (sev?: string) => {
    switch (sev) {
      case "CRITICAL":
        return "#ff0055";
      case "HIGH":
        return "#ff7700";
      case "ELEVATED":
      case "MEDIUM":
        return "#ffcc00";
      case "LOW":
        return "var(--cyan)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "rgba(12, 10, 20, 0.96)",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
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
          <SpiderIcon size={24} color="#a855f7" />
          <div>
            <h3 style={{ margin: 0, fontSize: 16, letterSpacing: 0.5, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              VOIDACCESS THREAT INTEL PLATFORM
              <span
                style={{
                  fontSize: 10,
                  background: "rgba(168, 85, 247, 0.15)",
                  color: "#c084fc",
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                }}
              >
                KatrielMoses/voidaccess
              </span>
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              Dark-Web Research, Ransomware Extortion Dossiers, Deep Entity Extraction (Crypto/Onions/CVEs) &amp; YARA/Sigma
            </p>
          </div>
        </div>

        {invResult && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 4,
                background: `${getSevColor(invResult.overall_severity)}20`,
                color: getSevColor(invResult.overall_severity),
                border: `1px solid ${getSevColor(invResult.overall_severity)}60`,
              }}
            >
              SEVERITY: {invResult.overall_severity}
            </span>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>
              {invResult.investigation_id}
            </span>
            <SaveToCaseButton
              identifierType="url"
              identifierValue={invResult.query}
              platform="voidaccess.investigation"
              discoveredBy="voidaccess"
              metadata={{
                title: `VoidAccess Threat Intel: ${invResult.query}`,
                investigation_id: invResult.investigation_id,
                severity: invResult.overall_severity,
                risk_summary: invResult.risk_summary,
                matched_actors: invResult.matched_actors.map((a) => a.name),
                onion_hits: invResult.onion_results.length,
                iocs_extracted: invResult.extracted_entities,
              }}
            />
          </div>
        )}
      </div>

      {/* Query Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ransomware group, malware family, .onion address, CVE, or target org..."
          onKeyDown={(e) => e.key === "Enter" && handleInvestigate()}
          style={{
            flex: 1,
            minWidth: 280,
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
          Route Tor Proxy
        </label>

        <button
          onClick={() => handleInvestigate()}
          disabled={loading}
          style={{
            background: "#a855f7",
            color: "#fff",
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
          {loading ? "SEARCHING ONION..." : "INVESTIGATE THREAT"}
        </button>
      </div>

      {/* Quick Presets */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Threat Targets:</span>
        {["LockBit", "Akira", "BlackCat", "Cl0p", "MOVEit Transfer", "CVE-2023-34362", "BianLian"].map((p) => (
          <button
            key={p}
            onClick={() => {
              setQuery(p);
              handleInvestigate(p);
            }}
            style={{
              background: "rgba(168, 85, 247, 0.08)",
              border: "1px solid rgba(168, 85, 247, 0.2)",
              borderRadius: 4,
              color: "#c084fc",
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

      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: 16, overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("INVESTIGATE")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "INVESTIGATE" ? "rgba(168, 85, 247, 0.2)" : "transparent",
            color: activeTab === "INVESTIGATE" ? "#c084fc" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "INVESTIGATE" ? "2px solid #a855f7" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <SearchIcon size={12} /> THREAT INVESTIGATION
        </button>

        <button
          onClick={() => setActiveTab("ACTORS")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "ACTORS" ? "rgba(168, 85, 247, 0.2)" : "transparent",
            color: activeTab === "ACTORS" ? "#c084fc" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "ACTORS" ? "2px solid #a855f7" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ShieldIcon size={12} /> ACTOR DOSSIERS ({actorsList.length})
        </button>

        <button
          onClick={() => {
            setActiveTab("EXTRACTOR");
            if (!extractedData) handleExtract();
          }}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "EXTRACTOR" ? "rgba(168, 85, 247, 0.2)" : "transparent",
            color: activeTab === "EXTRACTOR" ? "#c084fc" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "EXTRACTOR" ? "2px solid #a855f7" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <KeyIcon size={12} /> DEEP ENTITY EXTRACTOR
        </button>

        <button
          onClick={() => setActiveTab("FEEDS")}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "FEEDS" ? "rgba(168, 85, 247, 0.2)" : "transparent",
            color: activeTab === "FEEDS" ? "#c084fc" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "FEEDS" ? "2px solid #a855f7" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertIcon size={12} /> LIVE THREAT FEEDS ({feeds.length})
        </button>

        <button
          onClick={() => {
            setActiveTab("EXPORTS");
            if (!generatedRule) handleGenerateExport("yara");
          }}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 700,
            background: activeTab === "EXPORTS" ? "rgba(168, 85, 247, 0.2)" : "transparent",
            color: activeTab === "EXPORTS" ? "#c084fc" : "var(--text-muted)",
            border: "none",
            borderBottom: activeTab === "EXPORTS" ? "2px solid #a855f7" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FileTextIcon size={12} /> DETECTION &amp; EXPORTS (YARA/Sigma/STIX)
        </button>
      </div>

      {/* Tab 1: THREAT INVESTIGATION */}
      {activeTab === "INVESTIGATE" && invResult && (
        <div>
          {/* Executive Risk Posture */}
          <div
            style={{
              padding: 16,
              background: "rgba(0, 0, 0, 0.4)",
              border: `1px solid ${getSevColor(invResult.overall_severity)}40`,
              borderLeft: `4px solid ${getSevColor(invResult.overall_severity)}`,
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: getSevColor(invResult.overall_severity), letterSpacing: 0.5 }}>
                VOIDACCESS THREAT ASSESSMENT
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {invResult.timestamp}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#fff", lineHeight: 1.5, margin: 0 }}>
              {invResult.risk_summary}
            </p>
          </div>

          {/* Matched Threat Actors */}
          {invResult.matched_actors.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px 0" }}>
                MATCHED THREAT ACTOR SYNDICATES ({invResult.matched_actors.length})
              </h4>
              <div style={{ display: "grid", gap: 10 }}>
                {invResult.matched_actors.map((actor, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(168, 85, 247, 0.2)",
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ShieldIcon size={14} color="#a855f7" />
                        <strong style={{ fontSize: 14, color: "#fff" }}>{actor.name}</strong>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          ({actor.aliases.join(", ")})
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: `${getSevColor(actor.threat_level)}20`,
                          color: getSevColor(actor.threat_level),
                          border: `1px solid ${getSevColor(actor.threat_level)}50`,
                        }}
                      >
                        {actor.threat_level}
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: "#ccc", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                      {actor.description}
                    </p>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Extortion Onions:</span>
                      {actor.extortion_onions.map((o, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            background: "rgba(168, 85, 247, 0.15)",
                            color: "#c084fc",
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid rgba(168, 85, 247, 0.3)",
                          }}
                        >
                          {o.slice(0, 24)}...onion
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Onion Seeds Hits */}
          <div>
            <h4 style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px 0" }}>
              DARK WEB ONION INDEX HITS ({invResult.onion_results.length})
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
              {invResult.onion_results.map((seed, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 6,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 12, color: "#fff" }}>{seed.name}</strong>
                    <span style={{ fontSize: 10, color: "#a855f7", textTransform: "uppercase" }}>{seed.category}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px 0" }}>
                    {seed.description}
                  </p>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--cyan)" }}>
                    {seed.url.slice(0, 36)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: ACTOR DOSSIERS */}
      {activeTab === "ACTORS" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input
              type="text"
              value={actorSearch}
              onChange={(e) => {
                setActorSearch(e.target.value);
                loadActors(e.target.value);
              }}
              placeholder="Filter threat actors by name, alias, extension, or targeted sector..."
              style={{
                flex: 1,
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--border)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {actorsList.map((actor, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(168, 85, 247, 0.25)",
                  borderRadius: 6,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, color: "#fff" }}>{actor.name}</h4>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {actor.aliases.join(", ")}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: `${getSevColor(actor.threat_level)}20`,
                        color: getSevColor(actor.threat_level),
                        border: `1px solid ${getSevColor(actor.threat_level)}50`,
                      }}
                    >
                      {actor.threat_level}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: "#ccc", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                    {actor.description}
                  </p>

                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "grid", gap: 4, marginBottom: 12 }}>
                    <div>
                      Sectors: <span style={{ color: "#fff" }}>{actor.targeted_sectors.join(", ")}</span>
                    </div>
                    <div>
                      Extensions:{" "}
                      <span style={{ color: "#c084fc", fontFamily: "monospace" }}>
                        {actor.malware_extensions.join(" ")}
                      </span>
                    </div>
                    <div>
                      MITRE ATT&amp;CK:{" "}
                      <span style={{ color: "var(--cyan)", fontFamily: "monospace" }}>
                        {actor.mitre_techniques.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10 }}>
                  <button
                    onClick={() => {
                      setQuery(actor.name);
                      setActiveTab("INVESTIGATE");
                      handleInvestigate(actor.name);
                    }}
                    style={{
                      background: "rgba(168, 85, 247, 0.15)",
                      color: "#c084fc",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      borderRadius: 4,
                      padding: "4px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    PIVOT INVESTIGATION
                  </button>

                  <SaveToCaseButton
                    identifierType="corporate"
                    identifierValue={actor.name}
                    platform="voidaccess.actor"
                    discoveredBy="voidaccess"
                    metadata={{
                      name: actor.name,
                      aliases: actor.aliases,
                      threat_level: actor.threat_level,
                      status: actor.active_status,
                      targeted_sectors: actor.targeted_sectors,
                      extortion_onions: actor.extortion_onions,
                      mitre_techniques: actor.mitre_techniques,
                      iocs: actor.known_iocs,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: DEEP ENTITY EXTRACTOR */}
      {activeTab === "EXTRACTOR" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Paste darknet leak text, stealer log, or threat disclosure below for instant entity parsing:
            </span>
            <textarea
              value={extractorText}
              onChange={(e) => setExtractorText(e.target.value)}
              rows={6}
              style={{
                width: "100%",
                marginTop: 6,
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--border)",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "monospace",
                lineHeight: 1.4,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={handleExtract}
              disabled={extracting}
              style={{
                background: "#a855f7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                cursor: extracting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {extracting ? <RefreshCwIcon size={12} className="spin" /> : <TerminalIcon size={12} />}
              {extracting ? "PARSING..." : "EXTRACT ENTITIES"}
            </button>
          </div>

          {extractedData && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {/* Crypto Wallets */}
              <div style={{ background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 6, padding: 12 }}>
                <strong style={{ fontSize: 12, color: "#fff", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <KeyIcon size={14} color="#f59e0b" /> Cryptocurrency Wallets ({extractedData.cryptocurrency.length})
                </strong>
                {extractedData.cryptocurrency.length > 0 ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {extractedData.cryptocurrency.map((c, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: "monospace", background: "rgba(255, 255, 255, 0.04)", padding: "4px 8px", borderRadius: 4, color: "#f59e0b" }}>
                        [{c.type.toUpperCase()}] {c.address}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>None detected</span>
                )}
              </div>

              {/* Dark Web Onions */}
              <div style={{ background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 6, padding: 12 }}>
                <strong style={{ fontSize: 12, color: "#fff", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <SpiderIcon size={14} color="#a855f7" /> Onion v3 Addresses ({extractedData.onion_urls.length})
                </strong>
                {extractedData.onion_urls.length > 0 ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {extractedData.onion_urls.map((o, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: "monospace", background: "rgba(255, 255, 255, 0.04)", padding: "4px 8px", borderRadius: 4, color: "#c084fc" }}>
                        {o}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>None detected</span>
                )}
              </div>

              {/* CVEs & MITRE */}
              <div style={{ background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 6, padding: 12 }}>
                <strong style={{ fontSize: 12, color: "#fff", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <AlertIcon size={14} color="#ef4444" /> CVEs &amp; ATT&amp;CK ({extractedData.cves.length + extractedData.mitre_techniques.length})
                </strong>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {extractedData.cves.map((cve, i) => (
                    <span key={i} style={{ fontSize: 10, background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                      {cve}
                    </span>
                  ))}
                  {extractedData.mitre_techniques.map((m, i) => (
                    <span key={i} style={{ fontSize: 10, background: "rgba(0, 240, 255, 0.15)", color: "var(--cyan)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(0, 240, 255, 0.3)" }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hashes */}
              <div style={{ background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 6, padding: 12 }}>
                <strong style={{ fontSize: 12, color: "#fff", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <LayersIcon size={14} color="var(--cyan)" /> File Hashes ({extractedData.hashes.length})
                </strong>
                {extractedData.hashes.length > 0 ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {extractedData.hashes.map((h, i) => (
                      <div key={i} style={{ fontSize: 10, fontFamily: "monospace", background: "rgba(255, 255, 255, 0.04)", padding: "4px 8px", borderRadius: 4, color: "#fff" }}>
                        [{h.type.toUpperCase()}] {h.hash.slice(0, 32)}...
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>None detected</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: LIVE THREAT FEEDS */}
      {activeTab === "FEEDS" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Live telemetry aggregated from Ransomware.live, abuse.ch Feodo Tracker &amp; URLhaus:
            </span>
            <button
              onClick={loadFeeds}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border)",
                color: "#fff",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshCwIcon size={10} /> REFRESH FEEDS
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {feeds.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Header row: Source, Status, Severity, Title, SaveToCase */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: "monospace",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: "rgba(168, 85, 247, 0.2)",
                          color: "#c084fc",
                          border: "1px solid rgba(168, 85, 247, 0.3)",
                        }}
                      >
                        {item.source}
                      </span>
                      {item.status && (
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: "monospace",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: item.status === "DATA_LEAKED" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                            color: item.status === "DATA_LEAKED" ? "#f87171" : "#fbbf24",
                            border: item.status === "DATA_LEAKED" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                          }}
                        >
                          {item.status}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        Discovered: {item.date_discovered}
                      </span>
                    </div>
                    <strong style={{ fontSize: 14, color: "#fff" }}>{item.title}</strong>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: `${getSevColor(item.severity)}20`,
                        color: getSevColor(item.severity),
                        border: `1px solid ${getSevColor(item.severity)}50`,
                      }}
                    >
                      {item.severity}
                    </span>
                    <SaveToCaseButton
                      identifierType="url"
                      identifierValue={item.leak_source_url || item.indicator}
                      platform={`threatfeed.${item.source}`}
                      discoveredBy="voidaccess"
                      metadata={{
                        title: item.title,
                        indicator: item.indicator,
                        source: item.source,
                        date: item.date_discovered,
                        severity: item.severity,
                        victim_org: item.victim_organization,
                        victim_domain: item.victim_domain,
                        threat_actor: item.threat_actor,
                        leak_url: item.leak_source_url,
                        data_size: item.exfiltrated_data_size,
                        compromised_fields: item.compromised_fields,
                      }}
                    />
                  </div>
                </div>

                {/* 3-Tier Provenance Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10,
                    background: "rgba(0, 0, 0, 0.25)",
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  {/* TIER 1: WHERE THE LEAK IS */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <GlobeIcon size={12} color="var(--cyan)" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.05em" }}>
                        WHERE THE LEAK IS
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                      {item.victim_organization || "Target Entity Identification in Progress"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ color: "#38bdf8", fontFamily: "monospace" }}>{item.victim_domain || item.indicator}</span>
                      {item.victim_country && (
                        <span style={{ background: "rgba(255, 255, 255, 0.08)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>
                          {item.victim_country}
                        </span>
                      )}
                      {item.victim_sector && (
                        <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>
                          • {item.victim_sector}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* TIER 2: WHO LEAKED THE DATA */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <ShieldIcon size={12} color="#f59e0b" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em" }}>
                        WHO LEAKED IT
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fbbf24",
                          background: "rgba(245, 158, 11, 0.15)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        {item.threat_actor || "Unattributed Threat Actor"}
                      </span>
                      {item.threat_actor && (
                        <button
                          onClick={() => {
                            setActiveTab("ACTORS");
                            setActorSearch(item.threat_actor || "");
                            loadActors(item.threat_actor || "");
                          }}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "var(--cyan)",
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                        >
                          Pivot to Actor Dossier →
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      Threat Type: {item.threat_type}
                    </div>
                  </div>

                  {/* TIER 3: WHERE TO GATHER IT */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <LayersIcon size={12} color="#34d399" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: "0.05em" }}>
                        WHERE TO GATHER IT (PROVENANCE & PAYLOAD)
                      </span>
                    </div>

                    {item.exfiltrated_data_size && (
                      <div style={{ fontSize: 11, color: "#d1d5db" }}>
                        <strong>Compromised Volume:</strong> {item.exfiltrated_data_size}
                      </div>
                    )}

                    {item.leak_source_url && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Provenance Source:</span>
                        <code
                          style={{
                            fontSize: 11,
                            color: "#34d399",
                            background: "rgba(52, 211, 153, 0.1)",
                            padding: "2px 8px",
                            borderRadius: 4,
                            border: "1px solid rgba(52, 211, 153, 0.2)",
                            wordBreak: "break-all",
                          }}
                        >
                          {item.leak_source_url}
                        </code>
                        <button
                          onClick={() => copyFeedUrl(item.leak_source_url!)}
                          style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: copiedUrl === item.leak_source_url ? "#34d399" : "#fff",
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 3,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CopyIcon size={11} /> {copiedUrl === item.leak_source_url ? "Copied!" : "Copy Source URL"}
                        </button>
                      </div>
                    )}

                    {item.compromised_fields && item.compromised_fields.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Compromised Records:</span>
                        {item.compromised_fields.map((f, fi) => (
                          <span
                            key={fi}
                            style={{
                              fontSize: 10,
                              background: "rgba(239, 68, 68, 0.12)",
                              color: "#fca5a5",
                              padding: "1px 6px",
                              borderRadius: 3,
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                              fontFamily: "monospace",
                            }}
                          >
                            [{f}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: DETECTION & EXPORTS */}
      {activeTab === "EXPORTS" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["yara", "sigma", "stix", "csv"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  setExportFormat(fmt);
                  handleGenerateExport(fmt);
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: exportFormat === fmt ? "#a855f7" : "rgba(255, 255, 255, 0.05)",
                  color: exportFormat === fmt ? "#fff" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {fmt}
              </button>
            ))}

            <button
              onClick={() => copyToClipboard(generatedRule)}
              style={{
                marginLeft: "auto",
                background: copied ? "var(--success)" : "rgba(255, 255, 255, 0.08)",
                color: copied ? "#000" : "#fff",
                border: "1px solid var(--border)",
                padding: "6px 14px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {copied ? <CheckIcon size={12} /> : <DownloadIcon size={12} />}
              {copied ? "COPIED TO CLIPBOARD" : "COPY CODE"}
            </button>
          </div>

          <pre
            style={{
              background: "#080610",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              borderRadius: 6,
              padding: 14,
              fontSize: 12,
              fontFamily: "monospace",
              color: "#e2e8f0",
              overflowX: "auto",
              maxHeight: 420,
            }}
          >
            {ruleLoading ? "// Generating detection rule..." : generatedRule || "// Click an export format above to generate"}
          </pre>
        </div>
      )}
    </div>
  );
}
