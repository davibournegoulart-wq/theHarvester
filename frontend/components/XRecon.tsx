"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  XIcon,
  SearchIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  ShieldIcon,
  LockIcon,
  RefreshCwIcon,
  UserIcon,
  BotIcon,
  HeartIcon,
  RetweetIcon,
} from "./FlatIcons";

type XEntities = {
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

type XProfile = {
  screen_name: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  joined: string;
  tweets_count: number;
  avatar_url: string;
  raw_avatar_url: string;
  banner_url: string;
  url: string;
};

type XTweet = {
  id: string;
  text: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  media_urls: string[];
  url: string;
};

type BotAnalysis = {
  score: number;
  classification: string;
  color: string;
  flags: string[];
};

type XPivotItem = {
  name: string;
  url: string;
  category: string;
  description: string;
};

type XProfileScrapeResponse = {
  scrape_type: "profile" | "tweet";
  target: string;
  profile: XProfile;
  tweets: XTweet[];
  total_scraped: number;
  bot_analysis: BotAnalysis;
  aggregated_intel: XEntities;
  stats: {
    followers: number;
    following: number;
    tweets_count: number;
    timeline_scraped: number;
    media_tweets_count: number;
    wallets_count: number;
    emails_count: number;
    phones_count: number;
    urls_count: number;
  };
  osint_pivots: XPivotItem[];
  single_tweet?: {
    tweet_id: string;
    url: string;
    text: string;
    created_at: string;
    likes: number;
    retweets: number;
    replies: number;
    media_urls: string[];
    author: {
      name: string;
      screen_name: string;
      avatar_url: string;
      banner_url: string;
      url: string;
    };
    entities: XEntities;
    osint_pivots: XPivotItem[];
  };
};

type XSingleTweetResponse = {
  tweet_id: string;
  url: string;
  text: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  media_urls: string[];
  author: {
    name: string;
    screen_name: string;
    avatar_url: string;
    banner_url: string;
    url: string;
  };
  entities: XEntities;
  osint_pivots: XPivotItem[];
};

const DEFAULT_X_TOOLS: XPivotItem[] = [
  {
    name: "Foller.me",
    category: "Behavior & Topic Analytics",
    url: "https://foller.me/",
    description: "Analyze Twitter account topics, top mentions, active hours, hashtag clouds, and usage habits.",
  },
  {
    name: "Twitonomy",
    category: "Deep Profile Analytics",
    url: "https://www.twitonomy.com/",
    description: "Visual analytics on tweets, retweets, replies, mentions, hashtags, platforms, and follower engagement graphs.",
  },
  {
    name: "Bot Sentinel",
    category: "Bot & Inauthenticity Detection",
    url: "https://botsentinel.com/",
    description: "Machine-learning assessment of automated accounts, disruptive troll behavior, and coordinated bot activity.",
  },
  {
    name: "Wayback Tweets",
    category: "Deleted Tweet Recovery",
    url: "https://waybacktweets.streamlit.app/",
    description: "Retrieve deleted, modified, or historical tweets from the Internet Archive Wayback Machine.",
  },
  {
    name: "BirdHunt",
    category: "Geospatial Recon",
    url: "https://birdhunt.huntintel.io/",
    description: "Search historical tweets by geographic location, coordinate radius, and chronological time windows.",
  },
  {
    name: "Nitter Instance",
    category: "Alternative Frontend",
    url: "https://nitter.net/",
    description: "Free and open source alternative Twitter front-end focused on privacy, zero tracking, and performance.",
  },
  {
    name: "Twint",
    category: "No-API Scraping Methodology",
    url: "https://github.com/twintproject/twint",
    description: "Advanced open-source Twitter intelligence tool allowing deep timeline scraping without API rate limits.",
  },
  {
    name: "snscrape",
    category: "CLI Scraper & Archival",
    url: "https://github.com/JustAnotherArchivist/snscrape",
    description: "Specialized social network scraper for Python targeting profiles, hashtags, searches, and conversation threads.",
  },
  {
    name: "Social Blade Twitter",
    category: "Growth & Auditing",
    url: "https://socialblade.com/twitter/",
    description: "Historical follower gains, daily fluctuation curves, engagement grading, and projected growth curves.",
  },
];

export default function XRecon() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"profile" | "tweet" | "tools">("profile");

  // Profile Search State
  const [targetInput, setTargetInput] = useState("");
  const [limit, setLimit] = useState(50);
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<XProfileScrapeResponse | null>(null);

  // Single Tweet Search State
  const [tweetInput, setTweetInput] = useState("");
  const [tweetLoading, setTweetLoading] = useState(false);
  const [tweetError, setTweetError] = useState<string | null>(null);
  const [singleTweetResult, setSingleTweetResult] = useState<XSingleTweetResponse | null>(null);

  // Evidence Attachment State
  const [attachingKey, setAttachingKey] = useState<string | null>(null);
  const [attachFeedback, setAttachFeedback] = useState<string | null>(null);

  async function handleProfileScrape() {
    if (!targetInput.trim()) return;
    setLoading(true);
    setError(null);
    setAttachFeedback(null);

    try {
      const data = await apiGet<XProfileScrapeResponse>(
        `/recon/x/ultimate-scrape?target=${encodeURIComponent(targetInput.trim())}&limit=${limit}&use_tor=${useTor}`
      );
      if (data.scrape_type === "tweet" && data.single_tweet) {
        setSingleTweetResult(data.single_tweet);
        setActiveTab("tweet");
      } else {
        setScrapeResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error executing X / Twitter scrape");
    } finally {
      setLoading(false);
    }
  }

  async function handleTweetDetails(tweetIdOrUrl: string) {
    if (!tweetIdOrUrl.trim()) return;
    setTweetLoading(true);
    setTweetError(null);
    setAttachFeedback(null);
    setActiveTab("tweet");

    try {
      const data = await apiGet<XSingleTweetResponse>(
        `/recon/x/tweet-details?tweet_id=${encodeURIComponent(tweetIdOrUrl.trim())}&use_tor=${useTor}`
      );
      setSingleTweetResult(data);
    } catch (e) {
      setTweetError(e instanceof Error ? e.message : "Error retrieving tweet details");
    } finally {
      setTweetLoading(false);
    }
  }

  async function attachMediaToCase(url: string, filename: string, key: string) {
    if (!activeCase?.id) {
      setAttachFeedback("No active case selected. Please activate a case in Case Management.");
      return;
    }
    setAttachingKey(key);
    setAttachFeedback(null);
    try {
      await apiPostJson(
        `/recon/x/attach-evidence?case_id=${encodeURIComponent(activeCase.id)}&media_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`,
        {}
      );
      setAttachFeedback(`Successfully attached ${filename} to case "${activeCase.name}".`);
    } catch (e) {
      setAttachFeedback(e instanceof Error ? e.message : "Error attaching media to case evidence vault.");
    } finally {
      setAttachingKey(null);
    }
  }

  return (
    <div style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Sub-Header & Navigation Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          borderBottom: "1px solid var(--border-color, #27272a)",
          paddingBottom: "12px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: "#f4f4f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, letterSpacing: "0.5px" }}>
              X (TWITTER) ULTIMATE FORENSIC RECON
            </h2>
            <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
              Non-API Ingestion • Timeline Scraping • Bot Sentinel Authenticity • Multi-Chain Forensic Intel
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: activeTab === "profile" ? "#f4f4f5" : "var(--card-bg, #18181b)",
              color: activeTab === "profile" ? "#09090b" : "#a1a1aa",
            }}
          >
            <UserIcon size={13} />
            PROFILE & TIMELINE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tweet")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: activeTab === "tweet" ? "#f4f4f5" : "var(--card-bg, #18181b)",
              color: activeTab === "tweet" ? "#09090b" : "#a1a1aa",
            }}
          >
            <XIcon size={13} />
            TWEET DEEP DIVE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: activeTab === "tools" ? "#f4f4f5" : "var(--card-bg, #18181b)",
              color: activeTab === "tools" ? "#09090b" : "#a1a1aa",
            }}
          >
            <ShieldIcon size={13} />
            OSINT ARSENAL ({DEFAULT_X_TOOLS.length})
          </button>
        </div>
      </div>

      {/* Active Case Banner */}
      {activeCase ? (
        <div
          style={{
            padding: "8px 14px",
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
            borderRadius: "6px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>ACTIVE CASE VAULT:</span>
            <span style={{ color: "#f4f4f5", fontWeight: 600 }}>{activeCase.name}</span>
            <span style={{ color: "#71717a", fontFamily: "monospace" }}>({activeCase.id.slice(0, 8)}...)</span>
          </div>
          <span style={{ color: "#a1a1aa", fontSize: "11px" }}>
            1-Click evidence attachments directly vault avatars, banners, and tweet media.
          </span>
        </div>
      ) : (
        <div
          style={{
            padding: "8px 14px",
            backgroundColor: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.25)",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "12px",
            color: "#eab308",
          }}
        >
          <strong>No Active Case Selected:</strong> Open Case Management to bind an active case for 1-click media vaulting.
        </div>
      )}

      {/* Global Feedback Banner */}
      {attachFeedback && (
        <div
          style={{
            padding: "8px 14px",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "12px",
            color: "#60a5fa",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckIcon size={14} color="#60a5fa" />
          {attachFeedback}
        </div>
      )}

      {/* TAB 1: PROFILE & TIMELINE STREAM */}
      {activeTab === "profile" && (
        <div>
          {/* Search Controls */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--card-bg, #18181b)",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #27272a)",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "300px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "4px", fontWeight: 600 }}>
                  X / TWITTER TARGET (USERNAME, PROFILE URL, OR TWEET URL)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="e.g. @bellingcat, elonmusk, https://x.com/nasa, or status URL"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleProfileScrape()}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 34px",
                      borderRadius: "6px",
                      backgroundColor: "var(--input-bg, #09090b)",
                      border: "1px solid var(--border-color, #3f3f46)",
                      color: "#f4f4f5",
                      fontSize: "13px",
                      fontFamily: "monospace",
                    }}
                  />
                  <div style={{ position: "absolute", left: "10px", top: "11px", color: "#71717a" }}>
                    <SearchIcon size={14} />
                  </div>
                </div>
              </div>

              <div style={{ width: "120px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "4px", fontWeight: 600 }}>
                  MAX TWEETS
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--input-bg, #09090b)",
                    border: "1px solid var(--border-color, #3f3f46)",
                    color: "#f4f4f5",
                    fontSize: "13px",
                  }}
                >
                  <option value={20}>20 Tweets</option>
                  <option value={50}>50 Tweets</option>
                  <option value={100}>100 Tweets</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "18px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: "#d4d4d8" }}>
                  <input
                    type="checkbox"
                    checked={useTor}
                    onChange={(e) => setUseTor(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <LockIcon size={12} color={useTor ? "#22c55e" : "#71717a"} />
                  Tor Proxy (9050)
                </label>
              </div>

              <div style={{ paddingTop: "18px" }}>
                <button
                  type="button"
                  onClick={handleProfileScrape}
                  disabled={loading || !targetInput.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 20px",
                    borderRadius: "6px",
                    backgroundColor: "#f4f4f5",
                    color: "#09090b",
                    fontWeight: 700,
                    fontSize: "13px",
                    border: "none",
                    cursor: loading || !targetInput.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !targetInput.trim() ? 0.6 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCwIcon size={14} className="spin" />
                      SCRAPING TIMELINE...
                    </>
                  ) : (
                    <>
                      <XIcon size={14} />
                      LAUNCH RECON
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "6px",
                color: "#ef4444",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              <strong>Recon Error:</strong> {error}
            </div>
          )}

          {/* Profile Dossier */}
          {scrapeResult && (
            <div>
              {/* Profile Card */}
              <div
                style={{
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  overflow: "hidden",
                  marginBottom: "20px",
                }}
              >
                {/* Banner */}
                {scrapeResult.profile.banner_url && (
                  <div
                    style={{
                      height: "160px",
                      width: "100%",
                      backgroundImage: `url(${scrapeResult.profile.banner_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        attachMediaToCase(
                          scrapeResult.profile.banner_url,
                          `${scrapeResult.profile.screen_name}_banner.jpg`,
                          "banner"
                        )
                      }
                      disabled={attachingKey === "banner"}
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        padding: "5px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: "rgba(0,0,0,0.75)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {attachingKey === "banner" ? "Vaulting..." : "Attach Banner to Case"}
                    </button>
                  </div>
                )}

                {/* Profile Header Bar */}
                <div style={{ padding: "20px", position: "relative" }}>
                  <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* Avatar */}
                    {scrapeResult.profile.avatar_url && (
                      <div style={{ position: "relative", marginTop: scrapeResult.profile.banner_url ? "-50px" : "0" }}>
                        <img
                          src={scrapeResult.profile.avatar_url}
                          alt={scrapeResult.profile.name}
                          style={{
                            width: "90px",
                            height: "90px",
                            borderRadius: "50%",
                            border: "3px solid #18181b",
                            backgroundColor: "#27272a",
                            objectFit: "cover",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            attachMediaToCase(
                              scrapeResult.profile.avatar_url,
                              `${scrapeResult.profile.screen_name}_avatar.jpg`,
                              "avatar"
                            )
                          }
                          disabled={attachingKey === "avatar"}
                          title="Vault Avatar to Case"
                          style={{
                            position: "absolute",
                            bottom: "0",
                            right: "0",
                            padding: "4px 8px",
                            fontSize: "10px",
                            fontWeight: 600,
                            backgroundColor: "#f4f4f5",
                            color: "#09090b",
                            border: "none",
                            borderRadius: "12px",
                            cursor: "pointer",
                          }}
                        >
                          {attachingKey === "avatar" ? "..." : "+ Vault"}
                        </button>
                      </div>
                    )}

                    {/* Profile Information */}
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "#f4f4f5" }}>
                          {scrapeResult.profile.name}
                        </h1>
                        <span style={{ fontSize: "14px", color: "#a1a1aa", fontFamily: "monospace" }}>
                          @{scrapeResult.profile.screen_name}
                        </span>
                      </div>

                      {/* Metrics Bar */}
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: "#a1a1aa", flexWrap: "wrap" }}>
                        <span>
                          <strong>Followers:</strong>{" "}
                          <span style={{ color: "#22c55e", fontWeight: 700 }}>
                            {scrapeResult.profile.followers.toLocaleString()}
                          </span>
                        </span>
                        <span>
                          <strong>Following:</strong>{" "}
                          <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                            {scrapeResult.profile.following.toLocaleString()}
                          </span>
                        </span>
                        <span>
                          <strong>Total Tweets:</strong>{" "}
                          <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                            {scrapeResult.profile.tweets_count.toLocaleString()}
                          </span>
                        </span>
                        {scrapeResult.profile.joined && (
                          <span>
                            <strong>Joined:</strong> {scrapeResult.profile.joined}
                          </span>
                        )}
                      </div>

                      {/* Bio */}
                      {scrapeResult.profile.bio && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "10px 14px",
                            backgroundColor: "var(--input-bg, #09090b)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#d4d4d8",
                            lineHeight: "1.5",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {scrapeResult.profile.bio}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
                        <a
                          href={scrapeResult.profile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            color: "#f4f4f5",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLinkIcon size={12} />
                          Open Profile on X
                        </a>

                        <SaveToCaseButton
                          identifierType="username"
                          identifierValue={`@${scrapeResult.profile.screen_name}`}
                          platform="x_twitter"
                          url={scrapeResult.profile.url}
                          discoveredBy="XUltimateScraper"
                          metadata={{
                            name: scrapeResult.profile.name,
                            screen_name: scrapeResult.profile.screen_name,
                            followers: scrapeResult.profile.followers,
                            following: scrapeResult.profile.following,
                            total_tweets: scrapeResult.profile.tweets_count,
                          }}
                        />
                      </div>
                    </div>

                    {/* Bot Sentinel Authenticity Gauge */}
                    <div
                      style={{
                        width: "240px",
                        padding: "12px",
                        backgroundColor: "var(--input-bg, #09090b)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color, #27272a)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#a1a1aa", display: "flex", alignItems: "center", gap: "4px" }}>
                          <BotIcon size={13} color={scrapeResult.bot_analysis.color} />
                          BOT SENTINEL RATING
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: `${scrapeResult.bot_analysis.color}20`,
                            color: scrapeResult.bot_analysis.color,
                          }}
                        >
                          {scrapeResult.bot_analysis.score}/100
                        </span>
                      </div>

                      <div style={{ fontSize: "13px", fontWeight: 700, color: scrapeResult.bot_analysis.color }}>
                        {scrapeResult.bot_analysis.classification}
                      </div>

                      {scrapeResult.bot_analysis.flags.length > 0 ? (
                        <div style={{ fontSize: "10px", color: "#a1a1aa", marginTop: "4px" }}>
                          {scrapeResult.bot_analysis.flags.map((f, i) => (
                            <div key={i} style={{ marginBottom: "2px" }}>• {f}</div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: "10px", color: "#22c55e" }}>
                          ✓ Authentic posting velocity and organic follower metrics.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aggregated Forensic Intel Panel */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  marginBottom: "20px",
                }}
              >
                <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 12px 0", color: "#f4f4f5", letterSpacing: "0.5px" }}>
                  FORENSIC ENTITIES DISCOVERED IN TIMELINE
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                  {/* Cryptographic Wallets */}
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--input-bg, #09090b)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color, #27272a)",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#eab308", marginBottom: "8px" }}>
                      CRYPTOGRAPHIC WALLETS ({scrapeResult.stats.wallets_count})
                    </div>
                    {scrapeResult.stats.wallets_count === 0 ? (
                      <div style={{ fontSize: "11px", color: "#71717a" }}>No crypto wallets detected in timeline.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {[
                          ...scrapeResult.aggregated_intel.btc.map((a) => ({ type: "BTC", address: a })),
                          ...scrapeResult.aggregated_intel.eth.map((a) => ({ type: "ETH", address: a })),
                          ...scrapeResult.aggregated_intel.tron.map((a) => ({ type: "TRON", address: a })),
                          ...scrapeResult.aggregated_intel.sol.map((a) => ({ type: "SOL", address: a })),
                        ].map((w, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "11px",
                              fontFamily: "monospace",
                              padding: "4px 8px",
                              backgroundColor: "#18181b",
                              borderRadius: "4px",
                            }}
                          >
                            <span style={{ color: "#eab308" }}>[{w.type}] {w.address}</span>
                            <SaveToCaseButton
                              identifierType="crypto"
                              identifierValue={w.address}
                              platform="x_twitter"
                              discoveredBy="XUltimateScraper"
                              metadata={{ crypto_type: w.type }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Communication Contacts */}
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--input-bg, #09090b)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color, #27272a)",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", marginBottom: "8px" }}>
                      COMMUNICATION CONTACTS ({scrapeResult.stats.emails_count + scrapeResult.stats.phones_count})
                    </div>
                    {scrapeResult.stats.emails_count + scrapeResult.stats.phones_count === 0 ? (
                      <div style={{ fontSize: "11px", color: "#71717a" }}>No emails or phone numbers found in timeline.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {scrapeResult.aggregated_intel.emails.map((em, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "11px",
                              padding: "4px 8px",
                              backgroundColor: "#18181b",
                              borderRadius: "4px",
                            }}
                          >
                            <span style={{ color: "#38bdf8", fontFamily: "monospace" }}>{em}</span>
                            <SaveToCaseButton
                              identifierType="email"
                              identifierValue={em}
                              platform="x_twitter"
                              discoveredBy="XUltimateScraper"
                            />
                          </div>
                        ))}
                        {scrapeResult.aggregated_intel.phones.map((ph, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "11px",
                              padding: "4px 8px",
                              backgroundColor: "#18181b",
                              borderRadius: "4px",
                            }}
                          >
                            <span style={{ color: "#4ade80", fontFamily: "monospace" }}>{ph}</span>
                            <SaveToCaseButton
                              identifierType="phone"
                              identifierValue={ph}
                              platform="x_twitter"
                              discoveredBy="XUltimateScraper"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* External URLs & Links */}
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--input-bg, #09090b)",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color, #27272a)",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px" }}>
                      EXTERNAL IDENTIFIERS & PIVOTS ({scrapeResult.stats.urls_count})
                    </div>
                    {scrapeResult.stats.urls_count === 0 ? (
                      <div style={{ fontSize: "11px", color: "#71717a" }}>No external URLs found in timeline.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                        {scrapeResult.aggregated_intel.urls.map((u, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "11px",
                              padding: "4px 8px",
                              backgroundColor: "#18181b",
                              borderRadius: "4px",
                            }}
                          >
                            <a
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#a78bfa", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}
                            >
                              {u}
                            </a>
                            <SaveToCaseButton
                              identifierType="url"
                              identifierValue={u}
                              platform="x_twitter"
                              url={u}
                              discoveredBy="XUltimateScraper"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tweets Timeline Feed */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#f4f4f5" }}>
                    TIMELINE TWEETS FEED ({scrapeResult.tweets.length} POSTS)
                  </h3>
                  <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                    Click &quot;Inspect Tweet&quot; for single-post deep dive and high-res attachments
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {scrapeResult.tweets.map((tweet) => (
                    <div
                      key={tweet.id}
                      style={{
                        padding: "14px",
                        backgroundColor: "var(--input-bg, #09090b)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color, #27272a)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {/* Tweet Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                          <span style={{ fontWeight: 700, color: "#f4f4f5" }}>{scrapeResult.profile.name}</span>
                          <span style={{ color: "#71717a", fontFamily: "monospace" }}>@{scrapeResult.profile.screen_name}</span>
                          <span style={{ color: "#71717a" }}>•</span>
                          <span style={{ color: "#a1a1aa", fontSize: "11px" }}>{tweet.created_at}</span>
                        </div>

                        <span style={{ fontSize: "11px", color: "#71717a", fontFamily: "monospace" }}>
                          ID: {tweet.id}
                        </span>
                      </div>

                      {/* Tweet Content */}
                      <p style={{ fontSize: "13px", color: "#f4f4f5", lineHeight: "1.5", margin: 0, whiteSpace: "pre-wrap" }}>
                        {tweet.text}
                      </p>

                      {/* Photo / Media Grid */}
                      {tweet.media_urls?.length > 0 && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                          {tweet.media_urls.map((mUrl, mIdx) => (
                            <div key={mIdx} style={{ position: "relative", borderRadius: "6px", overflow: "hidden", maxWidth: "260px" }}>
                              <img
                                src={mUrl}
                                alt="Tweet Attachment"
                                style={{ width: "100%", maxHeight: "200px", objectFit: "cover", display: "block" }}
                              />
                              <button
                                type="button"
                                onClick={() => attachMediaToCase(mUrl, `x_tweet_${tweet.id}_${mIdx}.jpg`, `m_${tweet.id}_${mIdx}`)}
                                disabled={attachingKey === `m_${tweet.id}_${mIdx}`}
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  padding: "3px 6px",
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  backgroundColor: "rgba(0,0,0,0.75)",
                                  color: "#fff",
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  borderRadius: "3px",
                                  cursor: "pointer",
                                }}
                              >
                                {attachingKey === `m_${tweet.id}_${mIdx}` ? "..." : "+ Vault"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Metrics & Actions */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: "8px",
                          borderTop: "1px solid #1f1f23",
                          fontSize: "11px",
                          color: "#a1a1aa",
                        }}
                      >
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <HeartIcon size={12} color="#ef4444" />
                            {tweet.likes.toLocaleString()}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <RetweetIcon size={12} color="#22c55e" />
                            {tweet.retweets.toLocaleString()}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleTweetDetails(tweet.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: "rgba(255, 255, 255, 0.1)",
                              color: "#f4f4f5",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Inspect Tweet
                          </button>

                          <SaveToCaseButton
                            identifierType="url"
                            identifierValue={tweet.url}
                            platform="x_twitter"
                            url={tweet.url}
                            discoveredBy="XUltimateScraper"
                            metadata={{
                              tweet_id: tweet.id,
                              text: tweet.text,
                              likes: tweet.likes,
                              retweets: tweet.retweets,
                              date: tweet.created_at,
                            }}
                          />

                          <a
                            href={tweet.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#71717a", display: "flex", alignItems: "center" }}
                            title="Open Tweet on X"
                          >
                            <ExternalLinkIcon size={13} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* OSINT Pivots Section */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                }}
              >
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "#f4f4f5" }}>
                  TARGET-LINKED OSINT ARSENAL ({scrapeResult.osint_pivots.length} ENGINES)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
                  {scrapeResult.osint_pivots.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px",
                        backgroundColor: "var(--input-bg, #09090b)",
                        borderRadius: "6px",
                        border: "1px solid var(--border-color, #27272a)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#f4f4f5" }}>{p.name}</span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: "#f4f4f5",
                              backgroundColor: "rgba(255, 255, 255, 0.1)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {p.category}
                          </span>
                        </div>
                        <p style={{ fontSize: "11px", color: "#a1a1aa", margin: "0 0 10px 0", lineHeight: "1.4" }}>
                          {p.description}
                        </p>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #1f1f23" }}>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            color: "#f4f4f5",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Launch Engine <ExternalLinkIcon size={12} />
                        </a>
                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={p.url}
                          platform="x_twitter"
                          url={p.url}
                          discoveredBy="XUltimateScraper"
                          metadata={{ name: p.name, category: p.category }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SINGLE TWEET DEEP DIVE */}
      {activeTab === "tweet" && (
        <div>
          {/* Tweet Search Bar */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--card-bg, #18181b)",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #27272a)",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "300px" }}>
                <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "4px", fontWeight: 600 }}>
                  X / TWITTER TWEET URL OR STATUS ID
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="e.g. https://x.com/elonmusk/status/1519480761749016577 or 1519480761749016577"
                    value={tweetInput}
                    onChange={(e) => setTweetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTweetDetails(tweetInput)}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 34px",
                      borderRadius: "6px",
                      backgroundColor: "var(--input-bg, #09090b)",
                      border: "1px solid var(--border-color, #3f3f46)",
                      color: "#f4f4f5",
                      fontSize: "13px",
                      fontFamily: "monospace",
                    }}
                  />
                  <div style={{ position: "absolute", left: "10px", top: "11px", color: "#71717a" }}>
                    <XIcon size={14} />
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: "18px" }}>
                <button
                  type="button"
                  onClick={() => handleTweetDetails(tweetInput)}
                  disabled={tweetLoading || !tweetInput.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 20px",
                    borderRadius: "6px",
                    backgroundColor: "#f4f4f5",
                    color: "#09090b",
                    fontWeight: 700,
                    fontSize: "13px",
                    border: "none",
                    cursor: tweetLoading || !tweetInput.trim() ? "not-allowed" : "pointer",
                    opacity: tweetLoading || !tweetInput.trim() ? 0.6 : 1,
                  }}
                >
                  {tweetLoading ? (
                    <>
                      <RefreshCwIcon size={14} className="spin" />
                      FETCHING TWEET...
                    </>
                  ) : (
                    <>
                      <SearchIcon size={14} />
                      INSPECT TWEET
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tweet Error */}
          {tweetError && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "6px",
                color: "#ef4444",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              <strong>Analysis Error:</strong> {tweetError}
            </div>
          )}

          {/* Single Tweet Result */}
          {singleTweetResult && (
            <div>
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  marginBottom: "20px",
                }}
              >
                {/* Author Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {singleTweetResult.author.avatar_url && (
                      <img
                        src={singleTweetResult.author.avatar_url}
                        alt={singleTweetResult.author.name}
                        style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover" }}
                      />
                    )}
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>
                        {singleTweetResult.author.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "#a1a1aa", fontFamily: "monospace" }}>
                        @{singleTweetResult.author.screen_name}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
                    ID: {singleTweetResult.tweet_id}
                  </span>
                </div>

                {/* Tweet Text */}
                <div
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.6",
                    color: "#f4f4f5",
                    padding: "14px",
                    backgroundColor: "var(--input-bg, #09090b)",
                    borderRadius: "6px",
                    marginBottom: "16px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {singleTweetResult.text}
                </div>

                {/* Media Gallery */}
                {singleTweetResult.media_urls?.length > 0 && (
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                    {singleTweetResult.media_urls.map((mUrl, idx) => (
                      <div key={idx} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", maxWidth: "340px" }}>
                        <img src={mUrl} alt="Media" style={{ width: "100%", maxHeight: "260px", objectFit: "cover", display: "block" }} />
                        <button
                          type="button"
                          onClick={() => attachMediaToCase(mUrl, `tweet_${singleTweetResult.tweet_id}_${idx}.jpg`, `single_m_${idx}`)}
                          disabled={attachingKey === `single_m_${idx}`}
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            padding: "4px 8px",
                            fontSize: "10px",
                            fontWeight: 600,
                            backgroundColor: "rgba(0,0,0,0.8)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          {attachingKey === `single_m_${idx}` ? "..." : "+ Vault to Case"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Metrics Bar */}
                <div style={{ display: "flex", gap: "24px", fontSize: "13px", color: "#a1a1aa", marginBottom: "16px" }}>
                  <span>
                    <strong>Likes:</strong>{" "}
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>
                      {singleTweetResult.likes.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    <strong>Retweets:</strong>{" "}
                    <span style={{ color: "#22c55e", fontWeight: 700 }}>
                      {singleTweetResult.retweets.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    <strong>Replies:</strong>{" "}
                    <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                      {singleTweetResult.replies.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    <strong>Timestamp:</strong> {singleTweetResult.created_at}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #27272a" }}>
                  <SaveToCaseButton
                    identifierType="url"
                    identifierValue={singleTweetResult.url}
                    platform="x_twitter"
                    url={singleTweetResult.url}
                    discoveredBy="XUltimateScraper"
                    metadata={{
                      tweet_id: singleTweetResult.tweet_id,
                      author: singleTweetResult.author.screen_name,
                      text: singleTweetResult.text,
                      likes: singleTweetResult.likes,
                      retweets: singleTweetResult.retweets,
                      created_at: singleTweetResult.created_at,
                    }}
                  />

                  <a
                    href={singleTweetResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "#f4f4f5",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Open on X <ExternalLinkIcon size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CURATED OSINT ARSENAL */}
      {activeTab === "tools" && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "var(--card-bg, #18181b)",
            borderRadius: "8px",
            border: "1px solid var(--border-color, #27272a)",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px 0", color: "#f4f4f5" }}>
              CURATED X (TWITTER) OSINT ARSENAL
            </h3>
            <p style={{ fontSize: "12px", color: "#a1a1aa", margin: 0 }}>
              Specialized engines for non-API scraping, topic clustering, geolocation searches, deleted tweet retrieval, and bot detection.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px" }}>
            {DEFAULT_X_TOOLS.map((t, idx) => (
              <div
                key={idx}
                style={{
                  padding: "14px",
                  backgroundColor: "var(--input-bg, #09090b)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color, #27272a)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#f4f4f5" }}>{t.name}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#f4f4f5",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {t.category}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                    {t.description}
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #1f1f23" }}>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "#f4f4f5",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Launch Engine <ExternalLinkIcon size={12} />
                  </a>
                  <SaveToCaseButton
                    identifierType="url"
                    identifierValue={t.url}
                    platform="x_twitter"
                    url={t.url}
                    discoveredBy="XUltimateScraper"
                    metadata={{ name: t.name, category: t.category }}
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
