"use client";

import React, { useState, useRef } from "react";
import { apiPostJson, apiFetch, API_URL } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  CameraIcon,
  EyeIcon,
  ShieldIcon,
  CheckIcon,
  CrossIcon,
  SearchIcon,
  TerminalIcon,
  RadarIcon,
  BoltIcon,
  LinkIcon,
} from "./FlatIcons";

interface ModuleResults {
  ela?: any;
  clones?: any;
  noise?: any;
  luminance?: any;
  ghost?: any;
  resampling?: any;
  steganography?: any;
  hashes?: any;
  exif?: any;
}

interface ForensicReport {
  status: string;
  verdict: string;
  verdict_color: string;
  risk_score: number;
  findings: string[];
  original_image?: string;
  filename?: string;
  file_size?: number;
  modules: ModuleResults;
}

export default function ForensicsSuite() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<
    "overview" | "ela" | "clones" | "noise" | "ghost" | "stego"
  >("overview");

  // Input states
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [report, setReport] = useState<ForensicReport | null>(null);

  // Dynamic interactive controls
  const [elaQuality, setElaQuality] = useState(90);
  const [elaScale, setElaScale] = useState(12);
  const [elaOpacity, setElaOpacity] = useState(0.5);
  const [updatingEla, setUpdatingEla] = useState(false);

  const [cloneThreshold, setCloneThreshold] = useState(0.95);
  const [cloneDistance, setCloneDistance] = useState(40);
  const [updatingClones, setUpdatingClones] = useState(false);

  // Forensic Magnifier Controls
  const [magnifierZoom, setMagnifierZoom] = useState(3.0);
  const [magnifierMode, setMagnifierMode] = useState<
    "normal" | "contrast" | "invert" | "red" | "green" | "blue"
  >("normal");
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [imgDisplayBounds, setImgDisplayBounds] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLImageElement | null>(null);

  // Built-in Forensic Demo Test Samples
  const loadDemoSample = async (sampleType: "cloned" | "spliced" | "natural") => {
    setLoading(true);
    setError(null);
    try {
      // Create synthetic demonstration canvas
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (sampleType === "cloned") {
        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 400, 300);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 300);

        // Pattern
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 20px monospace";
        ctx.fillText("AUTHENTIC PASSPORT STAMP", 30, 60);

        // Stamp pattern 1
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 4;
        ctx.strokeRect(50, 90, 80, 80);
        ctx.fillStyle = "#fb7185";
        ctx.fillText("VALID", 65, 135);

        // Intentionally duplicated stamp 2 (Copy-Move Cloning)
        ctx.drawImage(canvas, 50, 90, 80, 80, 240, 160, 80, 80);
      } else if (sampleType === "spliced") {
        // High compression background
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(40, 40, 320, 220);
        // Spliced patch with high sharp edges
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(140, 100, 120, 90);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("INJECTED ID", 150, 150);
      } else {
        // Natural gradient & soft shadows
        const rad = ctx.createRadialGradient(200, 150, 20, 200, 150, 180);
        rad.addColorStop(0, "#cbd5e1");
        rad.addColorStop(1, "#475569");
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(200, 150, 60, 0, Math.PI * 2);
        ctx.fill();
      }

      const base64Data = canvas.toDataURL("image/jpeg", 0.9);
      const res = await apiPostJson<ForensicReport>("/recon/image-forensics/analyze", {
        image_base64: base64Data,
        use_tor: false,
      });
      setReport(res);
      setImageUrl("");
      setSelectedFile(null);
    } catch (err: any) {
      setError(err?.message || "Failed to run demo forensic analysis.");
    } finally {
      setLoading(false);
    }
  };

  // Run full forensic analysis via file upload or URL
  const handleAnalyze = async () => {
    if (!selectedFile && !imageUrl) {
      setError("Please select an image file or provide a valid image URL.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const headers = new Headers();
        headers.set("X-API-Key", "change-me-net-scraper-insecure-default");

        const resp = await fetch(`${API_URL}/recon/image-forensics/upload`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!resp.ok) {
          throw new Error(`Analysis failed (${resp.status}): ${await resp.text()}`);
        }
        const data = await resp.json();
        setReport(data);
      } else {
        const data = await apiPostJson<ForensicReport>("/recon/image-forensics/analyze", {
          image_url: imageUrl,
          use_tor: useTor,
        });
        setReport(data);
      }
    } catch (err: any) {
      setError(err?.message || "Forensic analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  // Re-run dynamic ELA with custom quality/scale
  const handleUpdateEla = async () => {
    if (!report?.original_image) return;
    setUpdatingEla(true);
    try {
      const data = await apiPostJson<any>("/recon/image-forensics/ela", {
        image_base64: report.original_image,
        quality: elaQuality,
        error_scale: elaScale,
        overlay_opacity: elaOpacity,
      });
      if (data.status === "success") {
        setReport((prev) =>
          prev
            ? {
                ...prev,
                modules: {
                  ...prev.modules,
                  ela: data,
                },
              }
            : null
        );
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setUpdatingEla(false);
    }
  };

  // Re-run dynamic Clone Detection with custom threshold
  const handleUpdateClones = async () => {
    if (!report?.original_image) return;
    setUpdatingClones(true);
    try {
      const data = await apiPostJson<any>("/recon/image-forensics/clones", {
        image_base64: report.original_image,
        block_size: 16,
        threshold: cloneThreshold,
        min_distance: cloneDistance,
      });
      if (data.status === "success") {
        setReport((prev) =>
          prev
            ? {
                ...prev,
                modules: {
                  ...prev.modules,
                  clones: data,
                },
              }
            : null
        );
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setUpdatingClones(false);
    }
  };

  // Magnifier Mouse Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLensPos({ x, y });
    setImgDisplayBounds({ width: rect.width, height: rect.height });
  };

  const getActiveDisplayImage = (): string => {
    if (!report) return "";
    switch (activeTab) {
      case "ela":
        return report.modules.ela?.overlay_image || report.modules.ela?.ela_image || report.original_image || "";
      case "clones":
        return report.modules.clones?.visualization || report.original_image || "";
      case "noise":
        return report.modules.noise?.noise_map || report.original_image || "";
      case "ghost":
        return (
          report.modules.ghost?.ghost_maps?.[String(report.modules.ghost?.estimated_original_quality)] ||
          report.original_image ||
          ""
        );
      case "stego":
        return report.modules.steganography?.lsb_plane_map || report.original_image || "";
      default:
        return report.original_image || "";
    }
  };

  const activeDisplayImg = getActiveDisplayImage();

  return (
    <div
      style={{
        background: "rgba(10, 15, 26, 0.95)",
        border: "1px solid rgba(0, 229, 255, 0.3)",
        borderRadius: 8,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        color: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingBottom: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CameraIcon size={22} color="var(--cyan)" />
            <h3 style={{ margin: 0, fontSize: 18, letterSpacing: "1px", color: "var(--cyan)" }}>
              FORENSICALLY & IMAGE FORENSICS TOOLKIT
            </h3>
            <span
              style={{
                fontSize: 10,
                background: "rgba(0, 229, 255, 0.15)",
                color: "var(--cyan)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(0, 229, 255, 0.3)",
                fontWeight: 600,
              }}
            >
              29a.ch/Forensically + CodeRafay
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Digital image authentication, Error Level Analysis (ELA), Copy-Move clone detection, 2D FFT resampling, and forensic magnifier.
          </p>
        </div>

        {/* Demo Test Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Demo Samples:
          </span>
          <button
            type="button"
            onClick={() => loadDemoSample("cloned")}
            disabled={loading}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid rgba(244, 63, 94, 0.4)",
              color: "#fb7185",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cloned Stamp
          </button>
          <button
            type="button"
            onClick={() => loadDemoSample("spliced")}
            disabled={loading}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.4)",
              color: "#4ade80",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Spliced Element
          </button>
          <button
            type="button"
            onClick={() => loadDemoSample("natural")}
            disabled={loading}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              color: "#38bdf8",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Natural Photo
          </button>
        </div>
      </div>

      {/* Input Form */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          padding: 14,
          borderRadius: 6,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 240, display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setSelectedFile(e.target.files[0]);
                setImageUrl("");
              }
            }}
            style={{ fontSize: 12 }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>OR</span>
          <input
            type="text"
            placeholder="https://example.com/suspect_image.jpg"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setSelectedFile(null);
            }}
            style={{
              flex: 1,
              padding: "7px 10px",
              fontSize: 12,
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 4,
              color: "#fff",
            }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={useTor} onChange={(e) => setUseTor(e.target.checked)} />
          Tor SOCKS5 Proxy
        </label>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading || (!selectedFile && !imageUrl)}
          style={{
            padding: "8px 18px",
            fontSize: 12,
            fontWeight: "bold",
            background: loading ? "rgba(0, 229, 255, 0.2)" : "var(--cyan)",
            color: loading ? "var(--cyan)" : "#000",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {loading ? (
            <>
              <RadarIcon size={14} color="currentColor" />
              ANALYZING FORENSICS...
            </>
          ) : (
            <>
              <SearchIcon size={14} color="currentColor" />
              RUN FORENSIC SUITE
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 10,
            background: "rgba(255, 0, 85, 0.1)",
            border: "1px solid var(--danger)",
            borderRadius: 4,
            color: "var(--danger)",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Main Workspace */}
      {report && (
        <div>
          {/* Navigation Sub-Tabs */}
          <div
            style={{
              display: "flex",
              gap: 8,
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              paddingBottom: 10,
              marginBottom: 16,
              overflowX: "auto",
            }}
          >
            {[
              { id: "overview", label: "VERDICT & OVERVIEW" },
              { id: "ela", label: "ERROR LEVEL (ELA)" },
              { id: "clones", label: "CLONE DETECTION (CMFD)" },
              { id: "noise", label: "NOISE & LUMINANCE" },
              { id: "ghost", label: "JPEG GHOST & RESAMPLE" },
              { id: "stego", label: "STEGANOGRAPHY & HASHES" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: activeTab === tab.id ? "1px solid var(--cyan)" : "1px solid transparent",
                  background: activeTab === tab.id ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  color: activeTab === tab.id ? "var(--cyan)" : "var(--text-muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Interactive Forensically Canvas Viewport */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Left: Interactive Canvas & Forensic Magnifier */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 6,
                padding: 12,
                position: "relative",
              }}
            >
              {/* Canvas Header & Mode Toggles */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <EyeIcon size={14} color="var(--cyan)" />
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#fff", textTransform: "uppercase" }}>
                    Active Layer: {activeTab}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
                    <input
                      type="checkbox"
                      checked={showMagnifier}
                      onChange={(e) => setShowMagnifier(e.target.checked)}
                    />
                    Magnifier Glass
                  </label>

                  {showMagnifier && (
                    <select
                      value={magnifierMode}
                      onChange={(e) => setMagnifierMode(e.target.value as any)}
                      style={{
                        padding: "2px 6px",
                        fontSize: 10,
                        background: "rgba(0, 0, 0, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        color: "#fff",
                        borderRadius: 3,
                      }}
                    >
                      <option value="normal">Normal Zoom ({magnifierZoom}x)</option>
                      <option value="contrast">High-Contrast</option>
                      <option value="invert">Inverted Lens</option>
                      <option value="red">Red Channel</option>
                      <option value="green">Green Channel</option>
                      <option value="blue">Blue Channel</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Main Image Container */}
              <div
                onMouseEnter={() => setShowMagnifier(true)}
                onMouseLeave={() => setShowMagnifier(false)}
                onMouseMove={handleMouseMove}
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: 300,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#080c14",
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: showMagnifier ? "crosshair" : "default",
                }}
              >
                {activeDisplayImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={canvasRef}
                    src={activeDisplayImg}
                    alt="Forensic View"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 520,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No visual layer available</div>
                )}

                {/* Floating Optical Forensic Magnifier Lens */}
                {showMagnifier && activeDisplayImg && (
                  <div
                    style={{
                      position: "absolute",
                      top: Math.max(0, lensPos.y - 65),
                      left: Math.max(0, lensPos.x - 65),
                      width: 130,
                      height: 130,
                      borderRadius: "50%",
                      border: "2px solid var(--cyan)",
                      boxShadow: "0 0 15px rgba(0, 229, 255, 0.6), inset 0 0 10px rgba(0, 0, 0, 0.8)",
                      pointerEvents: "none",
                      overflow: "hidden",
                      background: "#000",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeDisplayImg}
                      alt="Magnifier Source"
                      style={{
                        position: "absolute",
                        width: imgDisplayBounds.width * magnifierZoom,
                        height: imgDisplayBounds.height * magnifierZoom,
                        top: -(lensPos.y * magnifierZoom - 65),
                        left: -(lensPos.x * magnifierZoom - 65),
                        filter:
                          magnifierMode === "contrast"
                            ? "contrast(250%) brightness(120%)"
                            : magnifierMode === "invert"
                            ? "invert(100%)"
                            : magnifierMode === "red"
                            ? "grayscale(100%) sepia(100%) hue-rotate(300deg)"
                            : magnifierMode === "green"
                            ? "grayscale(100%) sepia(100%) hue-rotate(80deg)"
                            : magnifierMode === "blue"
                            ? "grayscale(100%) sepia(100%) hue-rotate(190deg)"
                            : "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: 2,
                        fontSize: 9,
                        color: "var(--cyan)",
                        background: "rgba(0, 0, 0, 0.7)",
                        padding: "1px 4px",
                        borderRadius: 3,
                      }}
                    >
                      {magnifierZoom}x
                    </div>
                  </div>
                )}
              </div>

              {/* Save finding button for current layer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Hover over the image to activate forensic inspection lens.
                </span>
                <SaveToCaseButton
                  key={`forensic-${activeTab}-${report.filename || "image"}`}
                  identifierType="corporate"
                  identifierValue={`Forensic Analysis [${activeTab.toUpperCase()}]: ${report.filename || "Evidence Image"}`}
                  platform="image_forensics"
                  discoveredBy="Forensically / Forensic-Image-Analysis-Toolkit"
                  metadata={{
                    verdict: report.verdict,
                    risk_score: report.risk_score,
                    layer: activeTab,
                    findings: report.findings,
                    hashes: report.modules.hashes?.cryptographic,
                  }}
                />
              </div>
            </div>

            {/* Right: Operational Controls & Analytical Insights */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 6,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 4,
                      background:
                        report.risk_score >= 60
                          ? "rgba(255, 0, 85, 0.15)"
                          : report.risk_score >= 30
                          ? "rgba(255, 170, 51, 0.15)"
                          : "rgba(0, 255, 159, 0.15)",
                      border: `1px solid ${report.verdict_color}`,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      AUTHENTICITY ASSESSMENT
                    </div>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: report.verdict_color, marginTop: 2 }}>
                      {report.verdict.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                      Manipulation Risk Score: <strong>{report.risk_score} / 100</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 6 }}>
                    DETECTED ANOMALIES ({report.findings.length})
                  </div>
                  {report.findings.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      No critical manipulation signatures detected across ELA, CMFD, or noise variance tests.
                    </div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                      {report.findings.map((f, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Metadata preview */}
                  {report.modules.exif?.has_exif && (
                    <div style={{ marginTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        EXIF Camera Signature
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Make: <strong>{report.modules.exif.camera_make || "Unknown"}</strong> {report.modules.exif.camera_model}
                      </div>
                      {report.modules.exif.software && (
                        <div style={{ fontSize: 12, color: report.modules.exif.software_manipulation_suspected ? "#ff5577" : "var(--cyan)" }}>
                          Software: {report.modules.exif.software}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ELA */}
              {activeTab === "ela" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
                    ERROR LEVEL ANALYSIS (ELA)
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 12px 0", lineHeight: 1.4 }}>
                    Measures pixel error when re-compressing at a specific JPEG quality. Mismatched bright clusters indicate regions inserted from foreign compression qualities.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Target Quality</span>
                        <strong style={{ color: "var(--cyan)" }}>{elaQuality}%</strong>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="99"
                        value={elaQuality}
                        onChange={(e) => setElaQuality(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Error Amplification Scale</span>
                        <strong style={{ color: "var(--cyan)" }}>{elaScale}x</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="25"
                        value={elaScale}
                        onChange={(e) => setElaScale(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Overlay Blending Opacity</span>
                        <strong style={{ color: "var(--cyan)" }}>{Math.round(elaOpacity * 100)}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={elaOpacity}
                        onChange={(e) => setElaOpacity(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateEla}
                      disabled={updatingEla}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        background: "rgba(0, 229, 255, 0.2)",
                        border: "1px solid var(--cyan)",
                        color: "var(--cyan)",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      {updatingEla ? "RECOMPUTING ELA..." : "APPLY ELA SETTINGS"}
                    </button>

                    {report.modules.ela && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                        Anomaly Score: <strong>{report.modules.ela.anomaly_score}</strong> (Mean Diff: {report.modules.ela.mean_diff})
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CLONES (CMFD) */}
              {activeTab === "clones" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
                    COPY-MOVE FORGERY DETECTION (CMFD)
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 12px 0", lineHeight: 1.4 }}>
                    Analyzes 2D-DCT coefficients across spatial blocks to find cloned or cloned-and-retouched patches in the same scene.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Similarity Threshold</span>
                        <strong style={{ color: "var(--cyan)" }}>{cloneThreshold}</strong>
                      </div>
                      <input
                        type="range"
                        min="0.85"
                        max="0.99"
                        step="0.01"
                        value={cloneThreshold}
                        onChange={(e) => setCloneThreshold(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Min Block Distance</span>
                        <strong style={{ color: "var(--cyan)" }}>{cloneDistance}px</strong>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={cloneDistance}
                        onChange={(e) => setCloneDistance(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateClones}
                      disabled={updatingClones}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        background: "rgba(0, 229, 255, 0.2)",
                        border: "1px solid var(--cyan)",
                        color: "var(--cyan)",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      {updatingClones ? "SCANNING DUPLICATES..." : "RE-SCAN CLONE BLOCKS"}
                    </button>

                    {report.modules.clones && (
                      <div style={{ marginTop: 8, fontSize: 11 }}>
                        Matches Found: <strong style={{ color: report.modules.clones.matches_count > 0 ? "#f43f5e" : "var(--cyan)" }}>{report.modules.clones.matches_count}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: NOISE & LUMINANCE */}
              {activeTab === "noise" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
                    NOISE & LUMINANCE GRADIENTS
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                    Spots retouched regions with smoothed noise floor and verifies lighting vector coherence across elements.
                  </p>

                  {report.modules.noise && (
                    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                      <div>Inconsistency Ratio: <strong>{report.modules.noise.inconsistency_ratio}</strong></div>
                      <div>Red Channel Variance: <strong>{report.modules.noise.channel_variance?.red}</strong></div>
                      <div>Green Channel Variance: <strong>{report.modules.noise.channel_variance?.green}</strong></div>
                      <div>Blue Channel Variance: <strong>{report.modules.noise.channel_variance?.blue}</strong></div>
                    </div>
                  )}

                  {report.modules.luminance && (
                    <div style={{ marginTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10, fontSize: 11 }}>
                      <div>Mean Lighting Angle: <strong>{report.modules.luminance.mean_light_angle_deg}°</strong></div>
                      <div>Gradient Std Dev: <strong>{report.modules.luminance.gradient_std_deg}°</strong></div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: JPEG GHOST & RESAMPLING */}
              {activeTab === "ghost" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
                    JPEG GHOST & 2D FFT RESAMPLING
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                    Identifies original JPEG compression quality and periodic interpolation patterns from digital resizing.
                  </p>

                  {report.modules.ghost && (
                    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                      <div>Estimated Save Quality: <strong style={{ color: "var(--cyan)" }}>Q={report.modules.ghost.estimated_original_quality}</strong></div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Recompression Curve Dips:</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {Object.entries(report.modules.ghost.quality_curve || {}).map(([q, s]: any) => (
                          <span
                            key={q}
                            style={{
                              padding: "2px 6px",
                              borderRadius: 3,
                              background: Number(q) === report.modules.ghost.estimated_original_quality ? "rgba(0, 229, 255, 0.2)" : "rgba(255, 255, 255, 0.04)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              fontSize: 10,
                            }}
                          >
                            Q{q}: {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.modules.resampling && (
                    <div style={{ marginTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10, fontSize: 11 }}>
                      <div>Resampling Score: <strong>{report.modules.resampling.resampling_score}</strong></div>
                      <div>Artifact Peaks: <strong>{report.modules.resampling.artifacts_detected}</strong></div>
                      <div>Interpolation Status: <strong>{report.modules.resampling.is_resampled ? "Likely Resampled" : "Natural Resolution"}</strong></div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: STEGANOGRAPHY & HASHES */}
              {activeTab === "stego" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
                    STEGANOGRAPHY & PROVENANCE HASHES
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                    Chi-Square LSB randomness anomaly tests and perceptual / cryptographic image signatures.
                  </p>

                  {report.modules.hashes && (
                    <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>SHA-256:</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, wordBreak: "break-all", color: "var(--cyan)" }}>
                        {report.modules.hashes.cryptographic?.sha256}
                      </div>

                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>Perceptual Hashes:</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                        pHash: <span style={{ color: "#a855f7" }}>{report.modules.hashes.perceptual?.phash}</span>
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                        aHash: <span style={{ color: "#38bdf8" }}>{report.modules.hashes.perceptual?.ahash}</span>
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                        dHash: <span style={{ color: "#22c55e" }}>{report.modules.hashes.perceptual?.dhash}</span>
                      </div>
                    </div>
                  )}

                  {report.modules.steganography && (
                    <div style={{ marginTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10, fontSize: 11 }}>
                      <div>Chi-Square Randomness: <strong>{report.modules.steganography.suspicious_payload ? "Anomaly Detected" : "Natural LSB Distribution"}</strong></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
