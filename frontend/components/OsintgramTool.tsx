"use client";

import React, { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  InstagramIcon,
  SearchIcon,
  CrossIcon,
  CheckIcon,
  GlobeIcon,
  LayersIcon,
  RadarIcon,
  PaperclipIcon,
  EyeIcon,
  DatabaseIcon,
} from "./FlatIcons";

type OsintgramResponse = {
  target: string;
  profile: {
    username: string;
    numeric_id: string | null;
    full_name: string;
    biography: string;
    followers_count_str?: string;
    following_count_str?: string;
    posts_count_str?: string;
    is_verified?: boolean;
    profile_pic_url?: string;
  };
  osintgram_modules: {
    info: {
      username: string;
      numeric_id: string | null;
      full_name: string;
      biography: string;
      followers: string;
      following: string;
      posts: string;
      profile_pic?: string;
    };
    fwersemail: string[];
    fwersnumber: string[];
    hashtags: { tag: string; count: number }[];
    tagged: { username: string; url: string }[];
    photodes: string[];
    addrs: { name: string; type: string }[];
    mirrors: Record<string, string>;
  };
};

type InstaloaderPost = {
  shortcode: string;
  author: string;
  date_utc?: string;
  caption: string;
  likes?: number;
  comments?: number;
  is_video: boolean;
  video_url?: string;
  display_url?: string;
  location?: string;
  tagged_users?: string[];
  mirrors?: Record<string, string>;
};

