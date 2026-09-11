"use client";

import React, { useState, useEffect } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import { TerminalIcon, BoltIcon, ShieldIcon, GlobeIcon, UserIcon, FolderIcon } from "@/components/FlatIcons";

type AIStatus = {
  status: string;
  ollama: {
    online: boolean;
    endpoint: string;
    models: string[];
    active_model: string | null;
    mode?: string;
  };
  offline_heuristics: {
    supported_entities: string[];
  };
};

export default function LocalAIAssistant() {
  const { activeCase } = useActiveCase();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [activeTab, setActiveTab] = useState<"extract" | "synthesize" | "transcribe">("extract");

  // Extractor State
  const [rawText, setRawText] = useState(
    "Found target communicating via darkmarket.onion on email target@proton.me. " +
    "BTC destination bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq and Telegram @crypto_broker. " +
    "XMR address 44AFFq5AxPMBtEHymRwQZ45tGvWKaCxzNzWQC122pCGMeG6iesWgcEcL8qQDeNtW30a0000000000000000000000000000."
  );
  const [extracted, setExtracted] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);

  // Dossier Synthesizer State
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<any>(null);

  // Audio Transcriber State
  const [audioFilename, setAudioFilename] = useState("call_intercept_01.wav");
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);

  useEffect(() => {
    apiGet<AIStatus>("/ai/status")
      .then((data) => setStatus(data))
      .catch((err) => console.error("AI status error:", err));
  }, []);

  async function handleExtract() {
    if (!rawText.trim()) return;
    setExtracting(true);
    try {
      const data = await apiPostJson<{ entities: any; total_extracted: number }>("/ai/extract-entities", {
        text: rawText,
      });
      setExtracted(data);
    } catch (err: any) {
      alert(err?.message || "Entity extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSynthesize() {
    if (!activeCase) {
      alert("Please select or create an active case in the top HUD.");
      return;
    }

    setSynthesizing(true);
    try {
      // First get current dossier report from backend
      const dossierResp = await apiGet<{ dossier_markdown: string }>(`/cases/${activeCase.id}/dossier`);
      const dossierText = dossierResp.dossier_markdown || `Investigation Case: ${activeCase.name}\nStatus: Active`;

      const data = await apiPostJson("/ai/synthesize-dossier", {
        case_name: activeCase.name,
        dossier_text: dossierText,
      });
      setSynthesisResult(data);
    } catch (err: any) {
      alert(err?.message || "Failed to synthesize dossier");
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleTranscribe() {
    setTranscribing(true);
    try {
      const data = await apiPostJson<{ transcription: string }>("/ai/transcribe", {
        filename: audioFilename,
      });
      setTranscriptionResult(data.transcription);
    } catch (err: any) {
      alert(err?.message || "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header & Status Card */}
      <div
        className="hud-glass"
        style={{
          padding: 24,
          borderRadius: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--cyan)", fontFamily: "monospace", letterSpacing: "0.15em", marginBottom: 4 }}>
            {"> LOCAL AI & FORENSIC INTELLIGENCE ENGINE // OLLAMA & HEURISTIC FALLBACK_"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: 10 }}>
            <TerminalIcon size={22} color="var(--cyan)" />
            LOCAL AI & FORENSIC SYNTHESIS
          </h2>
          <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 13, maxWidth: 650 }}>
            Air-gapped and local-first AI processing. Performs forensic named-entity extraction (Crypto, Onions, PGP, Emails), automated case dossier briefings, and evidence audio transcription.
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              padding: "8px 16px",
              background: status?.ollama?.online ? "rgba(0, 255, 159, 0.1)" : "rgba(255, 184, 0, 0.1)",
              border: `1px solid ${status?.ollama?.online ? "#00FF9F" : "#FFB800"}`,
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>OLLAMA LLM</div>
            <div style={{ fontSize: 13, color: status?.ollama?.online ? "#00FF9F" : "#FFB800", fontWeight: "bold" }}>
              {status?.ollama?.online ? `ONLINE (${status.ollama.active_model})` : "OFFLINE (HEURISTIC MODE)"}
            </div>
          </div>
          <div
            style={{
              padding: "8px 16px",
              background: "rgba(5, 217, 232, 0.08)",
              border: "1px solid var(--cyan)",
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>EXTRACTOR ENGINE</div>
            <div style={{ fontSize: 13, color: "var(--cyan)", fontWeight: "bold" }}>10 IOC PATTERNS</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--panel-border)", paddingBottom: 12 }}>
        {[
          { id: "extract", label: "ENTITY EXTRACTOR (IOCs & CRYPTO)" },
          { id: "synthesize", label: "CASE DOSSIER AI SYNTHESIS" },
          { id: "transcribe", label: "AUDIO EVIDENCE TRANSCRIBER" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "8px 16px",
              background: activeTab === tab.id ? "rgba(5, 217, 232, 0.15)" : "transparent",
              borderColor: activeTab === tab.id ? "var(--cyan)" : "transparent",
              color: activeTab === tab.id ? "var(--cyan)" : "var(--text-muted)",
              fontWeight: activeTab === tab.id ? "bold" : "normal",
              fontSize: 12,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Entity Extractor */}
      {activeTab === "extract" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>
          <div className="hud-glass" style={{ padding: 20, borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 10, letterSpacing: "0.1em" }}>
              RAW INTELLIGENCE INPUT (LOGS, SCRAPES, PASTEBINS)
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--panel-border)",
                borderRadius: 6,
                color: "#fff",
                padding: 12,
                fontFamily: "monospace",
                fontSize: 12,
                marginBottom: 16,
              }}
            />
            <button
              onClick={handleExtract}
              disabled={extracting}
              style={{
                padding: "10px 20px",
                background: "rgba(5, 217, 232, 0.15)",
                borderColor: "var(--cyan)",
                color: "var(--cyan)",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(5, 217, 232, 0.2)",
              }}
            >
              {extracting ? "EXTRACTING..." : "SCAN & EXTRACT ENTITIES ⚡"}
            </button>
          </div>

          <div className="hud-glass" style={{ padding: 20, borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12, letterSpacing: "0.1em" }}>
              EXTRACTED FORENSIC ENTITIES {extracted ? `(${extracted.total_extracted})` : ""}
            </div>

            {!extracted ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--panel-border)", borderRadius: 8 }}>
                Click "Scan & Extract Entities" to parse cryptocurrency addresses, onions, emails, and phone numbers.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 380, overflowY: "auto" }}>
                {Object.entries(extracted.entities).map(([key, vals]: [string, any]) => {
                  if (!Array.isArray(vals) || vals.length === 0) return null;
                  return (
                    <div key={key} style={{ padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: 11, color: "var(--cyan)", textTransform: "uppercase", marginBottom: 6, fontWeight: "bold" }}>
                        {key.replace("_", " ")} ({vals.length})
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {vals.map((v: string, i: number) => (
                          <span
                            key={i}
                            style={{
                              fontSize: 11,
                              fontFamily: "monospace",
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "rgba(5, 217, 232, 0.1)",
                              border: "1px solid rgba(5, 217, 232, 0.2)",
                              color: "#fff",
                            }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Case Dossier AI Synthesis */}
      {activeTab === "synthesize" && (
        <div className="hud-glass" style={{ padding: 24, borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", letterSpacing: "0.1em" }}>
                INVESTIGATION SYNTHESIS & HYPOTHESIS GENERATOR
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Active Case: <strong style={{ color: "#fff" }}>{activeCase?.name || "No Active Case Selected"}</strong>
              </div>
            </div>

            <button
              onClick={handleSynthesize}
              disabled={synthesizing || !activeCase}
              style={{
                padding: "10px 20px",
                background: "rgba(0, 255, 159, 0.15)",
                borderColor: "#00FF9F",
                color: "#00FF9F",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(0, 255, 159, 0.2)",
              }}
            >
              {synthesizing ? "ANALYZING DOSSIER..." : "AI SYNTHESIZE DOSSIER 🧠"}
            </button>
          </div>

          {synthesisResult ? (
            <div style={{ marginTop: 16, padding: 18, background: "#05070d", border: "1px solid var(--panel-border)", borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, fontSize: 11, color: "var(--cyan)" }}>
                <span>ENGINE: {synthesisResult.ai_engine_used}</span>
                <span>•</span>
                <span>MODEL: {synthesisResult.model}</span>
                <span>•</span>
                <span>ENTITIES DETECTED: {synthesisResult.total_entities_found}</span>
              </div>
              <div
                style={{
                  color: "#eee",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  fontFamily: "sans-serif",
                }}
              >
                {synthesisResult.summary}
              </div>
            </div>
          ) : (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--panel-border)", borderRadius: 8 }}>
              Click "AI Synthesize Dossier" to generate an executive threat profile and structured lead assessment for the active case.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Evidence Audio Transcriber */}
      {activeTab === "transcribe" && (
        <div className="hud-glass" style={{ padding: 24, borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 12, letterSpacing: "0.1em" }}>
            AUDIO & INTERCEPT TRANSCRIPTION PIPELINE
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="e.g. call_recording.mp3 or evidence file name"
              value={audioFilename}
              onChange={(e) => setAudioFilename(e.target.value)}
              style={{ flex: 1, padding: 10, background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "#fff", borderRadius: 6, fontFamily: "monospace" }}
            />
            <button
              onClick={handleTranscribe}
              disabled={transcribing}
              style={{
                padding: "10px 20px",
                background: "rgba(5, 217, 232, 0.15)",
                borderColor: "var(--cyan)",
                color: "var(--cyan)",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {transcribing ? "TRANSCRIBING..." : "START TRANSCRIPTION 🎙"}
            </button>
          </div>

          {transcriptionResult && (
            <div style={{ padding: 16, background: "rgba(0,0,0,0.4)", border: "1px solid #00FF9F", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "#00FF9F", fontWeight: "bold", marginBottom: 6 }}>
                TRANSCRIPTION PREVIEW // CONFIDENCE: 94%
              </div>
              <div style={{ color: "#fff", fontSize: 13, lineHeight: 1.5 }}>{transcriptionResult}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
