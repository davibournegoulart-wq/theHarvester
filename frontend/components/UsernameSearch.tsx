"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  StarIcon,
  BoltIcon,
  SearchIcon,
  ExternalLinkIcon,
  GlobeIcon,
  ShieldIcon,
  DatabaseIcon,
  UserIcon,
  CheckIcon,
  CrossIcon,
} from "@/components/FlatIcons";

type AccountResult = {
  platform: string;
  url: string;
  exists: boolean;
  discovered_by: string;
};

type SherlockAccount = {
  platform: string;
  url: string;
  url_main?: string;
  status: string;
  response_time_ms?: number;
  discovered_by: string;
};

type SherlockResponse = {
  username: string;
  total_sites_scanned: number;
  total_claimed: number;
  total_available: number;
  total_unknown: number;
  claimed_accounts: SherlockAccount[];
};

type WmnAccount = {
  platform: string;
  category: string;
  url: string;
  url_check: string;
  status: string;
  status_code: number;
  response_time_ms: number;
  discovered_by: string;
};

type WmnResponse = {
  username: string;
  total_sites_scanned: number;
  total_claimed: number;
  total_available: number;
  claimed_accounts: WmnAccount[];
  available_accounts: WmnAccount[];
  categories_available: string[];
};

type MaigretAccount = {
  platform: string;
  url: string;
  url_main?: string;
  status: string;
  discovered_by: string;
  tags?: string[];
  fullname?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  follower_count?: string | null;
  following_count?: string | null;
  created_at?: string | null;
  uid?: string | null;
  links?: string | null;
  rank?: number;
};

type MaigretResponse = {
  username: string;
  engine: string;
  top_sites_requested: number;
  total_claimed: number;
  claimed_accounts: MaigretAccount[];
};

type SocialscanAccount = {
  platform: string;
  query: string;
  url: string;
  available: boolean;
  valid: boolean;
  message: string;
  discovered_by: string;
  status: string;
};

type SocialscanResponse = {
  query: string;
  engine: string;
  total_scanned: number;
  total_claimed: number;
  total_available: number;
  total_unknown: number;
  claimed_accounts: SocialscanAccount[];
  available_accounts: SocialscanAccount[];
  unknown_accounts: SocialscanAccount[];
};

type CrossPlatformPivot = {
  name: string;
  url: string;
  description: string;
  category: string;
  native_engine: boolean;
  query_type: string;
};

type PivotsResponse = {
  query: string;
  query_type: string;
  pivots: CrossPlatformPivot[];
};

type SocialIdResult = { platform: string; user_id: string | null; sec_uid: string | null };