export default function OsintgramTool() {
  const { activeCase } = useActiveCase();
  const [targetUsername, setTargetUsername] = useState("");
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OsintgramResponse | null>(null);

  // Active Subtab inside Osintgram
  const [activeTab, setActiveTab] = useState<"info" | "photodes" | "hashtags" | "contacts" | "post">("info");

  // Post inspector state (Instaloader)
  const [postShortcode, setPostShortcode] = useState("");
  const [postData, setPostData] = useState<InstaloaderPost | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);

  // Evidence attachment state
  const [attaching, setAttaching] = useState(false);
  const [attachedMsg, setAttachedMsg] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await apiGet<OsintgramResponse>(
        `/recon/instagram/osintgram?username=${encodeURIComponent(targetUsername.trim())}&use_tor=${useTor}`
      );
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed running Osintgram scan");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postShortcode.trim()) return;

    setLoadingPost(true);
    setPostData(null);
    try {
      const res = await apiGet<InstaloaderPost>(
        `/recon/instagram/instaloader/post?shortcode=${encodeURIComponent(postShortcode.trim())}&use_tor=${useTor}`
      );
      setPostData(res);
    } catch (err: any) {
      setError(err?.message || "Failed fetching post via Instaloader");
    } finally {
      setLoadingPost(false);
    }
  };

  const handleAttachEvidence = async (url: string, filename: string, typology: "image" | "video") => {
    if (!activeCase) {
      alert("Please select or create an active case in Case Management first.");
      return;
    }

    setAttaching(true);
    setAttachedMsg(null);
    try {
      await apiPostJson(
        `/recon/instagram/instalooter/attach-case?case_id=${activeCase.id}&media_url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&typology=${typology}`,
        {}
      );
      setAttachedMsg(`Attached ${filename} directly into Case Evidence!`);
    } catch (err: any) {
      alert(err?.message || "Failed to attach media to Case Files");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
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
              background: "rgba(225, 48, 108, 0.15)",
              border: "1px solid #e1306c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <InstagramIcon size={20} color="#e1306c" />
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              Osintgram &amp; Instaloader: Deep Instagram Intelligence Suite
              <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(225, 48, 108, 0.2)", color: "#e1306c", borderRadius: 4, border: "1px solid #e1306c" }}>
                Datalux/Osintgram + Instaloader
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Permanent numeric ID resolution, AI scene descriptions (photodes), hashtag frequency, email/phone harvesting, and media looting.
            </div>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: useTor ? "var(--green)" : "var(--text-muted)" }}>
          <input type="checkbox" checked={useTor} onChange={(e) => setUseTor(e.target.checked)} />
          <span>Route via Tor (Port 9050)</span>
        </label>
      </div>

      {/* Target Scan Form */}
      <form onSubmit={handleScan} style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="Enter Instagram username (e.g. nasa, target_handle)..."
          value={targetUsername}
          onChange={(e) => setTargetUsername(e.target.value)}
          style={{
            flex: 1,
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
          disabled={loading || !targetUsername.trim()}
          style={{
            padding: "10px 18px",
            background: "#e1306c",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontWeight: "bold",
            fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <SearchIcon size={14} color="#fff" />
          {loading ? "Running Osintgram..." : "Scan Account"}
        </button>
      </form>

      {error && (
        <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {attachedMsg && (
        <div style={{ padding: 10, background: "rgba(0, 255, 102, 0.1)", border: "1px solid var(--green)", borderRadius: 4, color: "var(--green)", fontSize: 12 }}>
          {attachedMsg}
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Subtabs */}
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--panel-border)", paddingBottom: 8, overflowX: "auto" }}>
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              style={{
                padding: "6px 12px",
                background: activeTab === "info" ? "rgba(225, 48, 108, 0.2)" : "transparent",
                border: activeTab === "info" ? "1px solid #e1306c" : "1px solid transparent",
                color: activeTab === "info" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              1. Profile Intel (info)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("photodes")}
              style={{
                padding: "6px 12px",
                background: activeTab === "photodes" ? "rgba(225, 48, 108, 0.2)" : "transparent",
                border: activeTab === "photodes" ? "1px solid #e1306c" : "1px solid transparent",
                color: activeTab === "photodes" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              2. AI Alt-Text Scene Descriptors (photodes)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("hashtags")}
              style={{
                padding: "6px 12px",
                background: activeTab === "hashtags" ? "rgba(225, 48, 108, 0.2)" : "transparent",
                border: activeTab === "hashtags" ? "1px solid #e1306c" : "1px solid transparent",
                color: activeTab === "hashtags" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              3. Hashtag Cloud (hashtags)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              style={{
                padding: "6px 12px",
                background: activeTab === "contacts" ? "rgba(225, 48, 108, 0.2)" : "transparent",
                border: activeTab === "contacts" ? "1px solid #e1306c" : "1px solid transparent",
                color: activeTab === "contacts" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              4. Extracted Contacts &amp; Mentions (fwersemail/tagged)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("post")}
              style={{
                padding: "6px 12px",
                background: activeTab === "post" ? "rgba(225, 48, 108, 0.2)" : "transparent",
                border: activeTab === "post" ? "1px solid #e1306c" : "1px solid transparent",
                color: activeTab === "post" ? "#fff" : "var(--text-muted)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              5. Instaloader Post Looting
            </button>
          </div>

          {/* Subtab 1: Profile Intel */}
          {activeTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {data.profile.profile_pic_url ? (
                    <img
                      src={data.profile.profile_pic_url}
                      alt={data.profile.username}
                      style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid #e1306c", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(225, 48, 108, 0.2)", border: "2px solid #e1306c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <InstagramIcon size={32} color="#e1306c" />
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff" }}>
                      {data.profile.full_name || data.profile.username}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--cyan)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>@{data.profile.username}</span>
                      {data.profile.numeric_id && (
                        <span>
                          &bull; Permanent Numeric ID: <code>{data.profile.numeric_id}</code>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.profile.profile_pic_url && (
                    <button
                      type="button"
                      onClick={() => handleAttachEvidence(data.profile.profile_pic_url!, `${data.profile.username}_avatar.jpg`, "image")}
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
                      Attach Avatar to Evidence
                    </button>
                  )}

                  <SaveToCaseButton
                    identifierType="username"
                    platform="instagram.osintgram"
                    discoveredBy="Osintgram"
                    identifierValue={data.profile.numeric_id || data.profile.username}
                    metadata={{
                      username: data.profile.username,
                      numeric_id: data.profile.numeric_id,
                      full_name: data.profile.full_name,
                      biography: data.profile.biography,
                      followers: data.osintgram_modules.info.followers,
                      following: data.osintgram_modules.info.following,
                      posts: data.osintgram_modules.info.posts,
                    }}
                  />

                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Followers</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff", marginTop: 2 }}>
                    {data.osintgram_modules.info.followers}
                  </div>
                </div>

                <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Following</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff", marginTop: 2 }}>
                    {data.osintgram_modules.info.following}
                  </div>
                </div>

                <div style={{ background: "#0b0f14", padding: 12, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Posts</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff", marginTop: 2 }}>
                    {data.osintgram_modules.info.posts}
                  </div>
                </div>
              </div>

              {/* Biography Card */}
              {data.profile.biography && (
                <div style={{ background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold", marginBottom: 6 }}>
                    Biography
                  </div>
                  <div style={{ fontSize: 13, color: "#fff", whiteSpace: "pre-wrap" }}>
                    {data.profile.biography}
                  </div>
                </div>
              )}

              {/* Anonymous Mirrors */}
              <div style={{ background: "#0b0f14", border: "1px solid var(--panel-border)", borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <GlobeIcon size={12} color="var(--cyan)" />
                  Anonymous Web Mirrors (Bypass Login Walls to View Stories &amp; Grids)
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(data.osintgram_modules.mirrors).map(([mName, mUrl]) => (
                    <a
                      key={mName}
                      href={mUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "6px 12px",
                        background: "#161b22",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        color: "#fff",
                        fontSize: 12,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <EyeIcon size={12} color="var(--cyan)" />
                      {mName.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: AI Alt-Text Scene Descriptors */}
          {activeTab === "photodes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                AI-generated accessibility scene descriptions extracted directly from Instagram's neural computer vision engine:
              </div>

              {data.osintgram_modules.photodes.length === 0 ? (
                <div style={{ padding: 16, background: "#0b0f14", borderRadius: 6, color: "var(--text-muted)", fontSize: 12 }}>
                  No automated alt-text descriptors found in target's recent media tags.
                </div>
              ) : (
                data.osintgram_modules.photodes.map((desc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#0d1117",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <RadarIcon size={14} color="var(--cyan)" />
                      {desc}
                    </div>

                    <SaveToCaseButton
                      identifierType="url"
                      platform="instagram.osintgram.photodes"
                      discoveredBy="Osintgram"
                      identifierValue={desc}
                      metadata={{ target: data.profile.username, description: desc }}
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Subtab 3: Hashtag Cloud */}
          {activeTab === "hashtags" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Top hashtags utilized by target account:
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {data.osintgram_modules.hashtags.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "#161b22",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 20,
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>{h.tag}</span>
                    <span style={{ fontSize: 10, background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 10 }}>
                      {h.count}
                    </span>

                    <SaveToCaseButton
                      identifierType="username"
                      platform="instagram.osintgram.hashtag"
                      discoveredBy="Osintgram"
                      identifierValue={h.tag}
                      metadata={{ target: data.profile.username, hashtag: h.tag, count: h.count }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab 4: Extracted Contacts & Mentions */}
          {activeTab === "contacts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Emails */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
                  Extracted Email Addresses ({data.osintgram_modules.fwersemail.length})
                </div>
                {data.osintgram_modules.fwersemail.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No public email addresses detected in profile text.</div>
                ) : (
                  data.osintgram_modules.fwersemail.map((email, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
                      <code style={{ color: "var(--cyan)", fontSize: 13 }}>{email}</code>
                      <SaveToCaseButton
                        identifierType="email"
                        platform="email.osintgram"
                        discoveredBy="Osintgram"
                        identifierValue={email}
                        metadata={{ target: data.profile.username, email }}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Tagged Accounts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
                  Tagged Accounts &amp; Mentions ({data.osintgram_modules.tagged.length})
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.osintgram_modules.tagged.map((tag, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: "#fff" }}>@{tag.username}</span>
                      <SaveToCaseButton
                        identifierType="username"
                        platform="instagram.osintgram.mention"
                        discoveredBy="Osintgram"
                        identifierValue={tag.username}
                        metadata={{ target: data.profile.username, mentioned: tag.username }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* Subtab 5: Instaloader Post Looting */}
          {activeTab === "post" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <form onSubmit={handleFetchPost} style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Enter post shortcode or full post/reel link (e.g. C0tU_qYrvp_ or https://www.instagram.com/p/...)..."
                  value={postShortcode}
                  onChange={(e) => setPostShortcode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "#0d1117",
                    border: "1px solid var(--panel-border)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <button
                  type="submit"
                  disabled={loadingPost || !postShortcode.trim()}
                  style={{
                    padding: "8px 16px",
                    background: "#e1306c",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: "bold",
                    fontSize: 12,
                    cursor: loadingPost ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingPost ? "Inspecting Post..." : "Inspect Post Media"}
                </button>
              </form>

              {postData && (
                <div style={{ background: "#0d1117", border: "1px solid var(--panel-border)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>
                      Post [{postData.shortcode}] &bull; Author: @{postData.author}
                    </div>
                    <SaveToCaseButton
                      identifierType="url"
                      platform="instagram.instaloader.post"
                      discoveredBy="Instaloader"
                      identifierValue={postData.shortcode}
                      metadata={{
                        shortcode: postData.shortcode,
                        author: postData.author,
                        caption: postData.caption,
                        likes: postData.likes,
                      }}
                    />
                  </div>


                  {postData.caption && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", background: "#000", padding: 10, borderRadius: 4 }}>
                      {postData.caption}
                    </div>
                  )}

                  {postData.display_url && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleAttachEvidence(postData.display_url!, `${postData.shortcode}_media.jpg`, "image")}
                        disabled={attaching}
                        style={{
                          padding: "8px 14px",
                          background: "rgba(0, 255, 102, 0.2)",
                          border: "1px solid var(--green)",
                          color: "var(--green)",
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: attaching ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Attach Post Image to Case Evidence
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
