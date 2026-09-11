"use client";

import React, { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  BarChartIcon,
  ActivityIcon,
  RadarIcon,
  SearchIcon,
  ShieldIcon,
  GlobeIcon,
  ExternalLinkIcon,
  CheckIcon,
  CrossIcon,
  AlertIcon,
  FolderIcon,
  UserIcon,
  BoltIcon,
  DatabaseIcon,
  XIcon,
  YouTubeIcon,
} from "./FlatIcons";

type MentionItem = {
  platform: string;
  title: string;
  author: string;
  source: string;
  url: string;
  published_at: string;
  hour_utc: number;
  weekday: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "CRITICAL";
  sentiment_score: number;
  hashtags: string[];
  mentions: string[];
};

type MonitoringTool = {
  name: string;
  url: string;
  category: string;
  description: string;
  capabilities: string[];
  query_url: string;
};

type AnalyticsResponse = {
  target: string;
  query_type: string;
  analyzed_at: string;
  total_mentions: number;
  estimated_reach: number;
  threat_level: string;
  dominant_sentiment: string;
  sentiment_score_avg: number;
  sentiment_breakdown: {
    positive: { count: number; percent: number };
    neutral: { count: number; percent: number };
    negative: { count: number; percent: number };
    critical: { count: number; percent: number };
  };
  platform_breakdown: Record<string, number>;
  cadence_analysis: {
    rhythm_type: string;
    peak_hour_utc: number;
    hourly_distribution: number[];
    weekday_distribution: Record<string, number>;
  };
  top_hashtags: { tag: string; count: number }[];
  top_keywords: { keyword: string; count: number }[];
  top_amplifiers: { author: string; platform: string; count: number }[];
  audience_clusters: { segment: string; affinity_score: number; description: string }[];
  mentions: MentionItem[];
  monitoring_tools: MonitoringTool[];
};

