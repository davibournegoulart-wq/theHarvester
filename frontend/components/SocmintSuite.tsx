"use client";

import React, { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import {
  SearchIcon,
  UserIcon,
  GlobeIcon,
  AlertIcon,
  CheckIcon,
  CrossIcon,
  LinkIcon,
  VideoIcon,
  RadarIcon,
} from "@/components/FlatIcons";
import SaveToCaseButton from "./SaveToCaseButton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type SnapProfile = {
  found: boolean;
  is_private?: boolean;
  username?: string;
  display_name?: string;
  bio?: string;
  subscriber_count?: number;
  profile_url?: string;
  profile_picture_url?: string;
  snapcode_url?: string;
  hero_image_url?: string;
  website_url?: string;
  badge?: string;
  page_type?: string;
  has_stories?: boolean;
  has_curated_highlights?: boolean;
  has_spotlight?: boolean;
  stories_count?: number;
  highlights_count?: number;
  spotlights_count?: number;
  lenses_count?: number;
  stories_preview?: Array<{ index: number; type: string; url: string; timestamp?: number }>;
  note?: string;
  error?: string;
  timestamp?: string;
};

type Tool = {
  name: string;
  url: string;
  desc: string;
  type: string;
  free: boolean;
};

type ToolDirectory = {
  tools: Record<string, Tool[]>;
  categories: string[];
  total: number;
  sources: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TAB_IDS = ["snapchat", "directory"] as const;
type TabId = (typeof TAB_IDS)[number];

const PLATFORM_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  snapchat:       { label: "Snapchat",     color: "#FFFC00", emoji: "👻" },
  instagram:      { label: "Instagram",    color: "#E1306C", emoji: "📷" },
  twitter_x:      { label: "Twitter / X",  color: "#1DA1F2", emoji: "🐦" },
  facebook:       { label: "Facebook",     color: "#1877F2", emoji: "👤" },
  linkedin:       { label: "LinkedIn",     color: "#0A66C2", emoji: "💼" },
  reddit:         { label: "Reddit",       color: "#FF4500", emoji: "🔴" },
  telegram:       { label: "Telegram",     color: "#26A5E4", emoji: "✈️" },
  youtube:        { label: "YouTube",      color: "#FF0000", emoji: "▶️" },
  multi_platform: { label: "Multi-Platform", color: "#00E5FF", emoji: "🌐" },
};

const TYPE_BADGE_COLOR: Record<string, string> = {
  cli_tool:    "#7C3AED",
  viewer:      "#065F46",
  api:         "#DC2626",
  live_map:    "#1D4ED8",
  search:      "#374151",
  analytics:   "#0F766E",
  id_lookup:   "#92400E",
  dork_engine: "#7F1D1D",
  enumeration: "#3F3F46",
  monitoring:  "#1E40AF",
  framework:   "#4C1D95",
  people_search:"#831843",
  export:      "#065F46",
  correlation: "#1E3A5F",
  downloader:  "#78350F",
  archive:     "#27272A",
  geo_search:  "#14532D",
  image_search:"#1C1917",
  pivot:       "#4A1942",
  metadata:    "#1C2B4A",
  verification:"#0C3A4A",
  directory:   "#1A2E05",
  direct_link: "#1A1A1A",
  scraper:     "#2D1B00",
};

