"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import ImageMagnifier from "./ImageMagnifier";

type ReverseSearchLink = {
  engine: string;
  search_url: string;
};

type DetectedFace = {
  face_id: number;
  bbox: [number, number, number, number];
  confidence: number;
  landmarks: [number, number][];
  crop_base64: string;
  reverse_search_links: ReverseSearchLink[];
};

type DetectionResult = {
  image_width: number;
  image_height: number;
  total_faces: number;
  faces: DetectedFace[];
  original_reverse_links: ReverseSearchLink[];
};

type ComparisonResult = {
  cosine_similarity: number;
  l2_distance: number;
  match_percentage: number;
  is_match: boolean;
  confidence_level: string;
  face1_crop: string;
  face2_crop: string;
};

type SpiderDiscoveredFace = {
  source_image_url: string;
  face_index: number;
  confidence: number;
  bbox: [number, number, number, number];
  crop_base64: string;
  match_with_target: number | null;
};

type SpiderResult = {
  target_url: string;
  images_scanned: number;
  faces_detected: number;
  discovered_faces: SpiderDiscoveredFace[];
};

export default function FaceBiometricsRecon() {
  const { activeCase } = useActiveCase();
  const [activeSubTab, setActiveSubTab] = useState<"detect" | "compare" | "spider">("detect");

  // Detection states
  const [detectFile, setDetectFile] = useState<File | null>(null);
  const [detectPreview, setDetectPreview] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState<number>(0.55);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detectResult, setDetectResult] = useState<DetectionResult | null>(null);

  // Comparison states
  const [compFile1, setCompFile1] = useState<File | null>(null);
  const [compPreview1, setCompPreview1] = useState<string | null>(null);
  const [compFile2, setCompFile2] = useState<File | null>(null);
  const [compPreview2, setCompPreview2] = useState<string | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [compResult, setCompResult] = useState<ComparisonResult | null>(null);

  // FaceSpyder states
  const [spiderUrl, setSpiderUrl] = useState<string>("");
  const [spiderRefFile, setSpiderRefFile] = useState<File | null>(null);
  const [spiderRefPreview, setSpiderRefPreview] = useState<string | null>(null);
  const [spiderMaxImages, setSpiderMaxImages] = useState<number>(20);
  const [spiderUseTor, setSpiderUseTor] = useState<boolean>(false);
  const [spiderLoading, setSpiderLoading] = useState(false);
  const [spiderError, setSpiderError] = useState<string | null>(null);
  const [spiderResult, setSpiderResult] = useState<SpiderResult | null>(null);

  // Handle Detection
  async function handleRunDetection() {
    if (!detectFile) return;
    setDetectLoading(true);
    setDetectError(null);
    setDetectResult(null);

    try {
      const formData = new FormData();
      formData.append("file", detectFile);
      formData.append("min_confidence", minConfidence.toString());

      const res = await apiFetch("/biometrics/detect", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }

      const data: DetectionResult = await res.json();
      setDetectResult(data);
    } catch (err: any) {
      setDetectError(err.message || "Failed to analyze facial features.");
    } finally {
      setDetectLoading(false);
    }
  }

  // Handle 1:1 Comparison
  async function handleRunComparison() {
    if (!compFile1 || !compFile2) return;
    setCompLoading(true);
    setCompError(null);
    setCompResult(null);

    try {
      const formData = new FormData();
      formData.append("file1", compFile1);
      formData.append("file2", compFile2);

      const res = await apiFetch("/biometrics/compare", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }

      const data: ComparisonResult = await res.json();
      setCompResult(data);
    } catch (err: any) {
      setCompError(err.message || "Failed to execute biometric comparison.");
    } finally {
      setCompLoading(false);
    }
  }

  // Handle FaceSpyder Crawl
  async function handleRunSpider() {
    if (!spiderUrl.trim()) return;
    setSpiderLoading(true);
    setSpiderError(null);
    setSpiderResult(null);

    try {
      const formData = new FormData();
      formData.append("url", spiderUrl.trim());
      formData.append("max_images", spiderMaxImages.toString());
      formData.append("use_tor", spiderUseTor ? "true" : "false");
      if (spiderRefFile) {
        formData.append("reference_file", spiderRefFile);
      }

      const res = await apiFetch("/biometrics/spider", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }

      const data: SpiderResult = await res.json();
      setSpiderResult(data);
    } catch (err: any) {
      setSpiderError(err.message || "FaceSpyder crawling operation failed.");
    } finally {
      setSpiderLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ color: "var(--cyan)", fontSize: 13, fontWeight: "bold", letterSpacing: "0.1em" }}>
            [BIOMETRIC & FACIAL INTELLIGENCE CORE]
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 3,
              background: "rgba(5, 217, 232, 0.15)",
              color: "var(--cyan)",
              border: "1px solid rgba(5, 217, 232, 0.4)",
            }}
          >
            YUNET + SFACE ONNX NEURAL ENGINE
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0, maxWidth: 850 }}>
          High-precision facial biometric verification, multi-face crop extraction, 5-point facial landmarking,
          1:1 neural vector verification (Cosine/L2), and FaceSpyder automated web crawling.
        </p>
      </div>

      {/* Sub-Navigation Buttons */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--panel-border)", paddingBottom: 12 }}>
        <button
          onClick={() => setActiveSubTab("detect")}
          style={{
            padding: "8px 16px",
            fontSize: 12,
            background: activeSubTab === "detect" ? "rgba(5, 217, 232, 0.18)" : "transparent",
            border: activeSubTab === "detect" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeSubTab === "detect" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
            fontWeight: activeSubTab === "detect" ? "bold" : "normal",
          }}
        >
          1. Multi-Face Detector & Crops
        </button>
        <button
          onClick={() => setActiveSubTab("compare")}
          style={{
            padding: "8px 16px",
            fontSize: 12,
            background: activeSubTab === "compare" ? "rgba(5, 217, 232, 0.18)" : "transparent",
            border: activeSubTab === "compare" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeSubTab === "compare" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
            fontWeight: activeSubTab === "compare" ? "bold" : "normal",
          }}
        >
          2. 1:1 Biometric Comparison (Target vs Suspect)
        </button>
        <button
          onClick={() => setActiveSubTab("spider")}
          style={{
            padding: "8px 16px",
            fontSize: 12,
            background: activeSubTab === "spider" ? "rgba(5, 217, 232, 0.18)" : "transparent",
            border: activeSubTab === "spider" ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
            color: activeSubTab === "spider" ? "var(--cyan)" : "var(--text-muted)",
            cursor: "pointer",
            fontWeight: activeSubTab === "spider" ? "bold" : "normal",
          }}
        >
          3. FaceSpyder Web Crawler
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: MULTI-FACE DETECTOR & CROPS */}
      {/* ========================================================================= */}
      {activeSubTab === "detect" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--panel-border)",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 300px" }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--cyan)", marginBottom: 6 }}>
                  UPLOAD SOURCE IMAGE / PHOTO
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setDetectFile(f);
                    if (f) {
                      setDetectPreview(URL.createObjectURL(f));
                    } else {
                      setDetectPreview(null);
                    }
                  }}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "8px 10px",
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              <div style={{ width: 140 }}>
                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                  MIN CONFIDENCE ({Math.round(minConfidence * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.30"
                  max="0.95"
                  step="0.05"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <button
                onClick={handleRunDetection}
                disabled={detectLoading || !detectFile}
                style={{
                  padding: "10px 24px",
                  fontSize: 12,
                  fontWeight: "bold",
                  background: detectLoading ? "#333" : "var(--cyan)",
                  color: "#000",
                  border: "none",
                  cursor: detectLoading || !detectFile ? "not-allowed" : "pointer",
                  borderRadius: 2,
                }}
              >
                {detectLoading ? "SCANNING BIOMETRICS..." : "DETECT & EXTRACT FACES"}
              </button>
            </div>

            {detectPreview && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Preview:</span>
                <img
                  src={detectPreview}
                  alt="Detect Preview"
                  style={{ maxHeight: 80, borderRadius: 3, border: "1px solid var(--panel-border)" }}
                />
              </div>
            )}
          </div>

          {detectError && (
            <div style={{ padding: 12, background: "rgba(255, 0, 85, 0.15)", border: "1px solid #ff0055", color: "#ff7799", fontSize: 12 }}>
              {detectError}
            </div>
          )}

          {detectResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 16px",
                  background: "rgba(5, 217, 232, 0.05)",
                  border: "1px solid rgba(5, 217, 232, 0.2)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--cyan)", fontWeight: "bold" }}>
                  DETECTED FACES: {detectResult.total_faces}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Resolution: {detectResult.image_width} x {detectResult.image_height} px
                </span>
              </div>

              {detectResult.total_faces === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  No human faces detected above the confidence threshold ({Math.round(minConfidence * 100)}%).
                  Try lowering the confidence slider or uploading a clearer, higher-resolution picture.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {detectResult.faces.map((f) => (
                    <div
                      key={f.face_id}
                      style={{
                        background: "#080c14",
                        border: "1px solid var(--panel-border)",
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", gap: 12 }}>
                        <ImageMagnifier
                          src={f.crop_base64}
                          alt={`Face ${f.face_id}`}
                          lensSize={100}
                          zoomLevel={2.5}
                          style={{ width: 95, height: 95, flexShrink: 0 }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                          <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>FACE #{f.face_id}</span>
                          <span style={{ color: "var(--text-muted)" }}>
                            Confidence: <strong style={{ color: "#fff" }}>{Math.round(f.confidence * 100)}%</strong>
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            Box: {f.bbox[2]}x{f.bbox[3]} px at ({f.bbox[0]}, {f.bbox[1]})
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            5-Point Landmarks: <span style={{ color: "var(--cyan)" }}>Aligned</span>
                          </span>
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: 8 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                          REVERSE IMAGE SEARCH PIVOTS:
                        </span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <a
                            href="https://images.google.com/"
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 10, padding: "3px 7px", background: "rgba(255,255,255,0.06)", borderRadius: 3 }}
                          >
                            Google Lens
                          </a>
                          <a
                            href="https://yandex.com/images/"
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 10, padding: "3px 7px", background: "rgba(255,255,255,0.06)", borderRadius: 3 }}
                          >
                            Yandex
                          </a>
                          <a
                            href="https://tineye.com/"
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 10, padding: "3px 7px", background: "rgba(255,255,255,0.06)", borderRadius: 3 }}
                          >
                            TinEye
                          </a>
                          <a
                            href="https://www.bing.com/images/search?view=detailv2&iss=sbi"
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 10, padding: "3px 7px", background: "rgba(255,255,255,0.06)", borderRadius: 3 }}
                          >
                            Bing Visual
                          </a>
                        </div>
                      </div>

                      <div style={{ paddingTop: 4, display: "flex", justifyContent: "flex-end" }}>
                        <SaveToCaseButton
                          identifierType="person"
                          identifierValue={`Face #${f.face_id} (${Math.round(f.confidence * 100)}% conf)`}
                          platform="biometrics.face_crop"
                          discoveredBy="biometrics.yunet"
                          metadata={{
                            face_id: f.face_id,
                            confidence: f.confidence,
                            bbox: f.bbox,
                            landmarks: f.landmarks,
                            has_crop: true,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: 1:1 BIOMETRIC COMPARISON (TARGET VS SUSPECT) */}
      {/* ========================================================================= */}
      {activeSubTab === "compare" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              padding: 18,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--panel-border)",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
              {/* Photo 1 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, color: "var(--cyan)", fontWeight: "bold" }}>
                  PHOTO 1: TARGET / REFERENCE PROFILE
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setCompFile1(f);
                    if (f) setCompPreview1(URL.createObjectURL(f));
                    else setCompPreview1(null);
                  }}
                  style={{
                    fontSize: 12,
                    padding: "8px 10px",
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                  }}
                />
                {compPreview1 && (
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "center" }}>
                    <img
                      src={compPreview1}
                      alt="Comp 1"
                      style={{ maxHeight: 140, borderRadius: 4, border: "1px solid var(--panel-border)" }}
                    />
                  </div>
                )}
              </div>

              {/* Photo 2 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 12, color: "var(--cyan)", fontWeight: "bold" }}>
                  PHOTO 2: CANDIDATE / SUSPECT TO VERIFY
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setCompFile2(f);
                    if (f) setCompPreview2(URL.createObjectURL(f));
                    else setCompPreview2(null);
                  }}
                  style={{
                    fontSize: 12,
                    padding: "8px 10px",
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                  }}
                />
                {compPreview2 && (
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "center" }}>
                    <img
                      src={compPreview2}
                      alt="Comp 2"
                      style={{ maxHeight: 140, borderRadius: 4, border: "1px solid var(--panel-border)" }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleRunComparison}
                disabled={compLoading || !compFile1 || !compFile2}
                style={{
                  padding: "12px 36px",
                  fontSize: 13,
                  fontWeight: "bold",
                  background: compLoading ? "#333" : "var(--cyan)",
                  color: "#000",
                  border: "none",
                  cursor: compLoading || !compFile1 || !compFile2 ? "not-allowed" : "pointer",
                  borderRadius: 2,
                }}
              >
                {compLoading ? "COMPUTING NEURAL EMBEDDINGS..." : "EXECUTE 1:1 BIOMETRIC MATCH"}
              </button>
            </div>
          </div>

          {compError && (
            <div style={{ padding: 12, background: "rgba(255, 0, 85, 0.15)", border: "1px solid #ff0055", color: "#ff7799", fontSize: 12 }}>
              {compError}
            </div>
          )}

          {compResult && (
            <div
              style={{
                background: "#080c14",
                border: `1px solid ${compResult.is_match ? "var(--cyan)" : "#ff0055"}`,
                padding: 24,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
                {/* Face 1 Crop */}
                <div style={{ textAlign: "center" }}>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                    ALIGNED CROP: TARGET (Hover to Magnify)
                  </span>
                  <ImageMagnifier
                    src={compResult.face1_crop}
                    alt="Aligned 1"
                    lensSize={110}
                    zoomLevel={2.8}
                    style={{ width: 112, height: 112, display: "inline-block" }}
                  />
                </div>

                {/* Score Dial */}
                <div style={{ textAlign: "center", minWidth: 220 }}>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: "bold",
                      color: compResult.is_match ? "var(--cyan)" : "#ff3366",
                    }}
                  >
                    {compResult.match_percentage}%
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      letterSpacing: "0.08em",
                      color: compResult.is_match ? "#00ffcc" : "#ff5577",
                      marginTop: 4,
                    }}
                  >
                    {compResult.confidence_level}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
                    Cosine Distance: {compResult.cosine_similarity} | L2 Norm: {compResult.l2_distance}
                  </div>
                </div>

                {/* Face 2 Crop */}
                <div style={{ textAlign: "center" }}>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                    ALIGNED CROP: SUSPECT (Hover to Magnify)
                  </span>
                  <ImageMagnifier
                    src={compResult.face2_crop}
                    alt="Aligned 2"
                    lensSize={110}
                    zoomLevel={2.8}
                    style={{ width: 112, height: 112, display: "inline-block" }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--panel-border)",
                  paddingTop: 16,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {compResult.is_match
                    ? "Biometric criteria satisfied: Neural embeddings exceed identity threshold."
                    : "Low biometric correlation: Distinct facial features identified."}
                </div>

                <SaveToCaseButton
                  identifierType="person"
                  identifierValue={`Biometric Comparison: ${compResult.match_percentage}% Match (${compResult.confidence_level})`}
                  platform="biometrics.sface_1to1"
                  discoveredBy="biometrics.sface"
                  metadata={{
                    match_percentage: compResult.match_percentage,
                    is_match: compResult.is_match,
                    cosine_similarity: compResult.cosine_similarity,
                    l2_distance: compResult.l2_distance,
                    verdict: compResult.confidence_level,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: FACESPYDER WEB CRAWLER */}
      {/* ========================================================================= */}
      {activeSubTab === "spider" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              padding: 18,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--panel-border)",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--cyan)", marginBottom: 6 }}>
                  TARGET URL / DOMAIN TO SPIDER FOR FACES
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/team or https://example.com/profile"
                  value={spiderUrl}
                  onChange={(e) => setSpiderUrl(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13,
                    padding: "10px 12px",
                    background: "#080c14",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    OPTIONAL: REFERENCE SUSPECT FACE (TO HIGHLIGHT MATCHES)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setSpiderRefFile(f);
                      if (f) setSpiderRefPreview(URL.createObjectURL(f));
                      else setSpiderRefPreview(null);
                    }}
                    style={{
                      width: "100%",
                      fontSize: 11,
                      padding: "6px 8px",
                      background: "#080c14",
                      border: "1px solid var(--panel-border)",
                      color: "var(--text-main)",
                    }}
                  />
                  {spiderRefPreview && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <img
                        src={spiderRefPreview}
                        alt="Ref preview"
                        style={{ height: 40, borderRadius: 3, border: "1px solid var(--cyan)" }}
                      />
                      <span style={{ fontSize: 10, color: "var(--cyan)" }}>Reference suspect loaded</span>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                      MAX IMAGES TO SCAN ({spiderMaxImages})
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={spiderMaxImages}
                      onChange={(e) => setSpiderMaxImages(parseInt(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                    <input
                      type="checkbox"
                      id="spiderTor"
                      checked={spiderUseTor}
                      onChange={(e) => setSpiderUseTor(e.target.checked)}
                    />
                    <label htmlFor="spiderTor" style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
                      Route via Tor SOCKS5
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleRunSpider}
                  disabled={spiderLoading || !spiderUrl.trim()}
                  style={{
                    padding: "10px 28px",
                    fontSize: 12,
                    fontWeight: "bold",
                    background: spiderLoading ? "#333" : "var(--cyan)",
                    color: "#000",
                    border: "none",
                    cursor: spiderLoading || !spiderUrl.trim() ? "not-allowed" : "pointer",
                    borderRadius: 2,
                  }}
                >
                  {spiderLoading ? "CRAWLING & HARVESTING FACES..." : "LAUNCH FACESPYDER"}
                </button>
              </div>
            </div>
          </div>

          {spiderError && (
            <div style={{ padding: 12, background: "rgba(255, 0, 85, 0.15)", border: "1px solid #ff0055", color: "#ff7799", fontSize: 12 }}>
              {spiderError}
            </div>
          )}

          {spiderResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 16px",
                  background: "rgba(5, 217, 232, 0.05)",
                  border: "1px solid rgba(5, 217, 232, 0.2)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--cyan)", fontWeight: "bold" }}>
                  FACESPYDER HARVEST: {spiderResult.faces_detected} FACES FOUND
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Scanned {spiderResult.images_scanned} images on {spiderResult.target_url}
                </span>
              </div>

              {spiderResult.discovered_faces.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  No human faces were found in the scanned images on this URL.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                  {spiderResult.discovered_faces.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#080c14",
                        border: f.match_with_target && f.match_with_target >= 50
                          ? "1px solid #00ffcc"
                          : "1px solid var(--panel-border)",
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", gap: 10 }}>
                        <img
                          src={f.crop_base64}
                          alt="Crop"
                          style={{ width: 75, height: 75, objectFit: "cover", borderRadius: 3, border: "1px solid var(--cyan)" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, overflow: "hidden" }}>
                          <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>FACE #{f.face_index}</span>
                          <span style={{ color: "var(--text-muted)" }}>
                            Conf: <strong style={{ color: "#fff" }}>{Math.round(f.confidence * 100)}%</strong>
                          </span>
                          {f.match_with_target !== null && (
                            <span
                              style={{
                                color: f.match_with_target >= 50 ? "#00ffcc" : "#ffaa33",
                                fontWeight: "bold",
                              }}
                            >
                              Match: {f.match_with_target}%
                            </span>
                          )}
                          <a
                            href={f.source_image_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 10,
                              color: "var(--cyan)",
                              textDecoration: "underline",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              maxWidth: 150,
                            }}
                          >
                            Source Image
                          </a>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                        <SaveToCaseButton
                          identifierType="person"
                          identifierValue={`Face from ${spiderResult.target_url}`}
                          platform="biometrics.facespyder"
                          url={f.source_image_url}
                          discoveredBy="biometrics.facespyder"
                          metadata={{
                            confidence: f.confidence,
                            source_url: f.source_image_url,
                            target_url: spiderResult.target_url,
                            match_with_target: f.match_with_target,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
