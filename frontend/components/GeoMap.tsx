"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useActiveCase } from "@/lib/activeCase";
import { apiGet, apiPostJson, apiFetch } from "@/lib/api";
import { CaseFileItem } from "./CaseFilesDatabank";
import { MapIcon, PinIcon, PaperclipIcon, LinkIcon } from "@/components/FlatIcons";

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

// Leaflet custom marker icon
const customPinIcon = typeof window !== "undefined" ? new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
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

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showTraceLine}
              onChange={(e) => setShowTraceLine(e.target.checked)}
            />
            Show Tracing Path
          </label>
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

      {/* Map or Empty State */}
      {points.length === 0 ? (
        <div
          style={{
            height: 420,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed var(--panel-border)",
            borderRadius: 8,
            color: "var(--text-muted)",
            gap: 12,
          }}
        >
          {loading ? (
            <span>Fetching case coordinates...</span>
          ) : (
            <>
              <PinIcon size={36} color="var(--text-muted)" />
              <span>No geolocated coordinates recorded for <strong>{activeCase.name}</strong>.</span>
              <span style={{ fontSize: 12, maxWidth: 500, textAlign: "center" }}>
                Extract GPS coordinates from images via <strong>TOOLS &gt; Image EXIF</strong>, or click <strong>+ Pin Geolocation</strong> to pinpoint where documents and links were found.
              </span>
            </>
          )}
        </div>
      ) : (
        <div style={{ height: 520, width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--cyan)", position: "relative" }}>
          <MapContainer
            center={defaultCenter}
            zoom={points.length === 1 ? 14 : 11}
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

            {points.map((p, idx) => (
              <Marker
                key={p.id}
                position={[p.latitude, p.longitude]}
                icon={customPinIcon}
              >
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

                    {/* Attached Web Evidence Link */}
                    {p.source_url && (
                      <div style={{ marginBottom: 6 }}>
                        <strong>Origin URL:</strong>{" "}
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#0066cc", wordBreak: "break-all" }}
                        >
                          Visit Link ↗
                        </a>
                      </div>
                    )}

                    {/* Attached Case Databank File */}
                    {p.attached_file && (
                      <div
                        style={{
                          background: "#f0f4f8",
                          padding: "6px 8px",
                          borderRadius: 4,
                          marginBottom: 8,
                          border: "1px solid #d0d7de",
                        }}
                      >
                        <div style={{ fontWeight: "bold", color: "#0969da", display: "flex", alignItems: "center", gap: 4 }}>
                          <PaperclipIcon size={12} color="#0969da" /> Pinned Document:
                        </div>
                        <div style={{ fontSize: 11 }}>{p.attached_file.original_filename}</div>
                        <a
                          href={getDownloadUrl(p.attached_file.id)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-block",
                            marginTop: 4,
                            color: "#fff",
                            background: "#0969da",
                            padding: "2px 8px",
                            borderRadius: 3,
                            textDecoration: "none",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        >
                          Download Attached File
                        </a>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "#888" }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDeletePoint(p.id)}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          background: "#ff4d4f",
                          color: "#fff",
                          border: "none",
                          borderRadius: 3,
                          cursor: "pointer",
                        }}
                      >
                        Delete Pin
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
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
    </div>
  );
}

