"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useActiveCase } from "@/lib/activeCase";
import { apiGet, apiPostJson, apiFetch } from "@/lib/api";
import { CaseFileItem } from "./CaseFilesDatabank";
import ShadowbrokerSuite from "./ShadowbrokerSuite";
import GodsEyeSuite from "./GodsEyeSuite";
import {
  MapIcon,
  PinIcon,
  PaperclipIcon,
  LinkIcon,
  CameraIcon,
  CheckIcon,
  AlertIcon,
  RadarIcon,
  EyeIcon,
  GlobeIcon,
  CompassIcon,
  FileTextIcon,
  CrossIcon,
} from "@/components/FlatIcons";
import SaveToCaseButton from "./SaveToCaseButton";
import OsirisIntelSuite from "./OsirisIntelSuite";
import type { VisualShaderMode } from "./GodsEyeCesiumGlobe";

const GodsEyeCesiumGlobe = dynamic(() => import("./GodsEyeCesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 680, background: "#05070c", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cyan)" }}>
      Loading God's Eye 3D Engine...
    </div>
  ),
});

// Dynamically import react-leaflet components (Leaflet relies on window/DOM)
const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr: false });

export type CaseGeolocationItem = {
  id: string;
  case_id: string;
  latitude: number;
  longitude: number;
  label: string;
  description?: string;
  source: string;
  source_url?: string;
  attached_file_id?: string;
  attached_file?: {
    id: string;
    filename: string;
    original_filename: string;
    typology: string;
    size: number;
  };
  created_at: string;
};

import L from "leaflet";

// Leaflet custom marker icons
const customPinIcon = typeof window !== "undefined" ? new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
}) : (null as any);

const conflictIcon = typeof window !== "undefined" ? L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background: rgba(255, 60, 60, 0.9); border: 2px solid #ff1111; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; box-shadow: 0 0 10px #ff3333;">⚔️</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
}) : (null as any);

const earthquakeIcon = typeof window !== "undefined" ? L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background: rgba(255, 170, 0, 0.9); border: 2px solid #ffaa00; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: 0 0 8px #ffaa00;">🌋</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
}) : (null as any);

const cctvIcon = typeof window !== "undefined" ? L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background: rgba(0, 229, 255, 0.9); border: 2px solid #00e5ff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: 0 0 8px #00e5ff;">📹</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
}) : (null as any);

const newsIcon = typeof window !== "undefined" ? L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background: rgba(162, 89, 255, 0.9); border: 2px solid #a259ff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: 0 0 8px #a259ff;">📺</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
}) : (null as any);

const militaryFlightIcon = typeof window !== "undefined" ? L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background: rgba(0, 230, 118, 0.9); border: 2px solid #00E676; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; box-shadow: 0 0 8px #00E676;">✈️</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
}) : (null as any);

