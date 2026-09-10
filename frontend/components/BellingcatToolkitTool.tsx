"use client";

import { useState, useEffect, useMemo } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  FolderIcon,
  SearchIcon,
  LinkIcon,
  GlobeIcon,
  MapIcon,
  CameraIcon,
  BoxIcon,
  BuildingIcon,
  ShieldIcon,
  TerminalIcon,
} from "@/components/FlatIcons";

type BellingcatTool = {
  name: string;
  category: string;
  url: string;
  description: string;
  tags: string[];
};

const CATEGORIES = [
  "All",
  "Maps & Satellites",
  "Geolocation",
  "Image & Video",
  "Transport",
  "Companies & Finance",
  "Conflict & Events",
  "Archiving",
  "Infrastructure & IoT",
];

export default function BellingcatToolkitTool() {
  const { activeCase } = useActiveCase();
  const [tools, setTools] = useState<BellingcatTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadToolkit() {
      setLoading(true);
      try {
        const data = await apiGet<BellingcatTool[]>("/recon/bellingcat/toolkit");
        setTools(data || []);
      } catch (e) {
        console.error("Failed to load Bellingcat toolkit:", e);
      } finally {
        setLoading(false);
      }
    }
    loadToolkit();
  }, []);

  const filteredTools = useMemo(() => {
    let result = tools;
    if (selectedCategory !== "All") {
      result = result.filter(
        (t) => t.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tools, selectedCategory, searchQuery]);

  return (
    <div style={{ marginTop: 32, borderTop: "1px solid var(--panel-border)", paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FolderIcon size={18} color="var(--cyan)" />
          <div>
            <h3 style={{ margin: 0, color: "var(--cyan)", fontSize: 16 }}>
              Bellingcat Open Source Investigation Toolkit
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Official repository of verification tools, satellite imagery, flight trackers, and forensic platforms (bellingcat/toolkit).
            </p>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {filteredTools.length} / {tools.length} TOOLS AVAILABLE
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 260 }}>
          <SearchIcon size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search Bellingcat tools by name, keyword, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 12,
                cursor: "pointer",
                background: isActive ? "rgba(5, 217, 232, 0.2)" : "rgba(255, 255, 255, 0.04)",
                border: isActive ? "1px solid var(--cyan)" : "1px solid var(--border)",
                color: isActive ? "var(--cyan)" : "var(--text-muted)",
                fontWeight: isActive ? "bold" : "normal",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Tool List Grid */}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Loading Bellingcat investigation catalog...
        </div>
      ) : filteredTools.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          No tools match the selected filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {filteredTools.map((t, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 13, color: "#fff" }}>{t.name}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: "rgba(5, 217, 232, 0.1)",
                      color: "var(--cyan)",
                      border: "1px solid rgba(5, 217, 232, 0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.category}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {t.description}
                </p>
                {t.tags && t.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {t.tags.map((tag, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 9,
                          fontFamily: "monospace",
                          color: "#888",
                          background: "rgba(255, 255, 255, 0.05)",
                          padding: "1px 4px",
                          borderRadius: 2,
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11,
                    color: "var(--cyan)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                    fontWeight: "bold",
                  }}
                >
                  <LinkIcon size={12} color="var(--cyan)" /> Launch Tool
                </a>

                <SaveToCaseButton
                  identifierType="url"
                  identifierValue={t.url}
                  platform={`bellingcat.${t.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`}
                  url={t.url}
                  discoveredBy="Bellingcat Toolkit"
                  metadata={{
                    tool_name: t.name,
                    category: t.category,
                    description: t.description,
                    tags: t.tags,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
