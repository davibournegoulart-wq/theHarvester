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
  PhoneIcon,
  UserIcon,
  CheckIcon,
  CrossIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
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

export type GhostEgressIp = {
  ip: string;
  is_tor: boolean;
  isp: string;
  org: string;
  country: string;
  city: string;
  error?: string | null;
};

export type GhostPhoneResult = {
  raw_input: string;
  is_valid: boolean;
  is_possible: boolean;
  carrier: string;
  location: string;
  timezones: string[];
  international_format: string;
  e164_format: string;
  national_number: string;
  country_code: number;
  region_code: string;
  line_type: string;
  error?: string | null;
};

export type GhostUsernameItem = {
  platform: string;
  url: string;
  status: "FOUND" | "NOT_FOUND" | "ERROR";
  http_status?: number | null;
  error?: string | null;
};

export type GhostUsernameResponse = {
  username: string;
  total_sites: number;
  found_count: number;
  results: GhostUsernameItem[];
};

type GhostTab = "ip" | "my_ip" | "phone" | "username";

export default function GhostTrackSuite({
  initialTab = "ip",
  initialIp = "",
  initialPhone = "",
  initialUsername = "",
}: {
  initialTab?: GhostTab;
  initialIp?: string;
  initialPhone?: string;
  initialUsername?: string;
}) {
  const { activeCase } = useActiveCase();
  const [currentTab, setCurrentTab] = useState<GhostTab>(initialTab);

  // Common Tor option
  const [useTor, setUseTor] = useState(false);

  // 1. IP Tracker State
  const [ip, setIp] = useState(initialIp);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);
  const [ipResult, setIpResult] = useState<GhostIpResult | null>(null);

  // 2. Show Your IP (Egress) State
  const [egressLoading, setEgressLoading] = useState(false);
  const [egressError, setEgressError] = useState<string | null>(null);
  const [egressResult, setEgressResult] = useState<GhostEgressIp | null>(null);

  // 3. Phone Tracker State
  const [phone, setPhone] = useState(initialPhone);
  const [phoneRegion, setPhoneRegion] = useState("US");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneResult, setPhoneResult] = useState<GhostPhoneResult | null>(null);

  // 4. Username Tracker State
  const [username, setUsername] = useState(initialUsername);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userResult, setUserResult] = useState<GhostUsernameResponse | null>(null);

  // --- Handlers ---
  async function handleTraceIp() {
    const target = ip.trim();
    if (!target) return;
    setIpLoading(true);
    setIpError(null);
    setIpResult(null);

    try {
      const data = await apiGet<GhostIpResult>(
        `/recon/ghosttrack/ip?ip=${encodeURIComponent(target)}&use_tor=${useTor}`
      );
      if (data.error || !data.is_valid) {
        setIpError(data.error || "Invalid IP address or network query failed");
      }
      setIpResult(data);
    } catch (e) {
      setIpError(e instanceof Error ? e.message : "Error running GhostTrack IP trace");
    } finally {
      setIpLoading(false);
    }
  }

  async function handleCheckMyIp() {
    setEgressLoading(true);
    setEgressError(null);

    try {
      const data = await apiGet<GhostEgressIp>(
        `/recon/ghosttrack/my-ip?use_tor=${useTor}`
      );
      if (data.error || !data.ip) {
        setEgressError(data.error || "Failed to resolve active egress IP");
      }
      setEgressResult(data);
    } catch (e) {
      setEgressError(e instanceof Error ? e.message : "Error querying egress IP");
    } finally {
      setEgressLoading(false);
    }
  }

  async function handleTracePhone() {
    const target = phone.trim();
    if (!target) return;
    setPhoneLoading(true);
    setPhoneError(null);
    setPhoneResult(null);

    try {
      const data = await apiGet<GhostPhoneResult>(
        `/recon/ghosttrack/phone?phone=${encodeURIComponent(target)}&default_region=${phoneRegion}`
      );
      if (data.error || !data.is_valid) {
        setPhoneError(data.error || "Phone number appears invalid or cannot be parsed");
      }
      setPhoneResult(data);
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Error executing Phone Tracker");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleTraceUsername() {
    const target = username.trim().replace(/^@/, "");
    if (!target) return;
    setUserLoading(true);
    setUserError(null);
    setUserResult(null);

    try {
      const data = await apiGet<GhostUsernameResponse>(
        `/recon/ghosttrack/username?username=${encodeURIComponent(target)}&use_tor=${useTor}`
      );
      setUserResult(data);
    } catch (e) {
      setUserError(e instanceof Error ? e.message : "Error running GhostTrack Username scanner");
    } finally {
      setUserLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* Top Banner / ASCII Brand Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 16,
          borderBottom: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              background: "rgba(5, 217, 232, 0.12)",
              border: "1px solid var(--cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RadarIcon size={22} color="var(--cyan)" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0, color: "var(--cyan)", fontSize: 17, letterSpacing: "0.5px" }}>
                GhostTrack OSINT Suite
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
                HunxByts/GhostTrack
              </span>
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              All-in-one Network IP, Public Egress Verification, Telecom Carrier &amp; Fast Username Footprint Tracker.
            </p>
          </div>
        </div>

        {/* Tor Proxy Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
              background: useTor ? "rgba(5, 217, 232, 0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${useTor ? "var(--cyan)" : "var(--border)"}`,
              color: useTor ? "var(--cyan)" : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
          >
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

      {/* 4 Tool Option Navigation Tabs (Matching GhostTrack CLI Menu) */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 14,
          borderBottom: "1px solid var(--panel-border)",
          paddingBottom: 10,
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setCurrentTab("ip")}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: currentTab === "ip" ? "bold" : "normal",
            background: currentTab === "ip" ? "var(--cyan)" : "rgba(255, 255, 255, 0.05)",
            color: currentTab === "ip" ? "#000" : "var(--text)",
            border: `1px solid ${currentTab === "ip" ? "var(--cyan)" : "var(--border)"}`,
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <GlobeIcon size={14} color={currentTab === "ip" ? "#000" : "currentColor"} />
          [ 1 ] IP Tracker
        </button>

        <button
          onClick={() => {
            setCurrentTab("my_ip");
            if (!egressResult && !egressLoading) {
              handleCheckMyIp();
            }
          }}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: currentTab === "my_ip" ? "bold" : "normal",
            background: currentTab === "my_ip" ? "var(--cyan)" : "rgba(255, 255, 255, 0.05)",
            color: currentTab === "my_ip" ? "#000" : "var(--text)",
            border: `1px solid ${currentTab === "my_ip" ? "var(--cyan)" : "var(--border)"}`,
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ShieldIcon size={14} color={currentTab === "my_ip" ? "#000" : "currentColor"} />
          [ 2 ] Show Your IP
        </button>

        <button
          onClick={() => setCurrentTab("phone")}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: currentTab === "phone" ? "bold" : "normal",
            background: currentTab === "phone" ? "var(--cyan)" : "rgba(255, 255, 255, 0.05)",
            color: currentTab === "phone" ? "#000" : "var(--text)",
            border: `1px solid ${currentTab === "phone" ? "var(--cyan)" : "var(--border)"}`,
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <PhoneIcon size={14} color={currentTab === "phone" ? "#000" : "currentColor"} />
          [ 3 ] Phone Tracker
        </button>

        <button
          onClick={() => setCurrentTab("username")}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: currentTab === "username" ? "bold" : "normal",
            background: currentTab === "username" ? "var(--cyan)" : "rgba(255, 255, 255, 0.05)",
            color: currentTab === "username" ? "#000" : "var(--text)",
            border: `1px solid ${currentTab === "username" ? "var(--cyan)" : "var(--border)"}`,
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <UserIcon size={14} color={currentTab === "username" ? "#000" : "currentColor"} />
          [ 4 ] Username Tracker (TrackLu)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: IP TRACKER */}
      {/* ========================================================================= */}
      {currentTab === "ip" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, maxWidth: 640 }}>
            <input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTraceIp()}
              placeholder="Enter IPv4 or IPv6 address (e.g. 8.8.8.8, 1.1.1.1, 142.250.190.46)"
              style={{ flex: 1, padding: 8, fontFamily: "monospace", fontSize: 13 }}
            />
            <button
              onClick={handleTraceIp}
              disabled={ipLoading || !ip.trim()}
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
              {ipLoading ? "TRACING..." : <><RadarIcon size={13} /> TRACE IP</>}
            </button>
          </div>

          {ipError && (
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
              {ipError}
            </div>
          )}

          {ipResult && ipResult.is_valid && (
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
                    {ipResult.ip}
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
                    {ipResult.ip_type || "IPv4"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {ipResult.city ? `${ipResult.city}, ` : ""}{ipResult.region ? `${ipResult.region}, ` : ""}{ipResult.country} ({ipResult.country_code})
                  </span>
                  {ipResult.is_eu && (
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
                  identifierValue={ipResult.ip}
                  platform="ghosttrack.ip"
                  url={ipResult.maps_url || undefined}
                  discoveredBy="GhostTrack"
                  metadata={{
                    ip: ipResult.ip,
                    asn: ipResult.asn,
                    isp: ipResult.isp,
                    org: ipResult.org,
                    country: ipResult.country,
                    city: ipResult.city,
                    latitude: ipResult.latitude,
                    longitude: ipResult.longitude,
                    timezone: ipResult.timezone_id,
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
                    {ipResult.maps_url && (
                      <a
                        href={ipResult.maps_url}
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
                        <td style={{ color: "#fff" }}>{ipResult.country} ({ipResult.country_code})</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Region:</td>
                        <td style={{ color: "#fff" }}>{ipResult.region || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>City:</td>
                        <td style={{ color: "#fff" }}>{ipResult.city || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Postal:</td>
                        <td style={{ color: "#fff" }}>{ipResult.postal || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Coordinates:</td>
                        <td style={{ color: "#00ff9f", fontFamily: "monospace" }}>
                          {ipResult.latitude !== null && ipResult.longitude !== null
                            ? `${ipResult.latitude.toFixed(4)}, ${ipResult.longitude.toFixed(4)}`
                            : "—"}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Capital:</td>
                        <td style={{ color: "#fff" }}>{ipResult.capital || "—"}</td>
                      </tr>
                      {ipResult.borders && ipResult.borders.length > 0 && (
                        <tr>
                          <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Borders:</td>
                          <td style={{ color: "#fff" }}>{ipResult.borders.join(", ")}</td>
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
                      identifierValue={ipResult.asn || ipResult.isp || ipResult.ip}
                      platform="ghosttrack.asn"
                      discoveredBy="GhostTrack"
                      metadata={{
                        ip: ipResult.ip,
                        asn: ipResult.asn,
                        isp: ipResult.isp,
                        org: ipResult.org,
                      }}
                    />
                  </div>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0", width: 90 }}>ASN:</td>
                        <td style={{ color: "#00ff9f", fontFamily: "monospace", fontWeight: "bold" }}>
                          {ipResult.asn || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>ISP:</td>
                        <td style={{ color: "#fff" }}>{ipResult.isp || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Organization:</td>
                        <td style={{ color: "#fff" }}>{ipResult.org || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Host Domain:</td>
                        <td style={{ color: "#fff", fontFamily: "monospace" }}>{ipResult.domain || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Calling Code:</td>
                        <td style={{ color: "#fff" }}>{ipResult.calling_code ? `+${ipResult.calling_code}` : "—"}</td>
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
                        <td style={{ color: "#fff" }}>{ipResult.timezone_id || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Abbreviation:</td>
                        <td style={{ color: "#fff" }}>{ipResult.timezone_abbr || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>UTC Offset:</td>
                        <td style={{ color: "#00ff9f", fontFamily: "monospace" }}>{ipResult.utc_offset || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Current Time:</td>
                        <td style={{ color: "var(--cyan)", fontWeight: "bold", fontFamily: "monospace" }}>
                          {ipResult.current_time || "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHOW YOUR IP (EGRESS / OPSEC CHECK) */}
      {/* ========================================================================= */}
      {currentTab === "my_ip" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button
              onClick={handleCheckMyIp}
              disabled={egressLoading}
              style={{
                fontWeight: "bold",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {egressLoading ? <RefreshCwIcon size={13} /> : <ShieldIcon size={13} />}
              {egressLoading ? "DETECTING EGRESS..." : "CHECK ACTIVE EGRESS IP"}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Verify public egress IP and Tor proxy status before conducting OSINT investigations.
            </span>
          </div>

          {egressError && (
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
              {egressError}
            </div>
          )}

          {egressResult && (
            <div
              style={{
                marginTop: 12,
                padding: 16,
                background: egressResult.is_tor ? "rgba(0, 255, 159, 0.05)" : "rgba(5, 217, 232, 0.05)",
                border: `1px solid ${egressResult.is_tor ? "#00ff9f" : "var(--cyan)"}`,
                borderRadius: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Public Outbound Egress IP
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      color: egressResult.is_tor ? "#00ff9f" : "var(--cyan)",
                      marginTop: 4,
                    }}
                  >
                    {egressResult.ip || "Unknown"}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: egressResult.is_tor ? "rgba(0, 255, 159, 0.2)" : "rgba(255, 170, 0, 0.15)",
                      color: egressResult.is_tor ? "#00ff9f" : "#ffaa00",
                      border: `1px solid ${egressResult.is_tor ? "#00ff9f" : "#ffaa00"}`,
                    }}
                  >
                    <ShieldIcon size={14} />
                    {egressResult.is_tor ? "ROUTED VIA TOR NETWORK" : "CLEARNET / DIRECT CONNECTION"}
                  </span>

                  <button
                    onClick={() => {
                      setIp(egressResult.ip);
                      setCurrentTab("ip");
                      handleTraceIp();
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid var(--border)",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RadarIcon size={12} /> Pivot to IP Trace
                  </button>
                </div>
              </div>

              {(egressResult.isp || egressResult.country) && (
                <div style={{ marginTop: 14, display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>ISP / Provider: </span>
                    <strong style={{ color: "#fff" }}>{egressResult.isp || egressResult.org || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Location: </span>
                    <strong style={{ color: "#fff" }}>
                      {egressResult.city ? `${egressResult.city}, ` : ""}{egressResult.country || "—"}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PHONE TRACKER */}
      {/* ========================================================================= */}
      {currentTab === "phone" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, maxWidth: 640 }}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTracePhone()}
              placeholder="Enter phone with country code (e.g. +14155552671, +5511999999999)"
              style={{ flex: 1, padding: 8, fontFamily: "monospace", fontSize: 13 }}
            />
            <select
              value={phoneRegion}
              onChange={(e) => setPhoneRegion(e.target.value)}
              style={{
                width: 75,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "0 6px",
                fontSize: 12,
              }}
            >
              <option value="US">US</option>
              <option value="BR">BR</option>
              <option value="GB">GB</option>
              <option value="ID">ID</option>
              <option value="DE">DE</option>
              <option value="FR">FR</option>
            </select>
            <button
              onClick={handleTracePhone}
              disabled={phoneLoading || !phone.trim()}
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
              {phoneLoading ? "PARSING..." : <><PhoneIcon size={13} /> PARSE PHONE</>}
            </button>
          </div>

          {phoneError && (
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
              {phoneError}
            </div>
          )}

          {phoneResult && (
            <div style={{ marginTop: 16 }}>
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
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: "bold", color: "#fff" }}>
                    {phoneResult.international_format || phoneResult.raw_input}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 3,
                      background: phoneResult.is_valid ? "rgba(0, 255, 159, 0.15)" : "rgba(255, 0, 85, 0.15)",
                      color: phoneResult.is_valid ? "#00ff9f" : "#ff7799",
                      border: `1px solid ${phoneResult.is_valid ? "rgba(0, 255, 159, 0.4)" : "#ff0055"}`,
                      fontWeight: "bold",
                    }}
                  >
                    {phoneResult.is_valid ? "VALID TELECOM NUMBER" : "POSSIBLY INVALID"}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 3,
                      background: "rgba(0, 153, 255, 0.15)",
                      color: "#66b3ff",
                      border: "1px solid rgba(0, 153, 255, 0.4)",
                    }}
                  >
                    {phoneResult.line_type || "UNKNOWN"}
                  </span>
                </div>

                <SaveToCaseButton
                  identifierType="phone"
                  identifierValue={phoneResult.e164_format || phoneResult.raw_input}
                  platform="ghosttrack.phone"
                  discoveredBy="GhostTrack"
                  metadata={{
                    raw_input: phoneResult.raw_input,
                    carrier: phoneResult.carrier,
                    location: phoneResult.location,
                    timezones: phoneResult.timezones,
                    line_type: phoneResult.line_type,
                    e164: phoneResult.e164_format,
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 12,
                }}
              >
                {/* Telecom Carrier & Line */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: 14,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <BoltIcon size={14} color="var(--cyan)" /> CARRIER &amp; LINE TYPE
                  </span>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0", width: 100 }}>Carrier Provider:</td>
                        <td style={{ color: "#00ff9f", fontWeight: "bold" }}>{phoneResult.carrier || "Not Registered / Ported"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Line Type:</td>
                        <td style={{ color: "#fff" }}>{phoneResult.line_type}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Region / Country:</td>
                        <td style={{ color: "#fff" }}>{phoneResult.region_code} (+{phoneResult.country_code})</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Geocoded Area:</td>
                        <td style={{ color: "#fff" }}>{phoneResult.location || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Formats & Timezones */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: 14,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <GlobeIcon size={14} color="var(--cyan)" /> STANDARDS &amp; TIMEZONES
                  </span>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0", width: 100 }}>E.164 Format:</td>
                        <td style={{ color: "#fff", fontFamily: "monospace" }}>{phoneResult.e164_format || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>National:</td>
                        <td style={{ color: "#fff", fontFamily: "monospace" }}>{phoneResult.national_number || "—"}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)", padding: "3px 0" }}>Timezones:</td>
                        <td style={{ color: "#fff" }}>
                          {phoneResult.timezones && phoneResult.timezones.length > 0
                            ? phoneResult.timezones.join(", ")
                            : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: USERNAME TRACKER (TrackLu - 24 Platforms) */}
      {/* ========================================================================= */}
      {currentTab === "username" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, maxWidth: 640 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTraceUsername()}
              placeholder="Enter username (e.g. torvalds, elonmusk, satoshi)"
              style={{ flex: 1, padding: 8, fontFamily: "monospace", fontSize: 13 }}
            />
            <button
              onClick={handleTraceUsername}
              disabled={userLoading || !username.trim()}
              style={{
                fontWeight: "bold",
                padding: "8px 18px",
                minWidth: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {userLoading ? "SCANNING 24 SITES..." : <><UserIcon size={13} /> SCAN USERNAME</>}
            </button>
          </div>

          {userError && (
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
              {userError}
            </div>
          )}

          {userResult && (
            <div style={{ marginTop: 16 }}>
              {/* Summary Bar */}
              <div
                style={{
                  padding: "10px 16px",
                  background: "rgba(5, 217, 232, 0.06)",
                  border: "1px solid rgba(5, 217, 232, 0.3)",
                  borderRadius: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>
                    @{userResult.username}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 3,
                      background: "rgba(0, 255, 159, 0.15)",
                      color: "#00ff9f",
                      border: "1px solid rgba(0, 255, 159, 0.4)",
                      fontWeight: "bold",
                    }}
                  >
                    {userResult.found_count} FOUND / {userResult.total_sites} SCANNED
                  </span>
                </div>

                <SaveToCaseButton
                  identifierType="username"
                  identifierValue={userResult.username}
                  platform="ghosttrack.username"
                  discoveredBy="GhostTrack"
                  metadata={{
                    username: userResult.username,
                    found_count: userResult.found_count,
                    found_platforms: userResult.results.filter((r) => r.status === "FOUND").map((r) => r.platform),
                  }}
                />
              </div>

              {/* Grid of Results */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                {userResult.results.map((item) => {
                  const isFound = item.status === "FOUND";
                  return (
                    <div
                      key={item.platform}
                      style={{
                        padding: "10px 12px",
                        background: isFound ? "rgba(0, 255, 159, 0.04)" : "var(--surface)",
                        border: `1px solid ${isFound ? "rgba(0, 255, 159, 0.3)" : "var(--border)"}`,
                        borderRadius: 4,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: 13, color: isFound ? "#00ff9f" : "var(--text)" }}>
                          {item.platform}
                        </strong>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 3,
                            fontWeight: "bold",
                            background: isFound
                              ? "rgba(0, 255, 159, 0.2)"
                              : "rgba(255, 255, 255, 0.05)",
                            color: isFound ? "#00ff9f" : "var(--text-muted)",
                            border: `1px solid ${isFound ? "rgba(0, 255, 159, 0.4)" : "transparent"}`,
                          }}
                        >
                          {item.status}
                        </span>
                      </div>

                      {isFound ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: "var(--cyan)",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <ExternalLinkIcon size={11} /> Open Profile
                          </a>
                          <SaveToCaseButton
                            identifierType="username"
                            identifierValue={userResult.username}
                            platform={item.platform.toLowerCase()}
                            url={item.url}
                            discoveredBy="GhostTrack"
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                          No claimed account detected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
