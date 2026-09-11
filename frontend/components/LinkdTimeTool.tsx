"use client";

import React, { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import {
  ClockIcon,
  SearchIcon,
  CrossIcon,
  CalendarIcon,
  LayersIcon,
  ArrowRightIcon,
  GlobeIcon,
  LinkedinIcon,
  DatabaseIcon,
} from "./FlatIcons";

type DecodedActivity = {
  id: string;
  epoch_ms: number;
  utc_iso: string;
  utc_formatted: string;
  local_formatted: string;
  local_12h: string;
  timezone_label: string;
  day_of_week: string;
  hour_of_day: number;
  is_weekend: boolean;
  binary_snowflake?: string;
  timestamp_bits?: string;
  activity_type?: string;
  source_url?: string;
  author_handle?: string;
  notes?: string;
  delta_from_previous?: string;
};

type TimelineResult = {
  total_parsed: number;
  total_errors: number;
  timezone_offset: number;
  items: DecodedActivity[];
  errors: { input: string; error: string }[];
  pattern_analysis: {
    peak_hour_local: number | null;
    peak_hour_count: number;
    hour_distribution: Record<number, number>;
    day_distribution: Record<string, number>;
    weekday_count: number;
    weekend_count: number;
    weekend_ratio_percent: number;
  };
};

const TIMEZONES = [
  { label: "UTC (GMT+00:00)", offset: 0 },
  { label: "London / GMT (GMT+00:00)", offset: 0 },
  { label: "CET / Paris / Berlin (GMT+01:00)", offset: 1 },
  { label: "EET / Athens / Cairo (GMT+02:00)", offset: 2 },
  { label: "Moscow / Riyadh (GMT+03:00)", offset: 3 },
  { label: "Dubai (GMT+04:00)", offset: 4 },
  { label: "India / IST (GMT+05:30)", offset: 5.5 },
  { label: "Singapore / Beijing (GMT+08:00)", offset: 8 },
  { label: "Tokyo / JST (GMT+09:00)", offset: 9 },
  { label: "New York / EDT (GMT-04:00)", offset: -4 },
  { label: "Chicago / CDT (GMT-05:00)", offset: -5 },
  { label: "Los Angeles / PDT (GMT-07:00)", offset: -7 },
  { label: "São Paulo / BRT (GMT-03:00)", offset: -3 },
];

export default function LinkdTimeTool() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<"single" | "timeline">("single");

  // Single Decode state
  const [singleInput, setSingleInput] = useState("");
  const [timezoneOffset, setTimezoneOffset] = useState<number>(0);
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<DecodedActivity | null>(null);

  // Timeline state
  const [timelineBatch, setTimelineBatch] = useState("");
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineResult, setTimelineResult] = useState<TimelineResult | null>(null);

  const handleDecodeSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleInput.trim()) return;

    setLoadingSingle(true);
    setSingleError(null);
    setSingleResult(null);

    try {
      const res = await apiGet<DecodedActivity>(
        `/recon/linkedin/linkdtime?url_or_id=${encodeURIComponent(singleInput.trim())}&timezone_offset=${timezoneOffset}`
      );
      setSingleResult(res);
    } catch (err: any) {
      setSingleError(err?.message || "Failed to decode LinkedIn activity timestamp");
    } finally {
      setLoadingSingle(false);
    }
  };

  const handleBuildTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = timelineBatch
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    if (lines.length === 0) {
      setTimelineError("Please enter at least one LinkedIn URL or Snowflake ID.");
      return;
    }

    setLoadingTimeline(true);
    setTimelineError(null);
    setTimelineResult(null);

    try {
      const res = await apiPostJson<TimelineResult>("/recon/linkedin/linkdtime/timeline", {
        urls: lines,
        timezone_offset: timezoneOffset,
      });
      setTimelineResult(res);
    } catch (err: any) {
      setTimelineError(err?.message || "Failed to build LinkedIn timeline");
    } finally {
      setLoadingTimeline(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          padding: 16,
          borderRadius: 8,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: "rgba(0, 119, 181, 0.15)",
              border: "1px solid #0077b5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LinkedinIcon size={20} color="#0077b5" />
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              LinkdTime: LinkedIn Timestamp Decoder &amp; Timeline Forensics
              <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(0, 119, 181, 0.2)", color: "#70b5f9", borderRadius: 4, border: "1px solid #0077b5" }}>
                Lucksi/LinkdTime
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Extracts the exact millisecond publication timestamp from 64-bit LinkedIn Snowflake IDs, URNs, and comments.
            </div>
          </div>
        </div>

        {/* Timezone Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClockIcon size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Target Timezone:</span>
          <select
            value={timezoneOffset}
            onChange={(e) => setTimezoneOffset(parseFloat(e.target.value))}
            style={{
              padding: "6px 10px",
              background: "#111",
              border: "1px solid var(--panel-border)",
              color: "#fff",
              fontSize: 12,
              borderRadius: 4,
            }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.label} value={tz.offset}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--panel-border)", paddingBottom: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab("single")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: activeTab === "single" ? "rgba(0, 119, 181, 0.2)" : "transparent",
            border: activeTab === "single" ? "1px solid #0077b5" : "1px solid transparent",
            color: activeTab === "single" ? "#70b5f9" : "var(--text-muted)",
            borderRadius: 4,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: activeTab === "single" ? "bold" : "normal",
          }}
        >
          <ClockIcon size={14} color={activeTab === "single" ? "#70b5f9" : "var(--text-muted)"} />
          Single Activity Timestamp Decoder
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: activeTab === "timeline" ? "rgba(0, 119, 181, 0.2)" : "transparent",
            border: activeTab === "timeline" ? "1px solid #0077b5" : "1px solid transparent",
            color: activeTab === "timeline" ? "#70b5f9" : "var(--text-muted)",
            borderRadius: 4,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: activeTab === "timeline" ? "bold" : "normal",
          }}
        >
          <LayersIcon size={14} color={activeTab === "timeline" ? "#70b5f9" : "var(--text-muted)"} />
          Chronological Timeline &amp; Active Hours
        </button>
      </div>

      {/* Tab 1: Single Activity Decoder */}
      {activeTab === "single" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form onSubmit={handleDecodeSingle} style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              placeholder="Paste LinkedIn post URL, activity URN, comment link, or numeric snowflake ID (e.g. 7240000000000000000)..."
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "#0d1117",
                border: "1px solid var(--panel-border)",
                color: "#fff",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              disabled={loadingSingle || !singleInput.trim()}
              style={{
                padding: "10px 18px",
                background: "#0077b5",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontWeight: "bold",
                fontSize: 13,
                cursor: loadingSingle ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <SearchIcon size={14} color="#fff" />
              {loadingSingle ? "Decompiling..." : "Extract Timestamp"}
            </button>
          </form>

          {singleError && (
            <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 13 }}>
              {singleError}
            </div>
          )}

          {singleResult && (
            <div
              style={{
                background: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#0077b5", fontWeight: "bold", letterSpacing: 0.5 }}>
                    Decoded Activity Timestamp
                  </div>
                  <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff", marginTop: 4 }}>
                    {singleResult.local_formatted}{" "}
                    <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: "normal" }}>
                      ({singleResult.timezone_label})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--cyan)", marginTop: 2 }}>
                    {singleResult.utc_formatted} &bull; {singleResult.day_of_week}{" "}
                    {singleResult.is_weekend ? "(Weekend Activity)" : "(Business Day)"}
                  </div>
                </div>

                <SaveToCaseButton
                  identifierType="url"
                  platform="linkedin.linkdtime"
                  discoveredBy="LinkdTime"
                  identifierValue={singleResult.source_url || singleResult.id}
                  metadata={{
                    activity_type: singleResult.activity_type,
                    author: singleResult.author_handle,
                    utc_timestamp: singleResult.utc_iso,
                    local_time: singleResult.local_formatted,
                    timezone: singleResult.timezone_label,
                    day_of_week: singleResult.day_of_week,
                    source_url: singleResult.source_url,
                  }}
                />

              </div>

              {/* Data Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                  background: "#0b0f14",
                  padding: 14,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Activity Type</div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginTop: 2 }}>
                    {singleResult.activity_type || "LinkedIn Post / Activity"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Detected Author</div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#70b5f9", marginTop: 2 }}>
                    {singleResult.author_handle || "Unknown / Not in URL"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Snowflake ID</div>
                  <code style={{ fontSize: 12, color: "var(--cyan)", marginTop: 2, display: "block" }}>
                    {singleResult.id}
                  </code>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Epoch Milliseconds</div>
                  <code style={{ fontSize: 12, color: "#fff", marginTop: 2, display: "block" }}>
                    {singleResult.epoch_ms}
                  </code>
                </div>
              </div>

              {/* Snowflake Bit Decompilation breakdown */}
              {singleResult.timestamp_bits && (
                <div style={{ background: "#06090e", padding: 12, borderRadius: 6, border: "1px solid rgba(0, 119, 181, 0.2)" }}>
                  <div style={{ fontSize: 11, color: "#70b5f9", fontWeight: "bold", marginBottom: 6 }}>
                    Snowflake Bit Architecture (Lucksi/LinkdTime Algorithm)
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    First 41 bits represent millisecond timestamp since 1970-01-01 00:00:00 UTC:
                  </div>
                  <code style={{ fontSize: 11, color: "var(--green)", wordBreak: "break-all", display: "block" }}>
                    {singleResult.timestamp_bits}
                    <span style={{ color: "var(--text-muted)" }}>
                      {singleResult.binary_snowflake?.slice(41)}
                    </span>
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Chronological Timeline & Active Hours */}
      {activeTab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form onSubmit={handleBuildTimeline} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Paste one LinkedIn link, URN, or Snowflake ID per line:
            </label>
            <textarea
              rows={5}
              placeholder={`https://www.linkedin.com/posts/satyanadella_ai-innovation-activity-7170000000000000000-abcd\nhttps://www.linkedin.com/feed/update/urn:li:activity:7235000000000000000/\n7240000000000000000`}
              value={timelineBatch}
              onChange={(e) => setTimelineBatch(e.target.value)}
              style={{
                padding: "10px 14px",
                background: "#0d1117",
                border: "1px solid var(--panel-border)",
                color: "#fff",
                borderRadius: 4,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={loadingTimeline || !timelineBatch.trim()}
                style={{
                  padding: "10px 18px",
                  background: "#0077b5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: "bold",
                  fontSize: 13,
                  cursor: loadingTimeline ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <LayersIcon size={14} color="#fff" />
                {loadingTimeline ? "Reconstructing Timeline..." : "Generate Activity Timeline"}
              </button>
            </div>
          </form>

          {timelineError && (
            <div style={{ padding: 12, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--red)", borderRadius: 4, color: "var(--red)", fontSize: 13 }}>
              {timelineError}
            </div>
          )}

          {timelineResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary Dossier */}
              <div
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Events</div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#fff" }}>
                      {timelineResult.total_parsed}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Peak Active Hour</div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--cyan)" }}>
                      {timelineResult.pattern_analysis.peak_hour_local !== null
                        ? `${timelineResult.pattern_analysis.peak_hour_local}:00 (${timelineResult.pattern_analysis.peak_hour_count} events)`
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Weekend Activity</div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: timelineResult.pattern_analysis.weekend_ratio_percent > 30 ? "var(--orange)" : "#fff" }}>
                      {timelineResult.pattern_analysis.weekend_ratio_percent}%
                    </div>
                  </div>
                </div>

                <SaveToCaseButton
                  identifierType="url"
                  platform="linkedin.linkdtime.timeline"
                  discoveredBy="LinkdTime"
                  identifierValue={`timeline-${Date.now()}`}
                  metadata={{
                    total_events: timelineResult.total_parsed,
                    peak_hour: timelineResult.pattern_analysis.peak_hour_local,
                    weekend_ratio: timelineResult.pattern_analysis.weekend_ratio_percent,
                    timezone_offset: timelineResult.timezone_offset,
                  }}
                />
              </div>

              {/* Chronological Event Stream */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                  <CalendarIcon size={14} color="#70b5f9" />
                  Chronological Activity Stream ({timelineResult.items.length} items)
                </div>

                {timelineResult.items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    style={{
                      background: "#0d1117",
                      border: "1px solid var(--panel-border)",
                      borderRadius: 6,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          background: "rgba(0, 119, 181, 0.2)",
                          color: "#70b5f9",
                          fontSize: 11,
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff" }}>
                          {item.local_formatted}
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                            ({item.timezone_label}) &bull; {item.day_of_week}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--cyan)", marginTop: 2 }}>
                          {item.activity_type} &bull; ID: <code>{item.id}</code>
                          {item.author_handle && <span> &bull; Author: @{item.author_handle}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.05)",
                          color: item.delta_from_previous === "Initial Reference Event" ? "var(--text-muted)" : "var(--green)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {item.delta_from_previous}
                      </span>

                      <SaveToCaseButton
                        identifierType="url"
                        platform="linkedin.linkdtime"
                        discoveredBy="LinkdTime"
                        identifierValue={item.source_url || item.id}
                        metadata={{
                          timestamp: item.local_formatted,
                          utc_iso: item.utc_iso,
                          type: item.activity_type,
                          author: item.author_handle,
                        }}
                      />
                    </div>
                  </div>
                ))}

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
