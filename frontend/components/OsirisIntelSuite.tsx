"use client";

import React, { useState, useEffect } from "react";
import { apiGet } from "../lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  GlobeIcon,
  ShieldIcon,
  AlertIcon,
  EyeIcon,
  RadarIcon,
  RefreshCwIcon,
  SearchIcon,
  DownloadIcon,
  PinIcon,
  CrossIcon,
} from "./FlatIcons";

type OsirisTab =
  | "OVERVIEW"
  | "CONFLICTS"
  | "DISASTERS"
  | "CCTV"
  | "LIVE_NEWS"
  | "MARKETS"
  | "SANCTIONS";

export default function OsirisIntelSuite({
  onFocusCoordinates,
}: {
  onFocusCoordinates?: (lat: number, lon: number, zoom?: number) => void;
}) {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<OsirisTab>("OVERVIEW");

  // Telemetry state
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Conflicts
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<any>(null);

  // Earthquakes & Fires
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [fires, setFires] = useState<any[]>([]);
  const [disastersLoading, setDisastersLoading] = useState(false);

  // CCTV Cameras
  const [cctvList, setCctvList] = useState<any[]>([]);
  const [cctvLoading, setCctvLoading] = useState(false);
  const [cctvFilter, setCctvFilter] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<any>(null);

  // Live News
  const [newsFeeds, setNewsFeeds] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeStream, setActiveStream] = useState<any>(null);

  // Markets & SCM
  const [marketQuotes, setMarketQuotes] = useState<any[]>([]);
  const [scmAlerts, setScmAlerts] = useState<string[]>([]);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  const [marketsLoading, setMarketsLoading] = useState(false);

  // OFAC Sanctions
  const [sanctionsQuery, setSanctionsQuery] = useState("");
  const [sanctionsMatches, setSanctionsMatches] = useState<any[]>([]);
  const [sanctionsLoading, setSanctionsLoading] = useState(false);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const res = await apiGet<any>("/recon/osiris/summary");
      setSummary(res);
      loadConflicts();
    } catch (err) {
      console.warn("Error fetching Osiris summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }

  // Load Tab Data On Demand
  useEffect(() => {
    if (activeTab === "CONFLICTS" && conflicts.length === 0) loadConflicts();
    if (activeTab === "DISASTERS" && earthquakes.length === 0) loadDisasters();
    if (activeTab === "CCTV" && cctvList.length === 0) loadCctv();
    if (activeTab === "LIVE_NEWS" && newsFeeds.length === 0) loadNews();
    if (activeTab === "MARKETS" && marketQuotes.length === 0) loadMarkets();
  }, [activeTab]);

  async function loadConflicts() {
    setConflictsLoading(true);
    try {
      const res = await apiGet<any>("/recon/osiris/conflicts");
      setConflicts(res?.zones || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setConflictsLoading(false);
    }
  }

  async function loadDisasters() {
    setDisastersLoading(true);
    try {
      const [eqRes, fireRes] = await Promise.allSettled([
        apiGet<any>("/recon/osiris/earthquakes?min_magnitude=2.5"),
        apiGet<any>("/recon/osiris/fires"),
      ]);
      if (eqRes.status === "fulfilled") setEarthquakes(eqRes.value?.earthquakes || []);
      if (fireRes.status === "fulfilled") setFires(fireRes.value?.fires || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setDisastersLoading(false);
    }
  }

  async function loadCctv() {
    setCctvLoading(true);
    try {
      const res = await apiGet<any>("/recon/osiris/cctv?limit=100");
      setCctvList(res?.cameras || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setCctvLoading(false);
    }
  }

  async function loadNews() {
    setNewsLoading(true);
    try {
      const res = await apiGet<any>("/recon/osiris/live-news");
      const list = res?.feeds || [];
      setNewsFeeds(list);
      if (list.length > 0 && !activeStream) {
        const firstEmbed = list.find((c: any) => c.embed_allowed) || list[0];
        setActiveStream(firstEmbed);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setNewsLoading(false);
    }
  }

  async function loadMarkets() {
    setMarketsLoading(true);
    try {
      const [mkRes, spRes] = await Promise.allSettled([
        apiGet<any>("/recon/osiris/defense-markets"),
        apiGet<any>("/recon/osiris/space-weather"),
      ]);
      if (mkRes.status === "fulfilled") {
        setMarketQuotes(mkRes.value?.quotes || []);
        setScmAlerts(mkRes.value?.scm_alerts || []);
      }
      if (spRes.status === "fulfilled") {
        setSpaceWeather(spRes.value);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setMarketsLoading(false);
    }
  }

  async function handleSanctionsSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!sanctionsQuery || sanctionsQuery.trim().length < 3) return;
    setSanctionsLoading(true);
    try {
      const res = await apiGet<any>(
        `/recon/osiris/sanctions?query=${encodeURIComponent(sanctionsQuery.trim())}&limit=30`
      );
      setSanctionsMatches(res?.matches || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setSanctionsLoading(false);
    }
  }

  const filteredCctv = cctvList.filter((c) => {
    if (!cctvFilter) return true;
    const q = cctvFilter.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q))
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        background: "var(--panel-bg)",
        border: "1px solid var(--panel-border)",
        borderRadius: 8,
        color: "#e2e8f0",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--panel-border)",
          paddingBottom: 12,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "rgba(0, 229, 255, 0.15)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
            }}
          >
            <GlobeIcon size={18} color="var(--cyan)" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#fff", letterSpacing: 1 }}>
              OSIRIS C4ISR GLOBAL INTELLIGENCE
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Open Source Intelligence &amp; Reconnaissance Integrated System · 16 Global Feeds
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => {
              loadSummary();
              if (activeTab === "CONFLICTS") loadConflicts();
              if (activeTab === "DISASTERS") loadDisasters();
              if (activeTab === "CCTV") loadCctv();
              if (activeTab === "LIVE_NEWS") loadNews();
              if (activeTab === "MARKETS") loadMarkets();
            }}
            disabled={summaryLoading}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              background: "rgba(0, 229, 255, 0.12)",
              color: "var(--cyan)",
              border: "1px solid var(--cyan)",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "monospace",
            }}
          >
            <RefreshCwIcon size={12} color="var(--cyan)" />
            {summaryLoading ? "Syncing..." : "Refresh Intelligence"}
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {[
          { id: "OVERVIEW", label: "GLOBAL TICKER", count: null },
          { id: "CONFLICTS", label: "WAR ZONES", count: summary?.active_conflict_zones || 13 },
          { id: "DISASTERS", label: "EARTHQUAKES & FIRES", count: (summary?.active_earthquakes || 0) + (summary?.active_fires || 0) },
          { id: "CCTV", label: "SURVEILLANCE CCTV", count: summary?.surveillance_cctvs || 50 },
          { id: "LIVE_NEWS", label: "24/7 LIVE NEWS", count: summary?.live_news_channels || 10 },
          { id: "MARKETS", label: "DEFENSE MARKETS", count: null },
          { id: "SANCTIONS", label: "OFAC SDN SANCTIONS", count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as OsirisTab)}
            style={{
              padding: "7px 14px",
              fontSize: 11,
              fontWeight: activeTab === tab.id ? "bold" : "normal",
              color: activeTab === tab.id ? "var(--cyan)" : "var(--text-muted)",
              background: activeTab === tab.id ? "rgba(0, 229, 255, 0.12)" : "transparent",
              border: `1px solid ${activeTab === tab.id ? "var(--cyan)" : "transparent"}`,
              borderRadius: 4,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span
                style={{
                  background: activeTab === tab.id ? "var(--cyan)" : "rgba(255,255,255,0.1)",
                  color: activeTab === tab.id ? "#000" : "#cbd5e1",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 9,
                  fontWeight: "bold",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "OVERVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 85, 85, 0.3)" }}>
              <div style={{ fontSize: 11, color: "#ff5555", fontWeight: "bold" }}>ACTIVE CONFLICT ZONES</div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff", marginTop: 4 }}>
                {summary?.active_conflict_zones || 13}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Ukraine, Gaza, Sudan, Myanmar, Yemen +</div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 170, 0, 0.3)" }}>
              <div style={{ fontSize: 11, color: "#ffaa00", fontWeight: "bold" }}>USGS M2.5+ SEISMIC EVENTS</div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff", marginTop: 4 }}>
                {summary?.active_earthquakes || "Syncing"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Real-time 24h global detection</div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 85, 255, 0.3)" }}>
              <div style={{ fontSize: 11, color: "#ff55ff", fontWeight: "bold" }}>NASA FIRMS THERMAL FIRES</div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff", marginTop: 4 }}>
                {summary?.active_fires || "Syncing"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>VIIRS / MODIS satellite sensors</div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(0, 229, 255, 0.3)" }}>
              <div style={{ fontSize: 11, color: "var(--cyan)", fontWeight: "bold" }}>SURVEILLANCE CCTVs</div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff", marginTop: 4 }}>
                17,000+
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>London, US-West, East, HK, EU</div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(0, 230, 118, 0.3)" }}>
              <div style={{ fontSize: 11, color: "#00E676", fontWeight: "bold" }}>GEOMAGNETIC SPACE WEATHER</div>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff", marginTop: 6 }}>
                {summary?.geomagnetic_storm || "Quiet"} (Kp {summary?.kp_index || 2.0})
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>NOAA SWPC Solar Observatories</div>
            </div>
          </div>

          {/* Conflict Zones Quick Preview */}
          <div style={{ background: "rgba(0,0,0,0.25)", padding: 14, borderRadius: 6, border: "1px solid var(--panel-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)" }}>
                ⚔️ HIGHEST SEVERITY WAR ZONES (OSIRIS + GDELT)
              </span>
              <button
                onClick={() => setActiveTab("CONFLICTS")}
                style={{ fontSize: 11, background: "transparent", border: "none", color: "var(--cyan)", cursor: "pointer" }}
              >
                View all 13 zones →
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {(conflicts || []).slice(0, 4).map((z: any) => (
                <div
                  key={z.id}
                  style={{
                    padding: 10,
                    borderRadius: 4,
                    background: "rgba(255, 85, 85, 0.08)",
                    border: "1px solid rgba(255, 85, 85, 0.3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: "#ff5555", fontSize: 12 }}>{z.label}</strong>
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#ff5555", color: "#000", fontWeight: "bold" }}>
                      WARZONE
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {(z.description || "").substring(0, 110)}...
                  </div>
                  {onFocusCoordinates && (
                    <button
                      onClick={() => onFocusCoordinates(z.lat, z.lon, 6)}
                      style={{
                        marginTop: 4,
                        padding: "3px 8px",
                        fontSize: 10,
                        background: "rgba(0, 229, 255, 0.1)",
                        color: "var(--cyan)",
                        border: "1px solid var(--cyan)",
                        borderRadius: 3,
                        cursor: "pointer",
                        alignSelf: "flex-start",
                      }}
                    >
                      Focus on Tactical Map
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONFLICTS */}
      {activeTab === "CONFLICTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Tracking 13 active conflict and geopolitically contested zones with belligerents, threat assessments, and coordinates.
          </div>
          {conflictsLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cyan)" }}>Loading live conflict zones...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {conflicts.map((zone) => (
                <div
                  key={zone.id}
                  style={{
                    background: "rgba(10, 14, 23, 0.8)",
                    border: `1px solid ${zone.severity === "war" ? "#ff5555" : "#ffaa00"}`,
                    borderRadius: 6,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>{zone.label}</span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontSize: 9,
                        fontWeight: "bold",
                        background: zone.severity === "war" ? "rgba(255, 85, 85, 0.2)" : "rgba(255, 170, 0, 0.2)",
                        color: zone.severity === "war" ? "#ff5555" : "#ffaa00",
                        border: `1px solid ${zone.severity === "war" ? "#ff5555" : "#ffaa00"}`,
                      }}
                    >
                      {zone.threat_level || zone.severity.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>
                    {zone.description}
                  </div>

                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    <strong>Region:</strong> {zone.region} | <strong>Coords:</strong> {zone.lat}, {zone.lon}
                  </div>

                  {zone.belligerents && (
                    <div style={{ fontSize: 10, color: "#a259ff" }}>
                      <strong>Combatants:</strong> {zone.belligerents.join(" vs ")}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {onFocusCoordinates && (
                      <button
                        onClick={() => onFocusCoordinates(zone.lat, zone.lon, 6)}
                        style={{
                          flex: 1,
                          padding: "5px 10px",
                          fontSize: 10,
                          background: "rgba(0, 229, 255, 0.15)",
                          color: "var(--cyan)",
                          border: "1px solid var(--cyan)",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontFamily: "monospace",
                        }}
                      >
                        Target on Map
                      </button>
                    )}
                    <div style={{ flex: 1 }}>
                      <SaveToCaseButton
                        identifierType="domain"
                        identifierValue={zone.label}
                        platform="osiris_conflict_zone"
                        discoveredBy="osiris_c4isr"
                        metadata={zone}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DISASTERS (EARTHQUAKES & FIRES) */}
      {activeTab === "DISASTERS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {disastersLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cyan)" }}>
              Fetching real-time USGS seismic telemetry &amp; NASA FIRMS thermal hotspots...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Earthquakes */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 170, 0, 0.3)" }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "#ffaa00", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>USGS SEISMIC ACTIVITY (M2.5+)</span>
                  <span>{earthquakes.length} Events</span>
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {earthquakes.slice(0, 30).map((eq) => (
                    <div
                      key={eq.id}
                      style={{
                        padding: 8,
                        background: "rgba(255,255,255,0.03)",
                        borderLeft: `3px solid ${eq.magnitude >= 5.5 ? "#ff3333" : eq.magnitude >= 4.0 ? "#ffaa00" : "#00E676"}`,
                        borderRadius: 3,
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                        <span>{eq.place}</span>
                        <span style={{ color: eq.magnitude >= 5.0 ? "#ff3333" : "#ffaa00" }}>M{eq.magnitude}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                        <span>Depth: {eq.depth_km} km</span>
                        {onFocusCoordinates && (
                          <button
                            onClick={() => onFocusCoordinates(eq.lat, eq.lon, 7)}
                            style={{ background: "transparent", border: "none", color: "var(--cyan)", cursor: "pointer", fontSize: 10 }}
                          >
                            Locate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fires */}
              <div style={{ background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 85, 255, 0.3)" }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "#ff55ff", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>NASA FIRMS &amp; VOLCANIC HOTSPOTS</span>
                  <span>{fires.length} Clusters</span>
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {fires.slice(0, 30).map((fire, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 8,
                        background: "rgba(255,255,255,0.03)",
                        borderLeft: `3px solid ${fire.type === "volcano" ? "#ff2a5f" : "#ffaa00"}`,
                        borderRadius: 3,
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                        <span>{fire.title || `Thermal Cluster #${i + 1}`}</span>
                        <span style={{ color: "#ff55ff" }}>FRP {Math.round(fire.frp || 0)} MW</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                        <span>Coords: {fire.lat}, {fire.lon}</span>
                        {onFocusCoordinates && (
                          <button
                            onClick={() => onFocusCoordinates(fire.lat, fire.lon, 8)}
                            style={{ background: "transparent", border: "none", color: "var(--cyan)", cursor: "pointer", fontSize: 10 }}
                          >
                            Locate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CCTV */}
      {activeTab === "CCTV" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Search bar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={cctvFilter}
                onChange={(e) => setCctvFilter(e.target.value)}
                placeholder="Search CCTV cameras by city (London, Seattle, Hong Kong, Paris)..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 4,
                  color: "#fff",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Showing {filteredCctv.length} cameras
            </span>
          </div>

          {cctvLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cyan)" }}>Loading public camera network...</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
                maxHeight: 520,
                overflowY: "auto",
              }}
            >
              {filteredCctv.map((cam) => (
                <div
                  key={cam.id}
                  style={{
                    background: "rgba(10, 14, 23, 0.9)",
                    border: "1px solid rgba(0, 229, 255, 0.2)",
                    borderRadius: 6,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Camera Snapshot Image */}
                  <div style={{ position: "relative", width: "100%", height: 160, background: "#05070c" }}>
                    <img
                      src={cam.feed_url}
                      alt={cam.name}
                      loading="lazy"
                      onError={(e: any) => {
                        e.target.src = "https://placehold.co/400x240/090d16/00e5ff?text=SURVEILLANCE+FEED+OFFLINE";
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        padding: "2px 6px",
                        background: "rgba(0,0,0,0.7)",
                        border: "1px solid var(--cyan)",
                        borderRadius: 3,
                        fontSize: 9,
                        color: "var(--cyan)",
                        fontWeight: "bold",
                      }}
                    >
                      LIVE CAM
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff" }}>{cam.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {cam.city}, {cam.country} · {cam.source}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {onFocusCoordinates && cam.lat && cam.lon && (
                        <button
                          onClick={() => onFocusCoordinates(cam.lat, cam.lon, 14)}
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            fontSize: 10,
                            background: "rgba(0, 229, 255, 0.1)",
                            color: "var(--cyan)",
                            border: "1px solid var(--cyan)",
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                        >
                          Show on Map
                        </button>
                      )}
                      <div style={{ flex: 1 }}>
                        <SaveToCaseButton
                          identifierType="domain"
                          identifierValue={cam.name}
                          platform="cctv_surveillance"
                          discoveredBy="osiris_cctv_recon"
                          metadata={cam}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LIVE NEWS */}
      {activeTab === "LIVE_NEWS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {newsLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cyan)" }}>Loading global broadcast streams...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              {/* Active Stream Player */}
              <div style={{ background: "#05070c", borderRadius: 6, border: "1px solid var(--panel-border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {activeStream && activeStream.embed_allowed ? (
                  <iframe
                    src={activeStream.stream_url}
                    title={activeStream.name}
                    style={{ width: "100%", height: 380, border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div style={{ height: 380, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
                    <AlertIcon size={32} color="var(--cyan)" />
                    <div style={{ marginTop: 12, fontSize: 13, fontWeight: "bold" }}>
                      {activeStream?.name || "Select a Broadcast Channel"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, maxWidth: 360 }}>
                      This broadcaster requires viewing directly on their official live channel feed.
                    </div>
                    {activeStream && (
                      <a
                        href={activeStream.stream_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          marginTop: 12,
                          padding: "6px 14px",
                          background: "var(--cyan)",
                          color: "#000",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: "bold",
                          textDecoration: "none",
                        }}
                      >
                        Open Live Stream in New Tab ↗
                      </a>
                    )}
                  </div>
                )}

                <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>{activeStream?.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                      {activeStream?.city}, {activeStream?.country} ({activeStream?.category})
                    </span>
                  </div>
                  {activeStream && (
                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={activeStream.name}
                      platform="osiris_live_news"
                      discoveredBy="osiris_broadcast_monitor"
                      metadata={activeStream}
                    />
                  )}
                </div>
              </div>

              {/* Stream Channel Selector List */}
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid var(--panel-border)", padding: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 440, overflowY: "auto" }}>
                <div style={{ fontSize: 11, fontWeight: "bold", color: "var(--cyan)", marginBottom: 4 }}>
                  GLOBAL CHANNELS ({newsFeeds.length})
                </div>
                {newsFeeds.map((feed) => (
                  <button
                    key={feed.id}
                    onClick={() => setActiveStream(feed)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 4,
                      background: activeStream?.id === feed.id ? "rgba(0, 229, 255, 0.15)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${activeStream?.id === feed.id ? "var(--cyan)" : "transparent"}`,
                      color: activeStream?.id === feed.id ? "#fff" : "var(--text-muted)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "monospace",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: "bold", color: activeStream?.id === feed.id ? "var(--cyan)" : "#e2e8f0" }}>
                      {feed.name}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>
                      {feed.city}, {feed.country} · {feed.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MARKETS & SPACE WEATHER */}
      {activeTab === "MARKETS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {marketsLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--cyan)" }}>Syncing defense equities &amp; space telemetry...</div>
          ) : (
            <>
              {/* Space Weather Alert Banner */}
              {spaceWeather && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: "rgba(0,0,0,0.4)",
                    border: `1px solid ${spaceWeather.storm_color || "#00E676"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: spaceWeather.storm_color, fontWeight: "bold" }}>
                      ☀️ NOAA SWPC SPACE WEATHER · {spaceWeather.storm_level}
                    </div>
                    <div style={{ fontSize: 12, color: "#fff", marginTop: 2 }}>
                      Planetary Kp Index: <strong>{spaceWeather.kp_index}</strong> | Solar Flares Detected:{" "}
                      <strong>{spaceWeather.solar_flares?.length || 0}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Source: NOAA Space Weather Prediction Center</div>
                </div>
              )}

              {/* SCM Chokepoint Alerts */}
              {scmAlerts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {scmAlerts.map((alert, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 4,
                        background: "rgba(255, 85, 85, 0.1)",
                        border: "1px solid rgba(255, 85, 85, 0.3)",
                        fontSize: 11,
                        color: "#ff8888",
                      }}
                    >
                      {alert}
                    </div>
                  ))}
                </div>
              )}

              {/* Defense & Commodity Quotes */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10,
                }}
              >
                {marketQuotes.map((q) => (
                  <div
                    key={q.symbol}
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      padding: 12,
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                      <span>{q.group}</span>
                      <code>{q.symbol}</code>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>{q.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: "bold" }}>${q.price?.toFixed(2)}</span>
                      <span style={{ fontSize: 11, fontWeight: "bold", color: q.change >= 0 ? "#00E676" : "#ff5555" }}>
                        {q.change >= 0 ? `+${q.change?.toFixed(2)}%` : `${q.change?.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 7: SANCTIONS (OFAC SDN SEARCH) */}
      {activeTab === "SANCTIONS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Search US OFAC Specially Designated Nationals (SDN) database for individuals, front companies, cargo vessels, and aircraft.
          </div>

          <form onSubmit={handleSanctionsSearch} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={sanctionsQuery}
              onChange={(e) => setSanctionsQuery(e.target.value)}
              placeholder="Search by name, organization or vessel (e.g. Wagner, IRGC, Rosoboronexport, Al-Quds)..."
              style={{
                flex: 1,
                padding: "8px 12px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid var(--panel-border)",
                borderRadius: 4,
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              disabled={sanctionsLoading || sanctionsQuery.trim().length < 3}
              style={{
                padding: "8px 16px",
                fontSize: 11,
                background: "rgba(255, 85, 85, 0.2)",
                color: "#ff5555",
                border: "1px solid #ff5555",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
            >
              {sanctionsLoading ? "Querying..." : "Search SDN"}
            </button>
          </form>

          {sanctionsMatches.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {sanctionsMatches.map((match, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255, 85, 85, 0.06)",
                    border: "1px solid rgba(255, 85, 85, 0.4)",
                    borderRadius: 6,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: "bold", color: "#ff5555" }}>
                        🚫 {match.name}
                      </span>
                      <span
                        style={{
                          padding: "1px 5px",
                          borderRadius: 3,
                          fontSize: 9,
                          background: "rgba(255, 85, 85, 0.3)",
                          color: "#fff",
                        }}
                      >
                        {match.schema || "Entity"}
                      </span>
                    </div>

                    {match.programs && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        <strong>Sanctions Program:</strong> {Array.isArray(match.programs) ? match.programs.join(", ") : match.programs}
                      </div>
                    )}

                    {match.countries && match.countries.length > 0 && (
                      <div style={{ fontSize: 10, color: "var(--cyan)" }}>
                        <strong>Jurisdictions:</strong> {match.countries.join(", ")}
                      </div>
                    )}
                  </div>

                  <SaveToCaseButton
                    identifierType="corporate"
                    identifierValue={match.name}
                    platform="ofac_sdn_sanctions"
                    discoveredBy="osiris_sanctions_recon"
                    metadata={match}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
