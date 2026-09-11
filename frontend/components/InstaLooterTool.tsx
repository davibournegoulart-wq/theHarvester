"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  CameraIcon,
  DownloadIcon,
  LinkIcon,
  ShieldIcon,
  CheckIcon,
  AlertIcon,
  UserIcon,
  BoltIcon,
  FolderIcon,
} from "@/components/FlatIcons";

type ProfileLoot = {
  username: string;
  profile_id?: string | null;
  full_name?: string;
  biography?: string;
  followers_count?: string;
  following_count?: string;
  posts_count?: string;
  profile_pic_url?: string | null;
  profile_url: string;
  is_verified?: boolean;
  is_private?: boolean;
  mirrors: Record<string, string>;
  error?: string | null;
};

type PostLoot = {
  shortcode: string;
  post_url: string;
  owner_username?: string | null;
  caption?: string;
  media_url?: string | null;
  media_type?: string;
  likes_count?: string | null;
  comments_count?: string | null;
  taken_at?: string | null;
  mirrors: Record<string, string>;
  error?: string | null;
};

type CliLootResult = {
  target: string;
  target_type: string;
  files_looted: Array<{ filename: string; size_bytes: number; extension: string }>;
  raw_output: string;
  success: boolean;
  error?: string | null;
};

export default function InstaLooterTool() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"user" | "post" | "cli">("user");

  // User Profile Looter state
  const [userQuery, setUserQuery] = useState("");
  const [userUseTor, setUserUseTor] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [profileResult, setProfileResult] = useState<ProfileLoot | null>(null);
  const [attachingAvatar, setAttachingAvatar] = useState(false);
  const [avatarAttachedMsg, setAvatarAttachedMsg] = useState<string | null>(null);

  // Post Looter state
  const [postQuery, setPostQuery] = useState("");
  const [postUseTor, setPostUseTor] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<PostLoot | null>(null);
  const [attachingMedia, setAttachingMedia] = useState(false);
  const [mediaAttachedMsg, setMediaAttachedMsg] = useState<string | null>(null);

  // CLI Looter state
  const [cliTarget, setCliTarget] = useState("");
  const [cliType, setCliType] = useState<"user" | "post" | "hashtag">("user");
  const [cliCount, setCliCount] = useState(5);
  const [cliGetVideos, setCliGetVideos] = useState(false);
  const [cliDumpOnly, setCliDumpOnly] = useState(true);
  const [cliUsername, setCliUsername] = useState("");
  const [cliPassword, setCliPassword] = useState("");
  const [cliLoading, setCliLoading] = useState(false);
  const [cliResult, setCliResult] = useState<CliLootResult | null>(null);

  async function handleLootProfile() {
    const clean = userQuery.trim().replace("@", "");
    if (!clean) return;
    setUserLoading(true);
    setUserError(null);
    setProfileResult(null);
    setAvatarAttachedMsg(null);

    try {
      const data = await apiGet<ProfileLoot>(
        `/recon/instagram/instalooter/profile?username=${encodeURIComponent(clean)}&use_tor=${userUseTor}`
      );
      if (data.error && !data.profile_id && !data.full_name) {
        setUserError(data.error);
      }
      setProfileResult(data);
    } catch (e) {
      setUserError(e instanceof Error ? e.message : "Failed looting Instagram profile");
    } finally {
      setUserLoading(false);
    }
  }

  async function handleLootPost() {
    const clean = postQuery.trim();
    if (!clean) return;
    setPostLoading(true);
    setPostError(null);
    setPostResult(null);
    setMediaAttachedMsg(null);

    try {
      const data = await apiGet<PostLoot>(
        `/recon/instagram/instalooter/post?post_ref=${encodeURIComponent(clean)}&use_tor=${postUseTor}`
      );
      if (data.error && !data.media_url) {
        setPostError(data.error);
      }
      setPostResult(data);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed looting post");
    } finally {
      setPostLoading(false);
    }
  }

  async function handleAttachAvatar() {
    if (!activeCase || !profileResult?.profile_pic_url) return;
    setAttachingAvatar(true);
    setAvatarAttachedMsg(null);
    try {
      await apiPostJson("/recon/instagram/instalooter/attach-case", {
        case_id: activeCase.id,
        media_url: profileResult.profile_pic_url,
        filename: `${profileResult.username}_avatar.jpg`,
        typology: "image",
      });
      setAvatarAttachedMsg("Avatar successfully downloaded and attached to Case Evidence Files.");
    } catch (e) {
      setAvatarAttachedMsg(e instanceof Error ? `Error attaching: ${e.message}` : "Failed attaching avatar");
    } finally {
      setAttachingAvatar(false);
    }
  }

  async function handleAttachPostMedia() {
    if (!activeCase || !postResult?.media_url) return;
    setAttachingMedia(true);
    setMediaAttachedMsg(null);
    try {
      const ext = postResult.media_type === "video" ? ".mp4" : ".jpg";
      await apiPostJson("/recon/instagram/instalooter/attach-case", {
        case_id: activeCase.id,
        media_url: postResult.media_url,
        filename: `instagram_${postResult.shortcode}${ext}`,
        typology: postResult.media_type === "video" ? "video" : "image",
      });
      setMediaAttachedMsg("Post media successfully attached to Case Evidence Files.");
    } catch (e) {
      setMediaAttachedMsg(e instanceof Error ? `Error attaching: ${e.message}` : "Failed attaching media");
    } finally {
      setAttachingMedia(false);
    }
  }

  async function handleRunCli() {
    const clean = cliTarget.trim().replace("@", "");
    if (!clean) return;
    setCliLoading(true);
    setCliResult(null);

    try {
      const data = await apiPostJson<CliLootResult>("/recon/instagram/instalooter/cli", {
        target: clean,
        target_type: cliType,
        count: cliCount,
        get_videos: cliGetVideos,
        dump_only: cliDumpOnly,
        username_auth: cliUsername.trim() || undefined,
        password_auth: cliPassword.trim() || undefined,
      });
      setCliResult(data);
    } catch (e) {
      setCliResult({
        target: clean,
        target_type: cliType,
        files_looted: [],
        raw_output: "",
        success: false,
        error: e instanceof Error ? e.message : "CLI Execution failed",
      });
    } finally {
      setCliLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid var(--panel-border)", paddingTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CameraIcon size={20} color="#E1306C" />
          <div>
            <h3 style={{ margin: 0, color: "#E1306C", fontSize: 16 }}>
              InstaLooter: Profile &amp; Media Intelligence
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Extracts permanent numeric profile IDs, bio metrics, post media, and anonymous mirror streams (althonos/InstaLooter + stask + ofx).
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, borderBottom: "1px solid var(--panel-border)", paddingBottom: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("user")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: activeTab === "user" ? "bold" : "normal",
            background: activeTab === "user" ? "rgba(225, 48, 108, 0.15)" : "transparent",
            border: activeTab === "user" ? "1px solid #E1306C" : "1px solid var(--panel-border)",
            color: activeTab === "user" ? "#E1306C" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <UserIcon size={13} color={activeTab === "user" ? "#E1306C" : "var(--text-muted)"} />
          1. User Profile Looter
        </button>

        <button
          onClick={() => setActiveTab("post")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: activeTab === "post" ? "bold" : "normal",
            background: activeTab === "post" ? "rgba(225, 48, 108, 0.15)" : "transparent",
            border: activeTab === "post" ? "1px solid #E1306C" : "1px solid var(--panel-border)",
            color: activeTab === "post" ? "#E1306C" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <CameraIcon size={13} color={activeTab === "post" ? "#E1306C" : "var(--text-muted)"} />
          2. Post / Reel Media Looter
        </button>

        <button
          onClick={() => setActiveTab("cli")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: activeTab === "cli" ? "bold" : "normal",
            background: activeTab === "cli" ? "rgba(225, 48, 108, 0.15)" : "transparent",
            border: activeTab === "cli" ? "1px solid #E1306C" : "1px solid var(--panel-border)",
            color: activeTab === "cli" ? "#E1306C" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <BoltIcon size={13} color={activeTab === "cli" ? "#E1306C" : "var(--text-muted)"} />
          3. Batch / CLI Looter (InstaLooter Core)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. USER PROFILE LOOTER */}
      {/* ========================================================================= */}
      {activeTab === "user" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, maxWidth: 640, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLootProfile()}
              placeholder="Instagram Username (e.g. nasa, zuck, bellingcat)"
              style={{ flex: 1, minWidth: 240, padding: 8, fontSize: 13 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: userUseTor ? "var(--cyan)" : "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={userUseTor}
                onChange={(e) => setUserUseTor(e.target.checked)}
              />
              <ShieldIcon size={13} color={userUseTor ? "var(--cyan)" : "var(--text-muted)"} />
              Tor SOCKS5
            </label>
            <button
              onClick={handleLootProfile}
              disabled={userLoading || !userQuery.trim()}
              style={{ padding: "8px 16px", fontWeight: "bold", minWidth: 130 }}
            >
              {userLoading ? "LOOTING..." : "LOOT PROFILE"}
            </button>
          </div>

          {userError && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255, 0, 85, 0.12)", border: "1px solid #ff0055", color: "#ff7799", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertIcon size={14} color="#ff0055" />
              {userError}
            </div>
          )}

          {profileResult && (
            <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
              {/* Profile Card Header */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  {profileResult.profile_pic_url ? (
                    <img
                      src={profileResult.profile_pic_url}
                      alt={profileResult.username}
                      style={{ width: 68, height: 68, borderRadius: "50%", border: "2px solid #E1306C", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
                      <UserIcon size={28} color="var(--text-muted)" />
                    </div>
                  )}

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h4 style={{ margin: 0, fontSize: 16, color: "#fff" }}>
                        {profileResult.full_name || profileResult.username}
                      </h4>
                      <span style={{ fontFamily: "monospace", color: "var(--cyan)", fontSize: 13 }}>
                        @{profileResult.username}
                      </span>
                      {profileResult.is_verified && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(0, 153, 255, 0.2)", color: "#66b3ff", border: "1px solid rgba(0, 153, 255, 0.5)", fontWeight: "bold" }}>
                          VERIFIED
                        </span>
                      )}
                      {profileResult.is_private && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(255, 170, 51, 0.2)", color: "#ffaa33", border: "1px solid rgba(255, 170, 51, 0.5)", fontWeight: "bold" }}>
                          PRIVATE ACCOUNT
                        </span>
                      )}
                    </div>

                    {profileResult.profile_id && (
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        <span style={{ color: "var(--text-muted)" }}>Permanent Numeric ID: </span>
                        <strong style={{ fontFamily: "monospace", color: "#00ff9f", fontSize: 13 }}>
                          {profileResult.profile_id}
                        </strong>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                          (Never changes across username renames)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {profileResult.profile_pic_url && (
                    <button
                      onClick={handleAttachAvatar}
                      disabled={attachingAvatar}
                      style={{ fontSize: 11, padding: "6px 10px", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <DownloadIcon size={12} />
                      {attachingAvatar ? "Saving..." : "Attach Avatar to Case"}
                    </button>
                  )}

                  <SaveToCaseButton
                    identifierType="username"
                    identifierValue={profileResult.username}
                    platform="instagram"
                    url={profileResult.profile_url}
                    discoveredBy="InstaLooter"
                    metadata={{
                      profile_id: profileResult.profile_id,
                      full_name: profileResult.full_name,
                      followers: profileResult.followers_count,
                      following: profileResult.following_count,
                      posts: profileResult.posts_count,
                      biography: profileResult.biography,
                    }}
                  />
                </div>
              </div>

              {avatarAttachedMsg && (
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--success)" }}>
                  {avatarAttachedMsg}
                </div>
              )}

              {/* Metrics Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 16 }}>
                <div style={{ background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>FOLLOWERS</div>
                  <strong style={{ fontSize: 16, color: "var(--cyan)" }}>{profileResult.followers_count}</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>FOLLOWING</div>
                  <strong style={{ fontSize: 16, color: "#fff" }}>{profileResult.following_count}</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>TOTAL POSTS</div>
                  <strong style={{ fontSize: 16, color: "#fff" }}>{profileResult.posts_count}</strong>
                </div>
              </div>

              {/* Bio */}
              {profileResult.biography && (
                <div style={{ marginTop: 14, padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 4, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 }}>
                    BIOGRAPHY / PROFILE DESCRIPTION
                  </div>
                  <div style={{ fontSize: 12, color: "#eee", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                    {profileResult.biography}
                  </div>
                </div>
              )}

              {/* Mirror Viewers (Imginn, Picuki, Dumpor, StoriesIG) */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <LinkIcon size={12} color="var(--cyan)" />
                  ANONYMOUS WEB MIRRORS (BYPASS LOGIN WALLS &amp; VIEW STORIES):
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(profileResult.mirrors).map(([name, url]) => (
                    <a
                      key={name}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        padding: "5px 10px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        color: "var(--cyan)",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <LinkIcon size={11} /> {name} Mirror
                    </a>
                  ))}
                  <a
                    href={profileResult.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      background: "rgba(225, 48, 108, 0.1)",
                      border: "1px solid rgba(225, 48, 108, 0.4)",
                      borderRadius: 4,
                      color: "#E1306C",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <LinkIcon size={11} /> Instagram Official
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. POST / REEL MEDIA LOOTER */}
      {/* ========================================================================= */}
      {activeTab === "post" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, maxWidth: 640, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={postQuery}
              onChange={(e) => setPostQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLootPost()}
              placeholder="Instagram Post/Reel URL or Shortcode (e.g. https://instagram.com/p/ABC123XYZ/)"
              style={{ flex: 1, minWidth: 260, padding: 8, fontSize: 13 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: postUseTor ? "var(--cyan)" : "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={postUseTor}
                onChange={(e) => setPostUseTor(e.target.checked)}
              />
              <ShieldIcon size={13} color={postUseTor ? "var(--cyan)" : "var(--text-muted)"} />
              Tor SOCKS5
            </label>
            <button
              onClick={handleLootPost}
              disabled={postLoading || !postQuery.trim()}
              style={{ padding: "8px 16px", fontWeight: "bold", minWidth: 130 }}
            >
              {postLoading ? "LOOTING..." : "LOOT POST"}
            </button>
          </div>

          {postError && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255, 0, 85, 0.12)", border: "1px solid #ff0055", color: "#ff7799", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertIcon size={14} color="#ff0055" />
              {postError}
            </div>
          )}

          {postResult && (
            <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "rgba(5, 217, 232, 0.1)", color: "var(--cyan)", border: "1px solid rgba(5, 217, 232, 0.3)", fontWeight: "bold", textTransform: "uppercase" }}>
                    {postResult.media_type} POST
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, color: "#fff", marginLeft: 8 }}>
                    Code: {postResult.shortcode}
                  </span>
                  {postResult.owner_username && (
                    <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>
                      by @{postResult.owner_username}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {postResult.media_url && (
                    <button
                      onClick={handleAttachPostMedia}
                      disabled={attachingMedia}
                      style={{ fontSize: 11, padding: "6px 10px", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <DownloadIcon size={12} />
                      {attachingMedia ? "Saving..." : "Attach Media to Case"}
                    </button>
                  )}

                  <SaveToCaseButton
                    identifierType="url"
                    identifierValue={postResult.post_url}
                    platform="instagram.post"
                    url={postResult.post_url}
                    discoveredBy="InstaLooter"
                    metadata={{
                      shortcode: postResult.shortcode,
                      media_type: postResult.media_type,
                      caption: postResult.caption,
                      author: postResult.owner_username,
                    }}
                  />
                </div>
              </div>

              {mediaAttachedMsg && (
                <div style={{ marginBottom: 12, fontSize: 11, color: "var(--success)" }}>
                  {mediaAttachedMsg}
                </div>
              )}

              {/* Media Preview if available */}
              {postResult.media_url && (
                <div style={{ marginBottom: 12, maxHeight: 360, overflow: "hidden", borderRadius: 4, background: "#000", display: "flex", justifyContent: "center" }}>
                  {postResult.media_type === "video" ? (
                    <video controls src={postResult.media_url} style={{ maxHeight: 360, maxWidth: "100%" }} />
                  ) : (
                    <img src={postResult.media_url} alt="Post preview" style={{ maxHeight: 360, maxWidth: "100%", objectFit: "contain" }} />
                  )}
                </div>
              )}

              {postResult.caption && (
                <div style={{ padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 4, border: "1px solid var(--border)", fontSize: 12, color: "#eee", whiteSpace: "pre-wrap" }}>
                  <strong>Caption:</strong> {postResult.caption}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {Object.entries(postResult.mirrors).map(([name, url]) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      color: "var(--cyan)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <LinkIcon size={11} /> View on {name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BATCH / CLI LOOTER (InstaLooter Core) */}
      {/* ========================================================================= */}
      {activeTab === "cli" && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Executes the native <code>instalooter</code> CLI in an isolated sandbox. Extracts media JSON metadata or downloads batch files.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={cliType}
                onChange={(e) => setCliType(e.target.value as any)}
                style={{ padding: 8, fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", color: "#fff" }}
              >
                <option value="user">User Profile</option>
                <option value="hashtag">Hashtag (#)</option>
                <option value="post">Post Token</option>
              </select>

              <input
                value={cliTarget}
                onChange={(e) => setCliTarget(e.target.value)}
                placeholder={cliType === "user" ? "Username (e.g. nasa)" : cliType === "hashtag" ? "Hashtag without # (e.g. osint)" : "Post shortcode"}
                style={{ flex: 1, minWidth: 200, padding: 8, fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Max Files:</span>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={cliCount}
                  onChange={(e) => setCliCount(parseInt(e.target.value) || 5)}
                  style={{ width: 60, padding: 4 }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={cliGetVideos}
                  onChange={(e) => setCliGetVideos(e.target.checked)}
                />
                Include Videos (-v)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={cliDumpOnly}
                  onChange={(e) => setCliDumpOnly(e.target.checked)}
                />
                Metadata Only (-D)
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={handleRunCli}
                disabled={cliLoading || !cliTarget.trim()}
                style={{ padding: "8px 18px", fontWeight: "bold" }}
              >
                {cliLoading ? "RUNNING INSTALOOTER CLI..." : "EXECUTE CLI LOOTER"}
              </button>
            </div>
          </div>

          {cliResult && (
            <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: "bold", color: cliResult.success ? "#00ff9f" : "#ffaa33" }}>
                  {cliResult.success ? "EXECUTION COMPLETED" : "EXECUTION RETURNED LOGS"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {cliResult.files_looted.length} file(s) generated
                </span>
              </div>

              {cliResult.error && (
                <div style={{ color: "#ff5577", fontSize: 12, marginBottom: 8 }}>
                  {cliResult.error}
                </div>
              )}

              {cliResult.raw_output && (
                <pre style={{ margin: 0, padding: 10, background: "#05070d", border: "1px solid var(--panel-border)", fontSize: 11, fontFamily: "monospace", color: "var(--cyan)", maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap" }}>
                  {cliResult.raw_output}
                </pre>
              )}

              {cliResult.files_looted.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 12, color: "#fff" }}>Looted Files in Sandbox:</strong>
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, color: "var(--text-muted)" }}>
                    {cliResult.files_looted.map((f, i) => (
                      <li key={i}>
                        {f.filename} ({Math.round(f.size_bytes / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
