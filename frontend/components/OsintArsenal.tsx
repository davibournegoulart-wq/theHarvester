"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import { CheckIcon } from "@/components/FlatIcons";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  url?: string;
  install?: {
    method: string;
    kali?: string;
    raw?: string;
  };
  tags: string[];
};

// Mapping of Arsenal catalog tools that have direct, native in-app counterparts
const NATIVE_TOOL_MAP: Record<string, { tab: string; feature: string }> = {
  "sherlock": { tab: "USERNAME", feature: "400+ platform username checking engine" },
  "blackbird": { tab: "USERNAME", feature: "Native username checker with Blackbird endpoints" },
  "whatsmyname": { tab: "USERNAME", feature: "Fast username enumeration across hundreds of sites" },
  "holehe": { tab: "EMAIL", feature: "Password reset / registered services checker" },
  "mailaccess": { tab: "EMAIL", feature: "Infostealer malware detection, M365 tenant realm & MX checks" },
  "phoneinfoga": { tab: "PHONE", feature: "Phone carrier, line type, format & WhatsApp/TG validation" },
  "ghosttrack": { tab: "DOMAIN/IP", feature: "IP Geolocation, ASN Network Tracer & Carrier Intel" },
  "ignorant": { tab: "PHONE", feature: "Phone registration checkers" },
  "moriarty": { tab: "PHONE", feature: "Reverse caller ID search links & spam report pivots" },
  "theharvester": { tab: "DOMAIN/IP", feature: "Subdomain discovery, DNS resolution, and TLS certs" },
  "sublist3r": { tab: "DOMAIN/IP", feature: "Certificate Transparency (crt.sh) subdomains scanner" },
  "amass": { tab: "DOMAIN/IP", feature: "Domain reconnaissance & correlation graph" },
  "pic2map": { tab: "GEOLOCATION", feature: "Photo EXIF GPS extractor & reverse geocoding" },
  "netryx": { tab: "GEOLOCATION", feature: "Streetview Panorama & Landmark Geolocation AI" },
  "ghunt": { tab: "TOOLS", feature: "Google GAIA ID, Hangouts, and Google Photos profile extractor" },
  "exiftool": { tab: "TOOLS", feature: "Image EXIF metadata & GPS coordinate mapper" },
  "search-by-image": { tab: "TOOLS", feature: "Multi-engine reverse image search (Lens, Yandex, Baidu, PimEyes)" },
  "bellingcat": { tab: "TOOLS", feature: "Bellingcat Open Source Investigation Toolkit repository" },
  "waybackpy": { tab: "TOOLS", feature: "Wayback Machine web archive historical snapshots" },
  "wayback": { tab: "TOOLS", feature: "Internet Archive Wayback Machine engine" },
  "haveibeenpwned": { tab: "TOOLS", feature: "k-Anonymity password breach & pwned email checker" },
  "hibp": { tab: "TOOLS", feature: "Data breach verification engine" },
  "spiderfoot": { tab: "AUTO-RECON", feature: "Automated multi-target OSINT reconnaissance workflow" },
  "maltego": { tab: "GRAPH", feature: "Interactive graph, link analysis & shortest path finder" },
  "relationsfb": { tab: "META (FB/IG/WA)", feature: "GraphQL scraper for Facebook friends, followers & schools" },
  "sellerfb": { tab: "META (FB/IG/WA)", feature: "Facebook Marketplace seller listings reconnaissance" },
  "osint-for-countries": { tab: "GLOBAL", feature: "240+ territory intelligence geodatabase" },
  "sec-edgar": { tab: "CORPORATE", feature: "US SEC EDGAR 10-K public company filings search" },
  "offshoreleaks": { tab: "CORPORATE", feature: "ICIJ Offshore Leaks (Panama/Pandora Papers) search" },
  "ahmia": { tab: "DARK WEB", feature: "Native Tor Ahmia search engine" },
  "telegram": { tab: "TELEGRAM", feature: "Native profile, channel metadata & message feed inspector" },
  "instalooter": { tab: "META (FB/IG/WA)", feature: "InstaLooter Profile, Post, and Media Scraping Suite" },
  "insta-looter": { tab: "META (FB/IG/WA)", feature: "Clojure-adapted Instagram Profile & Post Looting API" },
  "ofxinstalooter": { tab: "META (FB/IG/WA)", feature: "Interactive Media Looting & Case Databank Attachment UI" },
  "facebook-stalker": { tab: "META (FB/IG/WA)", feature: "Facebook-Stalker Profile & Social Closeness Weight Matrix" },
  "osintgram": { tab: "META (FB/IG/WA)", feature: "Osintgram Deep Instagram Shell & AI Scene Reconnaissance" },
  "instaloader": { tab: "META (FB/IG/WA)", feature: "Instaloader Post, Reel, Highlight & Media Downloader" },
  "linkdtime": { tab: "CORPORATE", feature: "LinkdTime 41-bit Snowflake LinkedIn Activity Timelines" },
  "social-media-osint-tools-collection": { tab: "TOOLS", feature: "165+ Social Media OSINT Tools Directory across 15+ networks" },
  "social-osint": { tab: "TOOLS", feature: "Social Media OSINT Tools Collection" },
};

