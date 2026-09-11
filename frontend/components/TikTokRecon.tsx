"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  TikTokIcon,
  VideoIcon,
  SearchIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  ShieldIcon,
  LockIcon,
} from "./FlatIcons";

type TikTokEntities = {
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

type TikTokProfileResult = {
  found: boolean;
  platform: string;
  username: string;
  display_name?: string;
  user_id?: string;
  sec_uid?: string;
  created_at_utc?: string;
  followers?: string;
  following?: string;
  likes?: string;
  avatar_url?: string;
  url?: string;
  raw_description?: string;
  entities?: TikTokEntities;
  error?: string;
};

type TikTokVideoResult = {
  video_id: string;
  created_at_utc?: string;
  title?: string;
  url: string;
  error?: string;
};

export default function TikTokRecon() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"profile" | "video">("profile");

  // Profile State
  const [username, setUsername] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TikTokProfileResult | null>(null);

  // Video State
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<TikTokVideoResult | null>(null);

  // Evidence Attachment State
  const [attaching, setAttaching] = useState(false);
  const [attachFeedback, setAttachFeedback] = useState<string | null>(null);

  async function handleProfileSearch() {
    if (!username.trim()) return;
    setProfileLoading(true);
    setProfileError(null);
    setProfile(null);
    setAttachFeedback(null);

    let clean = username.trim();
    if (clean.includes("tiktok.com/@")) {
      clean = clean.split("tiktok.com/@")[1].split("/")[0].split("?")[0];
    } else if (clean.startsWith("@")) {
      clean = clean.substring(1);
    }

    try {
      const data = await apiGet<TikTokProfileResult>(`/identifiers/tiktok/profile/${encodeURIComponent(clean)}`);
      if (!data.found && data.error) {
        setProfileError(data.error);
      } else {
        setProfile(data);
      }
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Error scraping TikTok profile");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleVideoSearch() {
    if (!videoUrl.trim()) return;
    setVideoLoading(true);
    setVideoError(null);
    setVideoResult(null);

    try {
      const data = await apiGet<TikTokVideoResult>(`/identifiers/tiktok/video?url_or_id=${encodeURIComponent(videoUrl.trim())}`);
      if (data.error) {
        setVideoError(data.error);
      } else {
        setVideoResult(data);
      }
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : "Error analyzing TikTok video");
    } finally {
      setVideoLoading(false);
    }
  }

  async function handleAttachAvatar() {
    if (!profile?.avatar_url) return;
    if (!activeCase) {
      setAttachFeedback("Select an active case first to attach evidence.");
      return;
    }
    setAttaching(true);
    setAttachFeedback(null);

    try {
      await apiPostJson(
        `/recon/tiktok/attach-evidence?case_id=${activeCase.id}&media_url=${encodeURIComponent(profile.avatar_url)}&filename=${encodeURIComponent(`tiktok_avatar_${profile.username}.jpg`)}`,
        {}
      );
      setAttachFeedback(`Avatar attached to Case "${activeCase.name}" vault.`);
    } catch (e) {
      setAttachFeedback(e instanceof Error ? e.message : "Failed attaching avatar");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ color: "var(--cyan)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <TikTokIcon size={18} color="#FE2C55" />
            TikTok Intelligence & Forensic Scraper
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0 0" }}>
            Extract persistent internal numeric IDs, snowflake creation timestamps, follow metrics, and video upload dates without API keys or login.
          </p>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: "flex", gap: 8, background: "var(--bg)", padding: 4, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
          <button
            onClick={() => setActiveTab("profile")}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: activeTab === "profile" ? "#FE2C55" : "transparent",
              color: activeTab === "profile" ? "#fff" : "var(--text-muted)",
              fontWeight: activeTab === "profile" ? "bold" : "normal",
            }}
          >
            Profile Recon
          </button>
          <button
            onClick={() => setActiveTab("video")}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: activeTab === "video" ? "#FE2C55" : "transparent",
              color: activeTab === "video" ? "#fff" : "var(--text-muted)",
              fontWeight: activeTab === "video" ? "bold" : "normal",
            }}
          >
            Video Snowflake Timestamp
          </button>
        </div>
      </div>

      {activeTab === "profile" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleProfileSearch()}
              placeholder="Username or profile URL (e.g. khaby.lame or https://www.tiktok.com/@tiktok)"
              style={{ flex: 1, padding: "8px 12px" }}
            />
            <button onClick={handleProfileSearch} disabled={profileLoading} style={{ padding: "8px 20px" }}>
              {profileLoading ? "Scraping..." : "Scrape Profile"}
            </button>
          </div>

          {profileError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{profileError}</p>}
          {attachFeedback && <p style={{ color: "var(--success)", fontSize: 13 }}>{attachFeedback}</p>}

          {profile && (
            <div
              style={{
                marginTop: 16,
                padding: 20,
                background: "var(--bg)",
                border: "1px solid #FE2C55",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                {profile.avatar_url && (
                  <div style={{ position: "relative" }}>
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || profile.username}
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        border: "2px solid #FE2C55",
                        objectFit: "cover",
                        boxShadow: "0 0 16px rgba(254, 44, 85, 0.4)",
                      }}
                    />
                    <button
                      onClick={handleAttachAvatar}
                      disabled={attaching}
                      style={{
                        position: "absolute",
                        bottom: -8,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 10,
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                        background: "#FE2C55",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Attach Avatar
                    </button>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, color: "var(--text)" }}>{profile.display_name}</h3>
                    <span style={{ fontSize: 13, color: "var(--cyan)", fontWeight: "bold" }}>@{profile.username}</span>
                    <a
                      href={profile.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "rgba(254, 44, 85, 0.15)",
                        color: "#FE2C55",
                        border: "1px solid rgba(254, 44, 85, 0.4)",
                        textDecoration: "none",
                      }}
                    >
                      Open TikTok ↗
                    </a>
                  </div>

                  {/* Core OSINT Pivot Data */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                      marginTop: 16,
                      padding: 12,
                      background: "rgba(254, 44, 85, 0.05)",
                      border: "1px solid rgba(254, 44, 85, 0.2)",
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>INTERNAL NUMERIC ID (PIVOT)</div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: "#FE2C55" }}>
                        {profile.user_id || "Not exposed"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Permanent across username changes</div>
                    </div>

                    {profile.created_at_utc && (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ACCOUNT CREATION DATE (DECODED)</div>
                        <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                          {new Date(profile.created_at_utc).toUTCString()}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Extracted via 64-bit Snowflake timestamp</div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>METRICS</div>
                      <div style={{ fontSize: 13, color: "var(--text)" }}>
                        <strong>{profile.followers || "0"}</strong> Followers · <strong>{profile.following || "0"}</strong> Following · <strong>{profile.likes || "0"}</strong> Likes
                      </div>
                    </div>

                    {profile.sec_uid && (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SEC_UID</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text)", wordBreak: "break-all" }}>
                          {profile.sec_uid}
                        </div>
                      </div>
                    )}
                  </div>

                  {profile.raw_description && (
                    <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                      <strong>Bio: </strong>
                      <span>{profile.raw_description}</span>
                    </div>
                  )}

                  {/* Extracted Entities */}
                  {profile.entities && (
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                      {profile.entities.emails.length > 0 && (
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>Emails: </span>
                          {profile.entities.emails.map((e, idx) => (
                            <span key={idx} style={{ marginRight: 8, background: "rgba(0, 200, 83, 0.15)", color: "var(--success)", padding: "2px 6px", borderRadius: 3 }}>
                              {e}
                            </span>
                          ))}
                        </div>
                      )}

                      {profile.entities.phones.length > 0 && (
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>Phones: </span>
                          {profile.entities.phones.map((p, idx) => (
                            <span key={idx} style={{ marginRight: 8, background: "rgba(0, 119, 255, 0.15)", color: "#0077FF", padding: "2px 6px", borderRadius: 3 }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      {profile.entities.mentions.length > 0 && (
                        <div style={{ fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>Mentions: </span>
                          {profile.entities.mentions.map((m, idx) => (
                            <span key={idx} style={{ marginRight: 8, color: "var(--cyan)" }}>
                              @{m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Save to Active Case Button */}
                  <div style={{ marginTop: 16 }}>
                    <SaveToCaseButton
                      identifierType="username"
                      identifierValue={profile.username}
                      platform="tiktok"
                      url={profile.url}
                      discoveredBy="TikTokUltimateScraper"
                      metadata={{
                        display_name: profile.display_name,
                        user_id: profile.user_id,
                        sec_uid: profile.sec_uid,
                        followers: profile.followers,
                        following: profile.following,
                        likes: profile.likes,
                        created_at_utc: profile.created_at_utc,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "video" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVideoSearch()}
              placeholder="Video URL or ID (e.g. 7106594312292453678 or https://www.tiktok.com/@user/video/7106594312292453678)"
              style={{ flex: 1, padding: "8px 12px" }}
            />
            <button onClick={handleVideoSearch} disabled={videoLoading} style={{ padding: "8px 20px" }}>
              {videoLoading ? "Analyzing..." : "Decode Timestamp"}
            </button>
          </div>

          {videoError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{videoError}</p>}

          {videoResult && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: "var(--bg)",
                border: "1px solid #FE2C55",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", color: "var(--text)" }}>Video ID: {videoResult.video_id}</h4>
                  {videoResult.title && <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "var(--text-muted)" }}>{videoResult.title}</p>}
                </div>
                <a
                  href={videoResult.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: "rgba(254, 44, 85, 0.15)",
                    color: "#FE2C55",
                    textDecoration: "none",
                  }}
                >
                  Watch Video ↗
                </a>
              </div>

              {videoResult.created_at_utc ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "rgba(254, 44, 85, 0.05)",
                    borderRadius: 6,
                    border: "1px solid rgba(254, 44, 85, 0.2)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>DECODED EXACT UPLOAD TIMESTAMP (UTC)</div>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: "var(--cyan)", marginTop: 4 }}>
                    {new Date(videoResult.created_at_utc).toUTCString()}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Decoded from TikTok 64-bit Snowflake ID.
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Could not decode timestamp from this video ID.
                </p>
              )}

              <div style={{ marginTop: 12 }}>
                <SaveToCaseButton
                  identifierType="url"
                  identifierValue={videoResult.url}
                  platform="tiktok_video"
                  url={videoResult.url}
                  discoveredBy="TikTokSnowflakeDecoder"
                  metadata={{
                    video_id: videoResult.video_id,
                    created_at_utc: videoResult.created_at_utc,
                    title: videoResult.title,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
