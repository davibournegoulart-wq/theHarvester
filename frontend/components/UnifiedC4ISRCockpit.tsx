"use client";

import React, { useState, useEffect } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import GlobalCctvSuite, { CctvCameraItem } from "./GlobalCctvSuite";
import SocmintSuite from "./SocmintSuite";
import {
  RadarIcon,
  GlobeIcon,
  EyeIcon,
  PinIcon,
  CheckIcon,
  RefreshCwIcon,
  ShieldIcon,
  TerminalIcon,
  DatabaseIcon,
  ActivityIcon,
  AlertIcon,
  LinkIcon,
  SearchIcon,
  CrossIcon,
  SwordsIcon,
  FlameIcon,
  JetIcon,
  VideoIcon,
  CameraIcon,
  UserIcon,
} from "@/components/FlatIcons";

export type CockpitTab =
  | "AIR_EW"
  | "CONFLICTS_STRATEGY"
  | "CCTV"
  | "MARITIME_INFRA"
  | "DISASTERS_THERMAL"
  | "CYBER_C2"
  | "MARKETS_SANCTIONS"
  | "SOCMINT";

export type MilitaryFlightItem = {
  id: string;
  hex: string;
  callsign: string;
  type: string;
  description: string;
  registration: string;
  latitude: number;
  longitude: number;
  altitude_feet: number;
  ground_speed_kts: number;
  heading_deg: number;
  squawk: string;
  emergency: string;
  nac_p: number | null;
  category: string;
  source: string;
};

export type GpsJammingItem = {
  id: string;
  latitude: number;
  longitude: number;
  total_aircraft: number;
  degraded_aircraft: number;
  degraded_percentage: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  source: string;
};

export type SubmarineCableItem = {
  id: string;
  name: string;
  owners: string[];
  length_km: number;
  status: string;
  capacity_tbps: number;
  landing_points: Array<{
    name: string;
    country: string;
    lat: number;
    lon: number;
  }>;
};

export type MaritimeVesselItem = {
  mmsi: string;
  name: string;
  ship_type: string;
  flag: string;
  speed_kts: number;
  heading: number;
  status: string;
  chokepoint: string;
  destination: string;
  lat: number;
  lon: number;
};

export type StrategicInfraItem = {
  name: string;
  category: string;
  region: string;
  lat: number;
  lon: number;
  details: string;
};

export type MalwareC2Item = {
  id: string;
  ip: string;
  port: number | null;
  malware: string;
  status: string;
  country: string;
  latitude: number;
  longitude: number;
  first_seen: string;
  last_online: string;
  threat_type: string;
  source: string;
};

export type TelegramOsintItem = {
  id: string;
  channel: string;
  text: string;
  url: string;
  timestamp: string;
  photo_url: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
};

export type UnifiedC4ISRCockpitProps = {
  onFocusCoordinates?: (lat: number, lon: number, zoom?: number) => void;
  onPinToMap?: (item: { latitude: number; longitude: number; label: string; description?: string }) => void;
  onRideAlongFlight?: (flight: MilitaryFlightItem) => void;
};

