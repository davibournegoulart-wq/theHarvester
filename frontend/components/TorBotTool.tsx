"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  ShieldIcon,
  TerminalIcon,
  GlobeIcon,
  LinkIcon,
  KeyIcon,
  CheckIcon,
  AlertIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  FolderIcon,
  SearchIcon,
} from "@/components/FlatIcons";

export type TorbotCheckResponse = {
  url: string;
  online: boolean;
  status_code: number;
  latency_ms: number;
  server: string;
  title: string;
  content_length: number;
  is_onion: boolean;
  checked_at: string;
  error?: string;
};

export type TorbotIntelResponse = {
  url: string;
  online: boolean;
  status_code: number;
  title: string;
  description: string;
  server: string;
  content_hash_sha256: string | null;
  text_preview: string;
  emails: string[];
  crypto_wallets: {
    bitcoin: string[];
    monero: string[];
    ethereum: string[];
  };
  discovered_onions: string[];
  external_links: string[];
  security_audits: {
    exposed_git: boolean;
    exposed_svn: boolean;
    exposed_htaccess: boolean;
    robots_txt_found: boolean;
    robots_txt_rules: string[];
  };
  response_time_ms: number;
  error?: string;
};

export type TorbotTreeNode = {
  id: string;
  url: string;
  title: string;
  status_code: number;
  depth: number;
  emails_count: number;
  btc_count: number;
  is_seed: boolean;
  domain: string;
  error?: string;
};

export type TorbotCrawlResponse = {
  seed_url: string;
  total_nodes: number;
  total_edges: number;
  nodes: TorbotTreeNode[];
  edges: { source: string; target: string }[];
  max_depth_crawled: number;
};

const ONION_PRESETS = [
  { name: "Check Tor (Clearnet)", url: "https://check.torproject.org" },
  { name: "DuckDuckGo (.onion)", url: "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion" },
  { name: "Tor Project (.onion)", url: "http://2gzyxa5ihm7nsggfxnu52r2kgvfdafnggjhodq6urq2mgxrsz76vv3id.onion" },
  { name: "TorBox Mail (.onion)", url: "http://torbox36ijlcevgah7xsts3nxwtpq2sn7l5mh.onion" },
  { name: "DarkFail Mirror (.onion)", url: "http://darkfailenqduayrmn.onion" },
];

