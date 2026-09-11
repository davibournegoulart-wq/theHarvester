"use client";

import React, { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  SearchIcon,
  GlobeIcon,
  LayersIcon,
  CrossIcon,
  EyeIcon,
  DatabaseIcon,
  ExternalLinkIcon,
} from "./FlatIcons";

type ToolItem = {
  platform: string;
  name: string;
  url: string;
  category: string;
  description: string;
};

type CollectionResponse = {
  total: number;
  platforms: string[];
  categories: string[];
  tools: ToolItem[];
};

export default function SocialToolsDirectory() {
  const { activeCase } = useActiveCase();
  const [query, setQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [data, setData] = useState<CollectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query.trim() ? `&query=${encodeURIComponent(query.trim())}` : "";
      const p = selectedPlatform !== "all" ? `&platform=${encodeURIComponent(selectedPlatform)}` : "";
      const c = selectedCategory !== "all" ? `&category=${encodeURIComponent(selectedCategory)}` : "";
      const res = await apiGet<CollectionResponse>(`/recon/social-tools-collection?${q}${p}${c}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed loading social media tools collection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [selectedPlatform, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTools();
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedPlatform("all");
    setSelectedCategory("all");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Banner */}
      <div
        style={{
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          padding: 16,
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
              background: "rgba(5, 217, 232, 0.15)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GlobeIcon size={20} color="var(--cyan)" />
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              Social Media OSINT Tools Arsenal (165+ Tools)
              <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(5, 217, 232, 0.2)", color: "var(--cyan)", borderRadius: 4, border: "1px solid var(--cyan)" }}>
                osintambition/Social-Media-OSINT-Tools-Collection
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Curated intelligence tools, dorks, extractors, and search engines spanning 15+ major social networks.
            </div>
          </div>
        </div>

        {data && (
          <div style={{ fontSize: 12, color: "var(--cyan)", background: "rgba(5, 217, 232, 0.1)", padding: "4px 10px", borderRadius: 4, border: "1px solid var(--cyan)" }}>
            Showing <strong>{data.tools.length}</strong> of {data.total} tools
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Search tools by name, description, capability, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "9px 12px",
              background: "#0d1117",
              border: "1px solid var(--panel-border)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "9px 16px",
              background: "var(--cyan)",
              color: "#000",
              fontWeight: "bold",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <SearchIcon size={14} color="#000" />
            Search
          </button>

          {(query || selectedPlatform !== "all" || selectedCategory !== "all") && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                padding: "9px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--panel-border)",
                color: "var(--text-muted)",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Reset
            </button>
          )}
        </form>

        {/* Platform Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Platform:</span>
          {["all", ...(data?.platforms || [])].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPlatform(p)}
              style={{
                padding: "3px 8px",
                borderRadius: 12,
                fontSize: 11,
                cursor: "pointer",
                background: selectedPlatform === p ? "var(--cyan)" : "#161b22",
                color: selectedPlatform === p ? "#000" : "#fff",
                border: selectedPlatform === p ? "1px solid var(--cyan)" : "1px solid rgba(255,255,255,0.1)",
                fontWeight: selectedPlatform === p ? "bold" : "normal",
              }}
            >
              {p === "all" ? "All Platforms" : p}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Category:</span>
          {["all", ...(data?.categories || [])].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              style={{
                padding: "3px 8px",
                borderRadius: 12,
                fontSize: 11,
                cursor: "pointer",
                background: selectedCategory === c ? "#70b5f9" : "#161b22",
                color: selectedCategory === c ? "#000" : "#fff",
                border: selectedCategory === c ? "1px solid #70b5f9" : "1px solid rgba(255,255,255,0.1)",
                fontWeight: selectedCategory === c ? "bold" : "normal",
              }}
            >
              {c === "all" ? "All Categories" : c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Tools Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {data?.tools.map((t, idx) => (
          <div
            key={`${t.name}-${idx}`}
            style={{
              background: "#0d1117",
              border: "1px solid var(--panel-border)",
              borderRadius: 6,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontWeight: "bold", fontSize: 14, color: "#fff" }}>
                  {t.name}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(5, 217, 232, 0.1)",
                    color: "var(--cyan)",
                    border: "1px solid rgba(5, 217, 232, 0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.platform}
                </span>
              </div>

              <div style={{ fontSize: 11, color: "#70b5f9", marginTop: 2 }}>
                {t.category}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                {t.description}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "var(--cyan)",
                  textDecoration: "none",
                  fontWeight: "bold",
                }}
              >
                <span>Launch Tool</span>
                <EyeIcon size={12} color="var(--cyan)" />
              </a>

              <SaveToCaseButton
                identifierType="url"
                platform={`tool.${t.platform.toLowerCase()}`}
                discoveredBy="SocialToolsCollection"
                identifierValue={t.url}
                metadata={{
                  tool_name: t.name,
                  platform: t.platform,
                  category: t.category,
                  url: t.url,
                  description: t.description,
                }}
              />
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