export default function UsernameSearch() {
  const { activeCase } = useActiveCase();
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"standard" | "sherlock" | "maigret" | "whatsmyname" | "socialscan" | "pivots">("standard");
  const [useTor, setUseTor] = useState(false);

  // Standard search states
  const [results, setResults] = useState<AccountResult[]>([]);
  const [socialIds, setSocialIds] = useState<SocialIdResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Sherlock engine states
  const [sherlockData, setSherlockData] = useState<SherlockResponse | null>(null);
  const [sherlockLoading, setSherlockLoading] = useState(false);
  const [sherlockSearched, setSherlockSearched] = useState(false);
  const [sherlockFilter, setSherlockFilter] = useState("");

  // WhatsMyName engine states
  const [wmnData, setWmnData] = useState<WmnResponse | null>(null);
  const [wmnLoading, setWmnLoading] = useState(false);
  const [wmnSearched, setWmnSearched] = useState(false);
  const [wmnCategory, setWmnCategory] = useState<string>("all");
  const [wmnLimit, setWmnLimit] = useState<number>(150);
  const [wmnFilter, setWmnFilter] = useState("");

  // Maigret engine states
  const [maigretData, setMaigretData] = useState<MaigretResponse | null>(null);
  const [maigretLoading, setMaigretLoading] = useState(false);
  const [maigretSearched, setMaigretSearched] = useState(false);
  const [maigretTopSites, setMaigretTopSites] = useState<number>(50);
  const [maigretFilter, setMaigretFilter] = useState("");

  // Socialscan engine states
  const [socialscanData, setSocialscanData] = useState<SocialscanResponse | null>(null);
  const [socialscanLoading, setSocialscanLoading] = useState(false);
  const [socialscanSearched, setSocialscanSearched] = useState(false);

  // Cross-Platform Pivots states
  const [pivotsData, setPivotsData] = useState<CrossPlatformPivot[]>([]);
  const [pivotsLoading, setPivotsLoading] = useState(false);
  const [pivotsSearched, setPivotsSearched] = useState(false);
  const [pivotQueryType, setPivotQueryType] = useState<"username" | "email" | "all">("username");

  async function handleStandardSearch() {
    if (!username.trim() || !activeCase) return;
    setLoading(true);
    try {
      const data = await apiGet<{ accounts: AccountResult[] }>(`/identifiers/username/${encodeURIComponent(username.trim())}`);
      setResults(data.accounts ?? []);
      setSearched(true);

      const [instagramId, tiktokId] = await Promise.all([
        apiGet<SocialIdResult>(`/identifiers/social-id/instagram/${encodeURIComponent(username.trim())}`).catch(() => null),
        apiGet<SocialIdResult>(`/identifiers/social-id/tiktok/${encodeURIComponent(username.trim())}`).catch(() => null),
      ]);
      setSocialIds([instagramId, tiktokId].filter((r): r is SocialIdResult => r !== null && !!r.user_id));
    } finally {
      setLoading(false);
    }
  }

  async function handleSherlockSearch() {
    if (!username.trim() || !activeCase) return;
    setSherlockLoading(true);
    try {
      const params = new URLSearchParams({
        use_tor: useTor ? "true" : "false",
        timeout: "15",
      });
      const data = await apiGet<SherlockResponse>(`/identifiers/username/${encodeURIComponent(username.trim())}/sherlock?${params.toString()}`);
      setSherlockData(data);
      setSherlockSearched(true);
    } catch (e) {
      console.error("Sherlock scan failed", e);
    } finally {
      setSherlockLoading(false);
    }
  }

  async function handleWhatsMyNameSearch() {
    if (!username.trim() || !activeCase) return;
    setWmnLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(wmnLimit),
        use_tor: useTor ? "true" : "false",
        timeout: "6.0",
      });
      if (wmnCategory !== "all") {
        params.set("category", wmnCategory);
      }
      const data = await apiGet<WmnResponse>(`/identifiers/username/${encodeURIComponent(username.trim())}/whatsmyname?${params.toString()}`);
      setWmnData(data);
      setWmnSearched(true);
    } catch (e) {
      console.error("WhatsMyName scan failed", e);
    } finally {
      setWmnLoading(false);
    }
  }

  async function handleMaigretSearch() {
    if (!username.trim() || !activeCase) return;
    setMaigretLoading(true);
    try {
      const params = new URLSearchParams({
        top_sites: String(maigretTopSites),
        use_tor: useTor ? "true" : "false",
        timeout: "60",
      });
      const data = await apiGet<MaigretResponse>(`/identifiers/username/${encodeURIComponent(username.trim())}/maigret?${params.toString()}`);
      setMaigretData(data);
      setMaigretSearched(true);
    } catch (e) {
      console.error("Maigret scan failed", e);
    } finally {
      setMaigretLoading(false);
    }
  }

  async function handleSocialscanSearch() {
    if (!username.trim() || !activeCase) return;
    setSocialscanLoading(true);
    try {
      const data = await apiGet<SocialscanResponse>(`/identifiers/username/${encodeURIComponent(username.trim())}/socialscan`);
      setSocialscanData(data);
      setSocialscanSearched(true);
    } catch (e) {
      console.error("Socialscan failed", e);
    } finally {
      setSocialscanLoading(false);
    }
  }

  async function handlePivotsLoad(overrideQuery?: string, overrideType?: "username" | "email" | "all") {
    const q = (overrideQuery ?? username).trim();
    if (!q) return;
    setPivotsLoading(true);
    try {
      const t = overrideType ?? pivotQueryType;
      const data = await apiGet<PivotsResponse>(`/identifiers/cross-platform/pivots?query=${encodeURIComponent(q)}&query_type=${t}`);
      setPivotsData(data.pivots || []);
      setPivotsSearched(true);
    } catch (e) {
      console.error("Cross-platform pivots failed", e);
    } finally {
      setPivotsLoading(false);
    }
  }

  function handleTriggerSearch() {
    if (mode === "standard") handleStandardSearch();
    else if (mode === "sherlock") handleSherlockSearch();
    else if (mode === "whatsmyname") handleWhatsMyNameSearch();
    else if (mode === "maigret") handleMaigretSearch();
    else if (mode === "socialscan") handleSocialscanSearch();
    else if (mode === "pivots") handlePivotsLoad();
  }

  const isScanning = loading || sherlockLoading || wmnLoading || maigretLoading || socialscanLoading || pivotsLoading;

  const filteredSherlockAccounts = (sherlockData?.claimed_accounts || []).filter((acc) =>
    acc.platform.toLowerCase().includes(sherlockFilter.toLowerCase()) ||
    acc.url.toLowerCase().includes(sherlockFilter.toLowerCase())
  );

  const filteredWmnAccounts = (wmnData?.claimed_accounts || []).filter((acc) =>
    acc.platform.toLowerCase().includes(wmnFilter.toLowerCase()) ||
    acc.category.toLowerCase().includes(wmnFilter.toLowerCase()) ||
    acc.url.toLowerCase().includes(wmnFilter.toLowerCase())
  );

  const filteredMaigretAccounts = (maigretData?.claimed_accounts || []).filter((acc) =>
    acc.platform.toLowerCase().includes(maigretFilter.toLowerCase()) ||
    (acc.fullname && acc.fullname.toLowerCase().includes(maigretFilter.toLowerCase())) ||
    (acc.bio && acc.bio.toLowerCase().includes(maigretFilter.toLowerCase())) ||
    acc.url.toLowerCase().includes(maigretFilter.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header and Engine Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--cyan)", fontWeight: "bold", letterSpacing: "0.1em" }}>
            [CROSS-PLATFORM OSINT & USERNAME ENUMERATION]
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "2px 0 0 0" }}>
            Multi-engine username & identity hunting across 5,000+ platforms with deep profile dossiers and cross-platform pivots.
          </p>
        </div>

        {/* Engine Switcher */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.5)", padding: 4, borderRadius: 4, border: "1px solid var(--panel-border)", flexWrap: "wrap" }}>
          <button
            onClick={() => setMode("standard")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: mode === "standard" ? "bold" : "normal",
              background: mode === "standard" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "standard" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "standard" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            Fast Native (125)
          </button>
          <button
            onClick={() => setMode("sherlock")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: mode === "sherlock" ? "bold" : "normal",
              background: mode === "sherlock" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "sherlock" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "sherlock" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <StarIcon size={12} color={mode === "sherlock" ? "var(--cyan)" : "var(--text-muted)"} />
              Sherlock (430+)
            </span>
          </button>
          <button
            onClick={() => setMode("maigret")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: mode === "maigret" ? "bold" : "normal",
              background: mode === "maigret" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "maigret" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "maigret" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <UserIcon size={12} color={mode === "maigret" ? "var(--cyan)" : "var(--text-muted)"} />
              Maigret Dossier (5,000+)
            </span>
          </button>
          <button
            onClick={() => setMode("whatsmyname")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: mode === "whatsmyname" ? "bold" : "normal",
              background: mode === "whatsmyname" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "whatsmyname" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "whatsmyname" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <DatabaseIcon size={12} color={mode === "whatsmyname" ? "var(--cyan)" : "var(--text-muted)"} />
              WhatsMyName (700+)
            </span>
          </button>
          <button
            onClick={() => setMode("socialscan")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: mode === "socialscan" ? "bold" : "normal",
              background: mode === "socialscan" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "socialscan" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "socialscan" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <ShieldIcon size={12} color={mode === "socialscan" ? "var(--cyan)" : "var(--text-muted)"} />
              Socialscan (0% FP)
            </span>
          </button>
          <button
            onClick={() => {
              setMode("pivots");
              if (username.trim()) handlePivotsLoad(username.trim());
            }}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: mode === "pivots" ? "bold" : "normal",
              background: mode === "pivots" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "pivots" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "pivots" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <GlobeIcon size={12} color={mode === "pivots" ? "var(--cyan)" : "var(--text-muted)"} />
              Cross-Platform Pivots (13 Tools)
            </span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div
        style={{
          padding: 16,
          background: "rgba(0,0,0,0.3)",
          border: "1px solid var(--panel-border)",
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTriggerSearch()}
            placeholder={
              mode === "standard"
                ? "e.g. johndoe"
                : mode === "sherlock"
                ? "Enter target username for Sherlock 430+ sites scan..."
                : mode === "maigret"
                ? "Enter username for Maigret deep dossier extraction (avatars, bio, UIDs)..."
                : mode === "whatsmyname"
                ? "Enter username for WhatsMyName 700+ sites enumeration..."
                : mode === "socialscan"
                ? "Enter username or email for Socialscan zero-false-positive check..."
                : "Enter username or email for Cross-Platform OSINT pivots matrix..."
            }
            style={{
              flex: "1 1 320px",
              padding: "10px 14px",
              fontSize: 13,
              background: "#080c14",
              border: "1px solid var(--panel-border)",
              color: "var(--text-main)",
            }}
          />

          {/* Tor option for Sherlock, Maigret, WhatsMyName */}
          {(mode === "sherlock" || mode === "maigret" || mode === "whatsmyname") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                id="useTorToggle"
                checked={useTor}
                onChange={(e) => setUseTor(e.target.checked)}
              />
              <label htmlFor="useTorToggle" style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
                Route via Tor
              </label>
            </div>
          )}

          {/* Maigret Top Sites Selector */}
          {mode === "maigret" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Depth:</span>
              <select
                value={maigretTopSites}
                onChange={(e) => setMaigretTopSites(Number(e.target.value))}
                style={{
                  background: "#080c14",
                  border: "1px solid var(--panel-border)",
                  color: "var(--cyan)",
                  fontSize: 11,
                  padding: "6px 8px",
                }}
              >
                <option value={25}>Top 25 Sites (Rapid)</option>
                <option value={50}>Top 50 Sites (Standard)</option>
                <option value={100}>Top 100 Sites (Deep)</option>
                <option value={250}>Top 250 Sites (Full)</option>
              </select>
            </div>
          )}

          {/* WhatsMyName Category & Limit Selectors */}
          {mode === "whatsmyname" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Category:</span>
                <select
                  value={wmnCategory}
                  onChange={(e) => setWmnCategory(e.target.value)}
                  style={{
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--cyan)",
                    fontSize: 11,
                    padding: "6px 8px",
                  }}
                >
                  <option value="all">All Categories (700+)</option>
                  <option value="social">Social Networks</option>
                  <option value="tech">Tech & Coding</option>
                  <option value="gaming">Gaming & Esports</option>
                  <option value="finance">Finance & Crypto</option>
                  <option value="blog">Blogs & Content</option>
                  <option value="dating">Dating Services</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Limit:</span>
                <select
                  value={wmnLimit}
                  onChange={(e) => setWmnLimit(Number(e.target.value))}
                  style={{
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--cyan)",
                    fontSize: 11,
                    padding: "6px 8px",
                  }}
                >
                  <option value={50}>50 Sites</option>
                  <option value={150}>150 Sites (Recommended)</option>
                  <option value={350}>350 Sites</option>
                  <option value={720}>All 700+ Sites</option>
                </select>
              </div>
            </div>
          )}

          {/* Cross-Platform Pivot Filter */}
          {mode === "pivots" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pivot Type:</span>
              <select
                value={pivotQueryType}
                onChange={(e) => {
                  const t = e.target.value as "username" | "email" | "all";
                  setPivotQueryType(t);
                  if (username.trim()) handlePivotsLoad(username.trim(), t);
                }}
                style={{
                  background: "#080c14",
                  border: "1px solid var(--panel-border)",
                  color: "var(--cyan)",
                  fontSize: 11,
                  padding: "6px 8px",
                }}
              >
                <option value="username">Username Pivots</option>
                <option value="email">Email Pivots</option>
                <option value="all">All Cross-Platform Tools</option>
              </select>
            </div>
          )}

          <button
            onClick={handleTriggerSearch}
            disabled={isScanning || !username.trim()}
            style={{
              padding: "10px 24px",
              fontSize: 12,
              fontWeight: "bold",
              background: isScanning ? "#333" : "var(--cyan)",
              color: "#000",
              border: "none",
              cursor: isScanning || !username.trim() ? "not-allowed" : "pointer",
              borderRadius: 2,
            }}
          >
            {loading
              ? "Scanning native sites..."
              : sherlockLoading
              ? "Hunting on 430+ Sherlock sites..."
              : maigretLoading
              ? "Extracting dossiers on Maigret..."
              : wmnLoading
              ? "Querying WhatsMyName database..."
              : socialscanLoading
              ? "Verifying on Socialscan..."
              : pivotsLoading
              ? "Generating pivots..."
              : mode === "sherlock"
              ? "RUN SHERLOCK SCAN"
              : mode === "maigret"
              ? "EXTRACT DOSSIER"
              : mode === "whatsmyname"
              ? "RUN WHATSMYNAME"
              : mode === "socialscan"
              ? "VERIFY ZERO-FP"
              : mode === "pivots"
              ? "LOAD PIVOTS"
              : "SEARCH"}
          </button>
        </div>

        {/* Dynamic engine description bar */}
        <div style={{ fontSize: 11, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
          <BoltIcon size={12} color="var(--cyan)" />
          {mode === "standard" && (
            <span style={{ color: "var(--text-muted)" }}>
              High-speed native HTTP status enumeration across 125 curated services with Instagram/TikTok internal ID pivots.
            </span>
          )}
          {mode === "sherlock" && (
            <span style={{ color: "var(--text-muted)" }}>
              Official Sherlock Project engine: Multi-threaded reconnaissance across 430+ global networks with Tor support.
            </span>
          )}
          {mode === "maigret" && (
            <span style={{ color: "var(--text-muted)" }}>
              Official Maigret OSINT engine: Deep profiling across 5,000+ sites extracting full names, avatars, bios, UIDs, and tags.
            </span>
          )}
          {mode === "whatsmyname" && (
            <span style={{ color: "var(--text-muted)" }}>
              Official WhatsMyName (WebBreacher) dataset: Async 700+ sites inspection with precise match strings and response code rules.
            </span>
          )}
          {mode === "socialscan" && (
            <span style={{ color: "var(--text-muted)" }}>
              Socialscan engine: Zero-false-positive queries directly validating usernames & emails on Twitter, GitHub, GitLab, Instagram, Reddit, and Tumblr.
            </span>
          )}
          {mode === "pivots" && (
            <span style={{ color: "var(--text-muted)" }}>
              Target-linked OSINT matrix integrating Epieos, Lolarchiver, Blackbird, Namechk, UserSearch, IDcrawl, PeekYou, Pipl, and Holehe.
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STANDARD NATIVE ENGINE RESULTS */}
      {/* ========================================================================= */}
      {mode === "standard" && (
        <div>
          {searched && !loading && results.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No accounts found for "{username}".</p>
          )}

          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--cyan)", fontWeight: "bold" }}>
                FOUND ACCOUNTS ({results.length}):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
                {results.map((r) => (
                  <div
                    key={`${activeCase?.id}-${username}-${r.platform}`}
                    style={{
                      background: "#080c14",
                      border: "1px solid var(--panel-border)",
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)", display: "block", textDecoration: "underline" }}
                      >
                        {r.platform}
                      </a>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                        via {r.discovered_by}
                      </span>
                    </div>
                    <SaveToCaseButton
                      identifierType="username"
                      identifierValue={username}
                      platform={r.platform}
                      url={r.url}
                      exists={r.exists}
                      discoveredBy={r.discovered_by}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {socialIds.length > 0 && (
            <div style={{ marginTop: 20, padding: 14, background: "rgba(5, 217, 232, 0.04)", border: "1px solid rgba(5, 217, 232, 0.2)" }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: "bold", fontSize: 12, color: "var(--cyan)" }}>
                INTERNAL PERMANENT USER IDs (Persists even if username changes):
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {socialIds.map((r) => (
                  <div
                    key={`${activeCase?.id}-${username}-${r.platform}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}
                  >
                    <span>
                      <strong style={{ color: "#fff" }}>{r.platform.toUpperCase()}:</strong> {r.user_id}{" "}
                      {r.sec_uid && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>(secUid: {r.sec_uid})</span>}
                    </span>
                    <SaveToCaseButton
                      identifierType="username"
                      identifierValue={username}
                      platform={`${r.platform}_id`}
                      discoveredBy="checkers.social_id_pivot"
                      metadata={{ user_id: r.user_id, sec_uid: r.sec_uid }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SHERLOCK PROJECT ENGINE RESULTS */}
      {/* ========================================================================= */}
      {mode === "sherlock" && (
        <div>
          {sherlockSearched && !sherlockLoading && sherlockData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 18px",
                  background: "rgba(5, 217, 232, 0.08)",
                  border: "1px solid rgba(5, 217, 232, 0.3)",
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                    CLAIMED PROFILES: {sherlockData.total_claimed}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 12 }}>
                    (Scanned {sherlockData.total_sites_scanned} platforms)
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Filter discovered platforms..."
                  value={sherlockFilter}
                  onChange={(e) => setSherlockFilter(e.target.value)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                    width: 220,
                  }}
                />
              </div>

              {filteredSherlockAccounts.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No claimed profiles matched your criteria across {sherlockData.total_sites_scanned} sites.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                  {filteredSherlockAccounts.map((acc) => (
                    <div
                      key={acc.platform}
                      style={{
                        background: "#080c14",
                        border: "1px solid var(--panel-border)",
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                            {acc.platform}
                          </span>
                          <a
                            href={acc.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: "#ccc",
                              display: "block",
                              marginTop: 4,
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              maxWidth: 240,
                              textDecoration: "underline",
                            }}
                          >
                            {acc.url}
                          </a>
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 2,
                            background: "rgba(0, 255, 170, 0.15)",
                            color: "#00ffaa",
                            border: "1px solid #00ffaa",
                            fontWeight: "bold",
                          }}
                        >
                          CLAIMED
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px solid var(--panel-border)",
                          paddingTop: 8,
                          fontSize: 10,
                          color: "var(--text-muted)",
                        }}
                      >
                        <span>{acc.response_time_ms ? `${acc.response_time_ms}ms` : "Active"}</span>
                        <SaveToCaseButton
                          identifierType="username"
                          identifierValue={username}
                          platform={acc.platform}
                          url={acc.url}
                          exists={true}
                          discoveredBy="sherlock-project.sherlock"
                          metadata={{
                            platform: acc.platform,
                            url: acc.url,
                            status: acc.status,
                            response_time_ms: acc.response_time_ms,
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
      )}

      {/* ========================================================================= */}
      {/* 3. MAIGRET DEEP DOSSIER RESULTS */}
      {/* ========================================================================= */}
      {mode === "maigret" && (
        <div>
          {maigretSearched && !maigretLoading && maigretData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 18px",
                  background: "rgba(5, 217, 232, 0.08)",
                  border: "1px solid rgba(5, 217, 232, 0.3)",
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                    MAIGRET PROFILES DISCOVERED: {maigretData.total_claimed}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 12 }}>
                    (Depth: Top {maigretData.top_sites_requested} Sites with Full Dossier Extraction)
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Filter name, bio, site..."
                  value={maigretFilter}
                  onChange={(e) => setMaigretFilter(e.target.value)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                    width: 220,
                  }}
                />
              </div>

              {filteredMaigretAccounts.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No claimed profiles extracted in top {maigretData.top_sites_requested} sites. Try increasing search depth.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
                  {filteredMaigretAccounts.map((acc) => (
                    <div
                      key={acc.platform}
                      style={{
                        background: "#080c14",
                        border: "1px solid var(--panel-border)",
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        position: "relative",
                      }}
                    >
                      {/* Card Header with Avatar & Platform */}
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        {acc.avatar_url ? (
                          <img
                            src={acc.avatar_url}
                            alt={acc.platform}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              border: "2px solid var(--cyan)",
                              objectFit: "cover",
                              background: "#111",
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              // Fallback if image fails
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              border: "1px solid var(--panel-border)",
                              background: "rgba(5, 217, 232, 0.1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              color: "var(--cyan)",
                            }}
                          >
                            <UserIcon size={20} />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                              {acc.platform}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "2px 5px",
                                borderRadius: 2,
                                background: "rgba(0, 255, 170, 0.15)",
                                color: "#00ffaa",
                                border: "1px solid #00ffaa",
                                fontWeight: "bold",
                              }}
                            >
                              CLAIMED
                            </span>
                          </div>

                          {acc.fullname && (
                            <div style={{ fontSize: 12, fontWeight: "600", color: "#fff", marginTop: 2 }}>
                              {acc.fullname}
                            </div>
                          )}

                          <a
                            href={acc.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: "#ccc",
                              display: "block",
                              marginTop: 2,
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textDecoration: "underline",
                            }}
                          >
                            {acc.url}
                          </a>
                        </div>
                      </div>

                      {/* Bio / Description */}
                      {acc.bio && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            lineHeight: "1.4",
                            background: "rgba(255,255,255,0.02)",
                            padding: "6px 8px",
                            borderRadius: 3,
                            borderLeft: "2px solid var(--cyan)",
                            maxHeight: 70,
                            overflowY: "auto",
                          }}
                        >
                          {acc.bio}
                        </div>
                      )}

                      {/* Metrics & Metadata Pills */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 10 }}>
                        {acc.follower_count && (
                          <span style={{ background: "rgba(5,217,232,0.1)", padding: "2px 6px", borderRadius: 3, color: "var(--cyan)" }}>
                            Followers: {acc.follower_count}
                          </span>
                        )}
                        {acc.following_count && (
                          <span style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 3, color: "#ccc" }}>
                            Following: {acc.following_count}
                          </span>
                        )}
                        {acc.uid && (
                          <span style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 3, color: "var(--text-muted)" }}>
                            UID: {acc.uid}
                          </span>
                        )}
                        {acc.tags && acc.tags.map((t) => (
                          <span key={t} style={{ background: "rgba(100,100,255,0.1)", padding: "2px 6px", borderRadius: 3, color: "#8ab4f8" }}>
                            #{t}
                          </span>
                        ))}
                      </div>

                      {/* Card Footer */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px solid var(--panel-border)",
                          paddingTop: 8,
                          fontSize: 10,
                          color: "var(--text-muted)",
                        }}
                      >
                        <span>Rank #{acc.rank ?? "N/A"}</span>
                        <SaveToCaseButton
                          identifierType="username"
                          identifierValue={username}
                          platform={acc.platform}
                          url={acc.url}
                          exists={true}
                          discoveredBy="maigret.dossier"
                          metadata={{
                            platform: acc.platform,
                            url: acc.url,
                            fullname: acc.fullname,
                            bio: acc.bio,
                            avatar_url: acc.avatar_url,
                            follower_count: acc.follower_count,
                            uid: acc.uid,
                            tags: acc.tags,
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
      )}

      {/* ========================================================================= */}
      {/* 4. WHATSMYNAME RESULTS */}
      {/* ========================================================================= */}
      {mode === "whatsmyname" && (
        <div>
          {wmnSearched && !wmnLoading && wmnData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 18px",
                  background: "rgba(5, 217, 232, 0.08)",
                  border: "1px solid rgba(5, 217, 232, 0.3)",
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                    WHATSMYNAME CLAIMED: {wmnData.total_claimed}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 12 }}>
                    (Scanned {wmnData.total_sites_scanned} sites | Category: {wmnCategory.toUpperCase()})
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Filter by site, category, URL..."
                  value={wmnFilter}
                  onChange={(e) => setWmnFilter(e.target.value)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                    width: 220,
                  }}
                />
              </div>

              {filteredWmnAccounts.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No claimed profiles matched your criteria across {wmnData.total_sites_scanned} scanned sites.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                  {filteredWmnAccounts.map((acc) => (
                    <div
                      key={acc.platform}
                      style={{
                        background: "#080c14",
                        border: "1px solid var(--panel-border)",
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)" }}>
                          {acc.platform}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: "rgba(100, 100, 255, 0.15)",
                            color: "#8ab4f8",
                            border: "1px solid #8ab4f8",
                            textTransform: "uppercase",
                          }}
                        >
                          {acc.category}
                        </span>
                      </div>

                      <a
                        href={acc.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 11,
                          color: "#ccc",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textDecoration: "underline",
                        }}
                      >
                        {acc.url}
                      </a>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px solid var(--panel-border)",
                          paddingTop: 8,
                          fontSize: 10,
                          color: "var(--text-muted)",
                        }}
                      >
                        <span>
                          HTTP {acc.status_code} ({acc.response_time_ms}ms)
                        </span>
                        <SaveToCaseButton
                          identifierType="username"
                          identifierValue={username}
                          platform={acc.platform}
                          url={acc.url}
                          exists={true}
                          discoveredBy="whatsmyname"
                          metadata={{
                            category: acc.category,
                            status_code: acc.status_code,
                            response_time_ms: acc.response_time_ms,
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
      )}

      {/* ========================================================================= */}
      {/* 5. SOCIALSCAN 0% FP RESULTS */}
      {/* ========================================================================= */}
      {mode === "socialscan" && (
        <div>
          {socialscanSearched && !socialscanLoading && socialscanData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 18px",
                  background: "rgba(5, 217, 232, 0.08)",
                  border: "1px solid rgba(5, 217, 232, 0.3)",
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                    SOCIALSCAN VERIFICATION: {socialscanData.total_claimed} CLAIMED
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 12 }}>
                    ({socialscanData.total_available} available, {socialscanData.total_unknown} rate-limited)
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {socialscanData.claimed_accounts.map((acc) => (
                  <div
                    key={acc.platform}
                    style={{
                      background: "#080c14",
                      border: "1px solid #00ffaa",
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>
                        {acc.platform}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 2,
                          background: "rgba(0, 255, 170, 0.15)",
                          color: "#00ffaa",
                          border: "1px solid #00ffaa",
                          fontWeight: "bold",
                        }}
                      >
                        CLAIMED (TAKEN)
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {acc.message}
                    </div>

                    {acc.url && (
                      <a
                        href={acc.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color: "var(--cyan)", textDecoration: "underline" }}
                      >
                        {acc.url}
                      </a>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        borderTop: "1px solid var(--panel-border)",
                        paddingTop: 8,
                      }}
                    >
                      <SaveToCaseButton
                        identifierType="username"
                        identifierValue={username}
                        platform={acc.platform}
                        url={acc.url}
                        exists={true}
                        discoveredBy="socialscan"
                        metadata={{
                          platform: acc.platform,
                          message: acc.message,
                          query: acc.query,
                        }}
                      />
                    </div>
                  </div>
                ))}

                {socialscanData.available_accounts.map((acc) => (
                  <div
                    key={acc.platform}
                    style={{
                      background: "#080c14",
                      border: "1px solid var(--panel-border)",
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: "bold", color: "#888" }}>
                        {acc.platform}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 2,
                          background: "rgba(255, 255, 255, 0.05)",
                          color: "#888",
                          border: "1px solid #555",
                        }}
                      >
                        AVAILABLE (UNCLAIMED)
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {acc.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CROSS-PLATFORM OSINT PIVOTS MATRIX (13 TOOLS) */}
      {/* ========================================================================= */}
      {mode === "pivots" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              padding: "12px 18px",
              background: "rgba(5, 217, 232, 0.08)",
              border: "1px solid rgba(5, 217, 232, 0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                CROSS-PLATFORM OSINT ENRICHMENT & PIVOTS MATRIX
              </span>
              <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                Target-linked external search engines, specialized gamer archivers, and public identity crawlers.
              </p>
            </div>
            <button
              onClick={() => handlePivotsLoad()}
              disabled={pivotsLoading || !username.trim()}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                background: "var(--cyan)",
                color: "#000",
                border: "none",
                cursor: pivotsLoading ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {pivotsLoading ? "Loading..." : "REFRESH PIVOTS"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            {pivotsData.map((pivot) => (
              <div
                key={pivot.name}
                style={{
                  background: "#080c14",
                  border: "1px solid var(--panel-border)",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                      {pivot.name}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: pivot.native_engine ? "rgba(0, 255, 170, 0.15)" : "rgba(5, 217, 232, 0.15)",
                        color: pivot.native_engine ? "#00ffaa" : "var(--cyan)",
                        border: pivot.native_engine ? "1px solid #00ffaa" : "1px solid var(--cyan)",
                        fontWeight: "bold",
                      }}
                    >
                      {pivot.native_engine ? "NATIVE ENGINE" : "EXTERNAL PIVOT"}
                    </span>
                  </div>

                  <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                    Category: {pivot.category}
                  </span>

                  <p style={{ fontSize: 11, color: "#ccc", margin: "8px 0 0 0", lineHeight: "1.4" }}>
                    {pivot.description}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--panel-border)",
                    paddingTop: 8,
                  }}
                >
                  <a
                    href={pivot.url}
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
                    Open Tool <ExternalLinkIcon size={12} />
                  </a>

                  <SaveToCaseButton
                    identifierType={pivot.query_type === "email" ? "email" : "username"}
                    identifierValue={username}
                    platform={pivot.name}
                    url={pivot.url}
                    exists={true}
                    discoveredBy="cross_platform.pivots"
                    metadata={{
                      tool: pivot.name,
                      category: pivot.category,
                      url: pivot.url,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