export default function TorBotTool({ initialUrl }: { initialUrl?: string }) {
  const { activeCase } = useActiveCase();
  const [targetUrl, setTargetUrl] = useState(initialUrl || "https://check.torproject.org");
  const [crawlDepth, setCrawlDepth] = useState<number>(1);
  const [maxPages, setMaxPages] = useState<number>(10);
  
  const [loadingAction, setLoadingAction] = useState<"check" | "intel" | "crawl" | null>(null);
  const [checkResult, setCheckResult] = useState<TorbotCheckResponse | null>(null);
  const [intelResult, setIntelResult] = useState<TorbotIntelResponse | null>(null);
  const [crawlResult, setCrawlResult] = useState<TorbotCrawlResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheckStatus() {
    if (!targetUrl.trim()) return;
    setLoadingAction("check");
    setErrorMessage(null);
    setCheckResult(null);

    try {
      const data = await apiGet<TorbotCheckResponse>(`/recon/torbot/check?url=${encodeURIComponent(targetUrl.trim())}`);
      setCheckResult(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to query TorBot status checker");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleExtractIntel() {
    if (!targetUrl.trim()) return;
    setLoadingAction("intel");
    setErrorMessage(null);
    setIntelResult(null);

    try {
      const data = await apiPostJson<TorbotIntelResponse>("/recon/torbot/intel", { url: targetUrl.trim() });
      setIntelResult(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to execute TorBot forensic intel extraction");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCrawlLinkTree() {
    if (!targetUrl.trim()) return;
    setLoadingAction("crawl");
    setErrorMessage(null);
    setCrawlResult(null);

    try {
      const data = await apiPostJson<TorbotCrawlResponse>("/recon/torbot/crawl", {
        url: targetUrl.trim(),
        depth: crawlDepth,
        max_pages: maxPages,
      });
      setCrawlResult(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to crawl onion link tree");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid rgba(0, 255, 159, 0.4)",
        borderRadius: 6,
        padding: 20,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          borderBottom: "1px solid rgba(0, 255, 159, 0.2)",
          paddingBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldIcon size={20} color="#00ff9f" />
            <h3 style={{ margin: 0, color: "#00ff9f", letterSpacing: "0.08em", fontSize: 16 }}>
              OWASP TORBOT: DARK WEB OSINT &amp; ONION LINK CRAWLER
            </h3>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(0, 255, 159, 0.15)",
                color: "#00ff9f",
                border: "1px solid rgba(0, 255, 159, 0.3)",
                fontFamily: "monospace",
              }}
            >
              DedSecInside/TorBot
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "6px 0 0 0", maxWidth: 850 }}>
            Dark web reconnaissance engine for probing hidden services (.onion) via SOCKS5 proxy,
            extracting cryptographic addresses (BTC/XMR/ETH), harvesting emails, auditing exposed directories,
            and constructing hierarchical link relationship trees.
          </p>
        </div>
      </div>

      {/* Preset Onion Selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Target Presets:</span>
        {ONION_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => setTargetUrl(p.url)}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 4,
              border: targetUrl === p.url ? "1px solid #00ff9f" : "1px solid var(--border)",
              background: targetUrl === p.url ? "rgba(0, 255, 159, 0.15)" : "rgba(255, 255, 255, 0.04)",
              color: targetUrl === p.url ? "#00ff9f" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Input controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: "1 1 340px", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="http://example.onion or https://clearnet-target.com"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 13,
              fontFamily: "monospace",
              background: "rgba(10, 12, 18, 0.8)",
              border: "1px solid rgba(0, 255, 159, 0.4)",
              borderRadius: 4,
              color: "#fff",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            Depth:
            <select
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(parseInt(e.target.value, 10))}
              style={{
                padding: "6px 8px",
                fontSize: 11,
                background: "rgba(10, 12, 18, 0.8)",
                border: "1px solid var(--border)",
                color: "#fff",
                borderRadius: 4,
              }}
            >
              <option value={1}>1 (Direct Links)</option>
              <option value={2}>2 (Deep Tree)</option>
            </select>
          </label>

          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            Max:
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value, 10))}
              style={{
                padding: "6px 8px",
                fontSize: 11,
                background: "rgba(10, 12, 18, 0.8)",
                border: "1px solid var(--border)",
                color: "#fff",
                borderRadius: 4,
              }}
            >
              <option value={5}>5 Pages</option>
              <option value={10}>10 Pages</option>
              <option value={20}>20 Pages</option>
            </select>
          </label>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCheckStatus}
            disabled={loadingAction !== null}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              background: "rgba(5, 217, 232, 0.15)",
              color: "var(--cyan)",
              border: "1px solid var(--cyan)",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: loadingAction ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loadingAction === "check" ? <RefreshCwIcon size={12} color="var(--cyan)" /> : <GlobeIcon size={12} color="var(--cyan)" />}
            {loadingAction === "check" ? "PROBING..." : "CHECK STATUS"}
          </button>

          <button
            onClick={handleExtractIntel}
            disabled={loadingAction !== null}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              background: "rgba(0, 255, 159, 0.2)",
              color: "#00ff9f",
              border: "1px solid #00ff9f",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: loadingAction ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loadingAction === "intel" ? <RefreshCwIcon size={12} color="#00ff9f" /> : <TerminalIcon size={12} color="#00ff9f" />}
            {loadingAction === "intel" ? "EXTRACTING..." : "EXTRACT INTEL"}
          </button>

          <button
            onClick={handleCrawlLinkTree}
            disabled={loadingAction !== null}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              background: "rgba(162, 89, 255, 0.2)",
              color: "#a259ff",
              border: "1px solid #a259ff",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: loadingAction ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loadingAction === "crawl" ? <RefreshCwIcon size={12} color="#a259ff" /> : <LinkIcon size={12} color="#a259ff" />}
            {loadingAction === "crawl" ? "CRAWLING..." : "CRAWL LINK TREE"}
          </button>
        </div>
      </div>

      {/* Error display */}
      {errorMessage && (
        <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--danger)", borderRadius: 4, color: "var(--danger)", fontSize: 12, marginBottom: 14 }}>
          {errorMessage}
        </div>
      )}

      {/* =========================================================================
          SECTION 1: STATUS CHECK RESULT
          ========================================================================= */}
      {checkResult && (
        <div
          style={{
            background: "rgba(10, 14, 22, 0.95)",
            border: checkResult.online ? "1px solid rgba(0, 255, 159, 0.4)" : "1px solid rgba(255, 42, 109, 0.4)",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: "bold", fontSize: 13, color: checkResult.online ? "#00ff9f" : "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
              {checkResult.online ? <CheckIcon size={14} color="#00ff9f" /> : <AlertIcon size={14} color="var(--danger)" />}
              {checkResult.online ? "ONION SERVICE IS LIVE & RESPONDING" : "SERVICE UNREACHABLE / OFFLINE"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {checkResult.checked_at}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12, marginBottom: 10 }}>
            <div>HTTP STATUS: <strong style={{ color: checkResult.online ? "#00ff9f" : "var(--danger)" }}>{checkResult.status_code || "Connection Error"}</strong></div>
            <div>RESPONSE LATENCY: <strong style={{ color: "var(--cyan)" }}>{checkResult.latency_ms} ms</strong></div>
            <div>SERVER BANNER: <span style={{ color: "#fff" }}>{checkResult.server}</span></div>
            <div>PAYLOAD SIZE: <span style={{ color: "#fff" }}>{checkResult.content_length} bytes</span></div>
          </div>

          <div style={{ fontSize: 12, color: "#fff" }}>
            TITLE: <span style={{ color: "var(--cyan)" }}>{checkResult.title}</span>
          </div>
          {checkResult.error && (
            <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>
              Error: {checkResult.error}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 2: FORENSIC INTEL RESULT
          ========================================================================= */}
      {intelResult && (
        <div
          style={{
            background: "rgba(10, 14, 22, 0.95)",
            border: "1px solid rgba(0, 255, 159, 0.3)",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <h4 style={{ margin: 0, color: "#00ff9f", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <TerminalIcon size={14} color="#00ff9f" />
              FORENSIC ONION EXTRACTION: {intelResult.title}
            </h4>
            <div style={{ display: "flex", gap: 8 }}>
              <SaveToCaseButton
                identifierType="url"
                identifierValue={intelResult.url}
                platform="darkweb_onion"
                discoveredBy="torbot"
                metadata={{
                  title: intelResult.title,
                  server: intelResult.server,
                  emails: intelResult.emails,
                  crypto_wallets: intelResult.crypto_wallets,
                  content_hash: intelResult.content_hash_sha256,
                }}
              />
            </div>
          </div>

          {/* Quick metadata grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, fontSize: 12, marginBottom: 12, background: "rgba(255, 255, 255, 0.03)", padding: 10, borderRadius: 4 }}>
            <div>SERVER: <span style={{ color: "#fff" }}>{intelResult.server}</span></div>
            <div>STATUS: <span style={{ color: "#00ff9f" }}>{intelResult.status_code} OK</span></div>
            <div>LATENCY: <span style={{ color: "var(--cyan)" }}>{intelResult.response_time_ms} ms</span></div>
            <div>SHA-256 HASH: <span style={{ color: "var(--cyan)", fontFamily: "monospace", fontSize: 10 }}>{intelResult.content_hash_sha256?.slice(0, 16)}...</span></div>
          </div>

          {/* Discovered Cryptocurrencies */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "#ffaa00", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <KeyIcon size={12} color="#ffaa00" />
              CRYPTOCURRENCY WALLETS DISCOVERED:
            </span>
            {intelResult.crypto_wallets.bitcoin.length === 0 &&
            intelResult.crypto_wallets.monero.length === 0 &&
            intelResult.crypto_wallets.ethereum.length === 0 ? (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No public cryptocurrency addresses found in source text.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {intelResult.crypto_wallets.bitcoin.map((btc) => (
                  <div key={btc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 170, 0, 0.08)", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                    <span style={{ fontFamily: "monospace", color: "#ffaa00" }}>[BTC] {btc}</span>
                    <SaveToCaseButton identifierType="crypto" identifierValue={btc} platform="bitcoin" discoveredBy="torbot" metadata={{ onion_source: intelResult.url }} />
                  </div>
                ))}
                {intelResult.crypto_wallets.monero.map((xmr) => (
                  <div key={xmr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 170, 0, 0.08)", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                    <span style={{ fontFamily: "monospace", color: "#ffaa00" }}>[XMR] {xmr}</span>
                    <SaveToCaseButton identifierType="crypto" identifierValue={xmr} platform="monero" discoveredBy="torbot" metadata={{ onion_source: intelResult.url }} />
                  </div>
                ))}
                {intelResult.crypto_wallets.ethereum.map((eth) => (
                  <div key={eth} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 170, 0, 0.08)", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                    <span style={{ fontFamily: "monospace", color: "#ffaa00" }}>[ETH] {eth}</span>
                    <SaveToCaseButton identifierType="crypto" identifierValue={eth} platform="ethereum" discoveredBy="torbot" metadata={{ onion_source: intelResult.url }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discovered Emails */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <GlobeIcon size={12} color="var(--cyan)" />
              DISCOVERED EMAIL ADDRESSES:
            </span>
            {intelResult.emails.length === 0 ? (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No email addresses identified.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {intelResult.emails.map((em) => (
                  <div key={em} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(5, 217, 232, 0.08)", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                    <span style={{ fontFamily: "monospace", color: "var(--cyan)" }}>{em}</span>
                    <SaveToCaseButton identifierType="email" identifierValue={em} platform="onion_scraper" discoveredBy="torbot" metadata={{ source_url: intelResult.url }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Exposure Audit */}
          <div style={{ marginBottom: 12, fontSize: 11 }}>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "#a259ff", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <ShieldIcon size={12} color="#a259ff" />
              DIRECTORY &amp; REPOSITORY EXPOSURE:
            </span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: intelResult.security_audits.exposed_git ? "var(--danger)" : "#00ff9f" }}>
                Exposed .git: {intelResult.security_audits.exposed_git ? "CRITICAL (Config Leak)" : "No"}
              </span>
              <span style={{ color: intelResult.security_audits.robots_txt_found ? "var(--cyan)" : "var(--text-muted)" }}>
                robots.txt: {intelResult.security_audits.robots_txt_found ? "Found (Rules parsed)" : "None"}
              </span>
            </div>
            {intelResult.security_audits.robots_txt_rules.length > 0 && (
              <div style={{ marginTop: 6, padding: 6, background: "rgba(0,0,0,0.4)", borderRadius: 4, fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>
                {intelResult.security_audits.robots_txt_rules.join(" | ")}
              </div>
            )}
          </div>

          {/* Outbound Onions */}
          {intelResult.discovered_onions.length > 0 && (
            <div>
              <span style={{ fontSize: 11, fontWeight: "bold", color: "#00ff9f", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <LinkIcon size={12} color="#00ff9f" />
                DISCOVERED ONION PEERS ({intelResult.discovered_onions.length}):
              </span>
              <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {intelResult.discovered_onions.map((o) => (
                  <div key={o} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, background: "rgba(0, 255, 159, 0.05)", padding: "3px 6px", borderRadius: 3 }}>
                    <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{o}</span>
                    <button
                      onClick={() => setTargetUrl(o)}
                      style={{
                        padding: "2px 6px",
                        fontSize: 10,
                        background: "rgba(0, 255, 159, 0.15)",
                        color: "#00ff9f",
                        border: "none",
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                    >
                      Inspect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SECTION 3: LINK TREE CRAWLER RESULT
          ========================================================================= */}
      {crawlResult && (
        <div
          style={{
            background: "rgba(10, 14, 22, 0.95)",
            border: "1px solid rgba(162, 89, 255, 0.4)",
            borderRadius: 6,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h4 style={{ margin: 0, color: "#a259ff", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <LinkIcon size={14} color="#a259ff" />
              ONION LINK RELATIONSHIP GRAPH ({crawlResult.total_nodes} Nodes, {crawlResult.total_edges} Edges)
            </h4>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Seed: <strong style={{ color: "#fff", fontFamily: "monospace" }}>{crawlResult.seed_url}</strong>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {crawlResult.nodes.map((node) => (
              <div
                key={node.id}
                style={{
                  background: node.is_seed ? "rgba(162, 89, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  border: node.is_seed ? "1px solid rgba(162, 89, 255, 0.5)" : "1px solid var(--border)",
                  borderRadius: 4,
                  padding: 10,
                  marginLeft: node.depth * 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: node.is_seed ? "#a259ff" : "rgba(255, 255, 255, 0.1)",
                        color: node.is_seed ? "#000" : "#fff",
                        fontWeight: "bold",
                      }}
                    >
                      {node.is_seed ? "ROOT SEED" : `DEPTH ${node.depth}`}
                    </span>
                    <strong style={{ fontSize: 12, color: "#fff" }}>{node.title}</strong>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: "bold",
                      color: node.status_code === 200 ? "#00ff9f" : "var(--danger)",
                    }}
                  >
                    HTTP {node.status_code || "ERR"}
                  </span>
                </div>

                <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--cyan)", marginBottom: 6 }}>
                  {node.url}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--text-muted)" }}>
                    <span>Emails: <strong style={{ color: "#fff" }}>{node.emails_count}</strong></span>
                    <span>Crypto: <strong style={{ color: "#ffaa00" }}>{node.btc_count}</strong></span>
                  </div>

                  <button
                    onClick={() => {
                      setTargetUrl(node.url);
                      setTimeout(handleExtractIntel, 50);
                    }}
                    style={{
                      padding: "3px 8px",
                      fontSize: 10,
                      background: "rgba(162, 89, 255, 0.15)",
                      color: "#a259ff",
                      border: "1px solid #a259ff",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Forensic Scan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