const S: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    background: "var(--panel-bg, #060a10)",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
  header: {
    padding: "14px 16px 0",
    borderBottom: "1px solid rgba(0,229,255,0.12)",
    flexShrink: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "var(--cyan, #00E5FF)",
    textTransform: "uppercase",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tabs: {
    display: "flex",
    gap: 4,
    paddingTop: 2,
  },
  tab: {
    padding: "6px 14px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    border: "none",
    borderRadius: "4px 4px 0 0",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: 16,
    minHeight: 0,
  },
  input: {
    background: "rgba(0,229,255,0.04)",
    border: "1px solid rgba(0,229,255,0.2)",
    borderRadius: 6,
    color: "#E2E8F0",
    fontSize: 13,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
  },
  btn: {
    padding: "9px 20px",
    borderRadius: 6,
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const,
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    padding: 14,
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted, #6B7280)",
    marginBottom: 2,
  },
  value: {
    fontSize: 13,
    color: "#E2E8F0",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "#00E5FF" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 9, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function ToolCard({ tool, platform }: { tool: Tool; platform: string }) {
  const p = PLATFORM_LABELS[platform];
  const typeColor = TYPE_BADGE_COLOR[tool.type] || "#374151";

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 7,
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,229,255,0.2)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <a
          href={tool.url.includes("{username}") ? "#" : tool.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0", textDecoration: "none" }}
        >
          {tool.name}
        </a>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <span style={{ ...S.badge, background: typeColor + "33", color: typeColor === "#374151" ? "#9CA3AF" : "#CBD5E1", border: `1px solid ${typeColor}55` }}>
            {tool.type.replace(/_/g, " ")}
          </span>
          <span style={{ ...S.badge, background: tool.free ? "rgba(0,230,118,0.1)" : "rgba(220,38,38,0.1)", color: tool.free ? "#00E676" : "#EF4444", border: `1px solid ${tool.free ? "#00E67655" : "#EF444455"}` }}>
            {tool.free ? "FREE" : "PAID"}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>{tool.desc}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <a
          href={tool.url.includes("{username}") ? "#" : tool.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 10, color: "#64748B", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
        >
          <LinkIcon size={10} color="#64748B" />
          {tool.url.replace(/^https?:\/\//, "").split("/")[0]}
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function SocmintSuite() {
  const [activeTab, setActiveTab] = useState<TabId>("snapchat");

  // Snapchat
  const [snapQuery, setSnapQuery] = useState("");
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapProfile, setSnapProfile] = useState<SnapProfile | null>(null);
  const [snapError, setSnapError] = useState("");

  // Directory
  const [toolDir, setToolDir] = useState<ToolDirectory | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [activePlatform, setActivePlatform] = useState("snapchat");
  const [toolSearch, setToolSearch] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  useEffect(() => {
    if (activeTab === "directory" && !toolDir) {
      loadTools();
    }
  }, [activeTab]);

  async function loadTools() {
    setToolLoading(true);
    try {
      const res = await apiGet<any>("/recon/socmint/tools");
      setToolDir(res);
    } catch (e) {
      console.warn("Failed to load SOCMINT tools:", e);
    } finally {
      setToolLoading(false);
    }
  }

  async function lookupSnap() {
    const q = snapQuery.trim().replace(/^@/, "");
    if (!q) return;
    setSnapLoading(true);
    setSnapError("");
    setSnapProfile(null);
    try {
      const res = await apiGet<SnapProfile>(`/recon/socmint/snapchat?username=${encodeURIComponent(q)}`);
      setSnapProfile(res);
      if (!res.found && res.error) setSnapError(res.error);
    } catch (e: any) {
      setSnapError(e?.message || "Request failed");
    } finally {
      setSnapLoading(false);
    }
  }

  // Filtered tools for directory tab
  const filteredTools = (() => {
    if (!toolDir) return [];
    const all = toolDir.tools[activePlatform] || [];
    return all.filter(t => {
      if (showFreeOnly && !t.free) return false;
      if (!toolSearch) return true;
      const q = toolSearch.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.type.includes(q);
    });
  })();

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.title}>
          <UserIcon size={13} color="var(--cyan, #00E5FF)" />
          SOCMINT — Social Media Intelligence
        </div>
        <div style={S.tabs}>
          {[
            { id: "snapchat" as TabId, label: "👻 SNAPCHAT INTEL" },
            { id: "directory" as TabId, label: "📖 OSINT TOOL DIRECTORY" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                ...S.tab,
                background: activeTab === t.id ? "rgba(0,229,255,0.12)" : "transparent",
                color: activeTab === t.id ? "var(--cyan, #00E5FF)" : "#6B7280",
                borderBottom: activeTab === t.id ? "2px solid var(--cyan, #00E5FF)" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* ── SNAPCHAT TAB ────────────────────────────────────────── */}
        {activeTab === "snapchat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Attribution */}
            <div style={{ fontSize: 9, color: "#4B5563", letterSpacing: "0.08em" }}>
              Source: <a href="https://github.com/Kr0wZ/SnapIntel" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "none" }}>SnapIntel (Kr0wZ)</a> &nbsp;·&nbsp;
              <a href="https://github.com/OSINT-Trace/Snapchat-Checker" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "none" }}>Snapchat-Checker (OSINT-Trace)</a>
            </div>

            {/* Search */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <SearchIcon size={13} color="#4B5563" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  style={{ ...S.input, paddingLeft: 32 }}
                  placeholder="Snapchat username (without @)"
                  value={snapQuery}
                  onChange={e => setSnapQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupSnap()}
                />
              </div>
              <button
                onClick={lookupSnap}
                disabled={snapLoading || !snapQuery.trim()}
                style={{
                  ...S.btn,
                  background: snapLoading ? "rgba(255,252,0,0.05)" : "rgba(255,252,0,0.12)",
                  color: "#FFFC00",
                  border: "1px solid rgba(255,252,0,0.3)",
                  opacity: snapLoading || !snapQuery.trim() ? 0.5 : 1,
                }}
              >
                {snapLoading ? "SCANNING…" : "👻 SCAN"}
              </button>
            </div>

            {/* Error */}
            {snapError && (
              <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, fontSize: 12, color: "#EF4444", display: "flex", gap: 8, alignItems: "center" }}>
                <AlertIcon size={13} color="#EF4444" /> {snapError}
              </div>
            )}

            {/* Results */}
            {snapProfile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Status banner */}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 7,
                  border: `1px solid ${snapProfile.found ? "rgba(0,230,118,0.3)" : "rgba(239,68,68,0.3)"}`,
                  background: snapProfile.found ? "rgba(0,230,118,0.07)" : "rgba(239,68,68,0.07)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  {snapProfile.found
                    ? <CheckIcon size={14} color="#00E676" />
                    : <CrossIcon size={14} color="#EF4444" />
                  }
                  <span style={{ fontSize: 12, fontWeight: 600, color: snapProfile.found ? "#00E676" : "#EF4444" }}>
                    {snapProfile.found
                      ? `Account found${snapProfile.is_private ? " (private)" : " (public)"}`
                      : `Account not found — ${snapProfile.error || "does not exist"}`
                    }
                  </span>
                  {snapProfile.found && snapProfile.profile_url && (
                    <a href={snapProfile.profile_url} target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft: "auto", fontSize: 10, color: "#FFFC00", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      <LinkIcon size={10} color="#FFFC00" />
                      OPEN ON SNAPCHAT
                    </a>
                  )}
                </div>

                {snapProfile.found && (
                  <>
                    {/* Profile hero */}
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      {snapProfile.profile_picture_url && (
                        <img
                          src={snapProfile.profile_picture_url}
                          alt="profile"
                          style={{ width: 72, height: 72, borderRadius: 36, border: "2px solid #FFFC00", objectFit: "cover", flexShrink: 0 }}
                          onError={e => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      )}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>
                          {snapProfile.display_name || snapProfile.username}
                          {snapProfile.badge && (
                            <span style={{ marginLeft: 8, fontSize: 10, background: "#FFFC0022", color: "#FFFC00", border: "1px solid #FFFC0055", padding: "2px 6px", borderRadius: 10 }}>
                              ⭐ {snapProfile.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>@{snapProfile.username}</div>
                        {snapProfile.bio && (
                          <div style={{ fontSize: 12, color: "#CBD5E1", lineHeight: 1.5, marginTop: 4 }}>{snapProfile.bio}</div>
                        )}
                        {snapProfile.website_url && (
                          <a href={snapProfile.website_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "#00E5FF", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                            <LinkIcon size={10} color="#00E5FF" />
                            {snapProfile.website_url}
                          </a>
                        )}
                      </div>
                      {snapProfile.snapcode_url && (
                        <img
                          src={snapProfile.snapcode_url}
                          alt="snapcode"
                          style={{ width: 64, height: 64, borderRadius: 6, flexShrink: 0 }}
                          onError={e => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      )}
                    </div>

                    {/* Stats row */}
                    {!snapProfile.is_private && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                        <StatPill label="Subscribers" value={snapProfile.subscriber_count?.toLocaleString() || "—"} color="#FFFC00" />
                        <StatPill label="Stories" value={snapProfile.stories_count} color="#00E676" />
                        <StatPill label="Highlights" value={snapProfile.highlights_count} color="#00E5FF" />
                        <StatPill label="Spotlights" value={snapProfile.spotlights_count} color="#A855F7" />
                        <StatPill label="Lenses" value={snapProfile.lenses_count} color="#F97316" />
                      </div>
                    )}

                    {/* Private notice */}
                    {snapProfile.is_private && snapProfile.note && (
                      <div style={{ padding: "8px 12px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, fontSize: 11, color: "#FB923C" }}>
                        🔒 {snapProfile.note}
                      </div>
                    )}

                    {/* Story preview */}
                    {snapProfile.stories_preview && snapProfile.stories_preview.length > 0 && (
                      <div>
                        <div style={S.label}>Latest Stories ({snapProfile.stories_preview.length} shown)</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                          {snapProfile.stories_preview.map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", fontSize: 10, color: "#94A3B8", textDecoration: "none" }}>
                              {s.type === "video"
                                ? <VideoIcon size={11} color="#A855F7" />
                                : <GlobeIcon size={11} color="#00E5FF" />
                              }
                              {s.type} #{s.index}
                              {s.timestamp && (
                                <span style={{ color: "#4B5563" }}>
                                  {new Date(s.timestamp * 1000).toLocaleDateString()}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Save to case */}
                    {snapProfile.username && (
                      <div style={{ marginTop: 4 }}>
                        <SaveToCaseButton
                          identifierValue={snapProfile.username!}
                          identifierType="username"
                          platform="snapchat"
                          discoveredBy="socmint_snapintel"
                          metadata={{ display_name: snapProfile.display_name, subscriber_count: snapProfile.subscriber_count, is_private: snapProfile.is_private }}
                        />
                      </div>
                    )}

                    {/* Timestamp */}
                    {snapProfile.timestamp && (
                      <div style={{ fontSize: 9, color: "#374151", textAlign: "right" }}>
                        Scraped: {new Date(snapProfile.timestamp).toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Empty state */}
            {!snapProfile && !snapLoading && !snapError && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#374151" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👻</div>
                <div style={{ fontSize: 13, color: "#4B5563" }}>Enter a Snapchat username to start intelligence gathering</div>
                <div style={{ fontSize: 10, color: "#374151", marginTop: 8 }}>
                  Returns: profile picture · subscriber count · bio · Snapcode · stories · highlights · spotlights · lenses
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TOOL DIRECTORY TAB ──────────────────────────────────── */}
        {activeTab === "directory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {toolLoading && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#374151" }}>
                <RadarIcon size={28} color="#374151" />
                <div style={{ marginTop: 10, fontSize: 12 }}>Loading SOCMINT tool directory…</div>
              </div>
            )}

            {toolDir && (
              <>
                {/* Stats bar */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, color: "#00E5FF", fontWeight: 600 }}>
                    {toolDir.total} TOOLS ACROSS {toolDir.categories.length} PLATFORMS
                  </div>
                  <div style={{ fontSize: 9, color: "#374151", marginLeft: "auto" }}>
                    Sources: {toolDir.sources.join(" · ")}
                  </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <SearchIcon size={12} color="#4B5563" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      style={{ ...S.input, paddingLeft: 28, fontSize: 11 }}
                      placeholder="Search tools…"
                      value={toolSearch}
                      onChange={e => setToolSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => setShowFreeOnly(!showFreeOnly)}
                    style={{
                      ...S.btn,
                      padding: "7px 12px",
                      fontSize: 10,
                      background: showFreeOnly ? "rgba(0,230,118,0.12)" : "rgba(255,255,255,0.04)",
                      color: showFreeOnly ? "#00E676" : "#6B7280",
                      border: `1px solid ${showFreeOnly ? "rgba(0,230,118,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {showFreeOnly ? "✅ FREE ONLY" : "ALL TOOLS"}
                  </button>
                </div>

                {/* Platform pills */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {toolDir.categories.map(cat => {
                    const p = PLATFORM_LABELS[cat] || { label: cat, color: "#6B7280", emoji: "🔧" };
                    const count = (toolDir.tools[cat] || []).length;
                    const isActive = activePlatform === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActivePlatform(cat)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 20,
                          border: `1px solid ${isActive ? p.color + "66" : "rgba(255,255,255,0.08)"}`,
                          background: isActive ? p.color + "18" : "rgba(255,255,255,0.02)",
                          color: isActive ? p.color : "#6B7280",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                          letterSpacing: "0.05em",
                          transition: "all 0.15s",
                        }}
                      >
                        {p.emoji} {p.label} <span style={{ opacity: 0.6 }}>({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tool cards */}
                {filteredTools.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px", color: "#4B5563", fontSize: 12 }}>
                    No tools match your filters
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                    {filteredTools.map((tool, i) => (
                      <ToolCard key={i} tool={tool} platform={activePlatform} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
