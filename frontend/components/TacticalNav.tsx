"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SearchIcon, CrossIcon } from "@/components/FlatIcons";

export type NavItem = {
  id: string;
  label: string;
  hub: "investigation" | "identity" | "social" | "deep" | "arsenal";
  icon: React.ReactNode;
  content: React.ReactNode;
  description?: string;
};

type HubConfig = {
  id: "investigation" | "identity" | "social" | "deep" | "arsenal";
  label: string;
  tag: string;
  accent: string;
  iconSvg: React.ReactNode;
};

const HUBS: HubConfig[] = [
  {
    id: "investigation",
    label: "INVESTIGATION",
    tag: "CASES & GRAPH",
    accent: "#05D9E8",
    iconSvg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "identity",
    label: "IDENTITY & BIOMETRICS",
    tag: "PERSONS & ACCOUNTS",
    accent: "#FFB800",
    iconSvg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "social",
    label: "SOCIAL HARVESTERS",
    tag: "MEDIA & CHANNELS",
    accent: "#FF2A6D",
    iconSvg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    id: "deep",
    label: "DEEP WEB & INFRA",
    tag: "TOR, GEO & DORKS",
    accent: "#A259FF",
    iconSvg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "arsenal",
    label: "ARSENAL & ENGINES",
    tag: "AUTOMATION & TOOLS",
    accent: "#00FF9F",
    iconSvg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="12" x2="19" y2="5" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export default function TacticalNav({ items }: { items: NavItem[] }) {
  const [activeHub, setActiveHub] = useState<HubConfig["id"]>("investigation");
  const [activeItemId, setActiveItemId] = useState<string>(items[0]?.id || "");
  const [visitedTools, setVisitedTools] = useState<Set<string>>(() => new Set([items[0]?.id || "cases"]));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Tools in current Hub
  const currentHubTools = useMemo(() => {
    return items.filter((item) => item.hub === activeHub);
  }, [items, activeHub]);

  // Active Tool Object
  const currentTool = useMemo(() => {
    return items.find((item) => item.id === activeItemId) || items[0];
  }, [items, activeItemId]);

  // Switch tool with View Transitions & Tab Keep-Alive
  const transitionToTool = (toolId: string) => {
    setVisitedTools((prev) => {
      if (prev.has(toolId)) return prev;
      const next = new Set(prev);
      next.add(toolId);
      return next;
    });

    const target = items.find((i) => i.id === toolId);
    if (target && target.hub !== activeHub) {
      setActiveHub(target.hub);
    }

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        setActiveItemId(toolId);
      });
    } else {
      setActiveItemId(toolId);
    }
  };

  // Keyboard shortcut for Quick Search (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtered tools in search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const activeHubObj = HUBS.find((h) => h.id === activeHub) || HUBS[0];

  return (
    <div style={{ width: "100%", position: "relative", zIndex: 10 }}>
      {/* =========================================================================
          1. PRIMARY COMMAND HUBS (Top Category Deck)
          ========================================================================= */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Desktop Hub Buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            flex: "1 1 auto",
          }}
        >
          {HUBS.map((hub) => {
            const isActive = activeHub === hub.id;
            const hubToolCount = items.filter((i) => i.hub === hub.id).length;
            return (
              <button
                key={hub.id}
                onClick={() => {
                  setActiveHub(hub.id);
                  const firstTool = items.find((i) => i.hub === hub.id);
                  if (firstTool) {
                    transitionToTool(firstTool.id);
                  }
                }}
                style={{
                  position: "relative",
                  padding: "10px 16px",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  fontWeight: "bold",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderColor: isActive ? hub.accent : "rgba(30, 38, 54, 0.8)",
                  background: isActive ? `${hub.accent}18` : "rgba(17, 21, 31, 0.7)",
                  color: isActive ? hub.accent : "var(--text-muted)",
                  boxShadow: isActive ? `0 0 16px ${hub.accent}30` : "none",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-flex", color: isActive ? hub.accent : "var(--text-muted)" }}>
                  {hub.iconSvg}
                </span>
                <span>{hub.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: isActive ? `${hub.accent}30` : "rgba(255, 255, 255, 0.06)",
                    color: isActive ? "#ffffff" : "var(--text-muted)",
                  }}
                >
                  {hubToolCount}
                </span>
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: -1,
                      left: "15%",
                      right: "15%",
                      height: 2,
                      background: hub.accent,
                      boxShadow: `0 0 8px ${hub.accent}`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Search Shortcut Button */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            fontSize: 12,
            letterSpacing: "0.08em",
            borderColor: "rgba(5, 217, 232, 0.3)",
            background: "rgba(10, 12, 18, 0.8)",
            color: "var(--cyan)",
            cursor: "pointer",
          }}
          title="Search all 24 OSINT tools (Ctrl+K)"
        >
          <SearchIcon size={13} color="var(--cyan)" />
          <span>QUICK JUMP</span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 5px",
              background: "rgba(5, 217, 232, 0.15)",
              border: "1px solid rgba(5, 217, 232, 0.3)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            ⌘K
          </span>
        </button>
      </div>

      {/* =========================================================================
          2. ACTIVE SUB-TOOLS DOCK (Clean, Focused Horizontal Row)
          ========================================================================= */}
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          padding: "8px 12px",
          background: "rgba(10, 12, 18, 0.9)",
          border: `1px solid ${activeHubObj.accent}40`,
          borderLeft: `4px solid ${activeHubObj.accent}`,
          marginBottom: 20,
          borderRadius: 4,
          boxShadow: `0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 15px ${activeHubObj.accent}0a`,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: activeHubObj.accent,
            fontWeight: "bold",
            letterSpacing: "0.12em",
            marginRight: 8,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {activeHubObj.tag} //
        </span>

        {currentHubTools.map((tool) => {
          const isToolActive = activeItemId === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => transitionToTool(tool.id)}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                letterSpacing: "0.08em",
                fontWeight: isToolActive ? "bold" : "normal",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                border: isToolActive
                  ? `1px solid ${activeHubObj.accent}`
                  : "1px solid rgba(30, 38, 54, 0.7)",
                background: isToolActive
                  ? `${activeHubObj.accent}20`
                  : "rgba(17, 21, 31, 0.5)",
                color: isToolActive ? "#ffffff" : "var(--text)",
                boxShadow: isToolActive ? `0 0 12px ${activeHubObj.accent}40` : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tool.icon && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: isToolActive ? activeHubObj.accent : "var(--text-muted)",
                  }}
                >
                  {tool.icon}
                </span>
              )}
              {tool.label}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          3. ACTIVE TOOL WORKSPACE CONTAINER
          ========================================================================= */}
      <div
        id="tool-viewport"
        style={{
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          padding: 24,
          clipPath:
            "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
          minHeight: 500,
        }}
      >
        {items.map((item) => {
          const isVisited = visitedTools.has(item.id);
          const isCurrent = activeItemId === item.id;
          if (!isVisited && !isCurrent) return null;
          return (
            <div
              key={item.id}
              style={{
                display: isCurrent ? "block" : "none",
                height: "100%",
              }}
            >
              {item.content}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          4. QUICK-SEARCH COMMAND PALETTE MODAL (Ctrl+K)
          ========================================================================= */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6, 8, 18, 0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: "12vh",
            zIndex: 99999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: 640,
              background: "#0c101a",
              border: "1px solid var(--cyan)",
              boxShadow: "0 0 32px rgba(5, 217, 232, 0.35)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Search Input Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: "1px solid rgba(5, 217, 232, 0.25)",
                gap: 12,
                background: "#070913",
              }}
            >
              <SearchIcon size={18} color="var(--cyan)" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all 24 OSINT scrapers & tools..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  color: "#ffffff",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.08em",
                }}
              />
              <button
                onClick={() => setSearchOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <CrossIcon size={16} />
              </button>
            </div>

            {/* Tool List */}
            <div
              style={{
                maxHeight: 380,
                overflowY: "auto",
                padding: "10px 8px",
              }}
            >
              {searchResults.map((item) => {
                const hubObj = HUBS.find((h) => h.id === item.hub);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      transitionToTool(item.id);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background:
                        activeItemId === item.id
                          ? "rgba(5, 217, 232, 0.12)"
                          : "transparent",
                      border:
                        activeItemId === item.id
                          ? "1px solid rgba(5, 217, 232, 0.3)"
                          : "1px solid transparent",
                      transition: "background 0.12s",
                      marginBottom: 4,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(5, 217, 232, 0.08)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        activeItemId === item.id
                          ? "rgba(5, 217, 232, 0.12)"
                          : "transparent")
                    }
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        style={{
                          color: hubObj?.accent || "var(--cyan)",
                          display: "inline-flex",
                          padding: 6,
                          background: "rgba(255, 255, 255, 0.04)",
                          borderRadius: 4,
                        }}
                      >
                        {item.icon}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: "bold",
                            color: "#ffffff",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {item.label}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: `${hubObj?.accent}20`,
                        color: hubObj?.accent || "var(--cyan)",
                        fontWeight: "bold",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {hubObj?.label}
                    </span>
                  </div>
                );
              })}

              {searchResults.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  No tools found matching &quot;{searchQuery}&quot;
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 16px",
                borderTop: "1px solid rgba(30, 38, 54, 0.8)",
                fontSize: 11,
                color: "var(--text-muted)",
                display: "flex",
                justifyContent: "space-between",
                background: "#070913",
              }}
            >
              <span>Tip: Press ESC to close</span>
              <span>24 OSINT Modules Available</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
