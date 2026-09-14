"use client";

import React, { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import {
  VideoIcon,
  GlobeIcon,
  SearchIcon,
  MapIcon,
  CheckIcon,
  AlertIcon,
  CrossIcon,
  LinkIcon,
  RadarIcon,
} from "@/components/FlatIcons";
import SaveToCaseButton from "./SaveToCaseButton";

export type CctvCameraItem = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  feed_url: string;
  video_url?: string | null;
  source: string;
  type: string;
};

type GlobalCctvSuiteProps = {
  onFocusCoordinates?: (lat: number, lon: number, zoom?: number) => void;
  onPinToMap?: (cam: CctvCameraItem) => void;
};

export default function GlobalCctvSuite({ onFocusCoordinates, onPinToMap }: GlobalCctvSuiteProps) {
  const [cameras, setCameras] = useState<CctvCameraItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCam, setSelectedCam] = useState<CctvCameraItem | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<CctvCameraItem | null>(null);
  const [totalHarvested, setTotalHarvested] = useState(0);

  // International open portal directories
  const openPortals = [
    { country: "Global / Multi-National", name: "Insecam Open Surveillance", url: "https://www.insecam.org/", desc: "Directory of online live public and open security cameras by country" },
    { country: "Global / Tourism & Cities", name: "EarthCam Live Network", url: "https://www.earthcam.com/network/map.php", desc: "Live high-definition network of worldwide landmark and urban webcams" },
    { country: "Global / Weather & Ports", name: "Windy Live Webcams", url: "https://www.windy.com/-Webcams/webcams", desc: "Global geospatial map of over 50,000 public coastal and weather cameras" },
    { country: "Global / OpenStreetCam", name: "KartaView / OpenStreetCam", url: "https://kartaview.org/map", desc: "Open-source street-level imagery and camera captures worldwide" },
    { country: "Europe / Urban Watch", name: "Surveillance Under Surveillance", url: "https://sunders.uber.space/", desc: "Crowdsourced map of surveillance cameras, CCTV domes, and ANPR readers" },
    { country: "Australia / Transport", name: "QLD Traffic & Street Cameras", url: "https://qldtraffic.qld.gov.au/cameras.html", desc: "Queensland highway, junction, and tunnel real-time CCTV snapshots" },
  ];

  async function loadCameras(region: string = "all") {
    setLoading(true);
    try {
      const res = await apiGet<any>(`/recon/osiris/cctv?region=${encodeURIComponent(region)}&limit=300`);
      const list = res?.cameras || [];
      setCameras(list);
      setTotalHarvested(res?.total || list.length);
    } catch (err) {
      console.warn("Failed to load CCTV directory:", err);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCameras(selectedRegion);
  }, [selectedRegion]);

  const filteredCameras = cameras.filter((cam) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cam.name && cam.name.toLowerCase().includes(q)) ||
      (cam.city && cam.city.toLowerCase().includes(q)) ||
      (cam.country && cam.country.toLowerCase().includes(q)) ||
      (cam.source && cam.source.toLowerCase().includes(q)) ||
      (cam.type && cam.type.toLowerCase().includes(q))
    );
  });

  const countryStats = cameras.reduce((acc: Record<string, number>, c) => {
    acc[c.country] = (acc[c.country] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "var(--panel-bg, #080c14)",
        border: "1px solid var(--panel-border, rgba(0, 229, 255, 0.2))",
        borderRadius: 8,
        padding: 16,
        color: "#e2e8f0",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {/* Suite Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--panel-border, rgba(0, 229, 255, 0.15))",
          paddingBottom: 12,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              background: "rgba(0, 229, 255, 0.15)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--cyan)",
            }}
          >
            <VideoIcon size={18} color="var(--cyan)" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff", letterSpacing: 1 }}>
              WORLDWIDE CCTV SURVEILLANCE &amp; TRAFFIC HARVESTER
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Unified Surveillance Suite — Consolidating Osiris, Shadowbroker, and God&apos;s Eye C4ISR Feeds
            </div>
          </div>
        </div>

        {/* Live Metrics */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              padding: "4px 10px",
              background: "rgba(0, 229, 255, 0.1)",
              border: "1px solid var(--cyan)",
              borderRadius: 4,
              fontSize: 11,
              color: "var(--cyan)",
              fontWeight: "bold",
            }}
          >
            HARVESTED: {totalHarvested} FEEDS
          </div>
          {Object.entries(countryStats).map(([cnt, count]) => (
            <div
              key={cnt}
              style={{
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: 4,
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              {cnt}: <strong style={{ color: "#fff" }}>{count}</strong>
            </div>
          ))}
          <button
            onClick={() => loadCameras(selectedRegion)}
            disabled={loading}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: "rgba(0, 229, 255, 0.15)",
              color: "var(--cyan)",
              border: "1px solid var(--cyan)",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          >
            {loading ? "Harvesting..." : "↻ Refresh Feeds"}
          </button>
        </div>
      </div>

      {/* Control Bar: Regions & Search */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Region filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "Global (All Feeds)" },
            { id: "uk", label: "London (TfL JamCams)" },
            { id: "us", label: "New York (NYC DOT)" },
            { id: "nordic", label: "Nordics (Finland)" },
            { id: "hk", label: "Hong Kong (Transport)" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRegion(r.id)}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                borderRadius: 4,
                cursor: "pointer",
                background: selectedRegion === r.id ? "var(--cyan)" : "rgba(255, 255, 255, 0.05)",
                color: selectedRegion === r.id ? "#000" : "var(--text-muted)",
                border: `1px solid ${selectedRegion === r.id ? "var(--cyan)" : "rgba(255, 255, 255, 0.1)"}`,
                fontWeight: selectedRegion === r.id ? "bold" : "normal",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Real-time search */}
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by city, highway, bridge, borough (e.g. Manhattan, Piccadilly, Inkoo)..."
            style={{
              width: "100%",
              padding: "7px 12px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid var(--panel-border, rgba(0, 229, 255, 0.2))",
              borderRadius: 4,
              color: "#fff",
              fontFamily: "monospace",
              fontSize: 11,
            }}
          />
        </div>
      </div>

      {/* Cameras Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--cyan)" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "3px solid rgba(0, 229, 255, 0.2)",
              borderTopColor: "var(--cyan)",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px auto",
            }}
          />
          Streaming multi-source surveillance snapshots across global municipal feeds...
        </div>
      ) : filteredCameras.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          No cameras match query &ldquo;{searchQuery}&rdquo;. Try another city, street name, or select All Feeds.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
            maxHeight: 560,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {filteredCameras.map((cam) => (
            <div
              key={cam.id}
              style={{
                background: "rgba(10, 14, 23, 0.9)",
                border: "1px solid rgba(0, 229, 255, 0.2)",
                borderRadius: 6,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "border-color 0.2s ease",
              }}
            >
              {/* Snapshot Feed */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 160,
                  background: "#05070c",
                  overflow: "hidden",
                }}
              >
                <img
                  src={cam.feed_url}
                  alt={cam.name}
                  loading="lazy"
                  onError={(e: any) => {
                    e.target.src = "https://placehold.co/400x240/090d16/00e5ff?text=SURVEILLANCE+FEED+STANDBY";
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />

                {/* Tactical Badges */}
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    padding: "2px 6px",
                    background: "rgba(0, 0, 0, 0.8)",
                    border: "1px solid var(--cyan)",
                    borderRadius: 3,
                    fontSize: 9,
                    color: "var(--cyan)",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#00E676" }} />
                  LIVE CCTV
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "2px 6px",
                    background: "rgba(0, 0, 0, 0.8)",
                    borderRadius: 3,
                    fontSize: 9,
                    color: "#cbd5e1",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                  }}
                >
                  {cam.country}
                </div>

                {cam.video_url && (
                  <button
                    onClick={() => setActiveVideoModal(cam)}
                    style={{
                      position: "absolute",
                      bottom: 6,
                      right: 6,
                      padding: "3px 8px",
                      background: "rgba(162, 89, 255, 0.85)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    ▶ Live MP4 Loop
                  </button>
                )}
              </div>

              {/* Camera Metadata */}
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4, flex: 1, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", lineHeight: 1.3, marginBottom: 2 }}>
                    {cam.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {cam.city} · {cam.type}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--cyan)", marginTop: 2 }}>
                    {cam.lat.toFixed(4)}, {cam.lon.toFixed(4)} ({cam.source})
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                  {onFocusCoordinates && cam.lat && cam.lon && (
                    <button
                      onClick={() => onFocusCoordinates(cam.lat, cam.lon, 14)}
                      title="Fly to coordinate on active 3D Cesium or 2D Leaflet map"
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        fontSize: 10,
                        background: "rgba(0, 229, 255, 0.1)",
                        color: "var(--cyan)",
                        border: "1px solid var(--cyan)",
                        borderRadius: 3,
                        cursor: "pointer",
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <MapIcon size={11} color="var(--cyan)" />
                      Locate Map
                    </button>
                  )}

                  <div style={{ flex: 1 }}>
                    <SaveToCaseButton
                      identifierType="domain"
                      identifierValue={cam.name}
                      platform="cctv_surveillance"
                      discoveredBy="global_cctv_harvester"
                      metadata={cam}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Open Portals & Camera Registers Directory */}
      <div
        style={{
          borderTop: "1px solid var(--panel-border, rgba(0, 229, 255, 0.15))",
          paddingTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
          <GlobeIcon size={14} color="var(--cyan)" />
          GLOBAL OSINT CCTV &amp; WEBCAM REGISTRIES (INTERNATIONAL SURVEILLANCE DIRECTORY)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 8,
          }}
        >
          {openPortals.map((p, idx) => (
            <div
              key={idx}
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 4,
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.desc}</div>
                <div style={{ fontSize: 9, color: "var(--cyan)", marginTop: 2 }}>{p.country}</div>
              </div>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  background: "rgba(0, 229, 255, 0.1)",
                  color: "var(--cyan)",
                  border: "1px solid var(--cyan)",
                  borderRadius: 3,
                  textDecoration: "none",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                Open ↗
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Video Loop Modal */}
      {activeVideoModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#080c14",
              border: "1px solid var(--cyan)",
              borderRadius: 8,
              padding: 16,
              maxWidth: 580,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--cyan)" }}>
                LIVE SURVEILLANCE LOOP: {activeVideoModal.name}
              </div>
              <button
                onClick={() => setActiveVideoModal(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <CrossIcon size={16} />
              </button>
            </div>

            {activeVideoModal.video_url ? (
              <video
                src={activeVideoModal.video_url}
                autoPlay
                loop
                muted
                controls
                style={{ width: "100%", maxHeight: 360, borderRadius: 4, background: "#000" }}
              />
            ) : (
              <img
                src={activeVideoModal.feed_url}
                alt={activeVideoModal.name}
                style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 4 }}
              />
            )}

            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {activeVideoModal.city}, {activeVideoModal.country} · {activeVideoModal.source} ({activeVideoModal.lat.toFixed(4)}, {activeVideoModal.lon.toFixed(4)})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
