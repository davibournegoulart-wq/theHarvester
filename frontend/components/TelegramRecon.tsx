"use client";

import React, { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  TelegramIcon,
  SearchIcon,
  CrossIcon,
  CheckIcon,
  GlobeIcon,
  LayersIcon,
  RadarIcon,
  PaperclipIcon,
  EyeIcon,
  DatabaseIcon,
  DownloadIcon,
  ClockIcon,
  CalendarIcon,
  ArrowRightIcon,
} from "./FlatIcons";

type TelegramMessage = {
  post_id: string;
  post_url: string;
  datetime_utc: string | null;
  text: string;
  views: string;
  media_type: "text" | "photo" | "video" | "document" | "forward";
  media_url: string | null;
  is_forward: boolean;
  forward_from_title: string | null;
  forward_from_url: string | null;
  entities: {
    btc: string[];
    eth: string[];
    tron: string[];
    sol: string[];
    emails: string[];
    phones: string[];
    mentions: string[];
    hashtags: string[];
    onion_links: string[];
    urls: string[];
  };
};

type UltimateScrapeResponse = {
  channel_profile: {
    username: string;
    title: string;
    description: string;
    avatar_url: string | null;
    subscribers: string;
    is_verified: boolean;
    is_channel: boolean;
    tme_url: string;
    profile_entities?: Record<string, any>;
  };
  messages: TelegramMessage[];
  total_scraped: number;
  aggregated_intel: {
    crypto_wallets: { address: string; type: string; count: number }[];
    emails: { email: string; count: number }[];
    phones: { phone: string; count: number }[];
    mentions: { username: string; count: number }[];
    hashtags: { tag: string; count: number }[];
    forwarded_sources: { source: string; count: number }[];
    onion_links: { url: string; count: number }[];
    external_urls: { url: string; count: number }[];
  };
  stats: {
    total_messages: number;
    media_messages: number;
    forward_messages: number;
    newest_message_date: string | null;
    oldest_message_date: string | null;
    wallets_count: number;
    emails_count: number;
    phones_count: number;
  };
};

