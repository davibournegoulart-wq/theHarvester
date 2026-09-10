"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";

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

type SocialIdResult = { platform: string; user_id: string | null; sec_uid: string | null };

export default function UsernameSearch() {
  const { activeCase } = useActiveCase();
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"standard" | "sherlock">("standard");
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

  async function handleStandardSearch() {
    if (!username.trim() || !activeCase) return;
    setLoading(true);
    setSherlockData(null);
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
    setResults([]);
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

  const filteredSherlockAccounts = (sherlockData?.claimed_accounts || []).filter((acc) =>
    acc.platform.toLowerCase().includes(sherlockFilter.toLowerCase()) ||
    acc.url.toLowerCase().includes(sherlockFilter.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header and Engine Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--cyan)", fontWeight: "bold", letterSpacing: "0.1em" }}>
            [USERNAME ENUMERATION & RECON]
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
            Query usernames across hundreds of social networks, platforms, and forums.
          </p>
        </div>

        {/* Engine Switcher */}
        <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.4)", padding: 4, borderRadius: 4, border: "1px solid var(--panel-border)" }}>
          <button
            onClick={() => setMode("standard")}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: mode === "standard" ? "bold" : "normal",
              background: mode === "standard" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "standard" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "standard" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            Fast Native Engine (125 sites)
          </button>
          <button
            onClick={() => setMode("sherlock")}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: mode === "sherlock" ? "bold" : "normal",
              background: mode === "sherlock" ? "rgba(5, 217, 232, 0.2)" : "transparent",
              color: mode === "sherlock" ? "var(--cyan)" : "var(--text-muted)",
              border: mode === "sherlock" ? "1px solid var(--cyan)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            ★ Sherlock Project Core (430+ sites)
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
            onKeyDown={(e) => e.key === "Enter" && (mode === "standard" ? handleStandardSearch() : handleSherlockSearch())}
            placeholder={mode === "standard" ? "e.g. johndoe" : "Enter username to scan with Sherlock (430+ sites)..."}
            style={{
              flex: "1 1 300px",
              padding: "10px 14px",
              fontSize: 13,
              background: "#080c14",
              border: "1px solid var(--panel-border)",
              color: "var(--text-main)",
            }}
          />

          {mode === "sherlock" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                id="useTorSherlock"
                checked={useTor}
                onChange={(e) => setUseTor(e.target.checked)}
              />
              <label htmlFor="useTorSherlock" style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
                Route via Tor
              </label>
            </div>
          )}

          <button
            onClick={mode === "standard" ? handleStandardSearch : handleSherlockSearch}
            disabled={loading || sherlockLoading || !username.trim()}
            style={{
              padding: "10px 24px",
              fontSize: 12,
              fontWeight: "bold",
              background: loading || sherlockLoading ? "#333" : "var(--cyan)",
              color: "#000",
              border: "none",
              cursor: loading || sherlockLoading || !username.trim() ? "not-allowed" : "pointer",
              borderRadius: 2,
            }}
          >
            {loading
              ? "Scanning native sites..."
              : sherlockLoading
              ? "Hunting on 430+ Sherlock sites..."
              : mode === "sherlock"
              ? "RUN SHERLOCK SCAN"
              : "Search"}
          </button>
        </div>

        {mode === "sherlock" && (
          <div style={{ fontSize: 11, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚡ Sherlock Official Engine:</span>
            <span style={{ color: "var(--text-muted)" }}>
              Scans all 431 registered platforms including GitHub, GitLab, Twitter, Reddit, TikTok, OnlyFans, Telegram, Steam, Spotify, and 400+ others.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* STANDARD NATIVE ENGINE RESULTS */}
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
      {/* SHERLOCK PROJECT ENGINE RESULTS */}
      {/* ========================================================================= */}
      {mode === "sherlock" && (
        <div>
          {sherlockSearched && !sherlockLoading && sherlockData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Stats Bar */}
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
                        position: "relative",
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
                        <span>
                          {acc.response_time_ms ? `${acc.response_time_ms}ms` : "Active"}
                        </span>
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
    </div>
  );
}
