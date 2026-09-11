"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  YouTubeIcon,
  VideoIcon,
  SearchIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  ShieldIcon,
  LockIcon,
  ClosedCaptionsIcon,
  DownloadIcon,
  RefreshCwIcon,
  UserIcon,
} from "./FlatIcons";

type YouTubeEntities = {
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

type YouTubeChannelProfile = {
  channel_id: string;
  handle: string;
  title: string;
  vanity_url: string;
  channel_url: string;
  description: string;
  subscribers_count: string;
  video_count: string;
  verified: boolean;
  avatar_url: string;
  banner_url: string;
  keywords: string[];
};

type YouTubeVideoItem = {
  video_id: string;
  title: string;
  url: string;
  views_text: string;
  published_time_text: string;
  duration?: string;
  thumbnail_url: string;
  description_snippet?: string;
};

type TranscriptSnippet = {
  start: number;
  duration: number;
  text: string;
};

type VideoDetailsResponse = {
  video_id: string;
  url: string;
  title: string;
  author: string;
  channel_id: string;
  channel_url: string;
  length_seconds: number;
  duration_formatted: string;
  view_count: string;
  keywords: string[];
  description: string;
  thumbnail_url: string;
  maxres_thumbnail_url: string;
  hq_thumbnail_url: string;
  has_transcript: boolean;
  transcript_snippets_count: number;
  transcript: TranscriptSnippet[];
  full_transcript_text: string;
  entities: YouTubeEntities;
  osint_pivots: YouTubePivotItem[];
};

type YouTubePivotItem = {
  name: string;
  url: string;
  category: string;
  description: string;
};

type ChannelScrapeResponse = {
  scrape_type: "channel" | "video";
  target: string;
  channel_profile: YouTubeChannelProfile;
  videos: YouTubeVideoItem[];
  total_scraped: number;
  aggregated_intel: YouTubeEntities;
  stats: {
    subscribers: string;
    videos_count: string;
    scraped_videos_count: number;
    wallets_count: number;
    emails_count: number;
    phones_count: number;
    urls_count: number;
  };
  osint_pivots: YouTubePivotItem[];
  video_details?: VideoDetailsResponse;
};

const DEFAULT_YOUTUBE_TOOLS: YouTubePivotItem[] = [
  {
    name: "YouTube Metadata (Mattw.io)",
    category: "Deep Metadata & Tags",
    url: "https://mattw.io/youtube-metadata/",
    description: "Inspect complete backend metadata, EXIF tags, upload timestamps, raw thumbnail URLs, and technical properties.",
  },
  {
    name: "YouTube Geolocation (Mattw.io)",
    category: "Geospatial Recon",
    url: "https://mattw.io/youtube-geofind/location",
    description: "Discover geotagged YouTube videos by pinpoint coordinates, radius distance, and recording timestamps.",
  },
  {
    name: "YouTube Video Finder",
    category: "Deleted & Unlisted Finder",
    url: "https://findyoutubevideo.thetechrobo.ca/",
    description: "Multi-engine archival search across Wayback Machine, GhostArchive, Filmot, and archive.today to recover deleted videos.",
  },
  {
    name: "YTCommentSearch & Restrictions",
    category: "Comments & Regional Block",
    url: "https://polsy.org.uk/stuff/ytrestrict.cgi",
    description: "Check YouTube video regional blocking, country licensing restrictions, and advanced comment index search.",
  },
  {
    name: "Social Blade",
    category: "Growth Analytics & Auditing",
    url: "https://socialblade.com/youtube/",
    description: "Historical subscriber gains, daily view curves, estimated revenue, creator rankings, and network affiliation.",
  },
  {
    name: "Noxinfluencer",
    category: "Demographics & Valuation",
    url: "https://www.noxinfluencer.com/",
    description: "Audience demographics, active engagement rate, commercial price index, and brand collaboration intelligence.",
  },
  {
    name: "Channel Crawler",
    category: "Creator Search & Filtering",
    url: "https://channelcrawler.com/",
    description: "Multi-attribute creator discovery by category, country, subscriber threshold, and publication frequency.",
  },
  {
    name: "Filmot Subtitle Search",
    category: "Speech & Subtitle Archives",
    url: "https://filmot.com/",
    description: "Deep full-text search across hundreds of millions of video subtitles, transcripts, and speech records.",
  },
  {
    name: "Wayback Machine Archive",
    category: "Historical Archival",
    url: "https://web.archive.org/web/*/youtube.com/*",
    description: "Retrieve deleted channel bios, historical subscriber counts, removed videos, and previous channel branding.",
  },
];

export default function YouTubeRecon() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"channel" | "video" | "tools">("channel");

  // Channel Search State
  const [targetInput, setTargetInput] = useState("");
  const [limit, setLimit] = useState(30);
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelData, setChannelData] = useState<ChannelScrapeResponse | null>(null);

  // Video Deep-Dive State
  const [videoInput, setVideoInput] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoDetailsResponse | null>(null);
  const [transcriptFilter, setTranscriptFilter] = useState("");

  // Evidence Attachment State
  const [attachingKey, setAttachingKey] = useState<string | null>(null);
  const [attachFeedback, setAttachFeedback] = useState<string | null>(null);

  async function handleChannelScrape() {
    if (!targetInput.trim()) return;
    setLoading(true);
    setError(null);
    setAttachFeedback(null);

    try {
      const data = await apiGet<ChannelScrapeResponse>(
        `/recon/youtube/ultimate-scrape?target=${encodeURIComponent(targetInput.trim())}&limit=${limit}&use_tor=${useTor}`
      );
      if (data.scrape_type === "video" && data.video_details) {
        setVideoData(data.video_details);
        setActiveTab("video");
      } else {
        setChannelData(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed executing YouTube channel scrape");
    } finally {
      setLoading(false);
    }
  }

  async function handleVideoDetails(videoIdOrUrl: string) {
    if (!videoIdOrUrl.trim()) return;
    setVideoLoading(true);
    setVideoError(null);
    setAttachFeedback(null);
    setActiveTab("video");

    try {
      const data = await apiGet<VideoDetailsResponse>(
        `/recon/youtube/video-details?video_id=${encodeURIComponent(videoIdOrUrl.trim())}&use_tor=${useTor}`
      );
      setVideoData(data);
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : "Failed fetching video details and transcript");
    } finally {
      setVideoLoading(false);
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
        `/recon/youtube/attach-evidence?case_id=${encodeURIComponent(activeCase.id)}&media_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`,
        {}
      );
      setAttachFeedback(`Successfully vaulted ${filename} into case "${activeCase.name}".`);
    } catch (e) {
      setAttachFeedback(e instanceof Error ? e.message : "Error attaching media to case evidence vault.");
    } finally {
      setAttachingKey(null);
    }
  }

  // Filtered transcript snippets for in-transcript keyword search
  const filteredTranscript = videoData?.transcript?.filter((item) =>
    transcriptFilter ? item.text.toLowerCase().includes(transcriptFilter.toLowerCase()) : true
  ) || [];

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
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <YouTubeIcon size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, letterSpacing: "0.5px" }}>
              YOUTUBE ULTIMATE FORENSIC RECON
            </h2>
            <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
              Non-API Ingestion • Channel Dossier • Video Catalog • Speech Captions Forensics • Multi-Chain Intel
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("channel")}
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
              backgroundColor: activeTab === "channel" ? "#ef4444" : "var(--card-bg, #18181b)",
              color: activeTab === "channel" ? "#ffffff" : "#a1a1aa",
            }}
          >
            <UserIcon size={13} />
            CHANNEL DOSSIER
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("video")}
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
              backgroundColor: activeTab === "video" ? "#ef4444" : "var(--card-bg, #18181b)",
              color: activeTab === "video" ? "#ffffff" : "#a1a1aa",
            }}
          >
            <ClosedCaptionsIcon size={13} />
            VIDEO & SPEECH FORENSICS
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
              backgroundColor: activeTab === "tools" ? "#ef4444" : "var(--card-bg, #18181b)",
              color: activeTab === "tools" ? "#ffffff" : "#a1a1aa",
            }}
          >
            <ShieldIcon size={13} />
            OSINT ARSENAL ({DEFAULT_YOUTUBE_TOOLS.length})
          </button>
        </div>
      </div>

      {/* Active Case Context Bar */}
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
            1-Click evidence attachments directly link media into this case dossier.
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

      {/* TAB 1: CHANNEL DOSSIER */}
      {activeTab === "channel" && (
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
                  YOUTUBE TARGET (HANDLE, CHANNEL ID, OR URL)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="e.g. @Google, @MrBeast, UC..., or https://youtube.com/@handle"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChannelScrape()}
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
                  MAX VIDEOS
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
                  <option value={10}>10 Videos</option>
                  <option value={30}>30 Videos</option>
                  <option value={50}>50 Videos</option>
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
                  onClick={handleChannelScrape}
                  disabled={loading || !targetInput.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 20px",
                    borderRadius: "6px",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
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
                      SCRAPING IN PROGRESS...
                    </>
                  ) : (
                    <>
                      <YouTubeIcon size={14} />
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

          {/* Channel Data View */}
          {channelData && (
            <div>
              {/* Channel Profile Dossier Card */}
              <div
                style={{
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  overflow: "hidden",
                  marginBottom: "20px",
                }}
              >
                {/* High-Res Banner */}
                {channelData.channel_profile.banner_url && (
                  <div
                    style={{
                      height: "180px",
                      width: "100%",
                      backgroundImage: `url(${channelData.channel_profile.banner_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        attachMediaToCase(
                          channelData.channel_profile.banner_url,
                          `${channelData.channel_profile.handle || "youtube"}_banner.jpg`,
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
                    {/* High-Res Avatar */}
                    {channelData.channel_profile.avatar_url && (
                      <div style={{ position: "relative", marginTop: channelData.channel_profile.banner_url ? "-50px" : "0" }}>
                        <img
                          src={channelData.channel_profile.avatar_url}
                          alt={channelData.channel_profile.title}
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
                              channelData.channel_profile.avatar_url,
                              `${channelData.channel_profile.handle || "youtube"}_avatar.jpg`,
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
                            backgroundColor: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "12px",
                            cursor: "pointer",
                          }}
                        >
                          {attachingKey === "avatar" ? "..." : "+ Vault"}
                        </button>
                      </div>
                    )}

                    {/* Channel Titles & Stats */}
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "#f4f4f5" }}>
                          {channelData.channel_profile.title}
                        </h1>
                        {channelData.channel_profile.verified && (
                          <span
                            style={{
                              padding: "2px 6px",
                              backgroundColor: "rgba(59, 130, 246, 0.15)",
                              color: "#60a5fa",
                              fontSize: "11px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                            }}
                          >
                            VERIFIED
                          </span>
                        )}
                        <span style={{ fontSize: "13px", color: "#a1a1aa", fontFamily: "monospace" }}>
                          {channelData.channel_profile.handle}
                        </span>
                      </div>

                      {/* Channel IDs and Links */}
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: "#a1a1aa", flexWrap: "wrap" }}>
                        {channelData.channel_profile.channel_id && (
                          <span>
                            <strong>CID:</strong>{" "}
                            <span style={{ fontFamily: "monospace", color: "#f4f4f5" }}>
                              {channelData.channel_profile.channel_id}
                            </span>
                          </span>
                        )}
                        <span>
                          <strong>Subscribers:</strong>{" "}
                          <span style={{ color: "#22c55e", fontWeight: 700 }}>
                            {channelData.channel_profile.subscribers_count}
                          </span>
                        </span>
                        <span>
                          <strong>Videos:</strong>{" "}
                          <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                            {channelData.channel_profile.video_count}
                          </span>
                        </span>
                        <span>
                          <strong>Scraped Here:</strong>{" "}
                          <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                            {channelData.total_scraped}
                          </span>
                        </span>
                      </div>

                      {/* Description */}
                      {channelData.channel_profile.description && (
                        <div
                          style={{
                            marginTop: "12px",
                            padding: "10px 14px",
                            backgroundColor: "var(--input-bg, #09090b)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#d4d4d8",
                            lineHeight: "1.5",
                            whiteSpace: "pre-wrap",
                            maxHeight: "120px",
                            overflowY: "auto",
                          }}
                        >
                          {channelData.channel_profile.description}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center" }}>
                        <a
                          href={channelData.channel_profile.channel_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            color: "#ef4444",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLinkIcon size={12} />
                          Open Public Channel on YouTube
                        </a>

                        <SaveToCaseButton
                          identifierType="username"
                          identifierValue={channelData.channel_profile.handle || channelData.channel_profile.title}
                          platform="youtube"
                          url={channelData.channel_profile.channel_url}
                          discoveredBy="YouTubeUltimateScraper"
                          metadata={{
                            channel_id: channelData.channel_profile.channel_id,
                            title: channelData.channel_profile.title,
                            subscribers: channelData.channel_profile.subscribers_count,
                            videos_count: channelData.channel_profile.video_count,
                          }}
                        />
                      </div>
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
                  FORENSIC ENTITIES DISCOVERED IN DOSSIER
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
                      CRYPTOGRAPHIC WALLETS ({channelData.stats.wallets_count})
                    </div>
                    {channelData.stats.wallets_count === 0 ? (
                      <div style={{ fontSize: "11px", color: "#71717a" }}>No crypto wallets detected in profile text.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {[
                          ...channelData.aggregated_intel.btc.map((a) => ({ type: "BTC", address: a })),
                          ...channelData.aggregated_intel.eth.map((a) => ({ type: "ETH", address: a })),
                          ...channelData.aggregated_intel.tron.map((a) => ({ type: "TRON", address: a })),
                          ...channelData.aggregated_intel.sol.map((a) => ({ type: "SOL", address: a })),
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
                              platform="youtube"
                              discoveredBy="YouTubeUltimateScraper"
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
                      COMMUNICATION CONTACTS ({channelData.stats.emails_count + channelData.stats.phones_count})
                    </div>
                    {channelData.stats.emails_count + channelData.stats.phones_count === 0 ? (
                      <div style={{ fontSize: "11px", color: "#71717a" }}>No emails or phone numbers found in profile text.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {channelData.aggregated_intel.emails.map((em, i) => (
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
                              platform="youtube"
                              discoveredBy="YouTubeUltimateScraper"
                            />
                          </div>
                        ))}
                        {channelData.aggregated_intel.phones.map((ph, i) => (
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
                              platform="youtube"
                              discoveredBy="YouTubeUltimateScraper"
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
                      EXTERNAL IDENTIFIERS & PIVOTS ({channelData.stats.urls_count})
                    </div>
                    {channelData.stats.urls_count === 0 ? (
                      <div style={{ fontSize: "11px", color: "#71717a" }}>No external URLs found in profile text.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                        {channelData.aggregated_intel.urls.map((u, i) => (
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
                              platform="youtube"
                              url={u}
                              discoveredBy="YouTubeUltimateScraper"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Video Catalog Feed */}
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
                    LATEST VIDEOS FEED ({channelData.videos.length})
                  </h3>
                  <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                    Click &quot;Inspect &amp; Transcribe&quot; to perform speech forensics on any video
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {channelData.videos.map((vid) => (
                    <div
                      key={vid.video_id}
                      style={{
                        backgroundColor: "var(--input-bg, #09090b)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color, #27272a)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Thumbnail Container */}
                      <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", backgroundColor: "#18181b" }}>
                        <img
                          src={vid.thumbnail_url}
                          alt={vid.title}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {/* 1-Click Vault Thumbnail */}
                        <button
                          type="button"
                          onClick={() => attachMediaToCase(vid.thumbnail_url, `yt_thumb_${vid.video_id}.jpg`, `thumb_${vid.video_id}`)}
                          disabled={attachingKey === `thumb_${vid.video_id}`}
                          title="Vault Video Thumbnail"
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            padding: "4px 8px",
                            fontSize: "10px",
                            fontWeight: 600,
                            backgroundColor: "rgba(0,0,0,0.75)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          {attachingKey === `thumb_${vid.video_id}` ? "Vaulting..." : "+ Vault Thumb"}
                        </button>

                        {/* Views / Date Pill */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            left: "8px",
                            padding: "2px 6px",
                            backgroundColor: "rgba(0,0,0,0.8)",
                            color: "#f4f4f5",
                            fontSize: "10px",
                            borderRadius: "3px",
                            fontWeight: 600,
                          }}
                        >
                          {vid.views_text || vid.published_time_text}
                        </div>
                      </div>

                      {/* Video Info Body */}
                      <div style={{ padding: "12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "4px", fontFamily: "monospace" }}>
                            ID: {vid.video_id}
                          </div>
                          <h4
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#f4f4f5",
                              margin: "0 0 10px 0",
                              lineHeight: "1.3",
                              maxHeight: "36px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={vid.title}
                          >
                            {vid.title}
                          </h4>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", paddingTop: "8px", borderTop: "1px solid #27272a" }}>
                          <button
                            type="button"
                            onClick={() => handleVideoDetails(vid.video_id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "5px 10px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: "rgba(239, 68, 68, 0.15)",
                              color: "#ef4444",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            <ClosedCaptionsIcon size={12} />
                            Transcribe
                          </button>

                          <SaveToCaseButton
                            identifierType="url"
                            identifierValue={vid.url}
                            platform="youtube"
                            url={vid.url}
                            discoveredBy="YouTubeUltimateScraper"
                            metadata={{
                              video_id: vid.video_id,
                              title: vid.title,
                              thumbnail: vid.thumbnail_url,
                            }}
                          />

                          <a
                            href={vid.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "5px",
                              color: "#71717a",
                              display: "flex",
                              alignItems: "center",
                            }}
                            title="Watch on YouTube"
                          >
                            <ExternalLinkIcon size={13} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic OSINT Pivots Section for Channel */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                }}
              >
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "#f4f4f5" }}>
                  TARGET-LINKED OSINT ARSENAL ({channelData.osint_pivots.length} ENGINES)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
                  {channelData.osint_pivots.map((p, idx) => (
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
                              color: "#ef4444",
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
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
                            color: "#ef4444",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Launch Engine <ExternalLinkIcon size={12} />
                        </a>
                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={p.url}
                          platform="youtube"
                          url={p.url}
                          discoveredBy="YouTubeUltimateScraper"
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

      {/* TAB 2: VIDEO DEEP DIVE & SPEECH FORENSICS */}
      {activeTab === "video" && (
        <div>
          {/* Video Search Bar */}
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
                  YOUTUBE VIDEO URL OR 11-CHARACTER VIDEO ID
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVideoDetails(videoInput)}
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
                    <VideoIcon size={14} />
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: "18px" }}>
                <button
                  type="button"
                  onClick={() => handleVideoDetails(videoInput)}
                  disabled={videoLoading || !videoInput.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 20px",
                    borderRadius: "6px",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    border: "none",
                    cursor: videoLoading || !videoInput.trim() ? "not-allowed" : "pointer",
                    opacity: videoLoading || !videoInput.trim() ? 0.6 : 1,
                  }}
                >
                  {videoLoading ? (
                    <>
                      <RefreshCwIcon size={14} className="spin" />
                      EXTRACTING CAPTIONS...
                    </>
                  ) : (
                    <>
                      <ClosedCaptionsIcon size={14} />
                      ANALYZE & TRANSCRIBE
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Video Error */}
          {videoError && (
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
              <strong>Analysis Error:</strong> {videoError}
            </div>
          )}

          {/* Video Details Card & Speech Forensics */}
          {videoData && (
            <div>
              {/* Main Video Dossier Header */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  {/* Thumbnail with Vault Button */}
                  <div style={{ width: "320px", position: "relative", borderRadius: "6px", overflow: "hidden" }}>
                    <img
                      src={videoData.thumbnail_url}
                      alt={videoData.title}
                      style={{ width: "100%", height: "auto", display: "block", backgroundColor: "#09090b" }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        attachMediaToCase(videoData.thumbnail_url, `yt_video_${videoData.video_id}.jpg`, `video_thumb_${videoData.video_id}`)
                      }
                      disabled={attachingKey === `video_thumb_${videoData.video_id}`}
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
                      {attachingKey === `video_thumb_${videoData.video_id}` ? "Vaulting..." : "+ Vault to Case"}
                    </button>
                  </div>

                  {/* Metadata Info */}
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700, marginBottom: "4px" }}>
                      VIDEO ID: {videoData.video_id}
                    </div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px 0", color: "#f4f4f5" }}>
                      {videoData.title}
                    </h2>

                    <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#a1a1aa", flexWrap: "wrap", marginBottom: "12px" }}>
                      <span>
                        <strong>Author / Channel:</strong>{" "}
                        <span style={{ color: "#f4f4f5", fontWeight: 600 }}>{videoData.author}</span>
                      </span>
                      <span>
                        <strong>Duration:</strong>{" "}
                        <span style={{ color: "#22c55e", fontWeight: 600 }}>{videoData.duration_formatted}</span>
                      </span>
                      <span>
                        <strong>Views:</strong>{" "}
                        <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                          {Number(videoData.view_count) > 0 ? Number(videoData.view_count).toLocaleString() : videoData.view_count}
                        </span>
                      </span>
                      <span>
                        <strong>Transcript Status:</strong>{" "}
                        <span style={{ color: videoData.has_transcript ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                          {videoData.has_transcript ? `Available (${videoData.transcript_snippets_count} lines)` : "No captions found"}
                        </span>
                      </span>
                    </div>

                    {/* Description Snippet */}
                    {videoData.description && (
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: "var(--input-bg, #09090b)",
                          borderRadius: "6px",
                          fontSize: "11px",
                          color: "#a1a1aa",
                          maxHeight: "90px",
                          overflowY: "auto",
                          whiteSpace: "pre-wrap",
                          marginBottom: "12px",
                        }}
                      >
                        {videoData.description}
                      </div>
                    )}

                    {/* Keywords/Tags */}
                    {videoData.keywords?.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                        {videoData.keywords.slice(0, 15).map((kw, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              backgroundColor: "#27272a",
                              color: "#d4d4d8",
                              borderRadius: "3px",
                            }}
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Video Action Buttons */}
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <SaveToCaseButton
                        identifierType="url"
                        identifierValue={videoData.url}
                        platform="youtube"
                        url={videoData.url}
                        discoveredBy="YouTubeUltimateScraper"
                        metadata={{
                          video_id: videoData.video_id,
                          title: videoData.title,
                          author: videoData.author,
                          channel_id: videoData.channel_id,
                          views: videoData.view_count,
                          duration: videoData.duration_formatted,
                        }}
                      />

                      <a
                        href={videoData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          color: "#ef4444",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        Watch on YouTube <ExternalLinkIcon size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Speech Captions & Transcript Forensics Viewer */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#f4f4f5" }}>
                      SPEECH CAPTIONS & TRANSCRIPT INTELLIGENCE
                    </h3>
                    <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                      Full speech audio transcript with second-by-second timestamps and forensic keyword highlighting.
                    </span>
                  </div>

                  {/* Transcript In-Text Keyword Filter */}
                  <div style={{ width: "240px" }}>
                    <input
                      type="text"
                      placeholder="Filter transcript keywords..."
                      value={transcriptFilter}
                      onChange={(e) => setTranscriptFilter(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: "11px",
                        backgroundColor: "var(--input-bg, #09090b)",
                        border: "1px solid var(--border-color, #3f3f46)",
                        color: "#fff",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>

                {videoData.has_transcript ? (
                  <div>
                    <div
                      style={{
                        maxHeight: "380px",
                        overflowY: "auto",
                        padding: "12px",
                        backgroundColor: "var(--input-bg, #09090b)",
                        borderRadius: "6px",
                        border: "1px solid var(--border-color, #27272a)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {filteredTranscript.map((snippet, idx) => {
                        const startMin = Math.floor(snippet.start / 60);
                        const startSec = Math.floor(snippet.start % 60);
                        const timecode = `${startMin}:${startSec < 10 ? "0" : ""}${startSec}`;

                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              gap: "12px",
                              alignItems: "flex-start",
                              fontSize: "12px",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              backgroundColor: transcriptFilter ? "rgba(239, 68, 68, 0.08)" : "transparent",
                            }}
                          >
                            <a
                              href={`${videoData.url}&t=${Math.floor(snippet.start)}s`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#ef4444",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                textDecoration: "none",
                                flexShrink: 0,
                                fontSize: "11px",
                              }}
                              title="Jump to timecode on YouTube"
                            >
                              [{timecode}]
                            </a>
                            <span style={{ color: "#d4d4d8", lineHeight: "1.4" }}>
                              {snippet.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#71717a" }}>
                        Showing {filteredTranscript.length} of {videoData.transcript_snippets_count} transcript lines.
                      </span>

                      <SaveToCaseButton
                        identifierType="url"
                        identifierValue={videoData.url}
                        platform="youtube"
                        url={videoData.url}
                        discoveredBy="YouTubeUltimateScraper"
                        metadata={{
                          video_id: videoData.video_id,
                          title: videoData.title,
                          full_transcript: videoData.full_transcript_text,
                          snippets_count: videoData.transcript_snippets_count,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      backgroundColor: "var(--input-bg, #09090b)",
                      borderRadius: "6px",
                      color: "#71717a",
                      fontSize: "12px",
                    }}
                  >
                    No Closed Captions / Subtitles are publicly indexed or generated for this video.
                  </div>
                )}
              </div>

              {/* Video OSINT Pivots */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "var(--card-bg, #18181b)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #27272a)",
                }}
              >
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 12px 0", color: "#f4f4f5" }}>
                  VIDEO-SPECIFIC OSINT PIVOTS ({videoData.osint_pivots.length} TOOLS)
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
                  {videoData.osint_pivots.map((p, idx) => (
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
                              color: "#ef4444",
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
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
                            color: "#ef4444",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Launch Engine <ExternalLinkIcon size={12} />
                        </a>
                        <SaveToCaseButton
                          identifierType="url"
                          identifierValue={p.url}
                          platform="youtube"
                          url={p.url}
                          discoveredBy="YouTubeUltimateScraper"
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

      {/* TAB 3: OSINT ARSENAL */}
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
              CURATED YOUTUBE OSINT ARSENAL
            </h3>
            <p style={{ fontSize: "12px", color: "#a1a1aa", margin: 0 }}>
              Specialized engines for metadata extraction, geolocation mapping, comment search, deleted video recovery, and growth analytics.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px" }}>
            {DEFAULT_YOUTUBE_TOOLS.map((t, idx) => (
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
                        color: "#ef4444",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
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
                      color: "#ef4444",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Launch Engine <ExternalLinkIcon size={12} />
                  </a>
                  <SaveToCaseButton
                    identifierType="url"
                    identifierValue={t.url}
                    platform="youtube"
                    url={t.url}
                    discoveredBy="YouTubeUltimateScraper"
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
