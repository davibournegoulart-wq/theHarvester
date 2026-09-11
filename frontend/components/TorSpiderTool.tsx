"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import { ShieldIcon, TerminalIcon, BoltIcon, GlobeIcon, LinkIcon, CheckIcon, CrossIcon } from "@/components/FlatIcons";

type SpiderResultNode = {
  url: string;
  status_code: number;
  online: boolean;
  title: string;
  server: string;
  discovered_onions: string[];
  crypto_addresses: {
    bitcoin: string[];
    monero: string[];
    ethereum: string[];
  };
  emails: string[];
  pgp_detected: boolean;
  crawled_at: string;
};

export default function TorSpiderTool() {
  const { activeCase } = useActiveCase();
  const [seedsText, setSeedsText] = useState("http://darkfailenqduayrmn.onion\nhttp://torbox36ijlcevgah7xsts3nxwtpq2sn7l5mh.onion");
  const [maxDepth, setMaxDepth] = useState<number>(1);
  const [maxPages, setMaxPages] = useState<number>(15);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("IDLE");
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<SpiderResultNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachedCount, setAttachedCount] = useState<Record<string, boolean>>({});

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll spider job while active
  useEffect(() => {
    if (!jobId || status === "COMPLETED" || status === "CANCELLED") return;

    const interval = setInterval(async () => {
      try {
        const data = await apiGet<{
          status: string;
          visited_count: number;
          results_count: number;
          logs: string[];
        }>(`/darkweb/spider/status/${jobId}`);

        setStatus(data.status);
        setLogs(data.logs || []);

        if (data.status === "COMPLETED" || data.status === "CANCELLED") {
          // Fetch final results
          const res = await apiGet<{ results: SpiderResultNode[] }>(`/darkweb/spider/results/${jobId}`);
          setResults(res.results || []);
        }
      } catch (err) {
        console.error("Polling spider error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleStartCrawl() {
    const seeds = seedsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (seeds.length === 0) {
      alert("Please specify at least one seed .onion URL.");
      return;
    }

    setLoading(true);
    setResults([]);
    setLogs([]);
    try {
      const res = await apiPostJson<{ job_id: string; status: string }>("/darkweb/spider/start", {
        seeds,
        max_depth: maxDepth,
        max_pages: maxPages,
      });
      setJobId(res.job_id);
      setStatus("RUNNING");
    } catch (err: any) {
      alert(err?.message || "Failed to start Tor spider");
    } finally {
      setLoading(false);
    }
  }

  async function handleStopCrawl() {
    if (!jobId) return;
    try {
      await apiPostJson(`/darkweb/spider/stop/${jobId}`, {});
      setStatus("CANCELLED");
    } catch (err: any) {
      console.error("Stop error:", err);
    }
  }

  async function handleAttachToCase(node: SpiderResultNode) {
    if (!activeCase) {
      alert("No active case selected. Please select or create a case first in the top HUD.");
      return;
    }

    try {
      const textSummary = `[TOR SPIDER FINDING]\nTarget: ${node.url}\nTitle: ${node.title}\nServer: ${node.server}\nCrypto Wallets: ${JSON.stringify(node.crypto_addresses)}\nDiscovered Onions: ${node.discovered_onions.join(", ")}`;
      await apiPostJson(`/cases/${activeCase.id}/evidence/quick-add`, {
        category: "darkweb_spider",
        content: textSummary,
        source_url: node.url,
      });
      setAttachedCount((prev) => ({ ...prev, [node.url]: true }));
    } catch (err: any) {
      alert(err?.message || "Failed to attach finding to case");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header & Telemetry */}
      <div
        className="hud-glass"
        style={{
          padding: 24,
          borderRadius: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--cyan)", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: 4 }}>
            {"> DEEP WEB SUBSYSTEM // TOR SOCKS5 ROUTED // AUTOMATED CRAWLER_"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldIcon size={22} color="var(--cyan)" />
            TOR HIDDEN SERVICE SPIDER
          </h2>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 13, maxWidth: 650 }}>
            Multi-depth asynchronous dark web spider. Crawls .onion hidden services, follows outbound hyperlinks, indexes page titles, and automatically extracts Bitcoin, Monero, and PGP keys.
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(5, 217, 232, 0.08)",
              border: "1px solid var(--cyan)",
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>TOR PROXY</div>
            <div style={{ fontSize: 14, color: "var(--cyan)", fontWeight: "bold" }}>SOCKS5:9050 ONLINE</div>
          </div>
          <div
            style={{
              padding: "8px 16px",
              background: status === "RUNNING" ? "rgba(0, 255, 159, 0.15)" : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${status === "RUNNING" ? "#00FF9F" : "var(--panel-border)"}`,
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>STATUS</div>
            <div style={{ fontSize: 14, color: status === "RUNNING" ? "#00FF9F" : "var(--text-muted)", fontWeight: "bold" }}>
              {status}
            </div>
          </div>
        </div>
      </div>

      {/* Control Deck */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left: Seed Config */}
        <div className="hud-glass" style={{ padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12, letterSpacing: "0.1em" }}>
            CRAWLER SEEDS & PARAMETERS
          </div>

          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Seed .onion URLs (One per line):
          </label>
          <textarea
            value={seedsText}
            onChange={(e) => setSeedsText(e.target.value)}
            disabled={status === "RUNNING"}
            rows={5}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--panel-border)",
              borderRadius: 6,
              color: "#fff",
              padding: 10,
              fontFamily: "monospace",
              fontSize: 12,
              marginBottom: 16,
            }}
          />

          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Crawl Depth:</label>
              <select
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                disabled={status === "RUNNING"}
                style={{ width: "100%", padding: 8, background: "#0c0e17", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6 }}
              >
                <option value={1}>Depth 1 (Seed Pages Only)</option>
                <option value={2}>Depth 2 (Follow Outbound Onions)</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Max Pages Limiter:</label>
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                disabled={status === "RUNNING"}
                style={{ width: "100%", padding: 8, background: "#0c0e17", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6 }}
              >
                <option value={10}>10 Hidden Services</option>
                <option value={20}>20 Hidden Services</option>
                <option value={40}>40 Hidden Services</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {status === "RUNNING" ? (
              <button
                onClick={handleStopCrawl}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "rgba(255, 42, 109, 0.2)",
                  borderColor: "#FF2A6D",
                  color: "#FF2A6D",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ABORT SPIDER
              </button>
            ) : (
              <button
                onClick={handleStartCrawl}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "rgba(5, 217, 232, 0.2)",
                  borderColor: "var(--cyan)",
                  color: "var(--cyan)",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 0 12px rgba(5, 217, 232, 0.3)",
                }}
              >
                {loading ? "INITIALIZING..." : "LAUNCH TOR SPIDER"}
              </button>
            )}
            <button
              onClick={() => {
                setSeedsText("http://darkfailenqduayrmn.onion\nhttp://torbox36ijlcevgah7xsts3nxwtpq2sn7l5mh.onion\nhttp://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion");
              }}
              style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--panel-border)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              Load Presets
            </button>
          </div>
        </div>

        {/* Right: Live Terminal Log Console */}
        <div className="hud-glass" style={{ padding: 20, borderRadius: 12, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
              <TerminalIcon size={14} color="var(--cyan)" />
              LIVE TELEMETRY STREAM
            </div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>
              {logs.length} events logged
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 220,
              maxHeight: 250,
              background: "#05070d",
              border: "1px solid rgba(5, 217, 232, 0.2)",
              borderRadius: 8,
              padding: 12,
              fontFamily: "monospace",
              fontSize: 11,
              color: "#00FF9F",
              overflowY: "auto",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>{"> Waiting for crawler ignition..."}</div>
            ) : (
              logs.map((l, i) => <div key={i} style={{ marginBottom: 4 }}>{l}</div>)
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Results Deck */}
      {results.length > 0 && (
        <div className="hud-glass" style={{ padding: 24, borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: "var(--cyan)", letterSpacing: "0.1em" }}>
              DISCOVERED ONION NODES ({results.length})
            </h3>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Active Case: <strong style={{ color: "#fff" }}>{activeCase?.name || "None Selected"}</strong>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {results.map((r, idx) => {
              const btcCount = r.crypto_addresses.bitcoin.length;
              const xmrCount = r.crypto_addresses.monero.length;
              const isAttached = attachedCount[r.url];

              return (
                <div
                  key={idx}
                  style={{
                    padding: 16,
                    background: "rgba(10, 14, 24, 0.7)",
                    border: `1px solid ${r.online ? "rgba(0, 255, 159, 0.2)" : "rgba(255, 42, 109, 0.2)"}`,
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: r.online ? "rgba(0, 255, 159, 0.15)" : "rgba(255, 42, 109, 0.15)",
                            color: r.online ? "#00FF9F" : "#FF2A6D",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                          }}
                        >
                          {r.online ? `ONLINE (${r.status_code})` : "OFFLINE / UNREACHABLE"}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>{r.title}</span>
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--cyan)" }}>{r.url}</div>
                    </div>

                    <button
                      onClick={() => handleAttachToCase(r)}
                      disabled={isAttached}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        background: isAttached ? "rgba(0, 255, 159, 0.1)" : "rgba(5, 217, 232, 0.1)",
                        borderColor: isAttached ? "#00FF9F" : "var(--cyan)",
                        color: isAttached ? "#00FF9F" : "var(--cyan)",
                        cursor: isAttached ? "default" : "pointer",
                      }}
                    >
                      {isAttached ? "ATTACHED TO CASE ✓" : "+ ATTACH TO CASE"}
                    </button>
                  </div>

                  {/* Artifacts badges */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {btcCount > 0 && (
                      <span style={{ fontSize: 11, background: "rgba(255, 184, 0, 0.15)", border: "1px solid #FFB800", color: "#FFB800", padding: "2px 8px", borderRadius: 4 }}>
                        ⚡ BTC: {r.crypto_addresses.bitcoin.join(", ")}
                      </span>
                    )}
                    {xmrCount > 0 && (
                      <span style={{ fontSize: 11, background: "rgba(255, 102, 0, 0.15)", border: "1px solid #FF6600", color: "#FF6600", padding: "2px 8px", borderRadius: 4 }}>
                        🔒 XMR: {r.crypto_addresses.monero.join(", ")}
                      </span>
                    )}
                    {r.emails.length > 0 && (
                      <span style={{ fontSize: 11, background: "rgba(5, 217, 232, 0.15)", border: "1px solid var(--cyan)", color: "var(--cyan)", padding: "2px 8px", borderRadius: 4 }}>
                        ✉ {r.emails.join(", ")}
                      </span>
                    )}
                    {r.pgp_detected && (
                      <span style={{ fontSize: 11, background: "rgba(162, 89, 255, 0.15)", border: "1px solid #A259FF", color: "#A259FF", padding: "2px 8px", borderRadius: 4 }}>
                        🔑 PGP Key Detected
                      </span>
                    )}
                    {r.discovered_onions.length > 0 && (
                      <span style={{ fontSize: 11, background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--panel-border)", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 4 }}>
                        🔗 {r.discovered_onions.length} outbound onions linked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
