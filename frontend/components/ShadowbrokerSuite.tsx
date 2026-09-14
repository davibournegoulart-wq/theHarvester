"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  RadarIcon,
  PinIcon,
  ShieldIcon,
  GlobeIcon,
  AlertIcon,
  CheckIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  TerminalIcon,
  FolderIcon,
  CameraIcon,
} from "@/components/FlatIcons";

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

export type NasaFirmsItem = {
  id: string;
  latitude: number;
  longitude: number;
  radiative_power_mw: number;
  brightness_kelvin: number;
  acquisition_date: string;
  daynight: string;
  confidence: string;
  satellite: string;
  source: string;
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

export type EarthquakeItem = {
  id: string;
  magnitude: number;
  place: string;
  latitude: number;
  longitude: number;
  depth_km: number;
  time: string;
  url: string;
  source: string;
};

type TelemetryFeedTab = "military" | "jamming" | "firms" | "malware" | "telegram" | "earthquakes" | "country_dossier";

export default function ShadowbrokerSuite({
  onPinToMap,
}: {
  onPinToMap?: (item: { latitude: number; longitude: number; label: string }) => void;
}) {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<TelemetryFeedTab>("military");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedSuccessId, setPinnedSuccessId] = useState<string | null>(null);

  // Feed states
  const [militaryFlights, setMilitaryFlights] = useState<MilitaryFlightItem[]>([]);
  const [gpsJammingZones, setGpsJammingZones] = useState<GpsJammingItem[]>([]);
  const [nasaFirms, setNasaFirms] = useState<NasaFirmsItem[]>([]);
  const [malwareC2s, setMalwareC2s] = useState<MalwareC2Item[]>([]);
  const [telegramPosts, setTelegramPosts] = useState<TelegramOsintItem[]>([]);
  const [earthquakes, setEarthquakes] = useState<EarthquakeItem[]>([]);

  // Country Strategic Dossier State
  const [selectedCountryCode, setSelectedCountryCode] = useState("US");
  const [countryDossier, setCountryDossier] = useState<any | null>(null);

  // Telegram channel selector
  const [tgChannel, setTgChannel] = useState("osintdefender");

  useEffect(() => {
    loadActiveFeed(activeTab);
  }, [activeTab]);

  async function loadActiveFeed(tab: TelemetryFeedTab) {
    setLoading(true);
    setError(null);
    try {
      if (tab === "military") {
        const data = await apiGet<MilitaryFlightItem[]>("/recon/shadowbroker/military-flights?limit=40");
        setMilitaryFlights(data || []);
      } else if (tab === "jamming") {
        const data = await apiGet<GpsJammingItem[]>("/recon/shadowbroker/gps-jamming");
        setGpsJammingZones(data || []);
      } else if (tab === "firms") {
        const data = await apiGet<NasaFirmsItem[]>("/recon/shadowbroker/nasa-firms?limit=40");
        setNasaFirms(data || []);
      } else if (tab === "malware") {
        const data = await apiGet<MalwareC2Item[]>("/recon/shadowbroker/malware-c2?limit=40");
        setMalwareC2s(data || []);
      } else if (tab === "telegram") {
        const data = await apiGet<TelegramOsintItem[]>(`/recon/shadowbroker/telegram-feed?channel=${encodeURIComponent(tgChannel)}&limit=20`);
        setTelegramPosts(data || []);
      } else if (tab === "earthquakes") {
        const data = await apiGet<EarthquakeItem[]>("/recon/shadowbroker/earthquakes?limit=40");
        setEarthquakes(data || []);
      } else if (tab === "country_dossier") {
        const data = await apiGet<any>(`/recon/shadowbroker/country-dossier?country=${encodeURIComponent(selectedCountryCode)}`);
        setCountryDossier(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching telemetry stream");
    } finally {
      setLoading(false);
    }
  }

  async function handlePinTelemetry(item: {
    id: string;
    latitude: number;
    longitude: number;
    label: string;
    description: string;
    source: string;
    source_url?: string;
  }) {
    if (!activeCase) {
      alert("Please activate or select a case first.");
      return;
    }

    try {
      await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
        latitude: item.latitude,
        longitude: item.longitude,
        label: item.label,
        description: item.description,
        source_url: item.source_url || null,
        source: item.source,
      });

      setPinnedSuccessId(item.id);
      setTimeout(() => setPinnedSuccessId(null), 3000);

      if (onPinToMap) {
        onPinToMap({
          latitude: item.latitude,
          longitude: item.longitude,
          label: item.label,
        });
      }
    } catch (err) {
      alert("Error saving geolocation pin: " + err);
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid rgba(162, 89, 255, 0.4)",
        borderRadius: 6,
        padding: 20,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          borderBottom: "1px solid rgba(162, 89, 255, 0.2)",
          paddingBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RadarIcon size={20} color="#a259ff" />
            <h3 style={{ margin: 0, color: "#a259ff", letterSpacing: "0.08em", fontSize: 16 }}>
              SHADOWBROKER: MULTI-DOMAIN THREAT INTERCEPT &amp; TELEMETRY
            </h3>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(162, 89, 255, 0.15)",
                color: "#a259ff",
                border: "1px solid rgba(162, 89, 255, 0.3)",
                fontFamily: "monospace",
              }}
            >
              BigBodyCobain/Shadowbroker
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "6px 0 0 0", maxWidth: 850 }}>
            Real-time geospatial intelligence telemetry aggregating live military aircraft ADS-B transponders,
            electronic warfare &amp; GPS jamming zones, NASA FIRMS thermal anomalies, botnet C2 infrastructure, and Telegram conflict channels.
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => loadActiveFeed(activeTab)}
          disabled={loading}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            background: "rgba(162, 89, 255, 0.15)",
            color: "#a259ff",
            border: "1px solid #a259ff",
            borderRadius: 4,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: "bold",
          }}
        >
          <RefreshCwIcon size={12} color="#a259ff" />
          {loading ? "SYNCING..." : "REFRESH TELEMETRY"}
        </button>
      </div>

      {/* Layer selector tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 16,
          background: "rgba(10, 12, 18, 0.6)",
          padding: 8,
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setActiveTab("military")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "military" ? "1px solid #05d9e8" : "1px solid transparent",
            background: activeTab === "military" ? "rgba(5, 217, 232, 0.2)" : "transparent",
            color: activeTab === "military" ? "#05d9e8" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "military" ? "bold" : "normal",
          }}
        >
          <RadarIcon size={13} color={activeTab === "military" ? "#05d9e8" : "var(--text-muted)"} />
          Military &amp; VIP Flights
          <span style={{ fontSize: 10, opacity: 0.8 }}>({militaryFlights.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("jamming")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "jamming" ? "1px solid #ffaa00" : "1px solid transparent",
            background: activeTab === "jamming" ? "rgba(255, 170, 0, 0.2)" : "transparent",
            color: activeTab === "jamming" ? "#ffaa00" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "jamming" ? "bold" : "normal",
          }}
        >
          <AlertIcon size={13} color={activeTab === "jamming" ? "#ffaa00" : "var(--text-muted)"} />
          GPS Jamming &amp; EW
          <span style={{ fontSize: 10, opacity: 0.8 }}>({gpsJammingZones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("firms")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "firms" ? "1px solid #ff2a6d" : "1px solid transparent",
            background: activeTab === "firms" ? "rgba(255, 42, 109, 0.2)" : "transparent",
            color: activeTab === "firms" ? "#ff2a6d" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "firms" ? "bold" : "normal",
          }}
        >
          <GlobeIcon size={13} color={activeTab === "firms" ? "#ff2a6d" : "var(--text-muted)"} />
          NASA FIRMS Hotspots
          <span style={{ fontSize: 10, opacity: 0.8 }}>({nasaFirms.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("malware")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "malware" ? "1px solid #a259ff" : "1px solid transparent",
            background: activeTab === "malware" ? "rgba(162, 89, 255, 0.2)" : "transparent",
            color: activeTab === "malware" ? "#a259ff" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "malware" ? "bold" : "normal",
          }}
        >
          <ShieldIcon size={13} color={activeTab === "malware" ? "#a259ff" : "var(--text-muted)"} />
          Botnet &amp; C2 Threat Infrastructure
          <span style={{ fontSize: 10, opacity: 0.8 }}>({malwareC2s.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("telegram")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "telegram" ? "1px solid #00ff9f" : "1px solid transparent",
            background: activeTab === "telegram" ? "rgba(0, 255, 159, 0.2)" : "transparent",
            color: activeTab === "telegram" ? "#00ff9f" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "telegram" ? "bold" : "normal",
          }}
        >
          <TerminalIcon size={13} color={activeTab === "telegram" ? "#00ff9f" : "var(--text-muted)"} />
          Telegram Conflict OSINT
          <span style={{ fontSize: 10, opacity: 0.8 }}>({telegramPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("earthquakes")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "earthquakes" ? "1px solid #ffcc00" : "1px solid transparent",
            background: activeTab === "earthquakes" ? "rgba(255, 204, 0, 0.2)" : "transparent",
            color: activeTab === "earthquakes" ? "#ffcc00" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "earthquakes" ? "bold" : "normal",
          }}
        >
          <GlobeIcon size={13} color={activeTab === "earthquakes" ? "#ffcc00" : "var(--text-muted)"} />
          USGS Earthquakes (M2.5+)
          <span style={{ fontSize: 10, opacity: 0.8 }}>({earthquakes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("country_dossier")}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 4,
            border: activeTab === "country_dossier" ? "1px solid var(--cyan)" : "1px solid transparent",
            background: activeTab === "country_dossier" ? "rgba(0, 229, 255, 0.2)" : "transparent",
            color: activeTab === "country_dossier" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: activeTab === "country_dossier" ? "bold" : "normal",
          }}
        >
          <GlobeIcon size={13} color={activeTab === "country_dossier" ? "var(--cyan)" : "var(--text-muted)"} />
          C4ISR Country Dossiers
        </button>
      </div>

      {/* Sub-header controls for Telegram */}
      {activeTab === "telegram" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Select Intel Channel:</label>
          {["osintdefender", "nexta_live", "war_monitor", "Liveuamap", "aljazeeraenglish"].map((ch) => (
            <button
              key={ch}
              onClick={() => {
                setTgChannel(ch);
                setTimeout(() => loadActiveFeed("telegram"), 50);
              }}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                border: tgChannel === ch ? "1px solid #00ff9f" : "1px solid var(--border)",
                background: tgChannel === ch ? "rgba(0, 255, 159, 0.15)" : "transparent",
                color: tgChannel === ch ? "#00ff9f" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              @{ch}
            </button>
          ))}
        </div>
      )}

      {/* Loading & Error banner */}
      {loading && (
        <div style={{ padding: 16, textAlign: "center", color: "var(--cyan)", fontSize: 13 }}>
          Intercepting live telemetry stream from Shadowbroker feeds...
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--danger)", borderRadius: 4, color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* =========================================================================
          TAB 1: MILITARY FLIGHTS
          ========================================================================= */}
      {!loading && activeTab === "military" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {militaryFlights.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20 }}>No active military aircraft reported in range.</div>
          ) : (
            militaryFlights.map((ac) => {
              const isPinned = pinnedSuccessId === ac.id;
              return (
                <div
                  key={ac.id}
                  style={{
                    background: "rgba(10, 14, 22, 0.95)",
                    border: "1px solid rgba(5, 217, 232, 0.3)",
                    borderRadius: 6,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: "bold", fontSize: 14, color: "var(--cyan)", fontFamily: "monospace" }}>
                        {ac.callsign}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: "rgba(5, 217, 232, 0.15)",
                          color: "var(--cyan)",
                          fontWeight: "bold",
                        }}
                      >
                        {ac.type}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#fff", marginBottom: 6, fontWeight: 500 }}>
                      {ac.description}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                      <div>REG: <span style={{ color: "#fff" }}>{ac.registration}</span></div>
                      <div>HEX: <span style={{ color: "#fff", fontFamily: "monospace" }}>{ac.hex}</span></div>
                      <div>ALT: <span style={{ color: "var(--cyan)" }}>{ac.altitude_feet} ft</span></div>
                      <div>SPEED: <span style={{ color: "var(--cyan)" }}>{ac.ground_speed_kts} kts</span></div>
                      <div>SQUAWK: <span style={{ color: "#fff" }}>{ac.squawk}</span></div>
                      <div>ACCURACY (NAC-p): <span style={{ color: (ac.nac_p || 0) < 7 ? "#ffaa00" : "#00ff9f" }}>{ac.nac_p ?? "N/A"}</span></div>
                    </div>

                    <div style={{ fontSize: 11, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                      <PinIcon size={11} color="var(--cyan)" />
                      {ac.latitude.toFixed(4)}, {ac.longitude.toFixed(4)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() =>
                        handlePinTelemetry({
                          id: ac.id,
                          latitude: ac.latitude,
                          longitude: ac.longitude,
                          label: `Military Flight: ${ac.callsign} (${ac.type})`,
                          description: `${ac.description}. Reg: ${ac.registration}. Altitude: ${ac.altitude_feet} ft, Speed: ${ac.ground_speed_kts} kts.`,
                          source: "shadowbroker_military_adsb",
                          source_url: `https://globe.adsb.fi/?icao=${ac.hex.toLowerCase()}`,
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: "bold",
                        background: isPinned ? "rgba(0, 255, 159, 0.2)" : "rgba(5, 217, 232, 0.15)",
                        color: isPinned ? "#00ff9f" : "var(--cyan)",
                        border: isPinned ? "1px solid #00ff9f" : "1px solid var(--cyan)",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {isPinned ? <CheckIcon size={12} color="#00ff9f" /> : <PinIcon size={12} color="var(--cyan)" />}
                      {isPinned ? "PINNED TO MAP" : "PIN TO MAP"}
                    </button>

                    <SaveToCaseButton
                      identifierType="corporate"
                      identifierValue={ac.callsign}
                      platform="adsb_radar"
                      discoveredBy="shadowbroker"
                      metadata={{
                        hex: ac.hex,
                        type: ac.type,
                        description: ac.description,
                        altitude_feet: ac.altitude_feet,
                        ground_speed_kts: ac.ground_speed_kts,
                        coordinates: [ac.latitude, ac.longitude],
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: GPS JAMMING & ELECTRONIC WARFARE ZONES
          ========================================================================= */}
      {!loading && activeTab === "jamming" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {gpsJammingZones.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20 }}>No abnormal GPS jamming or electronic warfare zones detected in current snapshot.</div>
          ) : (
            gpsJammingZones.map((zone) => {
              const isPinned = pinnedSuccessId === zone.id;
              const severityColor = zone.severity === "HIGH" ? "#ff2a6d" : (zone.severity === "MEDIUM" ? "#ffaa00" : "#00ff9f");
              return (
                <div
                  key={zone.id}
                  style={{
                    background: "rgba(10, 14, 22, 0.95)",
                    border: `1px solid ${severityColor}60`,
                    borderRadius: 6,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: "bold", fontSize: 12, color: severityColor, display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertIcon size={14} color={severityColor} />
                        EW / GPS JAMMING ANOMALY
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: `${severityColor}20`,
                          color: severityColor,
                          fontWeight: "bold",
                        }}
                      >
                        {zone.severity} IMPACT ({zone.degraded_percentage}%)
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px 0" }}>
                      {zone.description}
                    </p>

                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
                      Degraded Aircraft: <strong style={{ color: "#fff" }}>{zone.degraded_aircraft}</strong> / {zone.total_aircraft} sampled in grid cell.
                    </div>

                    <div style={{ fontSize: 11, color: severityColor, display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                      <PinIcon size={11} color={severityColor} />
                      Center: {zone.latitude.toFixed(2)}, {zone.longitude.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        handlePinTelemetry({
                          id: zone.id,
                          latitude: zone.latitude,
                          longitude: zone.longitude,
                          label: `GPS Jamming Zone [${zone.severity}]`,
                          description: `${zone.description}. Degraded: ${zone.degraded_aircraft}/${zone.total_aircraft} (${zone.degraded_percentage}%).`,
                          source: "shadowbroker_gps_jamming",
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: "bold",
                        background: isPinned ? "rgba(0, 255, 159, 0.2)" : `${severityColor}15`,
                        color: isPinned ? "#00ff9f" : severityColor,
                        border: isPinned ? "1px solid #00ff9f" : `1px solid ${severityColor}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {isPinned ? <CheckIcon size={12} color="#00ff9f" /> : <PinIcon size={12} color={severityColor} />}
                      {isPinned ? "PINNED TO MAP" : "PIN TO MAP"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: NASA FIRMS SATELLITE THERMAL HOTSPOTS
          ========================================================================= */}
      {!loading && activeTab === "firms" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {nasaFirms.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20 }}>No active thermal satellite hotspots loaded.</div>
          ) : (
            nasaFirms.map((f) => {
              const isPinned = pinnedSuccessId === f.id;
              return (
                <div
                  key={f.id}
                  style={{
                    background: "rgba(10, 14, 22, 0.95)",
                    border: "1px solid rgba(255, 42, 109, 0.3)",
                    borderRadius: 6,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: "bold", fontSize: 13, color: "#ff2a6d", display: "flex", alignItems: "center", gap: 6 }}>
                        <GlobeIcon size={14} color="#ff2a6d" />
                        THERMAL ANOMALY / FIRE
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: "rgba(255, 42, 109, 0.15)",
                          color: "#ff2a6d",
                          fontWeight: "bold",
                        }}
                      >
                        {f.daynight} ({f.confidence})
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                      <div>FRP: <strong style={{ color: "#ff2a6d" }}>{f.radiative_power_mw} MW</strong></div>
                      <div>BRIGHTNESS: <span style={{ color: "#fff" }}>{f.brightness_kelvin} K</span></div>
                      <div>SATELLITE: <span style={{ color: "#fff" }}>{f.satellite}</span></div>
                      <div>UTC TIME: <span style={{ color: "var(--text-muted)" }}>{f.acquisition_date}</span></div>
                    </div>

                    <div style={{ fontSize: 11, color: "#ff2a6d", display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                      <PinIcon size={11} color="#ff2a6d" />
                      {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        handlePinTelemetry({
                          id: f.id,
                          latitude: f.latitude,
                          longitude: f.longitude,
                          label: `NASA FIRMS Thermal Hotspot (${f.radiative_power_mw} MW)`,
                          description: `Satellite thermal observation via ${f.satellite}. Radiative Power: ${f.radiative_power_mw} MW, Brightness: ${f.brightness_kelvin} K. Observed at ${f.acquisition_date}.`,
                          source: "shadowbroker_nasa_firms",
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: "bold",
                        background: isPinned ? "rgba(0, 255, 159, 0.2)" : "rgba(255, 42, 109, 0.15)",
                        color: isPinned ? "#00ff9f" : "#ff2a6d",
                        border: isPinned ? "1px solid #00ff9f" : "1px solid #ff2a6d",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {isPinned ? <CheckIcon size={12} color="#00ff9f" /> : <PinIcon size={12} color="#ff2a6d" />}
                      {isPinned ? "PINNED TO MAP" : "PIN TO MAP"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: MALWARE & BOTNET C2 INFRASTRUCTURE
          ========================================================================= */}
      {!loading && activeTab === "malware" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {malwareC2s.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20 }}>No active malware C2 nodes reported.</div>
          ) : (
            malwareC2s.map((c2) => {
              const isPinned = pinnedSuccessId === c2.id;
              return (
                <div
                  key={c2.id}
                  style={{
                    background: "rgba(10, 14, 22, 0.95)",
                    border: "1px solid rgba(162, 89, 255, 0.3)",
                    borderRadius: 6,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: "bold", fontSize: 13, color: "#a259ff", fontFamily: "monospace" }}>
                        {c2.ip}{c2.port ? `:${c2.port}` : ""}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: c2.status === "online" ? "rgba(0, 255, 159, 0.2)" : "rgba(255, 255, 255, 0.08)",
                          color: c2.status === "online" ? "#00ff9f" : "var(--text-muted)",
                          fontWeight: "bold",
                        }}
                      >
                        {c2.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#fff", fontWeight: "bold", marginBottom: 6 }}>
                      {c2.malware}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                      <div>COUNTRY: <strong style={{ color: "#fff" }}>{c2.country}</strong></div>
                      <div>TYPE: <span style={{ color: "var(--text-muted)" }}>{c2.threat_type}</span></div>
                      <div>FIRST SEEN: <span style={{ color: "var(--text-muted)" }}>{c2.first_seen?.slice(0, 10) || "N/A"}</span></div>
                      <div>LAST ONLINE: <span style={{ color: "var(--text-muted)" }}>{c2.last_online?.slice(0, 10) || "N/A"}</span></div>
                    </div>

                    <div style={{ fontSize: 11, color: "#a259ff", display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                      <PinIcon size={11} color="#a259ff" />
                      Approx: {c2.latitude.toFixed(2)}, {c2.longitude.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        handlePinTelemetry({
                          id: c2.id,
                          latitude: c2.latitude,
                          longitude: c2.longitude,
                          label: `Malware C2: ${c2.ip} (${c2.malware})`,
                          description: `Botnet C2 host for ${c2.malware} located in ${c2.country}. Port: ${c2.port || "N/A"}. First seen: ${c2.first_seen}.`,
                          source: "shadowbroker_feodo_c2",
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: "bold",
                        background: isPinned ? "rgba(0, 255, 159, 0.2)" : "rgba(162, 89, 255, 0.15)",
                        color: isPinned ? "#00ff9f" : "#a259ff",
                        border: isPinned ? "1px solid #00ff9f" : "1px solid #a259ff",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {isPinned ? <CheckIcon size={12} color="#00ff9f" /> : <PinIcon size={12} color="#a259ff" />}
                      {isPinned ? "PINNED TO MAP" : "PIN TO MAP"}
                    </button>

                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={c2.ip}
                      platform="botnet_tracker"
                      discoveredBy="shadowbroker"
                      metadata={{
                        malware: c2.malware,
                        port: c2.port,
                        country: c2.country,
                        status: c2.status,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: TELEGRAM CONFLICT OSINT
          ========================================================================= */}
      {!loading && activeTab === "telegram" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
          {telegramPosts.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20 }}>No messages found in public preview.</div>
          ) : (
            telegramPosts.map((post) => {
              const isPinned = pinnedSuccessId === post.id;
              return (
                <div
                  key={post.id}
                  style={{
                    background: "rgba(10, 14, 22, 0.95)",
                    border: "1px solid rgba(0, 255, 159, 0.3)",
                    borderRadius: 6,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: "bold", fontSize: 12, color: "#00ff9f" }}>
                        {post.channel}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {post.timestamp ? new Date(post.timestamp).toLocaleString() : ""}
                      </span>
                    </div>

                    {post.photo_url && (
                      <div
                        style={{
                          width: "100%",
                          height: 140,
                          borderRadius: 4,
                          marginBottom: 10,
                          backgroundImage: `url(${post.photo_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: "1px solid var(--border)",
                        }}
                      />
                    )}

                    <p
                      style={{
                        fontSize: 12,
                        color: "#e2e8f0",
                        margin: "0 0 10px 0",
                        lineHeight: "1.4",
                        maxHeight: 120,
                        overflowY: "auto",
                      }}
                    >
                      {post.text}
                    </p>

                    {post.location && post.latitude && post.longitude && (
                      <div style={{ fontSize: 11, color: "#00ff9f", display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                        <PinIcon size={11} color="#00ff9f" />
                        Geoparsed: <strong>{post.location}</strong> ({post.latitude.toFixed(2)}, {post.longitude.toFixed(2)})
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {post.latitude && post.longitude && (
                      <button
                        onClick={() =>
                          handlePinTelemetry({
                            id: post.id,
                            latitude: post.latitude!,
                            longitude: post.longitude!,
                            label: `Telegram OSINT: ${post.location}`,
                            description: `${post.text.slice(0, 180)}... (Channel: ${post.channel})`,
                            source: "shadowbroker_telegram_osint",
                            source_url: post.url,
                          })
                        }
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: 11,
                          fontWeight: "bold",
                          background: isPinned ? "rgba(0, 255, 159, 0.2)" : "rgba(0, 255, 159, 0.15)",
                          color: isPinned ? "#00ff9f" : "#00ff9f",
                          border: "1px solid #00ff9f",
                          borderRadius: 4,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        {isPinned ? <CheckIcon size={12} color="#00ff9f" /> : <PinIcon size={12} color="#00ff9f" />}
                        {isPinned ? "PINNED TO MAP" : "PIN TO MAP"}
                      </button>
                    )}

                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        background: "rgba(255, 255, 255, 0.06)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <ExternalLinkIcon size={12} color="var(--text-muted)" />
                      Feed
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 6: USGS SEISMIC & EARTHQUAKES
          ========================================================================= */}
      {!loading && activeTab === "earthquakes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {earthquakes.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 20 }}>No earthquakes recorded in 24h window.</div>
          ) : (
            earthquakes.map((eq) => {
              const isPinned = pinnedSuccessId === eq.id;
              const isHigh = eq.magnitude >= 5.0;
              const magColor = isHigh ? "#ff2a6d" : "#ffcc00";
              return (
                <div
                  key={eq.id}
                  style={{
                    background: "rgba(10, 14, 22, 0.95)",
                    border: `1px solid ${magColor}50`,
                    borderRadius: 6,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: "bold", fontSize: 14, color: magColor }}>
                        M {eq.magnitude.toFixed(1)}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        Depth: {eq.depth_km} km
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#fff", fontWeight: 500, marginBottom: 8 }}>
                      {eq.place}
                    </div>

                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                      Time: {eq.time}
                    </div>

                    <div style={{ fontSize: 11, color: magColor, display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                      <PinIcon size={11} color={magColor} />
                      {eq.latitude.toFixed(3)}, {eq.longitude.toFixed(3)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        handlePinTelemetry({
                          id: eq.id,
                          latitude: eq.latitude,
                          longitude: eq.longitude,
                          label: `Earthquake M${eq.magnitude.toFixed(1)}: ${eq.place}`,
                          description: `Seismic event magnitude ${eq.magnitude.toFixed(1)} at depth ${eq.depth_km} km. Recorded at ${eq.time}.`,
                          source: "shadowbroker_usgs_earthquake",
                          source_url: eq.url,
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: "bold",
                        background: isPinned ? "rgba(0, 255, 159, 0.2)" : `${magColor}15`,
                        color: isPinned ? "#00ff9f" : magColor,
                        border: isPinned ? "1px solid #00ff9f" : `1px solid ${magColor}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {isPinned ? <CheckIcon size={12} color="#00ff9f" /> : <PinIcon size={12} color={magColor} />}
                      {isPinned ? "PINNED TO MAP" : "PIN TO MAP"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 7. Strategic Country Dossiers Tab */}
      {activeTab === "country_dossier" && (
        <div>
          {/* Country Quick Selector */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
              STRATEGIC TARGET:
            </label>
            {[
              { code: "US", name: "United States" },
              { code: "RU", name: "Russia" },
              { code: "CN", name: "China" },
              { code: "UA", name: "Ukraine" },
              { code: "IL", name: "Israel" },
              { code: "IR", name: "Iran" },
              { code: "TW", name: "Taiwan" },
              { code: "GB", name: "United Kingdom" },
              { code: "BR", name: "Brazil" },
            ].map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setSelectedCountryCode(c.code);
                  setLoading(true);
                  apiGet<any>(`/recon/shadowbroker/country-dossier?country=${c.code}`)
                    .then((data) => setCountryDossier(data))
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
                style={{
                  padding: "5px 10px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  borderRadius: 4,
                  border: selectedCountryCode === c.code ? "1px solid var(--cyan)" : "1px solid var(--border)",
                  background: selectedCountryCode === c.code ? "rgba(0, 229, 255, 0.2)" : "rgba(10, 14, 22, 0.6)",
                  color: selectedCountryCode === c.code ? "var(--cyan)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontWeight: selectedCountryCode === c.code ? "bold" : "normal",
                }}
              >
                {c.name} ({c.code})
              </button>
            ))}
          </div>

          {countryDossier && (
            <div
              style={{
                background: "rgba(10, 14, 22, 0.95)",
                border: "1px solid var(--cyan)",
                borderRadius: 8,
                padding: 20,
                fontFamily: "monospace",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>
                    {countryDossier.country} ({countryDossier.iso_code})
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Capital: <strong style={{ color: "#fff" }}>{countryDossier.capital}</strong> | Population: {countryDossier.population}
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: "bold",
                    background: "rgba(255, 42, 109, 0.2)",
                    color: "var(--danger)",
                    border: "1px solid var(--danger)",
                  }}
                >
                  {countryDossier.defense_readiness}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 4, borderLeft: "3px solid var(--cyan)" }}>
                  <div style={{ color: "var(--cyan)", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
                    HEAD OF STATE &amp; MILITARY COMMAND:
                  </div>
                  <div style={{ color: "#fff", fontSize: 12 }}>{countryDossier.head_of_state}</div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 4, borderLeft: "3px solid #a259ff" }}>
                  <div style={{ color: "#a259ff", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
                    ALLIANCES &amp; STRATEGIC BLOCS:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {countryDossier.alliances?.map((al: string, i: number) => (
                      <span key={i} style={{ padding: "1px 5px", background: "rgba(162, 89, 255, 0.2)", borderRadius: 3, fontSize: 10 }}>
                        {al}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 4, borderLeft: "3px solid #ffaa00" }}>
                  <div style={{ color: "#ffaa00", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
                    NUCLEAR POSTURE:
                  </div>
                  <div style={{ color: "#fff", fontSize: 12 }}>{countryDossier.nuclear_triad}</div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 4, borderLeft: "3px solid #00ff9f" }}>
                  <div style={{ color: "#00ff9f", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
                    SANCTIONS REGIME / ENFORCEMENT:
                  </div>
                  <div style={{ color: "#fff", fontSize: 12 }}>{countryDossier.sanctions_enforcement}</div>
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 4, borderLeft: "3px solid var(--cyan)", marginBottom: 16 }}>
                <div style={{ color: "var(--cyan)", fontWeight: "bold", fontSize: 11, marginBottom: 4 }}>
                  STRATEGIC DOCTRINE &amp; PRIMARY AIRBASES:
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 12, marginBottom: 6 }}>
                  {countryDossier.strategic_posture}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  Key Installations: {countryDossier.primary_airbases?.join(" • ")}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <SaveToCaseButton
                  identifierType="corporate"
                  identifierValue={countryDossier.country}
                  platform="shadowbroker_c4isr"
                  discoveredBy="shadowbroker_country_dossier"
                  metadata={countryDossier}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