export default function GeoMap() {
  const { activeCase } = useActiveCase();
  const [points, setPoints] = useState<CaseGeolocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [caseFiles, setCaseFiles] = useState<CaseFileItem[]>([]);

  // Pin form inputs
  const [showAddModal, setShowAddModal] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTraceLine, setShowTraceLine] = useState(true);

  // Tactical Map Mode: "2D" (Leaflet) or "3D" (God's Eye Cesium)
  const [mapMode, setMapMode] = useState<"2D" | "3D">("3D");
  const [activeShader, setActiveShader] = useState<VisualShaderMode>("DEFAULT");

  // Country Strategic Dossier State (Shadowbroker C4ISR)
  const [dossierCountry, setDossierCountry] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);

  async function handleFetchCountryDossier(query: string) {
    setDossierLoading(true);
    setShowDossierModal(true);
    try {
      let url = "/recon/shadowbroker/country-dossier";
      if (query.startsWith("coords:")) {
        const [lat, lon] = query.replace("coords:", "").split(",");
        url += `?lat=${lat}&lon=${lon}`;
      } else {
        url += `?country=${encodeURIComponent(query)}`;
      }
      const data = await apiGet<any>(url);
      setDossierCountry(data);
    } catch (err) {
      console.error("Error fetching country dossier:", err);
    } finally {
      setDossierLoading(false);
    }
  }

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showShadowbrokerModal, setShowShadowbrokerModal] = useState(false);
  const [showGodsEyeModal, setShowGodsEyeModal] = useState(false);
  const [showOsirisModal, setShowOsirisModal] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Osiris Intelligence Multi-layer States
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [cctvs, setCctvs] = useState<any[]>([]);
  const [newsPoints, setNewsPoints] = useState<any[]>([]);
  const [militaryFlights, setMilitaryFlights] = useState<any[]>([]);

  // 2D Tactical Layer Visibility Toggles
  const [layerWars, setLayerWars] = useState(true);
  const [layerQuakes, setLayerQuakes] = useState(true);
  const [layerCctv, setLayerCctv] = useState(true);
  const [layerNews, setLayerNews] = useState(true);
  const [layerFlights, setLayerFlights] = useState(true);

  // Video News Player Modal in 2D map
  const [activeNewsStream, setActiveNewsStream] = useState<any | null>(null);
  const [pic2mapResult, setPic2mapResult] = useState<{
    has_gps: boolean;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    timestamp?: string;
    camera_make?: string;
    camera_model?: string;
    location_label?: string;
    google_maps_url?: string;
    error?: string;
  } | null>(null);
  const [netryxResult, setNetryxResult] = useState<{
    has_prediction: boolean;
    primary_location?: string;
    latitude?: number;
    longitude?: number;
    confidence_score: number;
    method: string;
    error?: string;
  } | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setPic2mapResult(null);
    setNetryxResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const [picRes, netryxRes] = await Promise.all([
        apiFetch("/recon/geo/pic2map", { method: "POST", body: formData }).then(r => r.json()).catch(() => null),
        apiFetch("/recon/geo/netryx-astra", { method: "POST", body: formData }).then(r => r.json()).catch(() => null),
      ]);
      setPic2mapResult(picRes);
      setNetryxResult(netryxRes);

      if (picRes?.has_gps && picRes?.latitude && picRes?.longitude) {
        setLatInput(String(picRes.latitude));
        setLngInput(String(picRes.longitude));
        setLabelInput(picRes.location_label || `Photo GPS: ${file.name}`);
        setDescInput(`Extracted via pic2map EXIF. Camera: ${picRes.camera_make || ""} ${picRes.camera_model || ""}. Taken: ${picRes.timestamp || "N/A"}`);
      }
    } catch {
      alert("Error analyzing image geolocation.");
    } finally {
      setPhotoLoading(false);
    }
  }

  // Load points & files whenever activeCase changes
  async function loadCaseGeolocations(caseId: string) {
    setLoading(true);
    try {
      const [geos, files] = await Promise.all([
        apiGet<CaseGeolocationItem[]>(`/cases/${caseId}/geolocations`),
        apiGet<CaseFileItem[]>(`/cases/${caseId}/files`).catch(() => []),
      ]);
      setPoints(geos || []);
      setCaseFiles(files || []);
    } catch (e) {
      console.error("Error fetching geolocations:", e);
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }

  // When activeCase changes or is switched, clear the map immediately and reload
  useEffect(() => {
    // Reset/clean up state immediately for the new case
    setPoints([]);
    setShowAddModal(false);

    if (activeCase?.id) {
      loadCaseGeolocations(activeCase.id);
    }
  }, [activeCase?.id]);

  // Load Osiris & Shadowbroker intelligence layers
  useEffect(() => {
    async function loadOsirisData() {
      try {
        const [czRes, eqRes, cctvRes, newsRes, flRes] = await Promise.allSettled([
          apiGet<any>("/recon/osiris/conflicts"),
          apiGet<any>("/recon/osiris/earthquakes?min_magnitude=3.0"),
          apiGet<any>("/recon/osiris/cctv?limit=60"),
          apiGet<any>("/recon/osiris/live-news"),
          apiGet<any>("/recon/shadowbroker/military-flights?limit=50"),
        ]);
        if (czRes.status === "fulfilled") setConflicts(czRes.value?.zones || []);
        if (eqRes.status === "fulfilled") setEarthquakes(eqRes.value?.earthquakes || []);
        if (cctvRes.status === "fulfilled") setCctvs(cctvRes.value?.cameras || []);
        if (newsRes.status === "fulfilled") setNewsPoints(newsRes.value?.feeds || []);
        if (flRes.status === "fulfilled") setMilitaryFlights(Array.isArray(flRes.value) ? flRes.value : []);
      } catch (err) {
        console.warn("Error loading Osiris layers:", err);
      }
    }
    loadOsirisData();
  }, []);

  async function handleAddPin(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCase) return;
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || !labelInput.trim()) {
      alert("Please provide valid coordinates and a label.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
        latitude: lat,
        longitude: lng,
        label: labelInput.trim(),
        description: descInput.trim() || null,
        source_url: sourceUrlInput.trim() || null,
        attached_file_id: selectedFileId || null,
        source: "manual_pin",
      });

      // Clear inputs
      setLatInput("");
      setLngInput("");
      setLabelInput("");
      setDescInput("");
      setSourceUrlInput("");
      setSelectedFileId("");
      setShowAddModal(false);

      await loadCaseGeolocations(activeCase.id);
    } catch (err) {
      alert("Error adding pin: " + err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePoint(id: string) {
    if (!activeCase) return;
    if (!confirm("Delete this geolocation pinpoint?")) return;
    try {
      await apiFetch(`/cases/${activeCase.id}/geolocations/${id}`, { method: "DELETE" });
      setPoints(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert("Error deleting pinpoint: " + err);
    }
  }

  async function handleClearAllPoints() {
    if (!activeCase) return;
    if (!confirm(`Are you sure you want to clear all geolocation points and tracing for "${activeCase.name}"?`)) return;
    try {
      await apiFetch(`/cases/${activeCase.id}/geolocations`, { method: "DELETE" });
      setPoints([]);
    } catch (err) {
      alert("Error clearing geolocations: " + err);
    }
  }

  function getDownloadUrl(fileId: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8100";
    return `${apiBase}/cases/${activeCase?.id}/files/${fileId}/download`;
  }

  if (!activeCase) {
    return (
      <div style={{ color: "var(--warning)", marginTop: 32, padding: 20, background: "var(--panel)", borderRadius: 6 }}>
        Select an active case from the <strong>CASES</strong> tab to inspect, pin, and trace geolocated evidence.
      </div>
    );
  }

  // Leaflet requires window
  if (typeof window === "undefined") return null;

  const polylineCoords: [number, number][] = points.map(p => [p.latitude, p.longitude]);
  const defaultCenter: [number, number] = points.length > 0
    ? [points[0].latitude, points[0].longitude]
    : [-23.55052, -46.633308];

  return (
    <div style={{ marginTop: 24, background: "var(--panel)", padding: 24, border: "1px solid var(--panel-border)", borderRadius: 6 }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <h2 style={{ color: "var(--cyan)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <MapIcon size={20} color="var(--cyan)" /> GEOINTELLIGENCE &amp; TRACING MAP
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "6px 0 0 0", maxWidth: 750 }}>
            Geospatial tracking of evidence, photo EXIF coordinates, and physical locations linked to case <strong>"{activeCase.name}"</strong>.
            Attach files and source URLs to pinpoint where documents and records originated.
          </p>
        </div>

        {/* Mode Switcher & Sensor Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* 2D vs 3D Tactical Mode Toggle */}
          <div
            style={{
              display: "flex",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--panel-border)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setMapMode("2D")}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: "bold",
                background: mapMode === "2D" ? "var(--cyan)" : "transparent",
                color: mapMode === "2D" ? "#000" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MapIcon size={13} color={mapMode === "2D" ? "#000" : "var(--text-muted)"} />
              2D TACTICAL (Leaflet)
            </button>
            <button
              onClick={() => setMapMode("3D")}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: "bold",
                background: mapMode === "3D" ? "var(--cyan)" : "transparent",
                color: mapMode === "3D" ? "#000" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <GlobeIcon size={13} color={mapMode === "3D" ? "#000" : "var(--text-muted)"} />
              3D ORBITAL (God's Eye)
            </button>
          </div>

          {/* GLSL Sensor Shader Selector (Available in 3D mode) */}
          {mapMode === "3D" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(0, 229, 255, 0.2)" }}>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--cyan)", fontWeight: "bold", marginRight: 2 }}>
                SENSOR:
              </span>
              {(["DEFAULT", "FLIR", "NVG", "CRT", "NOIR"] as VisualShaderMode[]).map((sh) => (
                <button
                  key={sh}
                  onClick={() => setActiveShader(sh)}
                  style={{
                    padding: "3px 7px",
                    fontSize: 10,
                    fontFamily: "monospace",
                    borderRadius: 3,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: activeShader === sh ? "bold" : "normal",
                    background: activeShader === sh ? (sh === "NVG" ? "#39ff14" : sh === "FLIR" ? "#ff2a5f" : "var(--cyan)") : "transparent",
                    color: activeShader === sh ? "#000" : "var(--text-muted)",
                  }}
                >
                  {sh}
                </button>
              ))}
            </div>
          )}

          {mapMode === "2D" && (
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showTraceLine}
                onChange={(e) => setShowTraceLine(e.target.checked)}
              />
              Show Tracing Path
            </label>
          )}

          <button
            onClick={() => setShowAddModal(!showAddModal)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "var(--cyan)",
              color: "#000",
              fontWeight: "bold",
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
            }}
          >
            {showAddModal ? "Cancel" : "+ Pin Geolocation"}
          </button>
          <button
            onClick={() => {
              setShowPhotoModal(!showPhotoModal);
              if (showAddModal) setShowAddModal(false);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "rgba(5, 217, 232, 0.15)",
              color: "var(--cyan)",
              border: "1px solid var(--cyan)",
              fontWeight: "bold",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CameraIcon size={13} color="var(--cyan)" />
            {showPhotoModal ? "Close Photo GPS" : "Photo GPS (Pic2Map & Astra)"}
          </button>
          <button
            onClick={() => {
              setShowShadowbrokerModal(!showShadowbrokerModal);
              if (showAddModal) setShowAddModal(false);
              if (showPhotoModal) setShowPhotoModal(false);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "rgba(162, 89, 255, 0.15)",
              color: "#a259ff",
              border: "1px solid #a259ff",
              fontWeight: "bold",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RadarIcon size={13} color="#a259ff" />
            {showShadowbrokerModal ? "Close Threat (Shadowbroker)" : "Threat Intercept (Shadowbroker)"}
          </button>
          <button
            onClick={() => {
              setShowGodsEyeModal(!showGodsEyeModal);
              if (showAddModal) setShowAddModal(false);
              if (showPhotoModal) setShowPhotoModal(false);
              if (showShadowbrokerModal) setShowShadowbrokerModal(false);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "rgba(0, 229, 255, 0.15)",
              color: "#00e5ff",
              border: "1px solid #00e5ff",
              fontWeight: "bold",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <EyeIcon size={13} color="#00e5ff" />
            {showGodsEyeModal ? "Close Satellite (God's Eye)" : "Satellite Recon (God's Eye)"}
          </button>
          <button
            onClick={() => {
              setShowOsirisModal(!showOsirisModal);
              if (showAddModal) setShowAddModal(false);
              if (showPhotoModal) setShowPhotoModal(false);
              if (showShadowbrokerModal) setShowShadowbrokerModal(false);
              if (showGodsEyeModal) setShowGodsEyeModal(false);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "rgba(0, 230, 118, 0.15)",
              color: "#00E676",
              border: "1px solid #00E676",
              fontWeight: "bold",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <GlobeIcon size={13} color="#00E676" />
            {showOsirisModal ? "Close Global Intel (Osiris)" : "Global Intel & Feeds (Osiris)"}
          </button>
          {points.length > 0 && (
            <button
              onClick={handleClearAllPoints}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: "rgba(255, 42, 109, 0.15)",
                color: "var(--danger)",
                border: "1px solid var(--danger)",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Clear Map
            </button>
          )}
        </div>
      </div>

      {/* Photo Geolocation Drawer (Pic2Map & Netryx Astra) */}
      {showPhotoModal && (
        <div
          style={{
            background: "#080c14",
            border: "1px solid var(--cyan)",
            borderRadius: 6,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <CameraIcon size={16} color="var(--cyan)" />
              Photo Geolocation Forensics (Pic2Map EXIF &amp; Netryx Astra V2)
            </h4>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Extracts hardware GPS coordinates, altitude, timestamp, and visual landmark features
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--cyan)",
                color: "#000",
                fontWeight: "bold",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <CameraIcon size={14} color="#000" />
              {photoLoading ? "Analyzing Metadata..." : "Choose Image (JPEG/PNG/HEIC)"}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} disabled={photoLoading} />
            </label>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Select an image from an investigation to locate its capture coordinates.
            </span>
          </div>

          {pic2mapResult && (
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", borderRadius: 4, padding: 12, marginTop: 10 }}>
              {pic2mapResult.has_gps && pic2mapResult.latitude && pic2mapResult.longitude ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--success)", fontWeight: "bold", fontSize: 13 }}>
                      <CheckIcon size={14} color="var(--success)" />
                      EXIF Hardware GPS Coordinates Verified
                    </div>
                    <button
                      onClick={async () => {
                        if (!activeCase || !pic2mapResult.latitude || !pic2mapResult.longitude) return;
                        try {
                          await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
                            latitude: pic2mapResult.latitude,
                            longitude: pic2mapResult.longitude,
                            label: pic2mapResult.location_label || "Photo GPS Pin (Pic2Map)",
                            description: `Hardware EXIF GPS. Camera: ${pic2mapResult.camera_make || ""} ${pic2mapResult.camera_model || ""}. Date: ${pic2mapResult.timestamp || "N/A"}`,
                            source: "pic2map_exif",
                          });
                          await loadCaseGeolocations(activeCase.id);
                          setShowPhotoModal(false);
                        } catch (e) {
                          alert("Error saving geolocation: " + e);
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: "var(--cyan)",
                        color: "#000",
                        fontWeight: "bold",
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      + Save Geolocation to Case Map
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block" }}>COORDINATES:</span>
                      <strong style={{ color: "var(--cyan)" }}>{pic2mapResult.latitude}, {pic2mapResult.longitude}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block" }}>ESTIMATED ADDRESS:</span>
                      <span>{pic2mapResult.location_label || "Coordinates extracted"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block" }}>ALTITUDE / TIMESTAMP:</span>
                      <span>{pic2mapResult.altitude ? `${pic2mapResult.altitude}m` : "N/A"} | {pic2mapResult.timestamp || "N/A"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block" }}>CAMERA HARDWARE:</span>
                      <span>{pic2mapResult.camera_make} {pic2mapResult.camera_model || "Sensor"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warning)", marginBottom: 4 }}>
                    <AlertIcon size={13} color="var(--warning)" />
                    No embedded GPS coordinates found in image EXIF tags.
                  </div>
                  {pic2mapResult.camera_make && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Camera detected: {pic2mapResult.camera_make} {pic2mapResult.camera_model} ({pic2mapResult.timestamp || "No timestamp"})
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {netryxResult && (
            <div style={{ background: "rgba(5, 217, 232, 0.04)", border: "1px solid rgba(5, 217, 232, 0.2)", borderRadius: 4, padding: 10, marginTop: 8, fontSize: 11 }}>
              <strong style={{ color: "var(--cyan)" }}>Netryx Astra V2 Pipeline:</strong>{" "}
              {netryxResult.has_prediction ? (
                <span>Matched visual streetview panorama: {netryxResult.primary_location} (Confidence: {Math.round(netryxResult.confidence_score * 100)}%)</span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>{netryxResult.error || "Streetview panorama matching ready."}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shadowbroker Threat Telemetry Drawer */}
      {showShadowbrokerModal && (
        <div style={{ marginBottom: 20 }}>
          <ShadowbrokerSuite
            onPinToMap={() => {
              if (activeCase?.id) {
                loadCaseGeolocations(activeCase.id);
              }
            }}
          />
        </div>
      )}

      {/* God's Eye View Satellite & Multi-Sensor Intelligence Drawer */}
      {showGodsEyeModal && (
        <div style={{ marginBottom: 20 }}>
          <GodsEyeSuite />
        </div>
      )}

      {/* Osiris Global Situational Intelligence & Feeds Drawer */}
      {showOsirisModal && (
        <div style={{ marginBottom: 20 }}>
          <OsirisIntelSuite />
        </div>
      )}

      {/* Pin Geolocation Form / Modal Drawer */}
      {showAddModal && (
        <form
          onSubmit={handleAddPin}
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--cyan)",
            borderRadius: 6,
            padding: 16,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label style={{ fontSize: 11, color: "var(--cyan)", display: "block", marginBottom: 4 }}>
              Latitude: *
            </label>
            <input
              required
              type="number"
              step="any"
              placeholder="-23.55052"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              style={{ width: "100%", padding: 6, fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--cyan)", display: "block", marginBottom: 4 }}>
              Longitude: *
            </label>
            <input
              required
              type="number"
              step="any"
              placeholder="-46.63330"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              style={{ width: "100%", padding: 6, fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--cyan)", display: "block", marginBottom: 4 }}>
              Location Label / Target: *
            </label>
            <input
              required
              placeholder="e.g. Suspect Office, Safehouse, Photo Location"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              style={{ width: "100%", padding: 6, fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Origin / Evidence URL (optional):
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={sourceUrlInput}
              onChange={(e) => setSourceUrlInput(e.target.value)}
              style={{ width: "100%", padding: 6, fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Attach Stored Case File (optional):
            </label>
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              style={{ width: "100%", padding: 6, fontSize: 12, background: "var(--bg)", color: "var(--text)" }}
            >
              <option value="">-- None (No attached file) --</option>
              {caseFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.typology.toUpperCase()}] {f.original_filename}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Notes / Description:
            </label>
            <input
              placeholder="Context or notes on where file was found..."
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              style={{ width: "100%", padding: 6, fontSize: 12 }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "6px 18px",
                fontSize: 12,
                background: "var(--cyan)",
                color: "#000",
                fontWeight: "bold",
                border: "none",
                borderRadius: 4,
              }}
            >
              {submitting ? "Saving Pin..." : "Save Pin to Map"}
            </button>
          </div>
        </form>
      )}

      {/* Tactical Display: 3D God's Eye Cesium Globe OR 2D Leaflet Map */}
      {mapMode === "3D" ? (
        <div style={{ marginBottom: 20 }}>
          <GodsEyeCesiumGlobe
            activeShader={activeShader}
            onSelectCountry={(countryCode) => handleFetchCountryDossier(countryCode)}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {/* 2D Multi-layer Switcher Bar */}
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 10,
              padding: "8px 12px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--panel-border)",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            <span style={{ color: "var(--cyan)", fontWeight: "bold", marginRight: 4 }}>LAYERS:</span>

            <button
              onClick={() => setLayerWars(!layerWars)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                fontSize: 10,
                background: layerWars ? "rgba(255, 85, 85, 0.25)" : "transparent",
                color: layerWars ? "#ff5555" : "var(--text-muted)",
                border: `1px solid ${layerWars ? "#ff5555" : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
              }}
            >
              ⚔️ Wars ({conflicts.length})
            </button>

            <button
              onClick={() => setLayerQuakes(!layerQuakes)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                fontSize: 10,
                background: layerQuakes ? "rgba(255, 170, 0, 0.25)" : "transparent",
                color: layerQuakes ? "#ffaa00" : "var(--text-muted)",
                border: `1px solid ${layerQuakes ? "#ffaa00" : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
              }}
            >
              🌋 Quakes ({earthquakes.length})
            </button>

            <button
              onClick={() => setLayerCctv(!layerCctv)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                fontSize: 10,
                background: layerCctv ? "rgba(0, 229, 255, 0.25)" : "transparent",
                color: layerCctv ? "var(--cyan)" : "var(--text-muted)",
                border: `1px solid ${layerCctv ? "var(--cyan)" : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
              }}
            >
              📹 CCTVs ({cctvs.length})
            </button>

            <button
              onClick={() => setLayerNews(!layerNews)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                fontSize: 10,
                background: layerNews ? "rgba(162, 89, 255, 0.25)" : "transparent",
                color: layerNews ? "#c084fc" : "var(--text-muted)",
                border: `1px solid ${layerNews ? "#a259ff" : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
              }}
            >
              📺 News ({newsPoints.length})
            </button>

            <button
              onClick={() => setLayerFlights(!layerFlights)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                fontSize: 10,
                background: layerFlights ? "rgba(0, 230, 118, 0.25)" : "transparent",
                color: layerFlights ? "#00E676" : "var(--text-muted)",
                border: `1px solid ${layerFlights ? "#00E676" : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
              }}
            >
              ✈️ Flights ({militaryFlights.length})
            </button>

            <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", cursor: "pointer", marginLeft: "auto" }}>
              <input
                type="checkbox"
                checked={showTraceLine}
                onChange={(e) => setShowTraceLine(e.target.checked)}
              />
              Case Trace Line
            </label>
          </div>

          <div style={{ height: 560, width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--cyan)", position: "relative" }}>
            <MapContainer
              center={points.length > 0 ? [points[0].latitude, points[0].longitude] : [20.0, 0.0]}
              zoom={points.length === 1 ? 14 : points.length > 1 ? 10 : 2}
              style={{ height: "100%", width: "100%", backgroundColor: "#0a0c12" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
              />

              {/* Tracing path between recorded evidence coordinates */}
              {showTraceLine && polylineCoords.length > 1 && (
                <Polyline
                  positions={polylineCoords}
                  pathOptions={{ color: "var(--cyan)", weight: 3, dashArray: "6, 8", opacity: 0.85 }}
                />
              )}

              {/* 1. Case Evidence Pins */}
              {points.map((p, idx) => (
                <Marker key={p.id} position={[p.latitude, p.longitude]} icon={customPinIcon}>
                  <Popup>
                    <div style={{ minWidth: 200, fontSize: 12, color: "#222" }}>
                      <div style={{ fontWeight: "bold", fontSize: 14, color: "#000", borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 6 }}>
                        #{idx + 1} {p.label}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Coords:</strong> {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                      </div>
                      {p.description && (
                        <div style={{ marginBottom: 4 }}>
                          <strong>Details:</strong> {p.description}
                        </div>
                      )}
                      {p.source && (
                        <div style={{ marginBottom: 4, color: "#555" }}>
                          <strong>Source:</strong> {p.source}
                        </div>
                      )}
                      {p.source_url && (
                        <div style={{ marginBottom: 6 }}>
                          <a href={p.source_url} target="_blank" rel="noreferrer" style={{ color: "#0066cc", wordBreak: "break-all" }}>
                            Visit Link ↗
                          </a>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: "#888" }}>{new Date(p.created_at).toLocaleDateString()}</span>
                        <button onClick={() => handleDeletePoint(p.id)} style={{ fontSize: 10, padding: "2px 6px", background: "#ff4d4f", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
                          Delete Pin
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* 2. Osiris Conflict Zones */}
              {layerWars &&
                conflicts.map((cz) => (
                  <Marker key={`cz-${cz.id}`} position={[cz.lat, cz.lon]} icon={conflictIcon}>
                    <Popup>
                      <div style={{ minWidth: 240, fontSize: 12, color: "#1e293b" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#dc2626", borderBottom: "1px solid #fecaca", paddingBottom: 4, marginBottom: 6 }}>
                          ⚔️ {cz.label}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: "bold", color: "#b91c1c", marginBottom: 4 }}>
                          {cz.threat_level || cz.severity?.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 6, lineHeight: 1.4 }}>{cz.description}</div>
                        {cz.belligerents && (
                          <div style={{ fontSize: 10, color: "#7c3aed", marginBottom: 6 }}>
                            <strong>Combatants:</strong> {cz.belligerents.join(" vs ")}
                          </div>
                        )}
                        <SaveToCaseButton
                          identifierType="domain"
                          identifierValue={cz.label}
                          platform="osiris_conflict_zone"
                          discoveredBy="osiris_c4isr"
                          metadata={cz}
                        />
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* 3. Osiris Earthquakes */}
              {layerQuakes &&
                earthquakes.map((eq) => (
                  <Marker key={`eq-${eq.id}`} position={[eq.lat, eq.lon]} icon={earthquakeIcon}>
                    <Popup>
                      <div style={{ minWidth: 200, fontSize: 12, color: "#1e293b" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#d97706", borderBottom: "1px solid #fef3c7", paddingBottom: 4, marginBottom: 6 }}>
                          🌋 M{eq.magnitude} — {eq.place}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 4 }}>
                          <strong>Depth:</strong> {eq.depth_km} km | <strong>Tsunami:</strong> {eq.tsunami ? "YES" : "NO"}
                        </div>
                        <SaveToCaseButton
                          identifierType="domain"
                          identifierValue={eq.place}
                          platform="osiris_earthquake"
                          discoveredBy="osiris_seismic_feed"
                          metadata={eq}
                        />
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* 4. Osiris CCTV Cameras */}
              {layerCctv &&
                cctvs.map((cam) => (
                  <Marker key={`cctv-${cam.id}`} position={[cam.lat, cam.lon]} icon={cctvIcon}>
                    <Popup>
                      <div style={{ minWidth: 240, fontSize: 12, color: "#1e293b" }}>
                        <div style={{ fontWeight: "bold", fontSize: 12, color: "#0284c7", marginBottom: 4 }}>
                          📹 {cam.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                          {cam.city}, {cam.country} · {cam.source}
                        </div>
                        <div style={{ width: "100%", height: 130, borderRadius: 4, overflow: "hidden", background: "#000", marginBottom: 6 }}>
                          <img
                            src={cam.feed_url}
                            alt={cam.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e: any) => {
                              e.target.src = "https://placehold.co/300x160/0a0e17/00e5ff?text=FEED+STANDBY";
                            }}
                          />
                        </div>
                        <SaveToCaseButton
                          identifierType="domain"
                          identifierValue={cam.name}
                          platform="cctv_surveillance"
                          discoveredBy="osiris_cctv_recon"
                          metadata={cam}
                        />
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* 5. Osiris Live News */}
              {layerNews &&
                newsPoints.map((nw) => (
                  <Marker key={`news-${nw.id}`} position={[nw.lat, nw.lon]} icon={newsIcon}>
                    <Popup>
                      <div style={{ minWidth: 220, fontSize: 12, color: "#1e293b" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#7c3aed", marginBottom: 4 }}>
                          📺 {nw.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                          {nw.city}, {nw.country} · {nw.category}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                          <a
                            href={nw.stream_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              flex: 1,
                              padding: "4px 8px",
                              fontSize: 10,
                              background: "#7c3aed",
                              color: "#fff",
                              borderRadius: 3,
                              textAlign: "center",
                              textDecoration: "none",
                              fontWeight: "bold",
                            }}
                          >
                            Watch Live Stream ↗
                          </a>
                        </div>
                        <SaveToCaseButton
                          identifierType="domain"
                          identifierValue={nw.name}
                          platform="osiris_live_news"
                          discoveredBy="osiris_news_monitor"
                          metadata={nw}
                        />
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* 6. Shadowbroker Military Flights */}
              {layerFlights &&
                militaryFlights.map((fl, i) => (
                  <Marker key={`fl-${fl.hex || i}`} position={[fl.lat, fl.lon]} icon={militaryFlightIcon}>
                    <Popup>
                      <div style={{ minWidth: 200, fontSize: 12, color: "#1e293b" }}>
                        <div style={{ fontWeight: "bold", fontSize: 13, color: "#16a34a", marginBottom: 4 }}>
                          ✈️ {fl.flight?.trim() || fl.hex}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
                          Alt: {fl.alt_baro?.toLocaleString() || "N/A"} ft | Speed: {fl.speed || "N/A"} kts
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                          Country: {fl.country || "Military"} | Track: {fl.track}°
                        </div>
                        <SaveToCaseButton
                          identifierType="corporate"
                          identifierValue={fl.flight?.trim() || fl.hex}
                          platform="military_flight_radar"
                          discoveredBy="shadowbroker_radar"
                          metadata={fl}
                        />
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Geolocations Table Summary */}
      {points.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ color: "var(--cyan)", margin: "0 0 10px 0", fontSize: 13 }}>
            Case Tracing Log ({points.length} coordinates pinned)
          </h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--panel-border)", textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "8px 6px" }}>#</th>
                  <th style={{ padding: "8px 6px" }}>Label</th>
                  <th style={{ padding: "8px 6px" }}>Coordinates</th>
                  <th style={{ padding: "8px 6px" }}>Attached File / URL</th>
                  <th style={{ padding: "8px 6px" }}>Source</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {points.map((pt, i) => (
                  <tr key={pt.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "8px 6px", color: "var(--cyan)" }}>{i + 1}</td>
                    <td style={{ padding: "8px 6px", fontWeight: "bold" }}>{pt.label}</td>
                    <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>
                      {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {pt.attached_file ? (
                        <a
                          href={getDownloadUrl(pt.attached_file.id)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--cyan)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <PaperclipIcon size={12} color="var(--cyan)" /> {pt.attached_file.original_filename}
                        </a>
                      ) : pt.source_url ? (
                        <a
                          href={pt.source_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <LinkIcon size={12} color="var(--accent)" /> Source Link
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>{pt.source}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDeletePoint(pt.id)}
                        style={{ fontSize: 10, padding: "2px 6px", color: "var(--danger)" }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Country Strategic Intelligence Dossier Modal (Shadowbroker C4ISR) */}
      {showDossierModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: 580,
              maxWidth: "100%",
              background: "#0a0e17",
              border: "1px solid var(--cyan)",
              borderRadius: 8,
              padding: 24,
              color: "#e2e8f0",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.8)",
              fontFamily: "monospace",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--panel-border)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GlobeIcon size={18} color="var(--cyan)" />
                <h3 style={{ margin: 0, color: "var(--cyan)", fontSize: 15 }}>
                  SHADOWBROKER C4ISR STRATEGIC DOSSIER
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowDossierModal(false);
                  setDossierCountry(null);
                }}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <CrossIcon size={16} />
              </button>
            </div>

            {dossierLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--cyan)" }}>
                Interrogating C4ISR Geopolitical Database...
              </div>
            ) : dossierCountry ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, color: "#fff", fontSize: 20 }}>
                      {dossierCountry.country} ({dossierCountry.iso_code})
                    </h2>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Capital: <strong style={{ color: "#fff" }}>{dossierCountry.capital}</strong> | Population: {dossierCountry.population}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: "bold",
                      background: "rgba(255, 42, 109, 0.2)",
                      color: "var(--danger)",
                      border: "1px solid var(--danger)",
                    }}
                  >
                    {dossierCountry.defense_readiness}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12, marginBottom: 20 }}>
                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 4, borderLeft: "3px solid var(--cyan)" }}>
                    <div style={{ color: "var(--cyan)", fontWeight: "bold", marginBottom: 2 }}>HEAD OF STATE &amp; COMMAND:</div>
                    <div style={{ color: "#fff" }}>{dossierCountry.head_of_state}</div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 4, borderLeft: "3px solid #a259ff" }}>
                    <div style={{ color: "#a259ff", fontWeight: "bold", marginBottom: 2 }}>ALLIANCES &amp; SECURITY BLOCS:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {dossierCountry.alliances?.map((al: string, i: number) => (
                        <span key={i} style={{ padding: "2px 6px", background: "rgba(162, 89, 255, 0.2)", borderRadius: 3, fontSize: 11 }}>
                          {al}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 4, borderLeft: "3px solid #ffaa00" }}>
                    <div style={{ color: "#ffaa00", fontWeight: "bold", marginBottom: 2 }}>NUCLEAR POSTURE / TRIAD:</div>
                    <div>{dossierCountry.nuclear_triad}</div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 4, borderLeft: "3px solid var(--cyan)" }}>
                    <div style={{ color: "var(--cyan)", fontWeight: "bold", marginBottom: 2 }}>KEY MILITARY BASES &amp; STRATEGIC POSTURE:</div>
                    <div style={{ marginBottom: 4 }}>{dossierCountry.strategic_posture}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Airbases: {dossierCountry.primary_airbases?.join(", ")}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <SaveToCaseButton
                    identifierType="corporate"
                    identifierValue={dossierCountry.country}
                    platform="shadowbroker_c4isr"
                    discoveredBy="shadowbroker_country_dossier"
                    metadata={dossierCountry}
                  />
                  <button
                    onClick={() => {
                      setShowDossierModal(false);
                      setDossierCountry(null);
                    }}
                    style={{
                      padding: "6px 14px",
                      fontSize: 12,
                      background: "transparent",
                      border: "1px solid var(--panel-border)",
                      color: "var(--text-muted)",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
                No intelligence dossier available for this target.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

