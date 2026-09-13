"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
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
} from "@/components/FlatIcons";

type GodsEyeTab = "satellites" | "vessels" | "cables" | "launches" | "infra";
type SensorMode = "optical" | "flir_white" | "flir_ironbow" | "nvg" | "sar";

type SatelliteItem = {
  name: string;
  norad_id: number;
  group: string;
  category: string;
  altitude_km: number;
  velocity_kms: number;
  inclination_deg: number;
  period_min: number;
  latitude: number;
  longitude: number;
  status: string;
  epoch?: string;
  source: string;
};

type SpaceLaunchItem = {
  id: string;
  mission_name: string;
  status: string;
  net_time: string;
  provider: string;
  rocket: string;
  pad_name: string;
  location_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  orbit: string;
  description: string;
};

type SubmarineCableItem = {
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

type MaritimeVesselItem = {
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

type StrategicInfraItem = {
  name: string;
  category: string;
  region: string;
  lat: number;
  lon: number;
  details: string;
};

export default function GodsEyeSuite() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<GodsEyeTab>("satellites");
  const [sensorMode, setSensorMode] = useState<SensorMode>("optical");

  // Satellites state
  const [satGroup, setSatGroup] = useState<string>("stations");
  const [satellites, setSatellites] = useState<SatelliteItem[]>([]);
  const [loadingSats, setLoadingSats] = useState<boolean>(false);

  // Launches state
  const [launches, setLaunches] = useState<SpaceLaunchItem[]>([]);
  const [loadingLaunches, setLoadingLaunches] = useState<boolean>(false);

  // Submarine Cables state
  const [cables, setCables] = useState<SubmarineCableItem[]>([]);
  const [loadingCables, setLoadingCables] = useState<boolean>(false);

  // Maritime vessels state
  const [vessels, setVessels] = useState<MaritimeVesselItem[]>([]);
  const [loadingVessels, setLoadingVessels] = useState<boolean>(false);

  // Critical infrastructure state
  const [infra, setInfra] = useState<StrategicInfraItem[]>([]);
  const [loadingInfra, setLoadingInfra] = useState<boolean>(false);

  // Pin state
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Fetch functions
  async function loadSatellites(group: string) {
    setLoadingSats(true);
    try {
      const data = await apiGet<SatelliteItem[]>(`/recon/godseye/satellites?group=${group}`);
      setSatellites(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSats(false);
    }
  }

  async function loadLaunches() {
    setLoadingLaunches(true);
    try {
      const data = await apiGet<SpaceLaunchItem[]>("/recon/godseye/launches");
      setLaunches(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLaunches(false);
    }
  }

  async function loadCables() {
    setLoadingCables(true);
    try {
      const data = await apiGet<SubmarineCableItem[]>("/recon/godseye/submarine-cables");
      setCables(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCables(false);
    }
  }

  async function loadVessels() {
    setLoadingVessels(true);
    try {
      const data = await apiGet<MaritimeVesselItem[]>("/recon/godseye/vessels");
      setVessels(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVessels(false);
    }
  }

  async function loadInfra() {
    setLoadingInfra(true);
    try {
      const data = await apiGet<StrategicInfraItem[]>("/recon/godseye/critical-infra?category=all");
      setInfra(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInfra(false);
    }
  }

  useEffect(() => {
    loadSatellites(satGroup);
    loadLaunches();
    loadCables();
    loadVessels();
    loadInfra();
  }, []);

  useEffect(() => {
    if (activeTab === "satellites") {
      loadSatellites(satGroup);
    }
  }, [satGroup]);

  // Pin to active case map
  async function handlePinLocation(label: string, lat: number, lon: number, notes: string, itemKey: string) {
    if (!activeCase) return;
    setPinnedId(itemKey);
    try {
      await apiPostJson(`/cases/${activeCase.id}/locations`, {
        label,
        latitude: lat,
        longitude: lon,
        source: "godseye.orbital",
        notes,
      });
      setTimeout(() => setPinnedId(null), 3500);
    } catch (e) {
      console.error(e);
      setPinnedId(null);
    }
  }

  // Sensor style theme mapping
  const sensorStyles: Record<SensorMode, { border: string; bg: string; text: string; label: string }> = {
    optical: {
      border: "rgba(5, 217, 232, 0.4)",
      bg: "rgba(10, 14, 24, 0.9)",
      text: "var(--cyan)",
      label: "OPTICAL SATELLITE (NRO / HIGH-RES)",
    },
    flir_white: {
      border: "rgba(240, 240, 240, 0.4)",
      bg: "rgba(20, 20, 25, 0.95)",
      text: "#f0f0f0",
      label: "FLIR THERMAL (WHITE-HOT INFRARED)",
    },
    flir_ironbow: {
      border: "rgba(255, 100, 30, 0.5)",
      bg: "rgba(35, 10, 20, 0.95)",
      text: "#ff7733",
      label: "FLIR IRONBOW (PREDATOR FALSE-COLOR)",
    },
    nvg: {
      border: "rgba(0, 255, 65, 0.45)",
      bg: "rgba(5, 25, 10, 0.95)",
      text: "#00ff41",
      label: "NVG NIGHT VISION (GREEN PHOSPHOR)",
    },
    sar: {
      border: "rgba(0, 229, 255, 0.5)",
      bg: "rgba(2, 20, 35, 0.95)",
      text: "#00e5ff",
      label: "SAR (SYNTHETIC APERTURE RADAR)",
    },
  };

  const curSensor = sensorStyles[sensorMode];

  return (
    <div
      style={{
        background: curSensor.bg,
        border: `1px solid ${curSensor.border}`,
        borderRadius: 6,
        padding: 20,
        boxShadow: "0 6px 26px rgba(0,0,0,0.45)",
        transition: "all 0.25s ease",
        fontFamily: "monospace",
      }}
    >
      {/* Top Classification & HUD Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          borderBottom: `1px solid ${curSensor.border}`,
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RadarIcon size={20} color={curSensor.text} />
            <h3 style={{ margin: 0, color: curSensor.text, letterSpacing: "0.1em", fontSize: 16 }}>
              GOD'S EYE VIEW: SPY-SATELLITE &amp; MULTI-SENSOR RECON
            </h3>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.08)",
                color: curSensor.text,
                border: `1px solid ${curSensor.border}`,
              }}
            >
              bilawalsidhu/gods-eye-view
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Active Sensor: <span style={{ color: curSensor.text, fontWeight: "bold" }}>{curSensor.label}</span>
          </div>
        </div>

        {/* Sensor Mode Switcher */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sensors:</span>
          {(
            [
              { id: "optical", label: "OPTICAL" },
              { id: "flir_white", label: "FLIR WHOT" },
              { id: "flir_ironbow", label: "IRONBOW" },
              { id: "nvg", label: "NVG GREEN" },
              { id: "sar", label: "SAR RADAR" },
            ] as Array<{ id: SensorMode; label: string }>
          ).map((s) => {
            const isSel = sensorMode === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSensorMode(s.id)}
                style={{
                  fontSize: 10,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: isSel ? `1px solid ${curSensor.text}` : "1px solid var(--border)",
                  background: isSel ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.3)",
                  color: isSel ? curSensor.text : "var(--text-muted)",
                  cursor: "pointer",
                  fontWeight: isSel ? "bold" : "normal",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: 8,
          flexWrap: "wrap",
        }}
      >
        {[
          { id: "satellites", label: "ORBITAL SATELLITES (CelesTrak)", count: satellites.length, icon: <RadarIcon size={12} /> },
          { id: "vessels", label: "MARITIME AIS VESSELS", count: vessels.length, icon: <GlobeIcon size={12} /> },
          { id: "cables", label: "SUBSEA FIBER CABLES", count: cables.length, icon: <LinkIcon size={12} /> },
          { id: "launches", label: "SPACE MISSIONS & LAUNCHES", count: launches.length, icon: <ActivityIcon size={12} /> },
          { id: "infra", label: "CRITICAL INFRASTRUCTURE", count: infra.length, icon: <DatabaseIcon size={12} /> },
        ].map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as GodsEyeTab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 4,
                border: active ? `1px solid ${curSensor.text}` : "1px solid transparent",
                background: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
                color: active ? curSensor.text : "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.icon}
              {t.label}
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 8,
                  background: active ? curSensor.text : "rgba(255,255,255,0.1)",
                  color: active ? "#000" : "#ccc",
                  fontWeight: "bold",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SATELLITES */}
      {activeTab === "satellites" && (
        <div>
          {/* Satellite Group Filter */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Constellation Group:</span>
              {[
                { id: "stations", label: "Stations (ISS / CSS)" },
                { id: "visual", label: "100 Brightest (Visual)" },
                { id: "gps-ops", label: "US GPS Nav" },
                { id: "glo-ops", label: "GLONASS Nav" },
                { id: "starlink", label: "Starlink Megaconstellation" },
                { id: "military", label: "Military / Recon" },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSatGroup(g.id)}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    border: satGroup === g.id ? `1px solid ${curSensor.text}` : "1px solid var(--border)",
                    background: satGroup === g.id ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.2)",
                    color: satGroup === g.id ? curSensor.text : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => loadSatellites(satGroup)}
              disabled={loadingSats}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                background: "transparent",
                border: `1px solid ${curSensor.border}`,
                color: curSensor.text,
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <RefreshCwIcon size={11} color={curSensor.text} />
              {loadingSats ? "RE-PROPAGATING..." : "REFRESH ORBIT"}
            </button>
          </div>

          {/* Satellites Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {satellites.map((s, idx) => {
              const itemKey = `sat-${s.norad_id || idx}`;
              const isPinned = pinnedId === itemKey;
              return (
                <div
                  key={itemKey}
                  style={{
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 4,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: curSensor.text }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          NORAD ID: {s.norad_id} | {s.category}
                        </div>
                      </div>
                      <span style={{ fontSize: 9, padding: "2px 5px", background: "rgba(52, 211, 153, 0.2)", color: "#34d399", borderRadius: 3 }}>
                        {s.status}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, margin: "8px 0" }}>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Sub-Point: </span>
                        <code style={{ color: "#fff" }}>{s.latitude.toFixed(2)}, {s.longitude.toFixed(2)}</code>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Altitude: </span>
                        <span style={{ color: "#a5b4fc" }}>{s.altitude_km} km</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Velocity: </span>
                        <span style={{ color: "#34d399" }}>{s.velocity_kms} km/s</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Period: </span>
                        <span style={{ color: "#fbbf24" }}>{s.period_min} min</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                    <button
                      onClick={() =>
                        handlePinLocation(
                          `Satellite: ${s.name} (NORAD ${s.norad_id})`,
                          s.latitude,
                          s.longitude,
                          `Alt: ${s.altitude_km}km | Vel: ${s.velocity_kms}km/s | Period: ${s.period_min}m`,
                          itemKey
                        )
                      }
                      disabled={!activeCase}
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: 10,
                        background: isPinned ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.06)",
                        color: isPinned ? "#34d399" : curSensor.text,
                        border: `1px solid ${isPinned ? "#34d399" : curSensor.border}`,
                        borderRadius: 3,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                      title={activeCase ? "Pin current sub-satellite position to Leaflet Case Map" : "Select an active case"}
                    >
                      {isPinned ? <CheckIcon size={10} color="#34d399" /> : <PinIcon size={10} color={curSensor.text} />}
                      {isPinned ? "PINNED" : "PIN TO MAP"}
                    </button>

                    <SaveToCaseButton
                      key={`${activeCase?.id}-${s.norad_id}`}
                      identifierType="domain"
                      identifierValue={`norad:${s.norad_id}`}
                      platform="godseye.satellites"
                      discoveredBy="godseye"
                      metadata={{
                        name: s.name,
                        norad_id: s.norad_id,
                        altitude_km: s.altitude_km,
                        latitude: s.latitude,
                        longitude: s.longitude,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MARITIME AIS VESSELS */}
      {activeTab === "vessels" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {vessels.map((v) => {
            const itemKey = `vessel-${v.mmsi}`;
            const isPinned = pinnedId === itemKey;
            return (
              <div
                key={itemKey}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 4,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#34d399" }}>{v.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        MMSI: {v.mmsi} | Flag: {v.flag}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, padding: "2px 5px", background: "rgba(52, 211, 153, 0.15)", color: "#34d399", borderRadius: 3 }}>
                      {v.chokepoint}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: "#fff", marginBottom: 6 }}>
                    Type: <span style={{ color: "var(--cyan)" }}>{v.ship_type}</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, margin: "6px 0" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Position: </span>
                      <code style={{ color: "#fff" }}>{v.lat.toFixed(2)}, {v.lon.toFixed(2)}</code>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Speed: </span>
                      <span style={{ color: "#fbbf24" }}>{v.speed_kts} kts</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Destination: </span>
                      <span style={{ color: "#a5b4fc" }}>{v.destination}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Heading: </span>
                      <span style={{ color: "#fff" }}>{v.heading}°</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                  <button
                    onClick={() =>
                      handlePinLocation(
                        `Vessel: ${v.name} (${v.ship_type})`,
                        v.lat,
                        v.lon,
                        `MMSI: ${v.mmsi} | Chokepoint: ${v.chokepoint} | Speed: ${v.speed_kts}kts | Dest: ${v.destination}`,
                        itemKey
                      )
                    }
                    disabled={!activeCase}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      fontSize: 10,
                      background: isPinned ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.06)",
                      color: isPinned ? "#34d399" : curSensor.text,
                      border: `1px solid ${isPinned ? "#34d399" : curSensor.border}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    {isPinned ? <CheckIcon size={10} color="#34d399" /> : <PinIcon size={10} color={curSensor.text} />}
                    {isPinned ? "PINNED" : "PIN TO MAP"}
                  </button>

                  <SaveToCaseButton
                    key={`${activeCase?.id}-${v.mmsi}`}
                    identifierType="domain"
                    identifierValue={`mmsi:${v.mmsi}`}
                    platform="godseye.vessels"
                    discoveredBy="godseye"
                    metadata={{
                      name: v.name,
                      mmsi: v.mmsi,
                      flag: v.flag,
                      chokepoint: v.chokepoint,
                      speed: v.speed_kts,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: SUBMARINE CABLES */}
      {activeTab === "cables" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
          {cables.map((c) => {
            const firstPt = c.landing_points[0] || { lat: 0, lon: 0 };
            const itemKey = `cable-${c.id}`;
            const isPinned = pinnedId === itemKey;
            return (
              <div
                key={itemKey}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 4,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#a5b4fc" }}>{c.name}</div>
                    <span style={{ fontSize: 9, padding: "2px 5px", background: "rgba(165, 180, 252, 0.2)", color: "#a5b4fc", borderRadius: 3 }}>
                      {c.length_km.toLocaleString()} km
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>
                    Owners: {c.owners.join(", ")} | Capacity: {c.capacity_tbps} Tbps
                  </div>

                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Landing Stations:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                    {c.landing_points.map((p, pIdx) => (
                      <div key={pIdx} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "2px 6px", borderRadius: 2 }}>
                        <span style={{ color: "#fff" }}>{p.name} ({p.country})</span>
                        <code style={{ color: curSensor.text, fontSize: 10 }}>{p.lat.toFixed(2)}, {p.lon.toFixed(2)}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                  <button
                    onClick={() =>
                      handlePinLocation(
                        `Subsea Landing: ${c.name} (${firstPt.name})`,
                        firstPt.lat,
                        firstPt.lon,
                        `Subsea Cable: ${c.name} | Length: ${c.length_km}km | Capacity: ${c.capacity_tbps}Tbps`,
                        itemKey
                      )
                    }
                    disabled={!activeCase}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      fontSize: 10,
                      background: isPinned ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.06)",
                      color: isPinned ? "#34d399" : curSensor.text,
                      border: `1px solid ${isPinned ? "#34d399" : curSensor.border}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    {isPinned ? <CheckIcon size={10} color="#34d399" /> : <PinIcon size={10} color={curSensor.text} />}
                    {isPinned ? "PINNED" : "PIN LANDING POINT"}
                  </button>

                  <SaveToCaseButton
                    key={`${activeCase?.id}-${c.id}`}
                    identifierType="corporate"
                    identifierValue={c.name}
                    platform="godseye.cables"
                    discoveredBy="godseye"
                    metadata={{
                      name: c.name,
                      length_km: c.length_km,
                      capacity: c.capacity_tbps,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: SPACE LAUNCHES */}
      {activeTab === "launches" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 12 }}>
          {launches.map((m) => {
            const itemKey = `launch-${m.id}`;
            const isPinned = pinnedId === itemKey;
            return (
              <div
                key={itemKey}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 4,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "#fbbf24" }}>{m.mission_name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {m.provider} | Rocket: {m.rocket}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, padding: "2px 5px", background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", borderRadius: 3 }}>
                      {m.status}
                    </span>
                  </div>

                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0", lineHeight: 1.4 }}>
                    {m.description}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, margin: "6px 0" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Target Orbit: </span>
                      <span style={{ color: curSensor.text }}>{m.orbit}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>T-0 NET: </span>
                      <span style={{ color: "#34d399" }}>{m.net_time ? new Date(m.net_time).toUTCString().slice(0, 22) : "TBD"}</span>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ color: "var(--text-muted)" }}>Launchpad: </span>
                      <span style={{ color: "#fff" }}>{m.pad_name}, {m.location_name}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                  <button
                    onClick={() =>
                      handlePinLocation(
                        `Launchpad: ${m.pad_name} (${m.mission_name})`,
                        m.latitude,
                        m.longitude,
                        `Mission: ${m.mission_name} | Provider: ${m.provider} | Rocket: ${m.rocket} | Pad: ${m.pad_name}`,
                        itemKey
                      )
                    }
                    disabled={!activeCase}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      fontSize: 10,
                      background: isPinned ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.06)",
                      color: isPinned ? "#34d399" : curSensor.text,
                      border: `1px solid ${isPinned ? "#34d399" : curSensor.border}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    {isPinned ? <CheckIcon size={10} color="#34d399" /> : <PinIcon size={10} color={curSensor.text} />}
                    {isPinned ? "PINNED" : "PIN LAUNCHPAD"}
                  </button>

                  <SaveToCaseButton
                    key={`${activeCase?.id}-${m.id}`}
                    identifierType="domain"
                    identifierValue={`launch:${m.id}`}
                    platform="godseye.launches"
                    discoveredBy="godseye"
                    metadata={{
                      mission: m.mission_name,
                      rocket: m.rocket,
                      provider: m.provider,
                      location: m.location_name,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 5: CRITICAL INFRASTRUCTURE */}
      {activeTab === "infra" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 12 }}>
          {infra.map((inf, i) => {
            const itemKey = `infra-${i}`;
            const isPinned = pinnedId === itemKey;
            return (
              <div
                key={itemKey}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 4,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#f472b6" }}>{inf.name}</div>
                    <span style={{ fontSize: 9, padding: "2px 5px", background: "rgba(244, 114, 182, 0.15)", color: "#f472b6", borderRadius: 3 }}>
                      {inf.category}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    Region: <span style={{ color: "#fff" }}>{inf.region}</span>
                  </div>

                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0", lineHeight: 1.4 }}>
                    {inf.details}
                  </p>

                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: "var(--text-muted)" }}>Coordinates: </span>
                    <code style={{ color: curSensor.text }}>{inf.lat.toFixed(4)}, {inf.lon.toFixed(4)}</code>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                  <button
                    onClick={() =>
                      handlePinLocation(
                        `Strategic Infra: ${inf.name}`,
                        inf.lat,
                        inf.lon,
                        `Category: ${inf.category} | Region: ${inf.region} | Details: ${inf.details}`,
                        itemKey
                      )
                    }
                    disabled={!activeCase}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      fontSize: 10,
                      background: isPinned ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.06)",
                      color: isPinned ? "#34d399" : curSensor.text,
                      border: `1px solid ${isPinned ? "#34d399" : curSensor.border}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    {isPinned ? <CheckIcon size={10} color="#34d399" /> : <PinIcon size={10} color={curSensor.text} />}
                    {isPinned ? "PINNED" : "PIN FACILITY"}
                  </button>

                  <SaveToCaseButton
                    key={`${activeCase?.id}-${inf.name}`}
                    identifierType="corporate"
                    identifierValue={inf.name}
                    platform="godseye.infra"
                    discoveredBy="godseye"
                    metadata={{
                      category: inf.category,
                      region: inf.region,
                      lat: inf.lat,
                      lon: inf.lon,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
