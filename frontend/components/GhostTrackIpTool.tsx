"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  GlobeIcon,
  ShieldIcon,
  RadarIcon,
  PinIcon,
  AlertIcon,
  LinkIcon,
  BoltIcon,
} from "@/components/FlatIcons";

export type GhostIpResult = {
  ip: string;
  is_valid: boolean;
  ip_type: string;
  continent: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  postal: string;
  latitude: number | null;
  longitude: number | null;
  maps_url: string;
  is_eu: boolean;
  calling_code: string;
  capital: string;
  borders?: string[];
  asn: string;
  org: string;
  isp: string;
  domain: string;
  timezone_id: string;
  timezone_abbr: string;
  utc_offset: string;
  current_time: string;
  error?: string | null;
};

export default function GhostTrackIpTool({ initialIp = "" }: { initialIp?: string }) {
  const { activeCase } = useActiveCase();
  const [ip, setIp] = useState(initialIp);
  const [useTor, setUseTor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GhostIpResult | null>(null);

  async function handleTrace() {
    const target = ip.trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiGet<GhostIpResult>(
        `/recon/ghosttrack/ip?ip=${encodeURIComponent(target)}&use_tor=${useTor}`
      );
      if (data.error || !data.is_valid) {
        setError(data.error || "Invalid IP address or intelligence query failed");
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error executing GhostTrack IP tracer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid var(--panel-border)", paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RadarIcon size={18} color="var(--cyan)" />
          <div>
            <h3 style={{ margin: 0, color: "var(--cyan)", fontSize: 16 }}>
              GhostTrack: IP Geolocation &amp; ASN Network Tracer
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Deep carrier ASN, routing infrastructure, geocoding &amp; timezone intelligence (HunxByts/GhostTrack).
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: useTor ? "var(--cyan)" : "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={useTor}
              onChange={(e) => setUseTor(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <ShieldIcon size={13} color={useTor ? "var(--cyan)" : "var(--text-muted)"} />
            Route via Tor SOCKS5 Proxy
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, maxWidth: 640, marginTop: 14 }}>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTrace()}
          placeholder="Enter IPv4 or IPv6 address (e.g. 8.8.8.8, 1.1.1.1)"
          style={{ flex: 1, padding: 8, fontFamily: "monospace", fontSize: 13 }}
        />
        <button
          onClick={handleTrace}
          disabled={loading || !ip.trim()}
          style={{
            fontWeight: "bold",
            padding: "8px 18px",
            minWidth: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {loading ? (
            "TRACING..."
          ) : (
            <>
              <RadarIcon size={13} /> TRACE IP
            </>
          )}
        </button>
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

      {result && result.is_valid && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header Summary Card */}
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(5, 217, 232, 0.06)",
              border: "1px solid rgba(5, 217, 232, 0.3)",
              borderRadius: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 15,
                  fontWeight: "bold",
                  color: "#fff",
                }}
              >
                {result.ip}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(0, 255, 159, 0.15)",
                  color: "#00ff9f",
                  border: "1px solid rgba(0, 255, 159, 0.4)",
                  fontWeight: "bold",
                }}
              >
                {result.ip_type || "IPv4"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {result.city ? `${result.city}, ` : ""}{result.region ? `${result.region}, ` : ""}{result.country} ({result.country_code})
              </span>
              {result.is_eu && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 5px",
                    background: "rgba(0, 153, 255, 0.2)",
                    color: "#66b3ff",
                    border: "1px solid rgba(0, 153, 255, 0.5)",
                    borderRadius: 2,
                  }}
                >
                  EU MEMBER
                </span>
              )}
            </div>

            <SaveToCaseButton
              identifierType="domain"
              identifierValue={result.ip}
              platform="ghosttrack.ip"
              url={result.maps_url || undefined}
              discoveredBy="GhostTrack"
              metadata={{
                ip: result.ip,
                asn: result.asn,
                isp: result.isp,
                org: result.org,
                country: result.country,
                city: result.city,
                latitude: result.latitude,
                longitude: result.longitude,
                timezone: result.timezone_id,
              }}
            />
          </div>

          {/* 3 Detail Columns / Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {/* 1. Geolocation & Physical Location */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
                  <PinIcon size={14} color="var(--cyan)" /> GEOLOCATION
                </span>
                {result.maps_url && (
                  <a
                    href={result.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <LinkIcon size={11} /> Open Map
                  </a>
                )}
              </div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0", width: 90 }}>Country:</td>
                    <td style={{ color: "#fff" }}>{result.country} ({result.country_code})</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Region:</td>
                    <td style={{ color: "#fff" }}>{result.region || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>City:</td>
                    <td style={{ color: "#fff" }}>{result.city || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Postal:</td>
                    <td style={{ color: "#fff" }}>{result.postal || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Coordinates:</td>
                    <td style={{ color: "#00ff9f", fontFamily: "monospace" }}>
                      {result.latitude !== null && result.longitude !== null
                        ? `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`
                        : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Capital:</td>
                    <td style={{ color: "#fff" }}>{result.capital || "—"}</td>
                  </tr>
                  {result.borders && result.borders.length > 0 && (
                    <tr>
                      <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Borders:</td>
                      <td style={{ color: "#fff" }}>{result.borders.join(", ")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 2. ASN & Network Routing */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
                  <BoltIcon size={14} color="var(--cyan)" /> ROUTING &amp; ASN
                </span>
                <SaveToCaseButton
                  identifierType="corporate"
                  identifierValue={result.asn || result.isp || result.ip}
                  platform="ghosttrack.asn"
                  discoveredBy="GhostTrack"
                  metadata={{
                    ip: result.ip,
                    asn: result.asn,
                    isp: result.isp,
                    org: result.org,
                  }}
                />
              </div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0", width: 90 }}>ASN:</td>
                    <td style={{ color: "#00ff9f", fontFamily: "monospace", fontWeight: "bold" }}>
                      {result.asn || "—"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>ISP:</td>
                    <td style={{ color: "#fff" }}>{result.isp || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Organization:</td>
                    <td style={{ color: "#fff" }}>{result.org || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Host Domain:</td>
                    <td style={{ color: "#fff", fontFamily: "monospace" }}>{result.domain || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Calling Code:</td>
                    <td style={{ color: "#fff" }}>{result.calling_code ? `+${result.calling_code}` : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 3. Timezone & Temporal Context */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
                  <GlobeIcon size={14} color="var(--cyan)" /> TIMEZONE &amp; CLOCK
                </span>
              </div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0", width: 100 }}>Zone ID:</td>
                    <td style={{ color: "#fff" }}>{result.timezone_id || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Abbreviation:</td>
                    <td style={{ color: "#fff" }}>{result.timezone_abbr || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>UTC Offset:</td>
                    <td style={{ color: "#00ff9f", fontFamily: "monospace" }}>{result.utc_offset || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Current Time:</td>
                    <td style={{ color: "var(--cyan)", fontWeight: "bold", fontFamily: "monospace" }}>
                      {result.current_time || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