export default function UnifiedC4ISRCockpit({
  onFocusCoordinates,
  onPinToMap,
  onRideAlongFlight,
}: UnifiedC4ISRCockpitProps) {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<CockpitTab>("AIR_EW");
  const [loading, setLoading] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // 1. TACTICAL AIR & EW
  const [militaryFlights, setMilitaryFlights] = useState<MilitaryFlightItem[]>([]);
  const [gpsJammingZones, setGpsJammingZones] = useState<GpsJammingItem[]>([]);
  const [flightSubFilter, setFlightSubFilter] = useState<string>("ALL");

  // 2. CONFLICTS & STRATEGY
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [countryDossier, setCountryDossier] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [telegramPosts, setTelegramPosts] = useState<TelegramOsintItem[]>([]);
  const [tgChannel, setTgChannel] = useState("osintdefender");

  // 3. MARITIME & INFRASTRUCTURE
  const [vessels, setVessels] = useState<MaritimeVesselItem[]>([]);
  const [cables, setCables] = useState<SubmarineCableItem[]>([]);
  const [infra, setInfra] = useState<StrategicInfraItem[]>([]);

  // 4. DISASTERS & THERMAL
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [thermalFires, setThermalFires] = useState<any[]>([]);

  // 5. CYBER C2 & THREATS
  const [malwareC2s, setMalwareC2s] = useState<MalwareC2Item[]>([]);

  // 6. GEO-FINANCE & SANCTIONS
  const [marketQuotes, setMarketQuotes] = useState<any[]>([]);
  const [scmAlerts, setScmAlerts] = useState<string[]>([]);
  const [sanctionsQuery, setSanctionsQuery] = useState("");
  const [sanctionsMatches, setSanctionsMatches] = useState<any[]>([]);
  const [sanctionsLoading, setSanctionsLoading] = useState(false);

  // Summary Metrics
  const [summary, setSummary] = useState<any>(null);

  // Initial Data Load
  useEffect(() => {
    loadOverviewMetrics();
    loadAirEw();
  }, []);

  async function loadOverviewMetrics() {
    try {
      const res = await apiGet<any>("/recon/osiris/summary");
      setSummary(res);
    } catch (e) {
      console.warn("Could not load summary metrics:", e);
    }
  }

  // Tab dynamic loaders
  useEffect(() => {
    if (activeTab === "AIR_EW" && militaryFlights.length === 0) loadAirEw();
    if (activeTab === "CONFLICTS_STRATEGY" && conflicts.length === 0) loadConflictsAndStrategy();
    if (activeTab === "MARITIME_INFRA" && vessels.length === 0) loadMaritimeInfra();
    if (activeTab === "DISASTERS_THERMAL" && earthquakes.length === 0) loadDisasters();
    if (activeTab === "CYBER_C2" && malwareC2s.length === 0) loadCyberC2();
    if (activeTab === "MARKETS_SANCTIONS" && marketQuotes.length === 0) loadMarkets();
  }, [activeTab]);

  async function loadAirEw() {
    setLoading(true);
    try {
      const [flRes, jamRes] = await Promise.allSettled([
        apiGet<MilitaryFlightItem[]>("/recon/shadowbroker/military-flights?limit=50"),
        apiGet<GpsJammingItem[]>("/recon/shadowbroker/gps-jamming"),
      ]);
      if (flRes.status === "fulfilled") setMilitaryFlights(flRes.value || []);
      if (jamRes.status === "fulfilled") setGpsJammingZones(jamRes.value || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadConflictsAndStrategy() {
    setLoading(true);
    try {
      const [czRes, tgRes] = await Promise.allSettled([
        apiGet<any>("/recon/osiris/conflicts"),
        apiGet<TelegramOsintItem[]>(`/recon/shadowbroker/telegram-feed?channel=${encodeURIComponent(tgChannel)}&limit=20`),
      ]);
      if (czRes.status === "fulfilled") setConflicts(czRes.value?.zones || []);
      if (tgRes.status === "fulfilled") setTelegramPosts(tgRes.value || []);
      loadCountryDossier(selectedCountry);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCountryDossier(countryCode: string) {
    setDossierLoading(true);
    try {
      const data = await apiGet<any>(`/recon/shadowbroker/country-dossier?country=${encodeURIComponent(countryCode)}`);
      setCountryDossier(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setDossierLoading(false);
    }
  }

  async function loadMaritimeInfra() {
    setLoading(true);
    try {
      const [vRes, cRes, iRes] = await Promise.allSettled([
        apiGet<MaritimeVesselItem[]>("/recon/godseye/vessels"),
        apiGet<SubmarineCableItem[]>("/recon/godseye/submarine-cables"),
        apiGet<StrategicInfraItem[]>("/recon/godseye/critical-infra?category=all"),
      ]);
      if (vRes.status === "fulfilled") setVessels(vRes.value || []);
      if (cRes.status === "fulfilled") setCables(cRes.value || []);
      if (iRes.status === "fulfilled") setInfra(iRes.value || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadDisasters() {
    setLoading(true);
    try {
      const [eqRes, fireRes] = await Promise.allSettled([
        apiGet<any>("/recon/osiris/earthquakes?min_magnitude=2.5"),
        apiGet<any>("/recon/shadowbroker/nasa-firms?limit=40"),
      ]);
      if (eqRes.status === "fulfilled") setEarthquakes(eqRes.value?.earthquakes || []);
      if (fireRes.status === "fulfilled") setThermalFires(fireRes.value || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCyberC2() {
    setLoading(true);
    try {
      const data = await apiGet<MalwareC2Item[]>("/recon/shadowbroker/malware-c2?limit=50");
      setMalwareC2s(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadMarkets() {
    setLoading(true);
    try {
      const res = await apiGet<any>("/recon/osiris/defense-markets");
      setMarketQuotes(res?.quotes || []);
      setScmAlerts(res?.scm_alerts || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
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

  async function handlePinTelemetry(item: {
    id: string;
    latitude: number;
    longitude: number;
    label: string;
    description?: string;
  }) {
    if (!activeCase) {
      alert("Please activate a case first.");
      return;
    }
    setPinnedId(item.id);
    try {
      await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
        latitude: item.latitude,
        longitude: item.longitude,
        label: item.label,
        description: item.description || "Pinned via Unified C4ISR Cockpit",
        source: "c4isr_cockpit",
      });
      setTimeout(() => setPinnedId(null), 3000);
      if (onPinToMap) onPinToMap(item);
    } catch (err) {
      alert("Error saving geolocation pin: " + err);
      setPinnedId(null);
    }
  }

  // Military flight filtering
  const filteredFlights = militaryFlights.filter((f) => {
    if (flightSubFilter === "ALL") return true;
    if (flightSubFilter === "VIP") return f.category?.includes("VIP") || f.callsign?.startsWith("AF") || f.callsign?.startsWith("SAM");
    if (flightSubFilter === "ISR") return f.description?.toLowerCase().includes("recon") || f.description?.toLowerCase().includes("patrol");
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "var(--panel-bg, #060910)",
        border: "1px solid var(--panel-border, rgba(0, 229, 255, 0.25))",
        borderRadius: 8,
        padding: 18,
        color: "#e2e8f0",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {/* COCKPIT COMMAND HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(0, 229, 255, 0.2)",
          paddingBottom: 14,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: "rgba(0, 229, 255, 0.12)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RadarIcon size={20} color="var(--cyan)" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: "bold", color: "#fff", letterSpacing: 1 }}>
                C4ISR UNIFIED INTELLIGENCE COCKPIT
              </h2>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(0, 229, 255, 0.15)",
                  color: "var(--cyan)",
                  border: "1px solid rgba(0, 229, 255, 0.3)",
                }}
              >
                OSIRIS · GOD'S EYE · SHADOWBROKER
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Multi-Domain Global Situational Awareness · Air &amp; EW · Chokepoints · Surveillance Harvester · Geopolitics
            </div>
          </div>
        </div>

        {/* Global Live Ticker Indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
          <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.4)", padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
            <span>Flights: <strong style={{ color: "#00E676" }}>{militaryFlights.length}</strong></span>
            <span>·</span>
            <span>Wars: <strong style={{ color: "#ff5555" }}>{conflicts.length || 13}</strong></span>
            <span>·</span>
            <span>EW Jam: <strong style={{ color: "#ffaa00" }}>{gpsJammingZones.length}</strong></span>
            <span>·</span>
            <span>Cables: <strong style={{ color: "#a5b4fc" }}>{cables.length || 12}</strong></span>
            <span>·</span>
            <span>Vessels: <strong style={{ color: "var(--cyan)" }}>{vessels.length || 38}</strong></span>
          </div>

          <button
            onClick={() => {
              if (activeTab === "AIR_EW") loadAirEw();
              else if (activeTab === "CONFLICTS_STRATEGY") loadConflictsAndStrategy();
              else if (activeTab === "MARITIME_INFRA") loadMaritimeInfra();
              else if (activeTab === "DISASTERS_THERMAL") loadDisasters();
              else if (activeTab === "CYBER_C2") loadCyberC2();
              else if (activeTab === "MARKETS_SANCTIONS") loadMarkets();
            }}
            disabled={loading}
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
              fontWeight: "bold",
            }}
          >
            <RefreshCwIcon size={12} color="var(--cyan)" />
            {loading ? "SYNCING..." : "REFRESH STREAM"}
          </button>
        </div>
      </div>

      {/* PRIMARY NAVIGATION COCKPIT TABS */}
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
          { id: "AIR_EW", label: "TACTICAL AIR & EW", count: militaryFlights.length, icon: <JetIcon size={13} /> },
          { id: "CONFLICTS_STRATEGY", label: "WAR ZONES & STRATEGY", count: conflicts.length || 13, icon: <SwordsIcon size={13} /> },
          { id: "CCTV", label: "WORLDWIDE CCTV HARVESTER", count: "300+", icon: <VideoIcon size={13} /> },
          { id: "MARITIME_INFRA", label: "MARITIME & INFRASTRUCTURE", count: vessels.length + cables.length, icon: <LinkIcon size={13} /> },
          { id: "DISASTERS_THERMAL", label: "DISASTERS & THERMAL (FIRMS)", count: earthquakes.length + thermalFires.length, icon: <FlameIcon size={13} /> },
          { id: "CYBER_C2", label: "CYBER C2 BOTNETS", count: malwareC2s.length, icon: <TerminalIcon size={13} /> },
          { id: "MARKETS_SANCTIONS", label: "GEO-FINANCE & SANCTIONS", count: null, icon: <ShieldIcon size={13} /> },
          { id: "SOCMINT", label: "👻 SOCMINT", count: null, icon: <UserIcon size={13} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CockpitTab)}
              style={{
                padding: "8px 14px",
                fontSize: 11,
                fontWeight: isActive ? "bold" : "normal",
                color: isActive ? "var(--cyan)" : "var(--text-muted)",
                background: isActive ? "rgba(0, 229, 255, 0.12)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? "var(--cyan)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 4,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    background: isActive ? "var(--cyan)" : "rgba(255,255,255,0.1)",
                    color: isActive ? "#000" : "#cbd5e1",
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
          );
        })}
      </div>

      {/* TAB 1: TACTICAL AIR & EW */}
      {activeTab === "AIR_EW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Filter Airframes:</span>
              {["ALL", "VIP", "ISR"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFlightSubFilter(f)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 10,
                    background: flightSubFilter === f ? "rgba(0, 230, 118, 0.2)" : "rgba(255,255,255,0.05)",
                    color: flightSubFilter === f ? "#00E676" : "var(--text-muted)",
                    border: `1px solid ${flightSubFilter === f ? "#00E676" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              GPS Degradation Zones Active: <strong style={{ color: "#ffaa00" }}>{gpsJammingZones.length}</strong>
            </div>
          </div>

          {gpsJammingZones.length > 0 && (
            <div
              style={{
                background: "rgba(255, 170, 0, 0.08)",
                border: "1px solid rgba(255, 170, 0, 0.35)",
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#ffaa00", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <AlertIcon size={14} color="#ffaa00" />
                ELECTRONIC WARFARE (EW) &amp; GNSS/GPS DEGRADATION ZONES
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, fontSize: 11 }}>
                {gpsJammingZones.slice(0, 4).map((j) => (
                  <div key={j.id} style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#fff" }}>{j.description || "EW Zone"}</strong>
                      <span style={{ color: "#ffaa00", fontWeight: "bold" }}>{j.severity}</span>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>
                      Degraded Aircraft: {j.degraded_aircraft}/{j.total_aircraft} ({j.degraded_percentage}%)
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <code>{j.latitude.toFixed(2)}, {j.longitude.toFixed(2)}</code>
                      {onFocusCoordinates && (
                        <button
                          onClick={() => onFocusCoordinates(j.latitude, j.longitude, 6)}
                          style={{ padding: "2px 6px", fontSize: 9, background: "rgba(255,170,0,0.2)", color: "#ffaa00", border: "none", borderRadius: 2, cursor: "pointer" }}
                        >
                          Focus
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
            {filteredFlights.map((fl) => {
              const isPinned = pinnedId === fl.id;
              return (
                <div
                  key={fl.id}
                  style={{
                    background: "rgba(10, 14, 24, 0.8)",
                    border: "1px solid rgba(0, 230, 118, 0.25)",
                    borderRadius: 6,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#00E676" }}>
                          {fl.callsign || "CLASSIFIED"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          HEX: <code>{fl.hex}</code> | Reg: {fl.registration || "MIL"}
                        </div>
                      </div>
                      <span style={{ fontSize: 9, padding: "2px 5px", background: "rgba(0, 230, 118, 0.15)", color: "#00E676", borderRadius: 3 }}>
                        {fl.type || "TACTICAL"}
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 4px 0" }}>
                      {fl.description || "Military / VIP Surveillance Airframe"}
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 4 }}>
                      <div>Alt: <strong style={{ color: "#fff" }}>{fl.altitude_feet?.toLocaleString()} ft</strong></div>
                      <div>Speed: <strong style={{ color: "#fff" }}>{fl.ground_speed_kts} kts</strong></div>
                      <div>Heading: <strong>{fl.heading_deg}°</strong></div>
                      <div>Squawk: <code>{fl.squawk || "STANDBY"}</code></div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                    {onFocusCoordinates && (
                      <button
                        onClick={() => onFocusCoordinates(fl.latitude, fl.longitude, 7)}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: 10,
                          background: "rgba(0, 229, 255, 0.12)",
                          color: "var(--cyan)",
                          border: "1px solid var(--cyan)",
                          borderRadius: 3,
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Target on Map
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handlePinTelemetry({
                          id: fl.id,
                          latitude: fl.latitude,
                          longitude: fl.longitude,
                          label: `Air Target: ${fl.callsign} (${fl.hex})`,
                          description: `Altitude: ${fl.altitude_feet}ft | Speed: ${fl.ground_speed_kts}kts | Heading: ${fl.heading_deg}° | Type: ${fl.type}`,
                        })
                      }
                      style={{
                        padding: "4px 8px",
                        fontSize: 10,
                        background: isPinned ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.05)",
                        color: isPinned ? "#00E676" : "#cbd5e1",
                        border: `1px solid ${isPinned ? "#00E676" : "rgba(255,255,255,0.15)"}`,
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                    >
                      {isPinned ? "PINNED" : "PIN"}
                    </button>

                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={`hex:${fl.hex}`}
                      platform="shadowbroker_military_flights"
                      discoveredBy="c4isr_unified_cockpit"
                      metadata={fl}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: WAR ZONES & STRATEGY */}
      {activeTab === "CONFLICTS_STRATEGY" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#ff5555", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <SwordsIcon size={15} color="#ff5555" />
              GLOBAL CONFLICT &amp; WAR ZONES (OSIRIS + GDELT)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
              {conflicts.map((cz) => (
                <div
                  key={cz.id}
                  style={{
                    background: "rgba(10, 14, 23, 0.8)",
                    border: `1px solid ${cz.severity === "war" ? "rgba(255, 85, 85, 0.4)" : "rgba(255, 170, 0, 0.4)"}`,
                    borderRadius: 6,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 6,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: cz.severity === "war" ? "#ff5555" : "#ffaa00", fontSize: 13 }}>
                        {cz.label}
                      </strong>
                      <span style={{ fontSize: 9, padding: "1px 5px", background: "rgba(255, 85, 85, 0.2)", color: "#ff5555", borderRadius: 3, fontWeight: "bold" }}>
                        {cz.threat_level || cz.severity?.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0", lineHeight: 1.4 }}>
                      {cz.description}
                    </p>
                    {cz.belligerents && (
                      <div style={{ fontSize: 10, color: "#a5b4fc", marginBottom: 6 }}>
                        <strong>Combatants:</strong> {cz.belligerents.join(" vs ")}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                    {onFocusCoordinates && (
                      <button
                        onClick={() => onFocusCoordinates(cz.lat, cz.lon, 6)}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: 10,
                          background: "rgba(0, 229, 255, 0.1)",
                          color: "var(--cyan)",
                          border: "1px solid var(--cyan)",
                          borderRadius: 3,
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Focus Tactical Map
                      </button>
                    )}
                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={cz.label}
                      platform="osiris_conflict_zone"
                      discoveredBy="c4isr_unified_cockpit"
                      metadata={cz}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: 6, border: "1px solid rgba(0, 229, 255, 0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)" }}>
                NATIONAL C4ISR STRATEGIC DOSSIER
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Select State:</span>
                {["US", "RU", "CN", "IR", "IL", "UA", "GB", "KP", "TW"].map((cc) => (
                  <button
                    key={cc}
                    onClick={() => {
                      setSelectedCountry(cc);
                      loadCountryDossier(cc);
                    }}
                    style={{
                      padding: "2px 8px",
                      fontSize: 10,
                      background: selectedCountry === cc ? "var(--cyan)" : "rgba(255,255,255,0.05)",
                      color: selectedCountry === cc ? "#000" : "#cbd5e1",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {cc}
                  </button>
                ))}
              </div>
            </div>

            {dossierLoading ? (
              <div style={{ padding: 16, textAlign: "center", color: "var(--cyan)", fontSize: 11 }}>
                Querying Geopolitical C4ISR Database...
              </div>
            ) : countryDossier ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: 16 }}>
                      {countryDossier.country} ({countryDossier.iso_code})
                    </h3>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Capital: {countryDossier.capital} | Population: {countryDossier.population}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(255, 85, 85, 0.2)", color: "#ff5555", borderRadius: 3, fontWeight: "bold" }}>
                    {countryDossier.defense_readiness}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8, fontSize: 11 }}>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 4 }}>
                    <div style={{ color: "var(--cyan)", fontWeight: "bold" }}>COMMAND &amp; LEADERSHIP:</div>
                    <div style={{ color: "#fff" }}>{countryDossier.head_of_state}</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 4 }}>
                    <div style={{ color: "#ffaa00", fontWeight: "bold" }}>NUCLEAR TRIAD &amp; POSTURE:</div>
                    <div style={{ color: "#fff" }}>{countryDossier.nuclear_triad}</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 4, gridColumn: "1 / -1" }}>
                    <div style={{ color: "#a5b4fc", fontWeight: "bold" }}>STRATEGIC BASES:</div>
                    <div>{countryDossier.strategic_posture}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      Airbases: {countryDossier.primary_airbases?.join(", ")}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#a5b4fc" }}>
                TELEGRAM CONFLICT OSINT WIRE
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["osintdefender", "geoconfirmed", "clashreport"].map((ch) => (
                  <button
                    key={ch}
                    onClick={() => {
                      setTgChannel(ch);
                      loadConflictsAndStrategy();
                    }}
                    style={{
                      padding: "2px 6px",
                      fontSize: 10,
                      background: tgChannel === ch ? "rgba(165, 180, 252, 0.2)" : "transparent",
                      color: tgChannel === ch ? "#a5b4fc" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: tgChannel === ch ? "underline" : "none",
                    }}
                  >
                    @{ch}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {telegramPosts.map((p) => (
                <div key={p.id} style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: 9 }}>
                    <span>@{p.channel}</span>
                    <span>{p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : ""}</span>
                  </div>
                  <p style={{ margin: "4px 0", color: "#e2e8f0", lineHeight: 1.3 }}>
                    {p.text?.substring(0, 160)}...
                  </p>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--cyan)" }}>
                      View Dispatch ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CCTV SURVEILLANCE HARVESTER */}
      {activeTab === "CCTV" && (
        <GlobalCctvSuite
          onFocusCoordinates={onFocusCoordinates}
          onPinToMap={(cam: CctvCameraItem) =>
            handlePinTelemetry({
              id: cam.id,
              latitude: cam.lat,
              longitude: cam.lon,
              label: `CCTV: ${cam.name} (${cam.city})`,
              description: `Source: ${cam.source} | Feed: ${cam.feed_url}`,
            })
          }
        />
      )}

      {/* TAB 4: MARITIME & INFRASTRUCTURE */}
      {activeTab === "MARITIME_INFRA" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <GlobeIcon size={14} color="var(--cyan)" />
              STRATEGIC MARITIME CHOKEPOINT VESSELS (GOD'S EYE AIS)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {vessels.map((v) => (
                <div key={v.mmsi} style={{ background: "rgba(10, 14, 24, 0.8)", border: "1px solid rgba(0, 229, 255, 0.25)", borderRadius: 6, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "var(--cyan)", fontSize: 13 }}>{v.name}</strong>
                    <span style={{ fontSize: 10, color: "#fff" }}>{v.flag}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    MMSI: <code>{v.mmsi}</code> | Chokepoint: <strong style={{ color: "#fff" }}>{v.chokepoint}</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, margin: "6px 0", background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 4 }}>
                    <div>Speed: <strong>{v.speed_kts} kts</strong></div>
                    <div>Heading: <strong>{v.heading}°</strong></div>
                    <div style={{ gridColumn: "1 / -1" }}>Dest: <strong style={{ color: "#a5b4fc" }}>{v.destination}</strong></div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {onFocusCoordinates && (
                      <button
                        onClick={() => onFocusCoordinates(v.lat, v.lon, 8)}
                        style={{ flex: 1, padding: "3px 6px", fontSize: 10, background: "rgba(0, 229, 255, 0.1)", color: "var(--cyan)", border: "1px solid var(--cyan)", borderRadius: 3, cursor: "pointer" }}
                      >
                        Target Vessel
                      </button>
                    )}
                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={`mmsi:${v.mmsi}`}
                      platform="godseye_vessels"
                      discoveredBy="c4isr_unified_cockpit"
                      metadata={v}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#a5b4fc", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <LinkIcon size={14} color="#a5b4fc" />
              SUBSEA FIBER OPTIC CABLES &amp; LANDING STATIONS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
              {cables.map((c) => {
                const firstPt = c.landing_points[0] || { lat: 0, lon: 0, name: "" };
                return (
                  <div key={c.id} style={{ background: "rgba(10, 14, 24, 0.8)", border: "1px solid rgba(165, 180, 252, 0.25)", borderRadius: 6, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#a5b4fc", fontSize: 13 }}>{c.name}</strong>
                      <span style={{ fontSize: 10, color: "#fff" }}>{c.length_km.toLocaleString()} km</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", margin: "4px 0" }}>
                      Owners: {c.owners.join(", ")} | Capacity: {c.capacity_tbps} Tbps
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Landing Points:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                      {c.landing_points.map((pt, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 2, fontSize: 10 }}>
                          <span>{pt.name} ({pt.country})</span>
                          <code>{pt.lat.toFixed(2)}, {pt.lon.toFixed(2)}</code>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {onFocusCoordinates && (
                        <button
                          onClick={() => onFocusCoordinates(firstPt.lat, firstPt.lon, 6)}
                          style={{ flex: 1, padding: "3px 6px", fontSize: 10, background: "rgba(165, 180, 252, 0.15)", color: "#a5b4fc", border: "1px solid #a5b4fc", borderRadius: 3, cursor: "pointer" }}
                        >
                          Focus Landing Station
                        </button>
                      )}
                      <SaveToCaseButton
                        identifierType="corporate"
                        identifierValue={c.name}
                        platform="godseye_cables"
                        discoveredBy="c4isr_unified_cockpit"
                        metadata={c}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#f472b6", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <DatabaseIcon size={14} color="#f472b6" />
              CRITICAL GLOBAL INFRASTRUCTURE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {infra.map((inf, idx) => (
                <div key={idx} style={{ background: "rgba(10, 14, 24, 0.8)", border: "1px solid rgba(244, 114, 182, 0.25)", borderRadius: 6, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#f472b6", fontSize: 13 }}>{inf.name}</strong>
                    <span style={{ fontSize: 9, padding: "1px 4px", background: "rgba(244, 114, 182, 0.15)", color: "#f472b6", borderRadius: 2 }}>{inf.category}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0" }}>{inf.details}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Coords: <code>{inf.lat.toFixed(4)}, {inf.lon.toFixed(4)}</code> ({inf.region})
                  </div>
                  {onFocusCoordinates && (
                    <button
                      onClick={() => onFocusCoordinates(inf.lat, inf.lon, 7)}
                      style={{ marginTop: 6, width: "100%", padding: "3px 6px", fontSize: 10, background: "rgba(244, 114, 182, 0.15)", color: "#f472b6", border: "1px solid #f472b6", borderRadius: 3, cursor: "pointer" }}
                    >
                      Target Facility
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DISASTERS & THERMAL */}
      {activeTab === "DISASTERS_THERMAL" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#ffaa00", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <FlameIcon size={14} color="#ffaa00" />
              USGS M2.5+ SEISMIC ACTIVITY (24-HOUR GLOBAL)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
              {earthquakes.map((eq) => (
                <div key={eq.id} style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255, 170, 0, 0.3)", borderRadius: 6, padding: 10, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#ffaa00" }}>M{eq.magnitude} — {eq.place}</strong>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 4 }}>
                    Depth: {eq.depth_km} km | Tsunami Risk: {eq.tsunami ? "YES" : "NO"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <code>{eq.lat.toFixed(2)}, {eq.lon.toFixed(2)}</code>
                    {onFocusCoordinates && (
                      <button
                        onClick={() => onFocusCoordinates(eq.lat, eq.lon, 6)}
                        style={{ padding: "2px 6px", fontSize: 9, background: "rgba(255,170,0,0.2)", color: "#ffaa00", border: "none", borderRadius: 2, cursor: "pointer" }}
                      >
                        Focus Epicenter
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#ff55ff", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <FlameIcon size={14} color="#ff55ff" />
              NASA FIRMS SATELLITE THERMAL HOTSPOTS &amp; WILDFIRES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              {thermalFires.map((f) => (
                <div key={f.id} style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255, 85, 255, 0.3)", borderRadius: 6, padding: 10, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#ff55ff" }}>Thermal Radiation: {f.radiative_power_mw || 15} MW</strong>
                    <span style={{ fontSize: 9, color: "#fff" }}>{f.confidence || "HIGH"}</span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 4 }}>
                    Sensor: {f.satellite || "VIIRS/MODIS"} | Brightness: {f.brightness_kelvin || 320}K
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <code>{f.latitude.toFixed(2)}, {f.longitude.toFixed(2)}</code>
                    {onFocusCoordinates && (
                      <button
                        onClick={() => onFocusCoordinates(f.latitude, f.longitude, 6)}
                        style={{ padding: "2px 6px", fontSize: 9, background: "rgba(255,85,255,0.2)", color: "#ff55ff", border: "none", borderRadius: 2, cursor: "pointer" }}
                      >
                        Focus Hotspot
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CYBER C2 & THREATS */}
      {activeTab === "CYBER_C2" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Real-time feed of active botnet Command &amp; Control (C2) servers via Feodo Tracker / abuse.ch with geolocation mapping.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {malwareC2s.map((c2) => (
              <div key={c2.id} style={{ background: "rgba(10, 14, 24, 0.8)", border: "1px solid rgba(255, 42, 109, 0.3)", borderRadius: 6, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "var(--danger)", fontSize: 13 }}>{c2.ip}:{c2.port || 80}</strong>
                  <span style={{ fontSize: 9, padding: "1px 5px", background: "rgba(255, 42, 109, 0.2)", color: "var(--danger)", borderRadius: 2 }}>{c2.malware}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Country: {c2.country} | Status: <strong style={{ color: "#fff" }}>{c2.status}</strong>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  First Seen: {c2.first_seen} | Last Online: {c2.last_online}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {onFocusCoordinates && (
                    <button
                      onClick={() => onFocusCoordinates(c2.latitude, c2.longitude, 7)}
                      style={{ flex: 1, padding: "3px 6px", fontSize: 10, background: "rgba(255, 42, 109, 0.15)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 3, cursor: "pointer" }}
                    >
                      Locate C2 Host
                    </button>
                  )}
                  <SaveToCaseButton
                    identifierType="domain"
                    identifierValue={c2.ip}
                    platform="feodo_tracker_c2"
                    discoveredBy="c4isr_unified_cockpit"
                    metadata={c2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: GEO-FINANCE & SANCTIONS */}
      {activeTab === "MARKETS_SANCTIONS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#00E676", marginBottom: 8 }}>
              DEFENSE AEROSPACE EQUITIES &amp; CRITICAL COMMODITIES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              {marketQuotes.map((mq, idx) => (
                <div key={idx} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0, 230, 118, 0.25)", borderRadius: 4, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#fff" }}>{mq.ticker}</strong>
                    <span style={{ color: mq.change_pct >= 0 ? "#00E676" : "#ff5555", fontWeight: "bold" }}>
                      {mq.change_pct >= 0 ? `+${mq.change_pct}%` : `${mq.change_pct}%`}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{mq.name}</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff", marginTop: 4 }}>${mq.price}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.3)", padding: 14, borderRadius: 6, border: "1px solid rgba(0, 229, 255, 0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
              OFAC SPECIALLY DESIGNATED NATIONALS (SDN) SEARCH
            </div>
            <form onSubmit={handleSanctionsSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                value={sanctionsQuery}
                onChange={(e) => setSanctionsQuery(e.target.value)}
                placeholder="Search sanctioned individuals, defense contractors, shell companies..."
                style={{ flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.5)", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 4, fontSize: 12 }}
              />
              <button
                type="submit"
                disabled={sanctionsLoading}
                style={{ padding: "8px 16px", background: "var(--cyan)", color: "#000", fontWeight: "bold", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
              >
                {sanctionsLoading ? "Interrogating..." : "Search SDN"}
              </button>
            </form>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
              {sanctionsMatches.map((sn, idx) => (
                <div key={idx} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255, 85, 85, 0.25)", borderRadius: 4, padding: 10, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#fff" }}>{sn.name}</strong>
                    <span style={{ fontSize: 9, padding: "1px 4px", background: "rgba(255, 85, 85, 0.2)", color: "#ff5555", borderRadius: 2 }}>{sn.program}</span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 4 }}>
                    Type: {sn.type} | Country: {sn.country || "GLOBAL"}
                  </div>
                  {sn.remarks && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sn.remarks}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* TAB 8: SOCMINT — Social Media Intelligence */}
      {activeTab === "SOCMINT" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <SocmintSuite />
        </div>
      )}
    </div>
  );
}
