"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";

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

  async function handleProfileSearch() {
    if (!username.trim()) return;
    setProfileLoading(true);
    setProfileError(null);
    setProfile(null);

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ color: "var(--cyan)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FE2C55", display: "inline-block", boxShadow: "0 0 8px #FE2C55" }} />
            TikTok Intelligence & Scraping
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
            <button onClick={handleProfileSearch} disabled={profileLoading}>
              {profileLoading ? "Scraping..." : "Scrape Profile"}
            </button>
          </div>

          {profileError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{profileError}</p>}

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
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ACCOUNT CREATION DATE (ESTIMATED)</div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--success)" }}>
                          {new Date(profile.created_at_utc).toUTCString()}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Decoded from 64-bit Snowflake ID</div>
                      </div>
                    )}

                    {profile.sec_uid && (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SEC-UID (API IDENTIFIER)</div>
                        <div style={{ fontSize: 11, wordBreak: "break-all", color: "var(--text)" }}>
                          {profile.sec_uid}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Follow Stats */}
                  <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--cyan)" }}>{profile.followers || "0"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Followers</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--cyan)" }}>{profile.following || "0"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Following</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--cyan)" }}>{profile.likes || "0"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Likes</div>
                    </div>
                  </div>

                  {profile.raw_description && (
                    <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", borderLeft: "2px solid var(--panel-border)", paddingLeft: 8 }}>
                      "{profile.raw_description}"
                    </div>
                  )}

                  {/* Save to Case */}
                  {activeCase && (
                    <div style={{ marginTop: 20 }}>
                      <SaveToCaseButton
                        identifierType="username"
                        identifierValue={profile.username}
                        platform="tiktok"
                        url={profile.url}
                        discoveredBy="tiktok_recon"
                        metadata={{
                          user_id: profile.user_id,
                          sec_uid: profile.sec_uid,
                          followers: profile.followers,
                          following: profile.following,
                          likes: profile.likes,
                          created_at_utc: profile.created_at_utc,
                          avatar_url: profile.avatar_url,
                        }}
                      />
                    </div>
                  )}
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
              placeholder="TikTok video URL or numeric ID (e.g. https://www.tiktok.com/@user/video/7187123908852337966)"
              style={{ flex: 1, padding: "8px 12px" }}
            />
            <button onClick={handleVideoSearch} disabled={videoLoading}>
              {videoLoading ? "Analyzing..." : "Extract Timestamp"}
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
              <h3 style={{ margin: "0 0 12px 0", color: "#FE2C55" }}>Video Snowflake Forensic Analysis</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>VIDEO ID</div>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: "var(--cyan)" }}>{videoResult.video_id}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>EXACT CREATION DATE (UTC)</div>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: "var(--success)" }}>
                    {videoResult.created_at_utc ? new Date(videoResult.created_at_utc).toUTCString() : "Unable to decode"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    ISO: {videoResult.created_at_utc || "N/A"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <a
                  href={videoResult.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 4,
                    background: "rgba(254, 44, 85, 0.15)",
                    color: "#FE2C55",
                    border: "1px solid rgba(254, 44, 85, 0.4)",
                    textDecoration: "none",
                    fontWeight: "bold",
                  }}
                >
                  Open Video on TikTok ↗
                </a>

                {activeCase && (
                  <SaveToCaseButton
                    identifierType="username"
                    identifierValue={`video_${videoResult.video_id}`}
                    platform="tiktok_video"
                    url={videoResult.url}
                    discoveredBy="tiktok_recon"
                    metadata={{
                      video_id: videoResult.video_id,
                      created_at_utc: videoResult.created_at_utc,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
