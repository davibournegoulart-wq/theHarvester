"use client";

import React, { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  FacebookIcon,
  SearchIcon,
  CrossIcon,
  CheckIcon,
  GlobeIcon,
  LayersIcon,
  RadarIcon,
  ShieldIcon,
  EyeIcon,
} from "./FlatIcons";

type FBProfileData = {
  uid: string;
  username: string;
  name?: string;
  profile_pic?: string;
  is_numeric: boolean;
};

type FBStalkerResponse = {
  profile: FBProfileData;
  dorks: Record<string, string>;
};

type ContactWeight = {
  name: string;
  username?: string;
  userid?: string;
  profile_url: string;
  weight: number;
  tier: string;
  color: string;
  risk: string;
  signals: {
    wall_posts: number;
    comments: number;
    likes: number;
    tagged_media: number;
    shared_tags: number;
    mutual_friends: number;
  };
};

type MatrixResult = {
  target: string;
  total_contacts: number;
  total_network_weight: number;
  average_weight: number;
  high_priority_associates: ContactWeight[];
  contacts: ContactWeight[];
};

export default function FacebookStalkerTool() {
  const { activeCase } = useActiveCase();
  const [targetInput, setTargetInput] = useState("");
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stalkerData, setStalkerData] = useState<FBStalkerResponse | null>(null);

  // Matrix calculation state
  const [contactsList, setContactsList] = useState<
    Array<{
      name: string;
      username: string;
      wall_posts: number;
      comments: number;
      likes: number;
      tagged_media: number;
      shared_tags: number;
      mutual_friends: number;
    }>
  >([
    {
      name: "Suspect Primary Contact",
      username: "associate_1",
      wall_posts: 2,
      comments: 5,
      likes: 8,
      tagged_media: 3,
      shared_tags: 1,
      mutual_friends: 4,
    },
  ]);

  const [matrixResult, setMatrixResult] = useState<MatrixResult | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // Form submit: Resolve Target Profile & Dorks
  const handleResolveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInput.trim()) return;

    setLoading(true);
    setError(null);
    setStalkerData(null);

    try {
      const res = await apiGet<FBStalkerResponse>(
        `/recon/facebook/stalker/profile?target=${encodeURIComponent(targetInput.trim())}&use_tor=${useTor}`
      );
      setStalkerData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to resolve Facebook profile intelligence");
    } finally {
      setLoading(false);
    }
  };

  // Add contact to matrix
  const handleAddContact = () => {
    setContactsList([
      ...contactsList,
      {
        name: `Contact #${contactsList.length + 1}`,
        username: `user_${contactsList.length + 1}`,
        wall_posts: 0,
        comments: 1,
        likes: 1,
        tagged_media: 0,
        shared_tags: 0,
        mutual_friends: 0,
      },
    ]);
  };

  // Calculate Closeness Matrix
  const handleCalculateMatrix = async () => {
    setLoadingMatrix(true);
    try {
      const formatted = contactsList.map((c) => ({
        name: c.name,
        username: c.username,
        signals: {
          wall_posts: c.wall_posts,
          comments: c.comments,
          likes: c.likes,
          tagged_media: c.tagged_media,
          shared_tags: c.shared_tags,
          mutual_friends: c.mutual_friends,
        },
      }));

      const res = await apiPostJson<MatrixResult>("/recon/facebook/stalker/matrix", {
        target: stalkerData?.profile.username || targetInput || "target",
        contacts: formatted,
      });
      setMatrixResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed calculating interaction matrix");
    } finally {
      setLoadingMatrix(false);
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
              background: "rgba(24, 119, 242, 0.15)",
              border: "1px solid #1877f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FacebookIcon size={20} color="#1877f2" />
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              Facebook-Stalker: Deep Profiling &amp; Social Graph Weighting
              <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(24, 119, 242, 0.2)", color: "#1877f2", borderRadius: 4, border: "1px solid #1877f2" }}>
                Mudgerikar/Facebook-Stalker
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Permanent UID resolution, Graph Search dork extraction, and social interaction closeness scoring (+5, +4, +3, +2, +1).
            </div>
          </div>
        </div>

        {/* Tor Toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: useTor ? "var(--green)" : "var(--text-muted)" }}>
          <input type="checkbox" checked={useTor} onChange={(e) => setUseTor(e.target.checked)} />
          <span>Route via Tor (Port 9050)</span>
        </label>
      </div>

      {/* Target Search Form */}
      <form onSubmit={handleResolveTarget} style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="Enter Facebook username, vanity ID, or full profile URL (e.g. zuck, mark.smith, 4)..."
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
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
          disabled={loading || !targetInput.trim()}
          style={{
            padding: "10px 18px",
            background: "#1877f2",
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
          {loading ? "Resolving Target..." : "Investigate Target"}
        </button>
      </form>

      {error && (
        <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Target Dossier & Dorks */}
      {stalkerData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              {stalkerData.profile.profile_pic ? (
                <img
                  src={stalkerData.profile.profile_pic}
                  alt={stalkerData.profile.name || stalkerData.profile.username}
                  style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #1877f2", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(24, 119, 242, 0.2)",
                    border: "2px solid #1877f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FacebookIcon size={28} color="#1877f2" />
                </div>
              )}

              <div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff" }}>
                  {stalkerData.profile.name || stalkerData.profile.username}
                </div>
                <div style={{ fontSize: 12, color: "var(--cyan)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>UID: <code>{stalkerData.profile.uid}</code></span>
                  <span>&bull;</span>
                  <span>Username: @{stalkerData.profile.username}</span>
                </div>
              </div>
            </div>

            <SaveToCaseButton
              identifierType="person"
              platform="facebook.stalker"
              discoveredBy="Facebook-Stalker"
              identifierValue={stalkerData.profile.uid}
              metadata={{
                name: stalkerData.profile.name,
                username: stalkerData.profile.username,
                uid: stalkerData.profile.uid,
                profile_pic: stalkerData.profile.profile_pic,
              }}
            />

          </div>

          {/* Graph Search & Mobile Bypass Endpoints */}
          <div style={{ background: "#0b0f14", border: "1px solid var(--panel-border)", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <RadarIcon size={14} color="var(--cyan)" />
              Direct Graph Search &amp; Mobile Mbasic Bypass Shortcuts
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {Object.entries(stalkerData.dorks).map(([key, url]) => {
                const label = key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#161b22",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 4,
                      color: "#fff",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    <span>{label}</span>
                    <EyeIcon size={12} color="var(--cyan)" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Social Closeness Weight Matrix (Mudgerikar Algorithm) */}
      <div style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
              <LayersIcon size={14} color="#1877f2" />
              Social Closeness &amp; Interaction Weight Calculator
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Weighs interaction intensity: Wall Post (+5), Tagged in Media (+4), Comments (+3), Shared Tags (+3), Likes (+2), Mutual Friends (+1).
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleAddContact}
              style={{
                padding: "6px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--panel-border)",
                color: "#fff",
                fontSize: 12,
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              + Add Contact
            </button>
            <button
              type="button"
              onClick={handleCalculateMatrix}
              disabled={loadingMatrix}
              style={{
                padding: "6px 14px",
                background: "#1877f2",
                border: "none",
                color: "#fff",
                fontSize: 12,
                borderRadius: 4,
                cursor: loadingMatrix ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {loadingMatrix ? "Calculating..." : "Compute Interaction Weights"}
            </button>
          </div>
        </div>

        {/* Contacts Input Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--panel-border)", color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Contact Name</th>
                <th style={{ padding: 8 }}>Wall Posts (+5)</th>
                <th style={{ padding: 8 }}>Tagged Media (+4)</th>
                <th style={{ padding: 8 }}>Comments (+3)</th>
                <th style={{ padding: 8 }}>Shared Tags (+3)</th>
                <th style={{ padding: 8 }}>Likes (+2)</th>
                <th style={{ padding: 8 }}>Mutual (+1)</th>
                <th style={{ padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {contactsList.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: 8 }}>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].name = e.target.value;
                        setContactsList(updated);
                      }}
                      style={{ padding: "4px 8px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={c.wall_posts}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].wall_posts = parseInt(e.target.value) || 0;
                        setContactsList(updated);
                      }}
                      style={{ width: 50, padding: "4px 6px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={c.tagged_media}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].tagged_media = parseInt(e.target.value) || 0;
                        setContactsList(updated);
                      }}
                      style={{ width: 50, padding: "4px 6px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={c.comments}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].comments = parseInt(e.target.value) || 0;
                        setContactsList(updated);
                      }}
                      style={{ width: 50, padding: "4px 6px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={c.shared_tags}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].shared_tags = parseInt(e.target.value) || 0;
                        setContactsList(updated);
                      }}
                      style={{ width: 50, padding: "4px 6px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={c.likes}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].likes = parseInt(e.target.value) || 0;
                        setContactsList(updated);
                      }}
                      style={{ width: 50, padding: "4px 6px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      min="0"
                      value={c.mutual_friends}
                      onChange={(e) => {
                        const updated = [...contactsList];
                        updated[i].mutual_friends = parseInt(e.target.value) || 0;
                        setContactsList(updated);
                      }}
                      style={{ width: 50, padding: "4px 6px", background: "#0d1117", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => setContactsList(contactsList.filter((_, idx) => idx !== i))}
                      style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer" }}
                    >
                      <CrossIcon size={12} color="var(--red)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Matrix Results */}
        {matrixResult && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0b0f14", padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
                Ranked Associates Matrix ({matrixResult.contacts.length} associates analyzed)
              </div>
              <SaveToCaseButton
                identifierType="person"
                platform="facebook.stalker.matrix"
                discoveredBy="Facebook-Stalker"
                identifierValue={`matrix-${Date.now()}`}
                metadata={{
                  target: matrixResult.target,
                  total_weight: matrixResult.total_network_weight,
                  average_weight: matrixResult.average_weight,
                  top_associate: matrixResult.contacts[0]?.name,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {matrixResult.contacts.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "#0d1117",
                    border: `1px solid ${c.weight >= 8 ? c.color : "var(--panel-border)"}`,
                    borderRadius: 6,
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.05)",
                        color: c.color,
                        fontWeight: "bold",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${c.color}`,
                      }}
                    >
                      {c.weight}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: c.color, marginTop: 1 }}>
                        {c.tier} &bull; Priority Risk: {c.risk}
                      </div>
                    </div>
                  </div>

                  <SaveToCaseButton
                    identifierType="person"
                    platform="facebook.stalker.associate"
                    discoveredBy="Facebook-Stalker"
                    identifierValue={c.username || c.name}
                    metadata={{
                      name: c.name,
                      closeness_score: c.weight,
                      tier: c.tier,
                      risk: c.risk,
                      signals: c.signals,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
