"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  CameraIcon,
  GlobeIcon,
  PinIcon,
  ShieldIcon,
  CheckIcon,
  AlertIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  SearchIcon,
} from "@/components/FlatIcons";

export type WebcamCountry = {
  code: string;
  name: string;
  flag: string;
};

export type WebcamItem = {
  id: string;
  ip: string;
  port: number;
  stream_url: string;
  snapshot_url: string;
  title: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  zip_code: string;
  timezone: string;
  manufacturer: string;
  is_online: boolean;
  http_status: number;
};

export type WebcamSearchResponse = {
  country_code: string;
  country_name: string;
  page: number;
  total_found: number;
  webcams: WebcamItem[];
  error?: string | null;
};

export default function WebanatorTool({
  onPinToMap,
}: {
  onPinToMap?: (cam: WebcamItem) => void;
}) {
  const { activeCase } = useActiveCase();
  const [countries, setCountries] = useState<WebcamCountry[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("US");
  const [useTor, setUseTor] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WebcamSearchResponse | null>(null);
  const [pinSuccessId, setPinSuccessId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<WebcamCountry[]>("/recon/webanator/countries")
      .then((data) => setCountries(data))
      .catch(() => {});
  }, []);

  async function handleSearch(targetPage: number = 1) {
    setLoading(true);
    setError(null);
    setPage(targetPage);

    try {
      const data = await apiGet<WebcamSearchResponse>(
        `/recon/webanator/search?country_code=${encodeURIComponent(selectedCountry)}&page=${targetPage}&max_results=12&use_tor=${useTor}`
      );
      if (data.error && data.webcams.length === 0) {
        setError(data.error);
      }
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error executing Webanator surveillance camera scan");
    } finally {
      setLoading(false);
    }
  }

  async function handlePinCamera(cam: WebcamItem) {
    if (!activeCase || cam.latitude === null || cam.longitude === null) return;

    try {
      await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
        latitude: cam.latitude,
        longitude: cam.longitude,
        label: `CCTV Cam: ${cam.city || cam.country} (${cam.ip}:${cam.port})`,
        description: `Open Surveillance Webcam (${cam.manufacturer || "Live Stream"}). Stream: ${cam.stream_url}. Region: ${cam.region || cam.country}.`,
        source: "webanator_cctv",
        source_url: cam.stream_url,
      });

      setPinSuccessId(cam.id);
      setTimeout(() => setPinSuccessId(null), 3500);

      if (onPinToMap) {
        onPinToMap(cam);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error pinning camera to case map");
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 18,
      }}
    >
      {/* Top Banner Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 14,
          borderBottom: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: "rgba(5, 217, 232, 0.12)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CameraIcon size={20} color="var(--cyan)" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0, color: "var(--cyan)", fontSize: 16 }}>
                Webanator: Open Webcam &amp; CCTV Stream Reconnaissance
              </h3>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(0, 255, 159, 0.15)",
                  color: "#00ff9f",
                  border: "1px solid rgba(0, 255, 159, 0.3)",
                  fontFamily: "monospace",
                }}
              >
                K3ysTr0K3R/Webanator
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Extract open surveillance cameras, physical coordinates, and live MJPG feeds across 28+ countries.
            </p>
          </div>
        </div>

        {/* Tor Routing Toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 4,
            background: useTor ? "rgba(5, 217, 232, 0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${useTor ? "var(--cyan)" : "var(--border)"}`,
            color: useTor ? "var(--cyan)" : "var(--text-muted)",
          }}
        >
          <input
            type="checkbox"
            checked={useTor}
            onChange={(e) => setUseTor(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <ShieldIcon size={13} color={useTor ? "var(--cyan)" : "var(--text-muted)"} />
          Route via Tor Proxy
        </label>
      </div>

      {/* Control Bar: Country Select & Scan Button */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          style={{
            minWidth: 200,
            padding: "8px 12px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "#fff",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.code})
            </option>
          ))}
        </select>

        <button
          onClick={() => handleSearch(1)}
          disabled={loading}
          style={{
            fontWeight: "bold",
            padding: "8px 18px",
            background: "var(--cyan)",
            color: "#000",
            border: "none",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: loading ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          {loading ? <RefreshCwIcon size={14} /> : <SearchIcon size={14} color="#000" />}
          {loading ? "SEARCHING CAMERAS..." : "SCAN WEBCAMS"}
        </button>

        {results && results.webcams.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button
              onClick={() => handleSearch(Math.max(1, page - 1))}
              disabled={loading || page <= 1}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: "#fff",
                borderRadius: 4,
                cursor: page <= 1 ? "not-allowed" : "pointer",
              }}
            >
              &larr; Prev Page
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", padding: "0 4px" }}>
              Page {page}
            </span>
            <button
              onClick={() => handleSearch(page + 1)}
              disabled={loading}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: "#fff",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Next Page &rarr;
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "rgba(255, 0, 85, 0.12)",
            border: "1px solid #ff0055",
            color: "#ff7799",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertIcon size={14} color="#ff0055" />
          {error}
        </div>
      )}

      {/* Camera Grid Results */}
      {results && results.webcams.length > 0 && (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {results.webcams.map((cam) => {
            const hasCoords = cam.latitude !== null && cam.longitude !== null;
            const isPinned = pinSuccessId === cam.id;

            return (
              <div
                key={cam.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 6,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                }}
              >
                {/* Live Stream / MJPG Snapshot Preview */}
                <div
                  style={{
                    height: 170,
                    background: "#000",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottom: "1px solid var(--panel-border)",
                  }}
                >
                  <img
                    src={cam.snapshot_url}
                    alt={cam.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      // Fallback placeholder if snapshot stream doesn't allow cross-origin
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      background: "rgba(0,0,0,0.75)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      color: "#00ff9f",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: "monospace",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff9f", display: "inline-block" }} />
                    {cam.ip}:{cam.port}
                  </div>

                  {cam.manufacturer && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(5, 217, 232, 0.85)",
                        color: "#000",
                        fontWeight: "bold",
                        padding: "1px 6px",
                        borderRadius: 3,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      {cam.manufacturer}
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {cam.city ? `${cam.city}, ` : ""}{cam.region ? `${cam.region}, ` : ""}{cam.country}
                  </div>

                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <PinIcon size={12} color="var(--cyan)" />
                    {hasCoords ? (
                      <span style={{ fontFamily: "monospace", color: "var(--cyan)" }}>
                        {cam.latitude?.toFixed(4)}, {cam.longitude?.toFixed(4)}
                      </span>
                    ) : (
                      <span>Coordinates pending</span>
                    )}
                  </div>

                  {/* Actions: Pin to Map & Save to Case */}
                  <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handlePinCamera(cam)}
                      disabled={!hasCoords || isPinned}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        fontSize: 11,
                        fontWeight: "bold",
                        background: isPinned ? "rgba(0, 255, 159, 0.2)" : "rgba(5, 217, 232, 0.15)",
                        color: isPinned ? "#00ff9f" : "var(--cyan)",
                        border: `1px solid ${isPinned ? "#00ff9f" : "var(--cyan)"}`,
                        borderRadius: 4,
                        cursor: hasCoords && !isPinned ? "pointer" : "not-allowed",
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
                      identifierType="domain"
                      identifierValue={`${cam.ip}:${cam.port}`}
                      platform="webanator.cctv"
                      url={cam.stream_url}
                      discoveredBy="Webanator"
                      metadata={{
                        ip: cam.ip,
                        port: cam.port,
                        city: cam.city,
                        region: cam.region,
                        country: cam.country,
                        latitude: cam.latitude,
                        longitude: cam.longitude,
                        manufacturer: cam.manufacturer,
                      }}
                    />

                    <a
                      href={cam.stream_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "6px 8px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Open Direct Camera Stream"
                    >
                      <ExternalLinkIcon size={12} color="currentColor" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