export default function SocialAnalyticsRecon() {
  const { activeCase } = useActiveCase();
  const [target, setTarget] = useState("");
  const [limit, setLimit] = useState(50);
  const [useTor, setUseTor] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream" | "sentiment" | "audience" | "cadence" | "tools">("stream");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Mention stream filter
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [streamSearch, setStreamSearch] = useState("");

  // Case Vault attachment state
  const [attaching, setAttaching] = useState(false);
  const [attachSuccess, setAttachSuccess] = useState(false);

  const handleSearch = async (overrideTarget?: string) => {
    const q = (overrideTarget ?? target).trim();
    if (!q || !activeCase) return;
    if (overrideTarget) setTarget(overrideTarget);

    setLoading(true);
    setError(null);
    setAttachSuccess(false);

    try {
      const params = new URLSearchParams({
        target: q,
        limit: String(limit),
        use_tor: useTor ? "true" : "false",
      });
      const res = await apiGet<AnalyticsResponse>(`/recon/social-analytics/analyze?${params.toString()}`);
      setData(res);
      setSearched(true);
    } catch (err: any) {
      setError(err?.message || "Failed running social media analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleAttachReportToCase = async () => {
    if (!data || !activeCase) return;
    setAttaching(true);
    try {
      await apiPostJson("/recon/social-analytics/attach-evidence", {
        case_id: activeCase.id,
        target: data.target,
        payload: data,
      });
      setAttachSuccess(true);
      setTimeout(() => setAttachSuccess(false), 4000);
    } catch (err) {
      console.error("Failed attaching analytics to case vault", err);
    } finally {
      setAttaching(false);
    }
  };

  const filteredMentions = (data?.mentions || []).filter((m) => {
    if (platformFilter !== "all" && m.platform.toLowerCase() !== platformFilter.toLowerCase()) return false;
    if (sentimentFilter !== "all" && m.sentiment.toLowerCase() !== sentimentFilter.toLowerCase()) return false;
    if (streamSearch.trim()) {
      const q = streamSearch.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getThreatColor = (level: string) => {
    if (level === "CRISIS ALERT") return "#ff0055";
    if (level === "HIGH SURGE") return "#ff5500";
    if (level === "ELEVATED") return "#ffbb00";
    return "#00ffaa";
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === "POSITIVE") return "#00ffaa";
    if (sentiment === "CRITICAL") return "#ff0055";
    if (sentiment === "NEGATIVE") return "#ff5500";
    return "#888888";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header Banner */}
      <div
        style={{
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          padding: 16,
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              background: "rgba(5, 217, 232, 0.15)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
            }}
          >
            <BarChartIcon size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, letterSpacing: "0.08em", color: "#fff" }}>
                SOCIAL MEDIA MONITORING & ANALYTICS
              </h2>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(5, 217, 232, 0.2)",
                  color: "var(--cyan)",
                  border: "1px solid var(--cyan)",
                  fontWeight: "bold",
                }}
              >
                MULTI-STREAM OSINT
              </span>
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Hootsuite, Buffer, Brandwatch, and Audiense intelligence: Multi-platform listening, sentiment radar, and audience segmentation.
            </p>
          </div>
        </div>

        {data && (
          <button
            onClick={handleAttachReportToCase}
            disabled={attaching}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: "bold",
              background: attachSuccess ? "#00ffaa" : "rgba(5, 217, 232, 0.15)",
              color: attachSuccess ? "#000" : "var(--cyan)",
              border: attachSuccess ? "1px solid #00ffaa" : "1px solid var(--cyan)",
              cursor: attaching ? "not-allowed" : "pointer",
              borderRadius: 4,
            }}
          >
            <FolderIcon size={13} />
            {attaching ? "Archiving to Vault..." : attachSuccess ? "SAVED TO CASE VAULT" : "ARCHIVE REPORT TO CASE VAULT"}
          </button>
        )}
      </div>

      {/* Target Search & Controls */}
      <div
        style={{
          padding: 16,
          background: "rgba(0,0,0,0.3)",
          border: "1px solid var(--panel-border)",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter brand name, keyword, #hashtag, or @handle (e.g. bellingcat, #osint, deepfake)..."
            style={{
              flex: "1 1 340px",
              padding: "10px 14px",
              fontSize: 13,
              background: "#080c14",
              border: "1px solid var(--panel-border)",
              color: "var(--text-main)",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Depth:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{
                background: "#080c14",
                border: "1px solid var(--panel-border)",
                color: "var(--cyan)",
                fontSize: 11,
                padding: "6px 8px",
              }}
            >
              <option value={25}>25 Mentions (Rapid)</option>
              <option value={50}>50 Mentions (Standard)</option>
              <option value={100}>100 Mentions (Comprehensive)</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              id="analyticsUseTor"
              checked={useTor}
              onChange={(e) => setUseTor(e.target.checked)}
            />
            <label htmlFor="analyticsUseTor" style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
              Route via Tor
            </label>
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={loading || !target.trim()}
            style={{
              padding: "10px 22px",
              fontSize: 12,
              fontWeight: "bold",
              background: loading ? "#333" : "var(--cyan)",
              color: "#000",
              border: "none",
              cursor: loading || !target.trim() ? "not-allowed" : "pointer",
              borderRadius: 2,
            }}
          >
            {loading ? "MONITORING SOCIAL STREAMS..." : "RUN ANALYTICS SCAN"}
          </button>
        </div>

        {/* Preset Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>Quick Targets:</span>
          {["bellingcat", "#osint", "cyberattack", "deepfake", "sanctions"].map((preset) => (
            <button
              key={preset}
              onClick={() => handleSearch(preset)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--panel-border)",
                padding: "2px 8px",
                fontSize: 10,
                color: "var(--cyan)",
                cursor: "pointer",
                borderRadius: 3,
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: "rgba(255,0,85,0.1)", border: "1px solid #ff0055", color: "#ff0055", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Analytics Results Dashboard */}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top Overview Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 14, borderRadius: 4 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Mentions Captured
              </span>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "var(--cyan)", marginTop: 4 }}>
                {data.total_mentions}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Across 4 major network feeds</span>
            </div>

            <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 14, borderRadius: 4 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Estimated Reach / Impressions
              </span>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff", marginTop: 4 }}>
                {data.estimated_reach.toLocaleString()}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Weighted audience visibility index</span>
            </div>

            <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 14, borderRadius: 4 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Threat & Crisis Level
              </span>
              <div style={{ fontSize: 22, fontWeight: "bold", color: getThreatColor(data.threat_level), marginTop: 4 }}>
                {data.threat_level}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Based on hostile keyword velocity</span>
            </div>

            <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 14, borderRadius: 4 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Dominant Sentiment
              </span>
              <div style={{ fontSize: 22, fontWeight: "bold", color: getSentimentColor(data.dominant_sentiment), marginTop: 4 }}>
                {data.dominant_sentiment}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                Score: {data.sentiment_score_avg > 0 ? `+${data.sentiment_score_avg}` : data.sentiment_score_avg} (-1.0 to +1.0)
              </span>
            </div>
          </div>

          {/* Tab Navigation for Detailed Sections */}
          <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--panel-border)", paddingBottom: 4, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveTab("stream")}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: activeTab === "stream" ? "bold" : "normal",
                background: activeTab === "stream" ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: activeTab === "stream" ? "var(--cyan)" : "var(--text-muted)",
                border: activeTab === "stream" ? "1px solid var(--cyan)" : "1px solid transparent",
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              Live Mentions Stream ({data.mentions.length})
            </button>
            <button
              onClick={() => setActiveTab("sentiment")}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: activeTab === "sentiment" ? "bold" : "normal",
                background: activeTab === "sentiment" ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: activeTab === "sentiment" ? "var(--cyan)" : "var(--text-muted)",
                border: activeTab === "sentiment" ? "1px solid var(--cyan)" : "1px solid transparent",
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              Sentiment & Crisis Radar (Brandwatch)
            </button>
            <button
              onClick={() => setActiveTab("audience")}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: activeTab === "audience" ? "bold" : "normal",
                background: activeTab === "audience" ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: activeTab === "audience" ? "var(--cyan)" : "var(--text-muted)",
                border: activeTab === "audience" ? "1px solid var(--cyan)" : "1px solid transparent",
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              Audience Tribes & Affinities (Audiense)
            </button>
            <button
              onClick={() => setActiveTab("cadence")}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: activeTab === "cadence" ? "bold" : "normal",
                background: activeTab === "cadence" ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: activeTab === "cadence" ? "var(--cyan)" : "var(--text-muted)",
                border: activeTab === "cadence" ? "1px solid var(--cyan)" : "1px solid transparent",
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              Posting Cadence & Automation (Buffer)
            </button>
            <button
              onClick={() => setActiveTab("tools")}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: activeTab === "tools" ? "bold" : "normal",
                background: activeTab === "tools" ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: activeTab === "tools" ? "var(--cyan)" : "var(--text-muted)",
                border: activeTab === "tools" ? "1px solid var(--cyan)" : "1px solid transparent",
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              Monitoring Platforms Matrix ({data.monitoring_tools.length})
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: LIVE MENTIONS STREAM */}
          {/* ========================================================================= */}
          {activeTab === "stream" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Filter Bar */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 4 }}>
                <input
                  type="text"
                  placeholder="Filter stream text, author, title..."
                  value={streamSearch}
                  onChange={(e) => setStreamSearch(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 11,
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                    width: 220,
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <span style={{ color: "var(--text-muted)" }}>Platform:</span>
                  <select
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    style={{ background: "#080c14", border: "1px solid var(--panel-border)", color: "var(--cyan)", fontSize: 11, padding: "4px 8px" }}
                  >
                    <option value="all">All Networks</option>
                    <option value="Twitter / X">Twitter / X</option>
                    <option value="Reddit">Reddit</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Web & News">Web & News</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <span style={{ color: "var(--text-muted)" }}>Sentiment:</span>
                  <select
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                    style={{ background: "#080c14", border: "1px solid var(--panel-border)", color: "var(--cyan)", fontSize: 11, padding: "4px 8px" }}
                  >
                    <option value="all">All Sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                    <option value="critical">Critical Threat</option>
                  </select>
                </div>

                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                  Showing {filteredMentions.length} of {data.mentions.length} mentions
                </span>
              </div>

              {filteredMentions.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No mentions matched the filter criteria.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredMentions.map((m, idx) => (
                    <div
                      key={`${m.url}-${idx}`}
                      style={{
                        background: "#080c14",
                        border: "1px solid var(--panel-border)",
                        padding: 14,
                        borderRadius: 4,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: "bold",
                              padding: "2px 6px",
                              borderRadius: 3,
                              background:
                                m.platform === "Twitter / X"
                                  ? "rgba(29, 161, 242, 0.15)"
                                  : m.platform === "Reddit"
                                  ? "rgba(255, 69, 0, 0.15)"
                                  : m.platform === "YouTube"
                                  ? "rgba(255, 0, 0, 0.15)"
                                  : "rgba(5, 217, 232, 0.15)",
                              color:
                                m.platform === "Twitter / X"
                                  ? "#1da1f2"
                                  : m.platform === "Reddit"
                                  ? "#ff4500"
                                  : m.platform === "YouTube"
                                  ? "#ff3333"
                                  : "var(--cyan)",
                              border: "1px solid currentColor",
                            }}
                          >
                            {m.platform}
                          </span>

                          <span style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>
                            {m.author}
                          </span>

                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {m.published_at.slice(0, 16).replace("T", " ")} UTC
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: "bold",
                            padding: "2px 6px",
                            borderRadius: 2,
                            background: "rgba(255,255,255,0.05)",
                            color: getSentimentColor(m.sentiment),
                            border: `1px solid ${getSentimentColor(m.sentiment)}`,
                          }}
                        >
                          {m.sentiment} ({m.sentiment_score > 0 ? `+${m.sentiment_score}` : m.sentiment_score})
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: 12, color: "#ccc", lineHeight: "1.4" }}>
                        {m.title}
                      </p>

                      {/* Hashtags and Mentions */}
                      {(m.hashtags.length > 0 || m.mentions.length > 0) && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10 }}>
                          {m.hashtags.map((h) => (
                            <span key={h} style={{ color: "var(--cyan)", background: "rgba(5,217,232,0.08)", padding: "1px 5px", borderRadius: 2 }}>
                              #{h}
                            </span>
                          ))}
                          {m.mentions.map((men) => (
                            <span key={men} style={{ color: "#8ab4f8", background: "rgba(100,100,255,0.08)", padding: "1px 5px", borderRadius: 2 }}>
                              @{men}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", paddingTop: 8, marginTop: 4 }}>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11,
                            color: "var(--cyan)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            textDecoration: "underline",
                          }}
                        >
                          Open Source Link <ExternalLinkIcon size={11} />
                        </a>

                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={m.url}
                          platform={m.platform}
                          url={m.url}
                          exists={true}
                          discoveredBy="social_analytics.stream"
                          metadata={{
                            title: m.title,
                            author: m.author,
                            sentiment: m.sentiment,
                            published_at: m.published_at,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SENTIMENT & CRISIS RADAR (BRANDWATCH METHODOLOGY) */}
          {/* ========================================================================= */}
          {activeTab === "sentiment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 18, borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12 }}>
                  BRANDWATCH SENTIMENT RADAR & EMOTIONAL POLARITY
                </div>

                {/* Progress bar visual */}
                <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", border: "1px solid var(--panel-border)", marginBottom: 14 }}>
                  <div
                    style={{
                      width: `${data.sentiment_breakdown.positive.percent}%`,
                      background: "#00ffaa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: "bold",
                      color: "#000",
                    }}
                    title={`Positive: ${data.sentiment_breakdown.positive.percent}%`}
                  >
                    {data.sentiment_breakdown.positive.percent > 8 && `${data.sentiment_breakdown.positive.percent}%`}
                  </div>
                  <div
                    style={{
                      width: `${data.sentiment_breakdown.neutral.percent}%`,
                      background: "#555",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: "bold",
                      color: "#fff",
                    }}
                    title={`Neutral: ${data.sentiment_breakdown.neutral.percent}%`}
                  >
                    {data.sentiment_breakdown.neutral.percent > 8 && `${data.sentiment_breakdown.neutral.percent}%`}
                  </div>
                  <div
                    style={{
                      width: `${data.sentiment_breakdown.negative.percent}%`,
                      background: "#ff5500",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: "bold",
                      color: "#000",
                    }}
                    title={`Negative: ${data.sentiment_breakdown.negative.percent}%`}
                  >
                    {data.sentiment_breakdown.negative.percent > 8 && `${data.sentiment_breakdown.negative.percent}%`}
                  </div>
                  <div
                    style={{
                      width: `${data.sentiment_breakdown.critical.percent}%`,
                      background: "#ff0055",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: "bold",
                      color: "#fff",
                    }}
                    title={`Critical Threat: ${data.sentiment_breakdown.critical.percent}%`}
                  >
                    {data.sentiment_breakdown.critical.percent > 5 && `${data.sentiment_breakdown.critical.percent}%`}
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <div style={{ width: 12, height: 12, background: "#00ffaa", borderRadius: 2 }} />
                    <span>Positive: <strong>{data.sentiment_breakdown.positive.count} ({data.sentiment_breakdown.positive.percent}%)</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <div style={{ width: 12, height: 12, background: "#555", borderRadius: 2 }} />
                    <span>Neutral: <strong>{data.sentiment_breakdown.neutral.count} ({data.sentiment_breakdown.neutral.percent}%)</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <div style={{ width: 12, height: 12, background: "#ff5500", borderRadius: 2 }} />
                    <span>Negative: <strong>{data.sentiment_breakdown.negative.count} ({data.sentiment_breakdown.negative.percent}%)</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <div style={{ width: 12, height: 12, background: "#ff0055", borderRadius: 2 }} />
                    <span>Critical Alert: <strong>{data.sentiment_breakdown.critical.count} ({data.sentiment_breakdown.critical.percent}%)</strong></span>
                  </div>
                </div>
              </div>

              {/* Threat Index Assessment */}
              <div style={{ background: "#080c14", border: `1px solid ${getThreatColor(data.threat_level)}`, padding: 18, borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: getThreatColor(data.threat_level) }}>
                    REPUTATIONAL THREAT ASSESSMENT: {data.threat_level}
                  </div>
                  <AlertIcon size={18} color={getThreatColor(data.threat_level)} />
                </div>
                <p style={{ fontSize: 12, color: "#ccc", margin: "8px 0 0 0", lineHeight: "1.4" }}>
                  {data.threat_level === "CRISIS ALERT"
                    ? "High concentration of hostile terms, breach alerts, scam accusations, or boycotts detected. Immediate escalation recommended."
                    : data.threat_level === "HIGH SURGE"
                    ? "Elevated negative sentiment and dispute velocity observed across indexed media streams."
                    : data.threat_level === "ELEVATED"
                    ? "Minor critical chatter detected; baseline monitoring advised."
                    : "Low hostility score. Conversations exhibit routine or predominantly positive sentiment patterns."}
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: AUDIENCE TRIBES & AFFINITIES (AUDIENSE METHODOLOGY) */}
          {/* ========================================================================= */}
          {activeTab === "audience" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Audience Clusters */}
              <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 18, borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12 }}>
                  AUDIENSE COMMUNITY CLUSTERS & TRIBES
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                  {data.audience_clusters.map((cluster) => (
                    <div
                      key={cluster.segment}
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--panel-border)",
                        padding: 12,
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
                          {cluster.segment}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold" }}>
                          {cluster.affinity_score}% Affinity
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: "1.4" }}>
                        {cluster.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hashtag & Keyword Cloud */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 16, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 10 }}>
                    TOP CO-OCCURRING HASHTAGS
                  </div>
                  {data.top_hashtags.length === 0 ? (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No hashtags extracted in sample.</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {data.top_hashtags.map((h) => (
                        <span
                          key={h.tag}
                          style={{
                            fontSize: 11,
                            background: "rgba(5,217,232,0.1)",
                            color: "var(--cyan)",
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid rgba(5,217,232,0.3)",
                          }}
                        >
                          #{h.tag} ({h.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 16, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 10 }}>
                    TOP AMPLIFIERS & SOURCES
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.top_amplifiers.slice(0, 6).map((a) => (
                      <div
                        key={a.author}
                        style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 4 }}
                      >
                        <span style={{ color: "#fff", fontWeight: "600" }}>{a.author}</span>
                        <span style={{ color: "var(--text-muted)" }}>{a.count} mentions ({a.platform})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: POSTING CADENCE & AUTOMATION (BUFFER METHODOLOGY) */}
          {/* ========================================================================= */}
          {activeTab === "cadence" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#080c14", border: "1px solid var(--panel-border)", padding: 18, borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)" }}>
                    BUFFER CADENCE ANALYSIS: {data.cadence_analysis.rhythm_type.toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Peak Window: <strong>{data.cadence_analysis.peak_hour_utc}:00 UTC</strong>
                  </span>
                </div>

                {/* Hourly Bar Histogram */}
                <div style={{ display: "flex", alignItems: "flex-end", height: 120, gap: 4, padding: "10px 0", borderBottom: "1px solid var(--panel-border)" }}>
                  {data.cadence_analysis.hourly_distribution.map((val, hr) => {
                    const maxVal = Math.max(...data.cadence_analysis.hourly_distribution, 1);
                    const pct = Math.max(8, (val / maxVal) * 100);
                    return (
                      <div
                        key={hr}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: `${pct}%`,
                            background: val > 0 ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                            borderRadius: 2,
                          }}
                          title={`${hr}:00 UTC: ${val} mentions`}
                        />
                        <span style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 4 }}>
                          {hr % 4 === 0 ? `${hr}h` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Weekday Distribution */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 14 }}>
                  {Object.entries(data.cadence_analysis.weekday_distribution).map(([day, count]) => (
                    <div
                      key={day}
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--panel-border)",
                        padding: "8px 4px",
                        textAlign: "center",
                        borderRadius: 3,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{day}</div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: count > 0 ? "var(--cyan)" : "#666", marginTop: 2 }}>
                        {count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: MONITORING PLATFORMS MATRIX (HOOTSUITE, BUFFER, BRANDWATCH, AUDIENSE) */}
          {/* ========================================================================= */}
          {activeTab === "tools" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
              {data.monitoring_tools.map((tool) => (
                <div
                  key={tool.name}
                  style={{
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    padding: 16,
                    borderRadius: 6,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontSize: 15, fontWeight: "bold", color: "var(--cyan)" }}>
                        {tool.name}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: "rgba(5, 217, 232, 0.15)",
                          color: "var(--cyan)",
                          border: "1px solid var(--cyan)",
                          fontWeight: "bold",
                        }}
                      >
                        {tool.category}
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: "#ccc", margin: "8px 0", lineHeight: "1.4" }}>
                      {tool.description}
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      {tool.capabilities.map((cap) => (
                        <div key={cap} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--text-muted)" }}>
                          <CheckIcon size={10} color="var(--cyan)" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", paddingTop: 10 }}>
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        color: "var(--cyan)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        textDecoration: "underline",
                        fontWeight: "bold",
                      }}
                    >
                      Open {tool.name} <ExternalLinkIcon size={12} />
                    </a>

                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={tool.name}
                      platform="SocialMediaMonitoring"
                      url={tool.url}
                      exists={true}
                      discoveredBy="social_analytics.matrix"
                      metadata={{
                        tool: tool.name,
                        category: tool.category,
                        target: data.target,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
