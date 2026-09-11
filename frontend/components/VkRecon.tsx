"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  VkIcon,
  SearchIcon,
  ShieldIcon,
  GlobeIcon,
  CalendarIcon,
  ExternalLinkIcon,
  ClockIcon,
  LayersIcon,
  CheckIcon,
  PaperclipIcon,
  LockIcon,
  TerminalIcon,
  UserIcon,
} from "./FlatIcons";

type VkAttachment = {
  type: string;
  url?: string;
  text?: string;
  video_id?: string;
  video_url?: string;
  title?: string;
  description?: string;
  duration?: number;
  thumbnail_url?: string;
  size?: number;
  ext?: string;
};

type VkPost = {
  post_id: string;
  post_url: string;
  date_utc: string | null;
  text: string;
  views: number;
  likes: number;
  reposts: number;
  comments: number;
  reactions_count: number;
  attachments: VkAttachment[];
  is_repost: boolean;
  repost_origin?: {
    owner_id: number;
    post_id: number;
    url: string;
    text: string;
  } | null;
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

type VkProfile = {
  target: string;
  owner_id: number | null;
  type: string;
  url: string;
  name: string | null;
  screen_name: string;
  verified: boolean;
  description: string | null;
  status: string | null;
  followers_or_members: number;
  city: string | null;
  country: string | null;
  bdate: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  contacts: { type: string; value: string }[];
  site: string | null;
  profile_entities: {
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

type VkPivotItem = {
  name: string;
  category: string;
  url: string;
  description: string;
};

type VkHarvestResponse = {
  target: string;
  profile: VkProfile;
  messages: VkPost[];
  total_scraped: number;
  aggregated_intel: {
    crypto_wallets: string[];
    emails: string[];
    phones: string[];
    mentions: string[];
    hashtags: string[];
    onion_links: string[];
    urls: string[];
  };
  stats: {
    total_posts: number;
    posts_with_media: number;
    reposts_count: number;
    newest_post_date?: string | null;
    oldest_post_date?: string | null;
  };
  osint_pivots?: VkPivotItem[];
  warning?: string;
};

const DEFAULT_VK_TOOLS: VkPivotItem[] = [
  {
    name: "VK Watch",
    category: "Search & Archive",
    url: "https://vk.watch/ru",
    description: "Search engine and deep cache for VK profiles, wall posts, videos, and groups.",
  },
  {
    name: "Bellingcat VK Scraper",
    category: "Profile & Post Scrapers",
    url: "https://github.com/bellingcat/vk-url-scraper",
    description: "Python methodology to scrape VK URLs, extracting post text, dates, and media attachments.",
  },
  {
    name: "VK ID Lookup (RegVK)",
    category: "Registration Date",
    url: "https://regvk.com/id/",
    description: "Inspect exact account registration dates, verification data, and numeric ID resolution.",
  },
  {
    name: "vk_api (Python)",
    category: "Developer Library",
    url: "https://github.com/python273/vk_api",
    description: "Python library for accessing VK API and automating large dataset extraction.",
  },
  {
    name: "Wayback Machine VK Archive",
    category: "Web Archive",
    url: "https://web.archive.org/web/*/https://vk.com/*",
    description: "Inspect historical snapshots of deleted or censored VK posts, walls, and communities.",
  },
  {
    name: "Search4Faces",
    category: "Reverse Face Recognition",
    url: "https://search4faces.com/",
    description: "High-precision neural face recognition search targeting VKontakte and OK.ru profile photos.",
  },
  {
    name: "VK History Robot",
    category: "Telegram Tracker",
    url: "https://t.me/VKHistoryRobot",
    description: "Telegram bot tracking timeline of historical name changes, avatars, and status shifts.",
  },
  {
    name: "FindNameVk Bot",
    category: "Telegram Bot",
    url: "https://t.me/FindNameVk_bot",
    description: "Telegram bot for finding VK accounts by real first and last names with phonetic matching.",
  },
  {
    name: "Дезертир (Deserteer)",
    category: "Telegram Bot",
    url: "https://t.me/deserteer",
    description: "Russian OSINT Telegram bot to monitor group leavers and member community activity.",
  },
  {
    name: "Barkov.net",
    category: "Audience Parser",
    url: "https://barkov.net/",
    description: "Deep audience, subscriber, wall author, and community relationship extraction service.",
  },
  {
    name: "VK People Search",
    category: "Native Filter",
    url: "https://vk.com/search/people",
    description: "Search VK users by exact age, city, university, military service, and relationships.",
  },
  {
    name: "VK Community Search",
    category: "Native Filter",
    url: "https://vk.com/communities",
    description: "Discover public and closed VK groups, public pages, and geographical communities.",
  },
];

export default function VkRecon() {
  const { activeCase } = useActiveCase();

  // Search State
  const [target, setTarget] = useState("");
  const [limit, setLimit] = useState(25);
  const [filterType, setFilterType] = useState<"all" | "own" | "others">("all");
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VkHarvestResponse | null>(null);

  // Client-side Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"wall" | "crypto" | "comms" | "reposts" | "links" | "tags" | "pivots">("wall");

  // Evidence Attachment State
  const [attachingMediaUrl, setAttachingMediaUrl] = useState<string | null>(null);
  const [attachFeedback, setAttachFeedback] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  async function handleHarvest() {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setAttachFeedback(null);

    try {
      const clean = target.trim();
      const params = new URLSearchParams({
        target: clean,
        limit: String(limit),
        filter_type: filterType,
        use_tor: String(useTor),
      });

      const data = await apiGet<VkHarvestResponse>(`/recon/vk/ultimate-harvest?${params.toString()}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error harvesting VKontakte target");
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachEvidence(mediaUrl: string, defaultName: string) {
    if (!activeCase) {
      setAttachFeedback("Select an active case first to attach evidence.");
      return;
    }
    setAttachingMediaUrl(mediaUrl);
    setAttachFeedback(null);
    try {
      await apiPostJson(
        `/recon/vk/attach-evidence?case_id=${activeCase.id}&media_url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(defaultName)}`,
        {}
      );
      setAttachFeedback(`Media attached to Case "${activeCase.name}" vault.`);
    } catch (e) {
      setAttachFeedback(e instanceof Error ? e.message : "Failed to attach media");
    } finally {
      setAttachingMediaUrl(null);
    }
  }

  function handleExportJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `vk_harvest_${result.profile.screen_name || result.target}.json`;
    a.click();
    URL.revokeObjectURL(u);
  }

  function handleCopy(urlToCopy: string) {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedUrl(urlToCopy);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  // Filtered wall posts
  const filteredPosts = (result?.messages || []).filter((p) => {
    if (mediaOnly && p.attachments.length === 0) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const inText = p.text.toLowerCase().includes(q);
      const inAtt = p.attachments.some(
        (a) => (a.title && a.title.toLowerCase().includes(q)) || (a.description && a.description.toLowerCase().includes(q))
      );
      if (!inText && !inAtt) return false;
    }
    return true;
  });

  const activePivots = result?.osint_pivots || DEFAULT_VK_TOOLS;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ color: "var(--cyan)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <VkIcon size={18} color="#0077FF" />
            VKontakte (VK) Ultimate OSINT Harvester & Arsenal
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0 0" }}>
            Extract public profiles, communities, multi-depth wall posts, photos/videos, repost networks, and cryptocurrency/contact entities.
          </p>
        </div>

        {result && (
          <button
            onClick={handleExportJson}
            style={{
              padding: "6px 14px",
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              color: "var(--text)",
              fontSize: 12,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Export Scrape JSON
          </button>
        )}
      </div>

      {/* Scraper Control Bar */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleHarvest()}
            placeholder="Username, Vanity URL, ID, or Wall URL (e.g. durov, id1, mash, club112510789, vk.com/wall1_2442097)"
            style={{ flex: 1, minWidth: 280, padding: "8px 12px" }}
          />

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ padding: "8px 10px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--panel-border)" }}
          >
            <option value={10}>10 posts</option>
            <option value={25}>25 posts</option>
            <option value={50}>50 posts</option>
            <option value={100}>100 posts</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | "own" | "others")}
            style={{ padding: "8px 10px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--panel-border)" }}
          >
            <option value="all">All Posts</option>
            <option value="own">Owner Posts Only</option>
            <option value="others">Others/Mentions Only</option>
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: useTor ? "var(--cyan)" : "var(--text-muted)",
              cursor: "pointer",
              padding: "0 8px",
            }}
          >
            <input type="checkbox" checked={useTor} onChange={(e) => setUseTor(e.target.checked)} />
            <LockIcon size={12} /> Tor Routing (9050)
          </label>

          <button onClick={handleHarvest} disabled={loading} style={{ padding: "8px 20px" }}>
            {loading ? "Harvesting..." : "Harvest Target"}
          </button>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0 0 0" }}>{error}</p>}
        {attachFeedback && (
          <p style={{ color: "var(--success)", fontSize: 13, margin: "8px 0 0 0" }}>{attachFeedback}</p>
        )}
      </div>

      {/* Target Profile Dossier Card if Loaded */}
      {result && (
        <div>
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              {result.profile.avatar_url ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={result.profile.avatar_url}
                    alt={result.profile.name || result.profile.screen_name}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: result.profile.type === "group" ? 8 : "50%",
                      objectFit: "cover",
                      border: "2px solid #0077FF",
                    }}
                  />
                  <button
                    onClick={() => handleAttachEvidence(result.profile.avatar_url!, `vk_avatar_${result.profile.screen_name}.jpg`)}
                    disabled={attachingMediaUrl === result.profile.avatar_url}
                    style={{
                      position: "absolute",
                      bottom: -8,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 10,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                      background: "rgba(0, 119, 255, 0.9)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Attach Avatar
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background: "rgba(0, 119, 255, 0.1)",
                    border: "2px dashed #0077FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <VkIcon size={32} color="#0077FF" />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, color: "var(--text)" }}>{result.profile.name}</h3>
                  <span style={{ color: "#0077FF", fontSize: 13, fontWeight: "bold" }}>
                    vk.com/{result.profile.screen_name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: result.profile.type === "group" ? "rgba(255, 170, 0, 0.15)" : "rgba(0, 119, 255, 0.15)",
                      color: result.profile.type === "group" ? "#FFAA00" : "#0077FF",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    {result.profile.type}
                  </span>
                  {result.profile.verified && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        background: "rgba(0, 200, 83, 0.15)",
                        color: "var(--success)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      <CheckIcon size={12} color="var(--success)" /> Verified
                    </span>
                  )}
                  <a
                    href={result.profile.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLinkIcon size={11} /> Open Profile
                  </a>
                </div>

                {/* Bio / Status */}
                {(result.profile.description || result.profile.status) && (
                  <p style={{ margin: "8px 0", fontSize: 13, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                    {result.profile.description || result.profile.status}
                  </p>
                )}

                {/* Attributes Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                    marginTop: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ background: "var(--bg)", padding: "6px 10px", borderRadius: 4 }}>
                    <span style={{ color: "var(--text-muted)" }}>Owner ID: </span>
                    <strong style={{ color: "var(--text)" }}>{result.profile.owner_id}</strong>
                  </div>

                  <div style={{ background: "var(--bg)", padding: "6px 10px", borderRadius: 4 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {result.profile.type === "group" ? "Members: " : "Followers: "}
                    </span>
                    <strong style={{ color: "var(--cyan)" }}>
                      {result.profile.followers_or_members.toLocaleString()}
                    </strong>
                  </div>

                  {(result.profile.city || result.profile.country) && (
                    <div style={{ background: "var(--bg)", padding: "6px 10px", borderRadius: 4 }}>
                      <span style={{ color: "var(--text-muted)" }}>Location: </span>
                      <strong style={{ color: "var(--text)" }}>
                        {[result.profile.city, result.profile.country].filter(Boolean).join(", ")}
                      </strong>
                    </div>
                  )}

                  {result.profile.bdate && (
                    <div style={{ background: "var(--bg)", padding: "6px 10px", borderRadius: 4 }}>
                      <span style={{ color: "var(--text-muted)" }}>Birthdate: </span>
                      <strong style={{ color: "var(--text)" }}>{result.profile.bdate}</strong>
                    </div>
                  )}

                  {result.profile.site && (
                    <div style={{ background: "var(--bg)", padding: "6px 10px", borderRadius: 4 }}>
                      <span style={{ color: "var(--text-muted)" }}>Site: </span>
                      <a href={result.profile.site} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                        {result.profile.site}
                      </a>
                    </div>
                  )}
                </div>

                {/* Contacts List if any */}
                {result.profile.contacts.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>Contacts: </span>
                    {result.profile.contacts.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          marginRight: 8,
                          background: "var(--bg)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--panel-border)",
                        }}
                      >
                        {c.value}
                      </span>
                    ))}
                  </div>
                )}

                {/* Save Profile to Case */}
                <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
                  <SaveToCaseButton
                    identifierType={result.profile.type === "group" ? "corporate" : "person"}
                    identifierValue={result.profile.name || result.profile.screen_name}
                    platform="vkontakte"
                    url={result.profile.url}
                    discoveredBy="VkUltimateHarvester"
                    metadata={{
                      owner_id: result.profile.owner_id,
                      screen_name: result.profile.screen_name,
                      type: result.profile.type,
                      followers_or_members: result.profile.followers_or_members,
                      city: result.profile.city,
                      country: result.profile.country,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Forensic Tabs Switcher */}
          <div
            style={{
              display: "flex",
              gap: 8,
              borderBottom: "1px solid var(--panel-border)",
              marginBottom: 16,
              overflowX: "auto",
            }}
          >
            {[
              { id: "wall", label: `Wall Posts (${result.messages.length})` },
              { id: "pivots", label: `OSINT Pivots & Arsenal (${activePivots.length})` },
              { id: "crypto", label: `Crypto Wallets (${result.aggregated_intel.crypto_wallets.length})` },
              { id: "comms", label: `Communications (${result.aggregated_intel.emails.length + result.aggregated_intel.phones.length + result.aggregated_intel.mentions.length})` },
              { id: "reposts", label: `Repost Network (${result.stats.reposts_count})` },
              { id: "links", label: `Web & Onions (${result.aggregated_intel.onion_links.length + result.aggregated_intel.urls.length})` },
              { id: "tags", label: `Hashtags (${result.aggregated_intel.hashtags.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                style={{
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === t.id ? "2px solid #0077FF" : "2px solid transparent",
                  color: activeTab === t.id ? "#0077FF" : "var(--text-muted)",
                  fontWeight: activeTab === t.id ? "bold" : "normal",
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: WALL STREAM */}
          {activeTab === "wall" && (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter posts by keyword or regex..."
                  style={{ flex: 1, padding: "6px 12px" }}
                />
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={mediaOnly} onChange={(e) => setMediaOnly(e.target.checked)} />
                  Media attachments only
                </label>
              </div>

              {filteredPosts.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No wall posts match criteria.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {filteredPosts.map((post) => (
                    <div
                      key={post.post_id}
                      style={{
                        background: "var(--panel)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: 6,
                        padding: 14,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <a
                            href={post.post_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#0077FF", fontSize: 12, fontWeight: "bold", textDecoration: "none" }}
                          >
                            Post #{post.post_id}
                          </a>
                          {post.date_utc && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                              <ClockIcon size={11} />
                              {new Date(post.date_utc).toLocaleString()}
                            </span>
                          )}
                          {post.is_repost && (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 3,
                                background: "rgba(255, 170, 0, 0.15)",
                                color: "#FFAA00",
                              }}
                            >
                              Repost
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                          <span>Likes: <strong style={{ color: "var(--text)" }}>{post.likes.toLocaleString()}</strong></span>
                          <span>Views: <strong style={{ color: "var(--text)" }}>{post.views.toLocaleString()}</strong></span>
                          <span>Shares: <strong style={{ color: "var(--text)" }}>{post.reposts.toLocaleString()}</strong></span>
                        </div>
                      </div>

                      {post.repost_origin && (
                        <div
                          style={{
                            background: "rgba(255, 170, 0, 0.08)",
                            borderLeft: "3px solid #FFAA00",
                            padding: "6px 10px",
                            marginBottom: 8,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: "#FFAA00", fontWeight: "bold" }}>Forwarded from: </span>
                          <a
                            href={post.repost_origin.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--cyan)", textDecoration: "none" }}
                          >
                            wall{post.repost_origin.owner_id}_{post.repost_origin.post_id}
                          </a>
                        </div>
                      )}

                      {post.text && (
                        <p style={{ margin: "6px 0", fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                          {post.text}
                        </p>
                      )}

                      {post.attachments.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {post.attachments.map((att, attIdx) => (
                            <div
                              key={attIdx}
                              style={{
                                background: "var(--bg)",
                                border: "1px solid var(--panel-border)",
                                borderRadius: 6,
                                padding: 8,
                                maxWidth: 280,
                              }}
                            >
                              {att.type === "photo" && att.url && (
                                <div>
                                  <img
                                    src={att.url}
                                    alt="VK Wall Photo"
                                    style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 4 }}
                                  />
                                  <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Photo CDN</span>
                                    <button
                                      onClick={() => handleAttachEvidence(att.url!, `vk_photo_${post.post_id}_${attIdx}.jpg`)}
                                      disabled={attachingMediaUrl === att.url}
                                      style={{
                                        fontSize: 10,
                                        padding: "2px 6px",
                                        background: "#0077FF",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 3,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Attach Evidence
                                    </button>
                                  </div>
                                </div>
                              )}

                              {att.type === "video" && (
                                <div>
                                  {att.thumbnail_url && (
                                    <img
                                      src={att.thumbnail_url}
                                      alt={att.title || "VK Video"}
                                      style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 4 }}
                                    />
                                  )}
                                  <div style={{ marginTop: 4 }}>
                                    <strong style={{ fontSize: 12, color: "var(--text)" }}>{att.title || "Video"}</strong>
                                    {att.duration && (
                                      <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>
                                        ({Math.floor(att.duration / 60)}m {att.duration % 60}s)
                                      </span>
                                    )}
                                  </div>
                                  {att.video_url && (
                                    <a
                                      href={att.video_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: 11, color: "var(--cyan)", display: "block", marginTop: 4 }}
                                    >
                                      Open Video ↗
                                    </a>
                                  )}
                                </div>
                              )}

                              {att.type === "link" && (
                                <div style={{ fontSize: 11 }}>
                                  <span style={{ color: "var(--text-muted)" }}>Link: </span>
                                  <a href={att.url} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                                    {att.title || att.url}
                                  </a>
                                </div>
                              )}

                              {att.type === "doc" && (
                                <div style={{ fontSize: 11 }}>
                                  <span style={{ color: "var(--text-muted)" }}>Doc: </span>
                                  <a href={att.url} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                                    {att.title || "Download Document"}
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {post.entities.btc.length > 0 && <span style={{ fontSize: 10, background: "#f7931a22", color: "#f7931a", padding: "1px 5px", borderRadius: 3 }}>BTC</span>}
                          {post.entities.eth.length > 0 && <span style={{ fontSize: 10, background: "#627eea22", color: "#627eea", padding: "1px 5px", borderRadius: 3 }}>ETH</span>}
                          {post.entities.emails.length > 0 && <span style={{ fontSize: 10, background: "rgba(0, 200, 83, 0.15)", color: "var(--success)", padding: "1px 5px", borderRadius: 3 }}>Email</span>}
                          {post.entities.phones.length > 0 && <span style={{ fontSize: 10, background: "rgba(0, 119, 255, 0.15)", color: "#0077FF", padding: "1px 5px", borderRadius: 3 }}>Phone</span>}
                          {post.entities.onion_links.length > 0 && <span style={{ fontSize: 10, background: "rgba(180, 0, 255, 0.15)", color: "#B400FF", padding: "1px 5px", borderRadius: 3 }}>Onion</span>}
                        </div>

                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={post.post_url}
                          platform="vkontakte"
                          url={post.post_url}
                          discoveredBy="VkUltimateHarvester"
                          metadata={{
                            post_id: post.post_id,
                            views: post.views,
                            likes: post.likes,
                            date_utc: post.date_utc,
                            text: post.text.substring(0, 200),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: OSINT ARSENAL & PIVOTS */}
          {activeTab === "pivots" && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ margin: "0 0 4px 0", color: "var(--text)" }}>VKontakte Specialized OSINT Arsenal</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  Curated external databases, historical registries, telegram bots, and search engines pre-configured for{" "}
                  <strong style={{ color: "var(--cyan)" }}>{result.profile.screen_name || result.target}</strong>.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {activePivots.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 6,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <h4 style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>{p.name}</h4>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: "rgba(0, 119, 255, 0.15)",
                            color: "#0077FF",
                            fontWeight: "bold",
                          }}
                        >
                          {p.category}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {p.description}
                      </p>
                    </div>

                    <div style={{ paddingTop: 8, borderTop: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            padding: "4px 8px",
                            background: "rgba(0, 119, 255, 0.2)",
                            color: "#0077FF",
                            borderRadius: 4,
                            textDecoration: "none",
                            fontWeight: "bold",
                          }}
                        >
                          <ExternalLinkIcon size={11} /> Launch Pivot ↗
                        </a>
                        <button
                          onClick={() => handleCopy(p.url)}
                          style={{
                            fontSize: 10,
                            padding: "4px 8px",
                            background: "transparent",
                            color: copiedUrl === p.url ? "var(--success)" : "var(--text-muted)",
                            border: "1px solid var(--panel-border)",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          {copiedUrl === p.url ? "Copied!" : "Copy URL"}
                        </button>
                      </div>

                      <SaveToCaseButton
                        identifierType="url"
                        identifierValue={p.url}
                        platform="vk_osint_tool"
                        discoveredBy="VkOsintArsenal"
                        metadata={{ tool_name: p.name, category: p.category }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CRYPTO WALLETS */}
          {activeTab === "crypto" && (
            <div>
              {result.aggregated_intel.crypto_wallets.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No cryptocurrency wallets identified.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.aggregated_intel.crypto_wallets.map((addr, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--panel)",
                        border: "1px solid var(--panel-border)",
                        padding: "10px 14px",
                        borderRadius: 6,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--cyan)", fontWeight: "bold" }}>
                          {addr}
                        </span>
                      </div>
                      <SaveToCaseButton
                        identifierType="crypto"
                        identifierValue={addr}
                        platform="vkontakte"
                        discoveredBy="VkUltimateHarvester"
                        metadata={{ source_target: result.target }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMMUNICATIONS */}
          {activeTab === "comms" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h4 style={{ color: "var(--text)", margin: "0 0 8px 0" }}>Emails Identified</h4>
                {result.aggregated_intel.emails.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>None found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.aggregated_intel.emails.map((e, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--panel-border)",
                          padding: "8px 12px",
                          borderRadius: 4,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--text)" }}>{e}</span>
                        <SaveToCaseButton
                          identifierType="email"
                          identifierValue={e}
                          platform="vkontakte"
                          discoveredBy="VkUltimateHarvester"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ color: "var(--text)", margin: "0 0 8px 0" }}>Phone Numbers</h4>
                {result.aggregated_intel.phones.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>None found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.aggregated_intel.phones.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--panel-border)",
                          padding: "8px 12px",
                          borderRadius: 4,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--text)" }}>{p}</span>
                        <SaveToCaseButton
                          identifierType="phone"
                          identifierValue={p}
                          platform="vkontakte"
                          discoveredBy="VkUltimateHarvester"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ color: "var(--text)", margin: "0 0 8px 0" }}>Mentions & Cross-Platform Handles</h4>
                {result.aggregated_intel.mentions.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>None found.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.aggregated_intel.mentions.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--panel-border)",
                          padding: "4px 10px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#0077FF" }}>@{m}</span>
                        <SaveToCaseButton
                          identifierType="username"
                          identifierValue={m}
                          platform="vkontakte"
                          discoveredBy="VkUltimateHarvester"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: REPOSTS */}
          {activeTab === "reposts" && (
            <div>
              {result.messages.filter((p) => p.is_repost && p.repost_origin).length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No reposted content in scraped batch.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.messages
                    .filter((p) => p.is_repost && p.repost_origin)
                    .map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--panel-border)",
                          padding: 12,
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#FFAA00", fontWeight: "bold" }}>
                            Origin: wall{p.repost_origin!.owner_id}_{p.repost_origin!.post_id}
                          </span>
                          <a
                            href={p.repost_origin!.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--cyan)", fontSize: 11 }}
                          >
                            Open Origin Post ↗
                          </a>
                        </div>
                        {p.repost_origin!.text && (
                          <p style={{ margin: "6px 0", fontSize: 12, color: "var(--text-muted)" }}>
                            {p.repost_origin!.text}
                          </p>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <SaveToCaseButton
                            identifierType="url"
                            identifierValue={p.repost_origin!.url}
                            platform="vkontakte"
                            discoveredBy="VkUltimateHarvester_RepostOrigin"
                            metadata={{ origin_owner_id: p.repost_origin!.owner_id }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: LINKS & ONIONS */}
          {activeTab === "links" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h4 style={{ color: "#B400FF", margin: "0 0 8px 0" }}>Dark Web (.onion) Links</h4>
                {result.aggregated_intel.onion_links.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>None detected.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.aggregated_intel.onion_links.map((on, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--panel-border)",
                          padding: "8px 12px",
                          borderRadius: 4,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, fontFamily: "monospace", color: "#B400FF" }}>{on}</span>
                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={on}
                          platform="darkweb_onion"
                          discoveredBy="VkUltimateHarvester"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ color: "var(--text)", margin: "0 0 8px 0" }}>External Clearnet URLs</h4>
                {result.aggregated_intel.urls.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12 }}>None detected.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.aggregated_intel.urls.slice(0, 30).map((u, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--panel-border)",
                          padding: "8px 12px",
                          borderRadius: 4,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, color: "var(--cyan)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}
                        >
                          {u}
                        </a>
                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={u}
                          platform="web"
                          discoveredBy="VkUltimateHarvester"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: HASHTAGS */}
          {activeTab === "tags" && (
            <div>
              {result.aggregated_intel.hashtags.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No hashtags identified.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.aggregated_intel.hashtags.map((h, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: "rgba(0, 119, 255, 0.1)",
                        color: "#0077FF",
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 12,
                        border: "1px solid rgba(0, 119, 255, 0.3)",
                      }}
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Standalone Toolkit Preview if no target is loaded */}
      {!result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: "var(--text)", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldIcon size={15} color="#0077FF" />
              Specialized VKontakte OSINT Tool Directory (12 Tools)
            </h3>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Search engines, archives, biometrics, and Telegram investigation bots
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {DEFAULT_VK_TOOLS.map((tool, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 6,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <h4 style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>{tool.name}</h4>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "rgba(0, 119, 255, 0.15)",
                        color: "#0077FF",
                        fontWeight: "bold",
                      }}
                    >
                      {tool.category}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {tool.description}
                  </p>
                </div>

                <div style={{ paddingTop: 8, borderTop: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        padding: "4px 8px",
                        background: "rgba(0, 119, 255, 0.2)",
                        color: "#0077FF",
                        borderRadius: 4,
                        textDecoration: "none",
                        fontWeight: "bold",
                      }}
                    >
                      <ExternalLinkIcon size={11} /> Launch Tool ↗
                    </a>
                    <button
                      onClick={() => handleCopy(tool.url)}
                      style={{
                        fontSize: 10,
                        padding: "4px 8px",
                        background: "transparent",
                        color: copiedUrl === tool.url ? "var(--success)" : "var(--text-muted)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      {copiedUrl === tool.url ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  <SaveToCaseButton
                    identifierType="url"
                    identifierValue={tool.url}
                    platform="vk_osint_tool"
                    discoveredBy="VkOsintArsenal"
                    metadata={{ tool_name: tool.name, category: tool.category }}
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