export default function TelegramRecon() {
  const { activeCase } = useActiveCase();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"channel" | "phone">("channel");
  const [limit, setLimit] = useState(50);
  const [keywordFilter, setKeywordFilter] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [data, setData] = useState<UltimateScrapeResponse | null>(null);
  const [phoneResult, setPhoneResult] = useState<{ exists: boolean; query: string } | null>(null);

  // Active Forensic Subtab
  const [activeTab, setActiveTab] = useState<"messages" | "wallets" | "contacts" | "forwards" | "web" | "hashtags">("messages");

  // Evidence Attachment Status
  const [attaching, setAttaching] = useState(false);
  const [attachedNotice, setAttachedNotice] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);
    setPhoneResult(null);
    setAttachedNotice(null);

    if (type === "phone") {
      try {
        const res = await apiGet<{ exists: boolean }>(
          `/identifiers/phone/telegram?phone=${encodeURIComponent(query.trim())}`
        );
        setPhoneResult({ exists: res.exists, query: query.trim() });
      } catch (err: any) {
        setError(err?.message || "Failed checking Telegram phone number");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const qParam = keywordFilter.trim() ? `&query=${encodeURIComponent(keywordFilter.trim())}` : "";
        const mParam = mediaFilter !== "all" ? `&media_type=${encodeURIComponent(mediaFilter)}` : "";
        const res = await apiGet<UltimateScrapeResponse>(
          `/recon/telegram/ultimate-scrape?target=${encodeURIComponent(query.trim())}&limit=${limit}&use_tor=${useTor}${qParam}${mParam}`
        );
        setData(res);
      } catch (err: any) {
        setError(err?.message || "Failed scraping Telegram channel messages");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAttachEvidence = async (url: string, filename: string, typology: "image" | "video") => {
    if (!activeCase) {
      alert("Please select or create an active case in Case Management first.");
      return;
    }

    setAttaching(true);
    setAttachedNotice(null);
    try {
      await apiPostJson(
        `/recon/telegram/attach-evidence?case_id=${activeCase.id}&media_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&typology=${typology}`,
        {}
      );
      setAttachedNotice(`Attached ${filename} directly into Case Evidence Vault.`);
    } catch (err: any) {
      alert(err?.message || "Failed to attach media to Case Evidence");
    } finally {
      setAttaching(false);
    }
  };

  const handleExportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telegram_scrape_${data.channel_profile.username}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          padding: 16,
          borderRadius: 8,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: "rgba(0, 136, 204, 0.15)",
              border: "1px solid #0088cc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TelegramIcon size={20} color="#0088cc" />
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              Telegram Ultimate Scraper &amp; Forensic Intelligence Suite
              <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(0, 136, 204, 0.2)", color: "#0088cc", borderRadius: 4, border: "1px solid #0088cc" }}>
                Ultimate Engine
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Channel message history ingestion, media looting, forward network mapping, and automated crypto/contact extraction.
            </div>
          </div>
        </div>

        {/* Tor Routing Toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: useTor ? "var(--green)" : "var(--text-muted)" }}>
          <input type="checkbox" checked={useTor} onChange={(e) => setUseTor(e.target.checked)} />
          <span>Route via Tor (Port 9050)</span>
        </label>
      </div>

      {/* Main Scraper Controls */}
      <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: 12, background: "#0b0f14", padding: 14, borderRadius: 8, border: "1px solid var(--panel-border)" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            style={{
              padding: "10px 12px",
              background: "#161b22",
              border: "1px solid var(--panel-border)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <option value="channel">Channel / Group Scraper</option>
            <option value="phone">Phone Verification</option>
          </select>

          <input
            type="text"
            placeholder={type === "phone" ? "+1234567890" : "Enter Telegram channel username or URL (e.g. durov, telegram, https://t.me/s/...)"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: 260,
              padding: "10px 14px",
              background: "#0d1117",
              border: "1px solid var(--panel-border)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 13,
            }}
          />

          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: "10px 20px",
              background: "#0088cc",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: "bold",
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <SearchIcon size={14} color="#fff" />
            {loading ? "Scraping Target..." : "Execute Scraper"}
          </button>
        </div>

        {/* Forensic Filter Parameters (Channel mode only) */}
        {type === "channel" && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Depth:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                style={{ padding: "4px 8px", background: "#161b22", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 11 }}
              >
                <option value={25}>25 Messages</option>
                <option value={50}>50 Messages</option>
                <option value={100}>100 Messages</option>
                <option value={200}>200 Messages</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Media Filter:</span>
              <select
                value={mediaFilter}
                onChange={(e) => setMediaFilter(e.target.value)}
                style={{ padding: "4px 8px", background: "#161b22", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 11 }}
              >
                <option value="all">All Media &amp; Text</option>
                <option value="photo">Photos Only</option>
                <option value="video">Videos Only</option>
                <option value="document">Documents Only</option>
                <option value="forward">Forwarded Only</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Keyword / Regex Filter:</span>
              <input
                type="text"
                placeholder="Filter by keyword (e.g. password, leak, 0x, btc, http)..."
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                style={{ flex: 1, padding: "4px 8px", background: "#161b22", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 11 }}
              />
            </div>
          </div>
        )}
      </form>

      {error && (
        <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {attachedNotice && (
        <div style={{ padding: 10, background: "rgba(0, 255, 102, 0.1)", border: "1px solid var(--green)", borderRadius: 4, color: "var(--green)", fontSize: 12 }}>
          {attachedNotice}
        </div>
      )}

      {/* Phone verification output */}
      {phoneResult && (
        <div style={{ background: "var(--panel-bg)", padding: 16, borderRadius: 8, border: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Phone Verification</div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: phoneResult.exists ? "var(--green)" : "var(--red)", marginTop: 4 }}>
              {phoneResult.exists ? "Target Registered on Telegram" : "Target Not Registered on Telegram"}
            </div>
          </div>
          <SaveToCaseButton
            identifierType="phone"
            platform="telegram.phone"
            discoveredBy="TelegramUltimateScraper"
            identifierValue={phoneResult.query}
            exists={phoneResult.exists}
            metadata={{ phone: phoneResult.query, registered: phoneResult.exists }}
          />
        </div>
      )}

      {/* Channel Dossier & Scrape Results */}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Channel Profile Dossier Card */}
          <div
            style={{
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              padding: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {data.channel_profile.avatar_url ? (
                <img
                  src={data.channel_profile.avatar_url}
                  alt={data.channel_profile.username}
                  style={{ width: 68, height: 68, borderRadius: "50%", border: "2px solid #0088cc", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(0, 136, 204, 0.2)", border: "2px solid #0088cc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TelegramIcon size={32} color="#0088cc" />
                </div>
              )}

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 19, fontWeight: "bold", color: "#fff" }}>
                    {data.channel_profile.title}
                  </span>
                  {data.channel_profile.is_verified && (
                    <span style={{ fontSize: 11, background: "rgba(0, 136, 204, 0.2)", color: "#0088cc", border: "1px solid #0088cc", padding: "2px 6px", borderRadius: 4, fontWeight: "bold" }}>
                      VERIFIED
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "var(--cyan)", marginTop: 2 }}>
                  @{data.channel_profile.username} &bull; Subscribers: {data.channel_profile.subscribers}
                </div>

                {data.channel_profile.description && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 650, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                    {data.channel_profile.description}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.channel_profile.avatar_url && (
                <button
                  type="button"
                  onClick={() => handleAttachEvidence(data.channel_profile.avatar_url!, `${data.channel_profile.username}_avatar.jpg`, "image")}
                  disabled={attaching}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "rgba(0, 255, 102, 0.15)",
                    border: "1px solid var(--green)",
                    color: "var(--green)",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: attaching ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  <PaperclipIcon size={12} color="var(--green)" />
                  Attach Avatar
                </button>
              )}

              <button
                type="button"
                onClick={handleExportJSON}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "rgba(5, 217, 232, 0.15)",
                  border: "1px solid var(--cyan)",
                  color: "var(--cyan)",
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                <DownloadIcon size={12} color="var(--cyan)" />
                Export Scrape JSON
              </button>

              <SaveToCaseButton
                identifierType="username"
                platform="telegram.channel"
                discoveredBy="TelegramUltimateScraper"
                identifierValue={data.channel_profile.username}
                metadata={{
                  title: data.channel_profile.title,
                  subscribers: data.channel_profile.subscribers,
                  total_scraped: data.total_scraped,
                  wallets_count: data.stats.wallets_count,
                  emails_count: data.stats.emails_count,
                }}
              />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Scraped</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff", marginTop: 2 }}>{data.stats.total_messages}</div>
            </div>
            <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Crypto Wallets</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--cyan)", marginTop: 2 }}>{data.stats.wallets_count}</div>
            </div>
            <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Contact Emails</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--green)", marginTop: 2 }}>{data.stats.emails_count}</div>
            </div>
            <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Phone Numbers</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--orange)", marginTop: 2 }}>{data.stats.phones_count}</div>
            </div>
            <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Forwarded Posts</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#70b5f9", marginTop: 2 }}>{data.stats.forward_messages}</div>
            </div>
          </div>

          {/* Forensic Entity Hub Tabs */}
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--panel-border)", paddingBottom: 8, overflowX: "auto" }}>
            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              style={{
                padding: "6px 12px",
                background: activeTab === "messages" ? "rgba(0, 136, 204, 0.2)" : "transparent",
                border: activeTab === "messages" ? "1px solid #0088cc" : "1px solid transparent",
                color: activeTab === "messages" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeTab === "messages" ? "bold" : "normal",
              }}
            >
              1. Messages Stream ({data.messages.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("wallets")}
              style={{
                padding: "6px 12px",
                background: activeTab === "wallets" ? "rgba(0, 136, 204, 0.2)" : "transparent",
                border: activeTab === "wallets" ? "1px solid #0088cc" : "1px solid transparent",
                color: activeTab === "wallets" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeTab === "wallets" ? "bold" : "normal",
              }}
            >
              2. Crypto Wallets ({data.aggregated_intel.crypto_wallets.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              style={{
                padding: "6px 12px",
                background: activeTab === "contacts" ? "rgba(0, 136, 204, 0.2)" : "transparent",
                border: activeTab === "contacts" ? "1px solid #0088cc" : "1px solid transparent",
                color: activeTab === "contacts" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeTab === "contacts" ? "bold" : "normal",
              }}
            >
              3. Communication Contacts ({data.aggregated_intel.emails.length + data.aggregated_intel.phones.length + data.aggregated_intel.mentions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("forwards")}
              style={{
                padding: "6px 12px",
                background: activeTab === "forwards" ? "rgba(0, 136, 204, 0.2)" : "transparent",
                border: activeTab === "forwards" ? "1px solid #0088cc" : "1px solid transparent",
                color: activeTab === "forwards" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeTab === "forwards" ? "bold" : "normal",
              }}
            >
              4. Forward Origins Network ({data.aggregated_intel.forwarded_sources.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("web")}
              style={{
                padding: "6px 12px",
                background: activeTab === "web" ? "rgba(0, 136, 204, 0.2)" : "transparent",
                border: activeTab === "web" ? "1px solid #0088cc" : "1px solid transparent",
                color: activeTab === "web" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeTab === "web" ? "bold" : "normal",
              }}
            >
              5. Tor Onions &amp; External Links ({data.aggregated_intel.onion_links.length + data.aggregated_intel.external_urls.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("hashtags")}
              style={{
                padding: "6px 12px",
                background: activeTab === "hashtags" ? "rgba(0, 136, 204, 0.2)" : "transparent",
                border: activeTab === "hashtags" ? "1px solid #0088cc" : "1px solid transparent",
                color: activeTab === "hashtags" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: activeTab === "hashtags" ? "bold" : "normal",
              }}
            >
              6. Hashtags ({data.aggregated_intel.hashtags.length})
            </button>
          </div>

          {/* Tab 1: Messages Stream */}
          {activeTab === "messages" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.messages.length === 0 ? (
                <div style={{ padding: 20, background: "#0b0f14", borderRadius: 6, color: "var(--text-muted)", fontSize: 13 }}>
                  No messages matched the specified filter criteria.
                </div>
              ) : (
                data.messages.map((m, idx) => (
                  <div
                    key={`${m.post_id}-${idx}`}
                    style={{
                      background: "#0d1117",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 6,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", background: "#161b22", color: "var(--cyan)", borderRadius: 4, fontWeight: "bold" }}>
                          ID: {m.post_id}
                        </span>
                        {m.datetime_utc && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {m.datetime_utc.replace("T", " ").replace("+00:00", " UTC")}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>
                          Views: {m.views}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        {m.media_url && (
                          <button
                            type="button"
                            onClick={() => handleAttachEvidence(m.media_url!, `${m.post_id.replace('/', '_')}_media.${m.media_type === 'video' ? 'mp4' : 'jpg'}`, m.media_type === "video" ? "video" : "image")}
                            disabled={attaching}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              background: "rgba(0, 255, 102, 0.15)",
                              border: "1px solid var(--green)",
                              color: "var(--green)",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: attaching ? "not-allowed" : "pointer",
                              fontWeight: "bold",
                            }}
                          >
                            <PaperclipIcon size={11} color="var(--green)" />
                            Attach Media
                          </button>
                        )}

                        <a
                          href={m.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            background: "#161b22",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#70b5f9",
                            borderRadius: 4,
                            fontSize: 11,
                            textDecoration: "none",
                          }}
                        >
                          <EyeIcon size={11} color="#70b5f9" />
                          View on Web
                        </a>

                        <SaveToCaseButton
                          identifierType="url"
                          platform="telegram.message"
                          discoveredBy="TelegramUltimateScraper"
                          identifierValue={m.post_url}
                          metadata={{
                            post_id: m.post_id,
                            datetime_utc: m.datetime_utc,
                            views: m.views,
                            media_type: m.media_type,
                            forwarded_from: m.forward_from_title,
                          }}
                        />
                      </div>
                    </div>

                    {/* Forwarded Header */}
                    {m.is_forward && (
                      <div style={{ fontSize: 11, color: "#70b5f9", display: "flex", alignItems: "center", gap: 6, background: "rgba(0,136,204,0.1)", padding: "4px 8px", borderRadius: 4 }}>
                        <ArrowRightIcon size={12} color="#70b5f9" />
                        Forwarded from:{" "}
                        {m.forward_from_url ? (
                          <a href={m.forward_from_url} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)", textDecoration: "underline" }}>
                            {m.forward_from_title || m.forward_from_url}
                          </a>
                        ) : (
                          <strong>{m.forward_from_title}</strong>
                        )}
                      </div>
                    )}

                    {/* Message Text */}
                    {m.text && (
                      <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {m.text}
                      </div>
                    )}

                    {/* Media Thumbnail */}
                    {m.media_url && m.media_type === "photo" && (
                      <div style={{ marginTop: 4 }}>
                        <img
                          src={m.media_url}
                          alt={m.post_id}
                          style={{ maxWidth: 360, maxHeight: 240, borderRadius: 6, border: "1px solid var(--panel-border)", objectFit: "cover" }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Crypto Wallets */}
          {activeTab === "wallets" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.aggregated_intel.crypto_wallets.length === 0 ? (
                <div style={{ padding: 16, background: "#0b0f14", borderRadius: 6, color: "var(--text-muted)", fontSize: 13 }}>
                  No cryptocurrency wallet addresses detected in scraped messages.
                </div>
              ) : (
                data.aggregated_intel.crypto_wallets.map((w, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", borderRadius: 4, fontWeight: "bold" }}>
                          {w.type}
                        </span>
                        <code style={{ fontSize: 13, color: "#fff" }}>{w.address}</code>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        Mentioned in {w.count} message(s)
                      </div>
                    </div>

                    <SaveToCaseButton
                      identifierType="crypto"
                      platform={`crypto.${w.type.toLowerCase()}`}
                      discoveredBy="TelegramUltimateScraper"
                      identifierValue={w.address}
                      metadata={{ coin: w.type, occurrences: w.count, channel: data.channel_profile.username }}
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Communication Contacts */}
          {activeTab === "contacts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Emails */}
              <div>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 8 }}>
                  Extracted Email Addresses ({data.aggregated_intel.emails.length})
                </div>
                {data.aggregated_intel.emails.map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6, marginBottom: 6 }}>
                    <div>
                      <code style={{ fontSize: 13, color: "var(--cyan)" }}>{e.email}</code>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>({e.count}x)</span>
                    </div>
                    <SaveToCaseButton
                      identifierType="email"
                      platform="email.telegram"
                      discoveredBy="TelegramUltimateScraper"
                      identifierValue={e.email}
                      metadata={{ channel: data.channel_profile.username, count: e.count }}
                    />
                  </div>
                ))}
              </div>

              {/* Phones */}
              <div>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 8 }}>
                  Extracted Phone Numbers ({data.aggregated_intel.phones.length})
                </div>
                {data.aggregated_intel.phones.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6, marginBottom: 6 }}>
                    <div>
                      <code style={{ fontSize: 13, color: "var(--orange)" }}>{p.phone}</code>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>({p.count}x)</span>
                    </div>
                    <SaveToCaseButton
                      identifierType="phone"
                      platform="phone.telegram"
                      discoveredBy="TelegramUltimateScraper"
                      identifierValue={p.phone}
                      metadata={{ channel: data.channel_profile.username, count: p.count }}
                    />
                  </div>
                ))}
              </div>

              {/* Mentioned Handles */}
              <div>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 8 }}>
                  Mentioned Accounts ({data.aggregated_intel.mentions.length})
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.aggregated_intel.mentions.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: "#70b5f9" }}>@{m.username}</span>
                      <span style={{ fontSize: 10, background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 4 }}>{m.count}</span>
                      <SaveToCaseButton
                        identifierType="username"
                        platform="telegram.mention"
                        discoveredBy="TelegramUltimateScraper"
                        identifierValue={m.username}
                        metadata={{ channel: data.channel_profile.username, count: m.count }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Forward Origin Network */}
          {activeTab === "forwards" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Channels and sources from which the target frequently syndicates, reposts, and forwards content:
              </div>
              {data.aggregated_intel.forwarded_sources.length === 0 ? (
                <div style={{ padding: 16, background: "#0b0f14", borderRadius: 6, color: "var(--text-muted)", fontSize: 13 }}>
                  No forwarded messages found in this sample batch.
                </div>
              ) : (
                data.aggregated_intel.forwarded_sources.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>{s.source}</div>
                      <div style={{ fontSize: 11, color: "var(--cyan)", marginTop: 2 }}>{s.count} forwarded post(s)</div>
                    </div>
                    <SaveToCaseButton
                      identifierType="person"
                      platform="telegram.forward_origin"
                      discoveredBy="TelegramUltimateScraper"
                      identifierValue={s.source}
                      metadata={{ forward_channel: s.source, count: s.count, target_channel: data.channel_profile.username }}
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 5: Darknet & External URLs */}
          {activeTab === "web" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.aggregated_intel.onion_links.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--red)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <RadarIcon size={14} color="var(--red)" />
                    Extracted Tor Onion Links ({data.aggregated_intel.onion_links.length})
                  </div>
                  {data.aggregated_intel.onion_links.map((o, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6, marginBottom: 6 }}>
                      <code style={{ fontSize: 12, color: "var(--red)" }}>{o.url}</code>
                      <SaveToCaseButton
                        identifierType="url"
                        platform="darkweb.onion"
                        discoveredBy="TelegramUltimateScraper"
                        identifierValue={o.url}
                        metadata={{ url: o.url, occurrences: o.count }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 8 }}>
                  External Web Links ({data.aggregated_intel.external_urls.length})
                </div>
                {data.aggregated_intel.external_urls.map((u, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6, marginBottom: 6 }}>
                    <a href={u.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--cyan)", textDecoration: "none", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.url}
                    </a>
                    <SaveToCaseButton
                      identifierType="url"
                      platform="telegram.external_link"
                      discoveredBy="TelegramUltimateScraper"
                      identifierValue={u.url}
                      metadata={{ url: u.url, occurrences: u.count }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 6: Hashtags */}
          {activeTab === "hashtags" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.aggregated_intel.hashtags.map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#161b22", border: "1px solid var(--panel-border)", borderRadius: 20 }}>
                  <span style={{ color: "var(--cyan)", fontSize: 12, fontWeight: "bold" }}>{h.tag}</span>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 10 }}>{h.count}</span>
                  <SaveToCaseButton
                    identifierType="username"
                    platform="telegram.hashtag"
                    discoveredBy="TelegramUltimateScraper"
                    identifierValue={h.tag}
                    metadata={{ tag: h.tag, count: h.count }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