function getNativeEquivalent(tool: Tool) {
  const id = tool.id.toLowerCase();
  for (const [key, mapping] of Object.entries(NATIVE_TOOL_MAP)) {
    if (id.includes(key)) {
      return mapping;
    }
  }
  return null;
}

export default function OsintArsenal() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [filterNativeOnly, setFilterNativeOnly] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchTools();
  }, []);

  useEffect(() => {
    fetchTools();
  }, [search, selectedCategory]);

  const fetchCategories = async () => {
    try {
      const data = await apiGet<{ categories: string[] }>("/arsenal/categories");
      setCategories(data.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTools = async () => {
    setLoading(true);
    try {
      let path = "/arsenal/tools";
      const params = new URLSearchParams();
      if (search) params.append("query", search);
      if (selectedCategory) params.append("category", selectedCategory);
      
      if (params.toString()) {
        path += "?" + params.toString();
      }

      const data = await apiGet<{ tools: Tool[] }>(path);
      setTools(data.tools || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const displayedTools = filterNativeOnly
    ? tools.filter((t) => getNativeEquivalent(t) !== null)
    : tools;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            OSINT ARSENAL
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0 0" }}>
            Searchable directory of 880+ Open-Source Intelligence tools with integrated native modules.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => setFilterNativeOnly(!filterNativeOnly)}
            className="btn btn-sm"
            style={{
              background: filterNativeOnly ? "rgba(5, 217, 232, 0.2)" : "transparent",
              borderColor: "var(--cyan)",
              color: "var(--cyan)",
              fontWeight: "bold",
            }}
          >
            {filterNativeOnly ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <CheckIcon size={13} color="var(--cyan)" /> Showing Native In-App Only
              </span>
            ) : (
              "Filter: Native In-App Modules"
            )}
          </button>
          <span className="badge" style={{ background: "rgba(5, 217, 232, 0.1)", color: "var(--cyan)", padding: "6px 12px", fontSize: 13 }}>
            {displayedTools.length} {filterNativeOnly ? "Native Tools" : "Total Tools"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <input 
          type="text" 
          placeholder="Search by name, description, or tag..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 2, padding: "8px 12px" }}
        />
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", background: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/-/g, " ").toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--cyan)" }}>Loading tools database...</div>
      ) : (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
          gap: 16,
          maxHeight: "650px",
          overflowY: "auto",
          paddingRight: "8px"
        }}>
          {displayedTools.map((tool) => {
            const nativeEquiv = getNativeEquivalent(tool);
            return (
              <div key={tool.id} style={{
                background: nativeEquiv ? "rgba(5, 217, 232, 0.04)" : "rgba(255,255,255,0.02)",
                border: nativeEquiv ? "1px solid rgba(5, 217, 232, 0.35)" : "1px solid rgba(255,255,255,0.05)",
                padding: 16,
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: "var(--cyan)" }}>{tool.name}</h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {nativeEquiv && (
                      <span style={{
                        fontSize: 10,
                        background: "rgba(0, 255, 100, 0.15)",
                        border: "1px solid #00ff66",
                        color: "#00ff66",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: "bold",
                      }}>
                        NATIVE IN-APP
                      </span>
                    )}
                    {tool.category && (
                      <span style={{ 
                        fontSize: 10, 
                        background: "rgba(255,255,255,0.1)", 
                        padding: "2px 6px", 
                        borderRadius: 4 
                      }}>
                        {tool.category.replace(/-/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
                
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px 0", flex: 1, lineHeight: 1.4 }}>
                  {tool.description}
                </p>

                {nativeEquiv && (
                  <div style={{
                    marginBottom: 12,
                    padding: "6px 10px",
                    background: "rgba(5, 217, 232, 0.08)",
                    borderRadius: 4,
                    borderLeft: "3px solid var(--cyan)",
                    fontSize: 11,
                    color: "var(--cyan)",
                  }}>
                    <strong>Integrated Tab: [{nativeEquiv.tab}]</strong> — {nativeEquiv.feature}
                  </div>
                )}
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {tool.tags?.slice(0, 3).map(tag => (
                    <span key={tag} style={{ fontSize: 10, color: "#888", border: "1px solid #333", padding: "2px 6px", borderRadius: 4 }}>
                      #{tag}
                    </span>
                  ))}
                </div>
                
                <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center", flexWrap: "wrap" }}>
                  {tool.url && (
                    <a 
                      href={tool.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn"
                      style={{ flex: 1, textAlign: "center", textDecoration: "none", fontSize: 12, minWidth: 90 }}
                    >
                      Open Link ↗
                    </a>
                  )}
                  {tool.install?.kali && (
                    <button 
                      className="btn"
                      onClick={() => copyToClipboard(tool.install!.kali!)}
                      style={{ flex: 1, fontSize: 12, minWidth: 90 }}
                    >
                      {copiedText === tool.install.kali ? "Copied!" : "Copy Install"}
                    </button>
                  )}
                  <SaveToCaseButton
                    identifierType="url"
                    identifierValue={tool.url || tool.name}
                    platform={`arsenal.${(tool.category || "general").toLowerCase().replace(/[^a-z0-9]/g, "_")}`}
                    url={tool.url}
                    discoveredBy="OSINT Arsenal"
                    metadata={{
                      tool_name: tool.name,
                      category: tool.category,
                      description: tool.description,
                      native_tab: nativeEquiv?.tab,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {displayedTools.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              No tools found matching your criteria.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
