"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  ShieldIcon,
  TerminalIcon,
  KeyIcon,
  BuildingIcon,
  GlobeIcon,
  RadarIcon,
  PinIcon,
  CheckIcon,
  AlertIcon,
  RefreshCwIcon,
  FolderIcon,
  DatabaseIcon,
  LinkIcon,
} from "@/components/FlatIcons";

type HorusTab = "mac" | "bin" | "wifi" | "vt" | "loki";

type MacVendorResult = {
  mac: string;
  mac_dash: string;
  mac_raw: string;
  oui_prefix: string;
  vendor: string;
  country: string;
  address: string;
  device_type: string;
  transmission: string;
  administration: string;
  is_randomized: boolean;
  discovered_by: string;
  queried_at: string;
};

type BankBinResult = {
  bin: string;
  scheme: string;
  type: string;
  brand: string;
  bank: string;
  country: string;
  country_code: string;
  currency: string;
  prepaid: boolean;
  source: string;
  queried_at: string;
};

type WifiBssidResult = {
  bssid: string;
  found: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  ssid_name: string | null;
  channel: number | null;
  encryption: string | null;
  address: string;
  provider: string;
  queried_at: string;
};

type ThreatIntelResult = {
  target: string;
  target_type: string;
  reputation: string;
  malicious_count: number;
  suspicious_count: number;
  harmless_count: number;
  total_engines: number;
  risk_level: string;
  tags: string[];
  verdict_details: Array<{ engine: string; category: string; result: string }>;
  provider: string;
  queried_at: string;
};

const MAC_PRESETS = [
  { label: "Raspberry Pi 4", mac: "B8:27:EB:4A:12:34" },
  { label: "Apple AirPort", mac: "00:25:00:88:99:AA" },
  { label: "Cisco Catalyst", mac: "00:00:0C:44:55:66" },
  { label: "Espressif IoT", mac: "24:0A:C4:11:22:33" },
  { label: "Ubiquiti UniFi", mac: "74:AC:5F:AA:BB:CC" },
];

const BIN_PRESETS = [
  { label: "Visa Signature (Chase)", bin: "414720" },
  { label: "Mastercard Black (Nubank)", bin: "524188" },
  { label: "Amex Centurion (US)", bin: "378282" },
  { label: "Mastercard Plat (HSBC)", bin: "541275" },
  { label: "Elo Nanquim (Bradesco)", bin: "636368" },
];

const BSSID_PRESETS = [
  { label: "Google HQ AP", bssid: "00:14:6C:7E:40:80" },
  { label: "Public City AP", bssid: "24:DE:C6:A1:B2:C3" },
  { label: "Starbucks Wi-Fi", bssid: "00:1E:58:33:44:55" },
];

const THREAT_PRESETS = [
  { label: "Google DNS (Clean)", target: "8.8.8.8" },
  { label: "Mozi Botnet Hash", target: "d5c90b6a70e7e1f42d2a452ef349386c" },
  { label: "Suspicious Host", target: "185.220.101.5" },
];

export default function HorusSuite() {
  const { activeCase } = useActiveCase();
  const [activeTab, setActiveTab] = useState<HorusTab>("mac");

  // 1. MAC state
  const [macInput, setMacInput] = useState("B8:27:EB:4A:12:34");
  const [macLoading, setMacLoading] = useState(false);
  const [macResult, setMacResult] = useState<MacVendorResult | null>(null);
  const [macError, setMacError] = useState<string | null>(null);

  // 2. BIN state
  const [binInput, setBinInput] = useState("414720");
  const [binLoading, setBinLoading] = useState(false);
  const [binResult, setBinResult] = useState<BankBinResult | null>(null);
  const [binError, setBinError] = useState<string | null>(null);

  // 3. Wi-Fi BSSID state
  const [bssidInput, setBssidInput] = useState("00:14:6C:7E:40:80");
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiResult, setWifiResult] = useState<WifiBssidResult | null>(null);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [pinningWifi, setPinningWifi] = useState(false);
  const [pinnedSuccess, setPinnedSuccess] = useState(false);

  // 4. Threat Intel state
  const [threatInput, setThreatInput] = useState("8.8.8.8");
  const [threatLoading, setThreatLoading] = useState(false);
  const [threatResult, setThreatResult] = useState<ThreatIntelResult | null>(null);
  const [threatError, setThreatError] = useState<string | null>(null);

  // 5. Loki Vault state
  const [lokiKey, setLokiKey] = useState("");
  const [lokiPlaintext, setLokiPlaintext] = useState("SUSPECT_CRYPTO_SEED: abandon amount liar evoke buyer island track...");
  const [lokiCiphertext, setLokiCiphertext] = useState("");
  const [lokiStatus, setLokiStatus] = useState<string | null>(null);
  const [lokiError, setLokiError] = useState<string | null>(null);

  // MAC Handler
  async function handleSearchMac() {
    if (!macInput.trim()) return;
    setMacLoading(true);
    setMacError(null);
    try {
      const data = await apiGet<MacVendorResult>(`/recon/horus/mac?mac=${encodeURIComponent(macInput.trim())}`);
      setMacResult(data);
    } catch (e) {
      setMacError(e instanceof Error ? e.message : "Error querying MAC vendor");
    } finally {
      setMacLoading(false);
    }
  }

  // BIN Handler
  async function handleSearchBin() {
    if (!binInput.trim()) return;
    setBinLoading(true);
    setBinError(null);
    try {
      const data = await apiGet<BankBinResult>(`/recon/horus/bin?bin=${encodeURIComponent(binInput.trim())}`);
      setBinResult(data);
    } catch (e) {
      setBinError(e instanceof Error ? e.message : "Error querying BIN router");
    } finally {
      setBinLoading(false);
    }
  }

  // Wi-Fi BSSID Handler
  async function handleSearchWifi() {
    if (!bssidInput.trim()) return;
    setWifiLoading(true);
    setWifiError(null);
    setPinnedSuccess(false);
    try {
      const data = await apiGet<WifiBssidResult>(`/recon/horus/wifi?bssid=${encodeURIComponent(bssidInput.trim())}`);
      setWifiResult(data);
    } catch (e) {
      setWifiError(e instanceof Error ? e.message : "Error triangulating Wi-Fi BSSID");
    } finally {
      setWifiLoading(false);
    }
  }

  // Pin Wi-Fi Access Point to Active Case Map
  async function handlePinWifiToMap() {
    if (!activeCase || !wifiResult || !wifiResult.latitude || !wifiResult.longitude) return;
    setPinningWifi(true);
    try {
      await apiPostJson(`/cases/${activeCase.id}/locations`, {
        label: `Wi-Fi AP: ${wifiResult.ssid_name || wifiResult.bssid}`,
        latitude: wifiResult.latitude,
        longitude: wifiResult.longitude,
        source: "horus.wigle",
        notes: `BSSID: ${wifiResult.bssid} | Provider: ${wifiResult.provider} | Address: ${wifiResult.address}`,
      });
      setPinnedSuccess(true);
      setTimeout(() => setPinnedSuccess(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setPinningWifi(false);
    }
  }

  // Threat Intel Handler
  async function handleSearchThreat() {
    if (!threatInput.trim()) return;
    setThreatLoading(true);
    setThreatError(null);
    try {
      const data = await apiPostJson<ThreatIntelResult>("/recon/horus/vt", {
        target: threatInput.trim(),
      });
      setThreatResult(data);
    } catch (e) {
      setThreatError(e instanceof Error ? e.message : "Error running threat intelligence scan");
    } finally {
      setThreatLoading(false);
    }
  }

  // Loki Cryptographic Handlers
  async function handleLokiKeygen() {
    setLokiError(null);
    setLokiStatus("Generating AES-128-CBC + HMAC-SHA256 Fernet key...");
    try {
      const res = await apiPostJson<{ action: string; key: string }>("/recon/horus/loki", {
        action: "keygen",
      });
      setLokiKey(res.key);
      setLokiStatus("New cryptographic key generated successfully.");
    } catch (e) {
      setLokiError(e instanceof Error ? e.message : "Failed to generate key");
    }
  }

  async function handleLokiEncrypt() {
    if (!lokiKey.trim()) {
      setLokiError("Encryption key is required. Generate or paste a key first.");
      return;
    }
    setLokiError(null);
    setLokiStatus("Encrypting confidential payload...");
    try {
      const res = await apiPostJson<{ action: string; ciphertext: string }>("/recon/horus/loki", {
        action: "encrypt",
        key: lokiKey.trim(),
        data: lokiPlaintext,
      });
      setLokiCiphertext(res.ciphertext);
      setLokiStatus("Payload encrypted into tamper-proof Fernet vault.");
    } catch (e) {
      setLokiError(e instanceof Error ? e.message : "Failed to encrypt payload");
    }
  }

  async function handleLokiDecrypt() {
    if (!lokiKey.trim()) {
      setLokiError("Decryption key is required.");
      return;
    }
    if (!lokiCiphertext.trim()) {
      setLokiError("Ciphertext payload is required to decrypt.");
      return;
    }
    setLokiError(null);
    setLokiStatus("Decrypting cipher from vault...");
    try {
      const res = await apiPostJson<{ action: string; plaintext: string }>("/recon/horus/loki", {
        action: "decrypt",
        key: lokiKey.trim(),
        data: lokiCiphertext.trim(),
      });
      setLokiPlaintext(res.plaintext);
      setLokiStatus("Cipher decrypted successfully!");
    } catch (e) {
      setLokiError(e instanceof Error ? e.message : "Decryption failed (Invalid key or altered cipher)");
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid rgba(5, 217, 232, 0.35)",
        borderRadius: 6,
        padding: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
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
          marginBottom: 16,
          borderBottom: "1px solid rgba(5, 217, 232, 0.2)",
          paddingBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldIcon size={20} color="var(--cyan)" />
            <h3 style={{ margin: 0, color: "var(--cyan)", letterSpacing: "0.08em", fontSize: 16 }}>
              PROJECT HORUS: DIGITAL FORENSICS &amp; OSINT SUITE
            </h3>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(5, 217, 232, 0.15)",
                color: "var(--cyan)",
                border: "1px solid rgba(5, 217, 232, 0.3)",
                fontFamily: "monospace",
              }}
            >
              6abd/horus
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "6px 0 0 0", maxWidth: 900 }}>
            Unified digital forensics toolkit integrating hardware MAC OUI vendor tracing, financial BIN/IIN routing index,
            Wi-Fi BSSID access point triangulation, multi-source threat intelligence, and the Loki cryptographic evidence vault.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 8,
          flexWrap: "wrap",
        }}
      >
        {[
          { id: "mac", label: "MAC OUI TRACE (mactrace)", icon: <TerminalIcon size={13} /> },
          { id: "bin", label: "BANK BIN INDEX (bankindex)", icon: <BuildingIcon size={13} /> },
          { id: "wifi", label: "WIFI BSSID GEO (wigle)", icon: <RadarIcon size={13} /> },
          { id: "vt", label: "THREAT INTEL SCAN (vt)", icon: <AlertIcon size={13} /> },
          { id: "loki", label: "LOKI EVIDENCE VAULT (loki)", icon: <KeyIcon size={13} /> },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as HorusTab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 4,
                border: active ? "1px solid var(--cyan)" : "1px solid transparent",
                background: active ? "rgba(5, 217, 232, 0.15)" : "transparent",
                color: active ? "var(--cyan)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: MAC OUI TRACE */}
      {activeTab === "mac" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Hardware Presets:</span>
            {MAC_PRESETS.map((p) => (
              <button
                key={p.mac}
                onClick={() => setMacInput(p.mac)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: macInput === p.mac ? "1px solid var(--cyan)" : "1px solid var(--border)",
                  background: macInput === p.mac ? "rgba(5, 217, 232, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: macInput === p.mac ? "var(--cyan)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={macInput}
              onChange={(e) => setMacInput(e.target.value)}
              placeholder="e.g. B8:27:EB:4A:12:34 or B827EB4A1234"
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "monospace",
                background: "rgba(10, 12, 18, 0.8)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "#fff",
              }}
            />
            <button
              onClick={handleSearchMac}
              disabled={macLoading}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                background: "rgba(5, 217, 232, 0.15)",
                color: "var(--cyan)",
                border: "1px solid var(--cyan)",
                borderRadius: 4,
                fontWeight: "bold",
                cursor: macLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {macLoading ? <RefreshCwIcon size={12} color="var(--cyan)" /> : <TerminalIcon size={12} color="var(--cyan)" />}
              {macLoading ? "QUERYING OUI..." : "TRACE MAC"}
            </button>
          </div>

          {macError && (
            <div style={{ padding: 10, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--magenta)", borderRadius: 4, color: "var(--magenta)", fontSize: 12, marginBottom: 14 }}>
              {macError}
            </div>
          )}

          {macResult && (
            <div style={{ background: "rgba(10, 14, 22, 0.7)", border: "1px solid rgba(5, 217, 232, 0.3)", borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>IEEE OUI HARDWARE VENDOR</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "var(--cyan)" }}>{macResult.vendor}</div>
                  <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                    Type: <span style={{ color: "#a5b4fc" }}>{macResult.device_type}</span> | Country: <span style={{ color: "#34d399" }}>{macResult.country}</span>
                  </div>
                </div>
                <SaveToCaseButton
                  key={`${activeCase?.id}-${macResult.mac}`}
                  identifierType="corporate"
                  identifierValue={macResult.vendor}
                  platform="horus.mactrace"
                  discoveredBy="horus"
                  metadata={{
                    mac: macResult.mac,
                    oui: macResult.oui_prefix,
                    device_type: macResult.device_type,
                    country: macResult.country,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Normalized MAC: </span>
                  <code style={{ color: "var(--cyan)" }}>{macResult.mac}</code>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>OUI Prefix: </span>
                  <code style={{ color: "#a5b4fc" }}>{macResult.oui_prefix}</code>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Transmission: </span>
                  <span style={{ color: "#fff" }}>{macResult.transmission}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Administration: </span>
                  <span style={{ color: macResult.is_randomized ? "var(--magenta)" : "#34d399" }}>
                    {macResult.administration}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BANK BIN / IIN INDEX */}
      {activeTab === "bin" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Card Presets:</span>
            {BIN_PRESETS.map((p) => (
              <button
                key={p.bin}
                onClick={() => setBinInput(p.bin)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: binInput === p.bin ? "1px solid #34d399" : "1px solid var(--border)",
                  background: binInput === p.bin ? "rgba(52, 211, 153, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: binInput === p.bin ? "#34d399" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={binInput}
              onChange={(e) => setBinInput(e.target.value)}
              placeholder="e.g. 414720 or 524188 (6-8 digits)"
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "monospace",
                background: "rgba(10, 12, 18, 0.8)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "#fff",
              }}
            />
            <button
              onClick={handleSearchBin}
              disabled={binLoading}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                background: "rgba(52, 211, 153, 0.15)",
                color: "#34d399",
                border: "1px solid #34d399",
                borderRadius: 4,
                fontWeight: "bold",
                cursor: binLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {binLoading ? <RefreshCwIcon size={12} color="#34d399" /> : <BuildingIcon size={12} color="#34d399" />}
              {binLoading ? "INDEXING BIN..." : "INDEX BIN / IIN"}
            </button>
          </div>

          {binError && (
            <div style={{ padding: 10, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--magenta)", borderRadius: 4, color: "var(--magenta)", fontSize: 12, marginBottom: 14 }}>
              {binError}
            </div>
          )}

          {binResult && (
            <div style={{ background: "rgba(10, 14, 22, 0.7)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ISSUING FINANCIAL INSTITUTION</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#34d399" }}>{binResult.bank}</div>
                  <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                    Brand: <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>{binResult.scheme}</span> | Tier: <span style={{ color: "#fbbf24" }}>{binResult.brand}</span> ({binResult.type})
                  </div>
                </div>
                <SaveToCaseButton
                  key={`${activeCase?.id}-${binResult.bin}`}
                  identifierType="corporate"
                  identifierValue={binResult.bank}
                  platform="horus.bankindex"
                  discoveredBy="horus"
                  metadata={{
                    bin: binResult.bin,
                    scheme: binResult.scheme,
                    card_type: binResult.type,
                    country: binResult.country,
                    currency: binResult.currency,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, fontSize: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>BIN / IIN: </span>
                  <code style={{ color: "#34d399", fontWeight: "bold" }}>{binResult.bin}</code>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Country of Origin: </span>
                  <span style={{ color: "#fff" }}>{binResult.country} ({binResult.country_code})</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Currency: </span>
                  <span style={{ color: "#a5b4fc" }}>{binResult.currency}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Prepaid Card: </span>
                  <span style={{ color: binResult.prepaid ? "var(--magenta)" : "#34d399" }}>
                    {binResult.prepaid ? "YES (Prepaid)" : "NO (Standard)"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WIFI BSSID GEOLOCATION */}
      {activeTab === "wifi" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Access Point Presets:</span>
            {BSSID_PRESETS.map((p) => (
              <button
                key={p.bssid}
                onClick={() => setBssidInput(p.bssid)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: bssidInput === p.bssid ? "1px solid #fbbf24" : "1px solid var(--border)",
                  background: bssidInput === p.bssid ? "rgba(251, 191, 36, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: bssidInput === p.bssid ? "#fbbf24" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={bssidInput}
              onChange={(e) => setBssidInput(e.target.value)}
              placeholder="e.g. 00:14:6C:7E:40:80 or 24DEC6A1B2C3"
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "monospace",
                background: "rgba(10, 12, 18, 0.8)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "#fff",
              }}
            />
            <button
              onClick={handleSearchWifi}
              disabled={wifiLoading}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                background: "rgba(251, 191, 36, 0.15)",
                color: "#fbbf24",
                border: "1px solid #fbbf24",
                borderRadius: 4,
                fontWeight: "bold",
                cursor: wifiLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {wifiLoading ? <RefreshCwIcon size={12} color="#fbbf24" /> : <RadarIcon size={12} color="#fbbf24" />}
              {wifiLoading ? "TRIANGULATING..." : "LOCATE BSSID"}
            </button>
          </div>

          {wifiError && (
            <div style={{ padding: 10, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--magenta)", borderRadius: 4, color: "var(--magenta)", fontSize: 12, marginBottom: 14 }}>
              {wifiError}
            </div>
          )}

          {wifiResult && (
            <div style={{ background: "rgba(10, 14, 22, 0.7)", border: "1px solid rgba(251, 191, 36, 0.3)", borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>WIRELESS ACCESS POINT</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#fbbf24" }}>
                    {wifiResult.ssid_name || `AP [${wifiResult.bssid}]`}
                  </div>
                  <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                    Address / Region: <span style={{ color: "#a5b4fc" }}>{wifiResult.address || "Unresolved"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {wifiResult.latitude && wifiResult.longitude && (
                    <button
                      onClick={handlePinWifiToMap}
                      disabled={pinningWifi || !activeCase}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11,
                        background: pinnedSuccess ? "rgba(52, 211, 153, 0.2)" : "rgba(251, 191, 36, 0.2)",
                        color: pinnedSuccess ? "#34d399" : "#fbbf24",
                        border: pinnedSuccess ? "1px solid #34d399" : "1px solid #fbbf24",
                        borderRadius: 4,
                        cursor: pinningWifi ? "wait" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 600,
                      }}
                      title={activeCase ? "Pin to Active Case Leaflet Map" : "Select an active case to pin"}
                    >
                      {pinnedSuccess ? <CheckIcon size={12} color="#34d399" /> : <PinIcon size={12} color="#fbbf24" />}
                      {pinnedSuccess ? "PINNED TO MAP" : "PIN TO MAP"}
                    </button>
                  )}
                  <SaveToCaseButton
                    key={`${activeCase?.id}-${wifiResult.bssid}`}
                    identifierType="url"
                    identifierValue={`bssid:${wifiResult.bssid}`}
                    platform="horus.wigle"
                    discoveredBy="horus"
                    metadata={{
                      bssid: wifiResult.bssid,
                      ssid: wifiResult.ssid_name,
                      latitude: wifiResult.latitude,
                      longitude: wifiResult.longitude,
                      address: wifiResult.address,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, fontSize: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Coordinates: </span>
                  <code style={{ color: "#fbbf24" }}>
                    {wifiResult.latitude && wifiResult.longitude ? `${wifiResult.latitude.toFixed(5)}, ${wifiResult.longitude.toFixed(5)}` : "Coordinate not indexed"}
                  </code>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Accuracy Radius: </span>
                  <span style={{ color: "#fff" }}>{wifiResult.accuracy_meters ? `~${wifiResult.accuracy_meters}m` : "Estimated"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Provider: </span>
                  <span style={{ color: "#34d399" }}>{wifiResult.provider}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: THREAT INTEL SCANNER */}
      {activeTab === "vt" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Threat Presets:</span>
            {THREAT_PRESETS.map((p) => (
              <button
                key={p.target}
                onClick={() => setThreatInput(p.target)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: threatInput === p.target ? "1px solid var(--magenta)" : "1px solid var(--border)",
                  background: threatInput === p.target ? "rgba(255, 42, 109, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: threatInput === p.target ? "var(--magenta)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={threatInput}
              onChange={(e) => setThreatInput(e.target.value)}
              placeholder="Enter IP, domain, URL, or MD5/SHA256 hash"
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 13,
                fontFamily: "monospace",
                background: "rgba(10, 12, 18, 0.8)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "#fff",
              }}
            />
            <button
              onClick={handleSearchThreat}
              disabled={threatLoading}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                background: "rgba(255, 42, 109, 0.15)",
                color: "var(--magenta)",
                border: "1px solid var(--magenta)",
                borderRadius: 4,
                fontWeight: "bold",
                cursor: threatLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {threatLoading ? <RefreshCwIcon size={12} color="var(--magenta)" /> : <AlertIcon size={12} color="var(--magenta)" />}
              {threatLoading ? "SCANNING THREATS..." : "SCAN THREAT INTEL"}
            </button>
          </div>

          {threatError && (
            <div style={{ padding: 10, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--magenta)", borderRadius: 4, color: "var(--magenta)", fontSize: 12, marginBottom: 14 }}>
              {threatError}
            </div>
          )}

          {threatResult && (
            <div style={{ background: "rgba(10, 14, 22, 0.7)", border: "1px solid rgba(255, 42, 109, 0.3)", borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>THREAT INTELLIGENCE VERDICT</div>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: threatResult.malicious_count > 0 ? "var(--magenta)" : "#34d399" }}>
                    RISK: {threatResult.risk_level} ({threatResult.malicious_count} Malicious Detections)
                  </div>
                  <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                    Target: <code style={{ color: "var(--cyan)" }}>{threatResult.target}</code> ({threatResult.target_type})
                  </div>
                </div>
                <SaveToCaseButton
                  key={`${activeCase?.id}-${threatResult.target}`}
                  identifierType={threatResult.target_type === "ip" ? "domain" : "url"}
                  identifierValue={threatResult.target}
                  platform="horus.vt"
                  discoveredBy="horus"
                  metadata={{
                    risk_level: threatResult.risk_level,
                    malicious: threatResult.malicious_count,
                    suspicious: threatResult.suspicious_count,
                    provider: threatResult.provider,
                  }}
                />
              </div>

              {threatResult.verdict_details.length > 0 && (
                <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>VENDOR VERDICTS:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {threatResult.verdict_details.map((v, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, background: "rgba(255,255,255,0.02)", padding: "4px 8px", borderRadius: 4 }}>
                        <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{v.engine}</span>
                        <span style={{ color: v.category === "malicious" ? "var(--magenta)" : "#34d399" }}>{v.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LOKI EVIDENCE VAULT */}
      {activeTab === "loki" && (
        <div>
          <div style={{ background: "rgba(10, 14, 22, 0.7)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: 6, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>LOKI EVIDENCE CRYPTOGRAPHIC VAULT</div>
                <div style={{ fontSize: 15, fontWeight: "bold", color: "#c084fc" }}>
                  Fernet Military-Grade AES-128-CBC + HMAC-SHA256 Locker
                </div>
              </div>
              <button
                onClick={handleLokiKeygen}
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  background: "rgba(168, 85, 247, 0.2)",
                  color: "#c084fc",
                  border: "1px solid #c084fc",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <KeyIcon size={12} color="#c084fc" />
                GENERATE NEW VAULT KEY
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Vault Passkey (Fernet Base64 Key):
              </label>
              <input
                type="text"
                value={lokiKey}
                onChange={(e) => setLokiKey(e.target.value)}
                placeholder="Paste or generate an AES-128 Fernet key..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  background: "rgba(10, 12, 18, 0.8)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "#c084fc",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Plaintext Evidence / Confidential Notes:
                </label>
                <textarea
                  rows={5}
                  value={lokiPlaintext}
                  onChange={(e) => setLokiPlaintext(e.target.value)}
                  placeholder="Type sensitive evidence, passwords, or case findings..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 12,
                    fontFamily: "monospace",
                    background: "rgba(10, 12, 18, 0.8)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "#fff",
                    resize: "vertical",
                  }}
                />
                <button
                  onClick={handleLokiEncrypt}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "8px",
                    fontSize: 12,
                    background: "rgba(168, 85, 247, 0.2)",
                    color: "#c084fc",
                    border: "1px solid #c084fc",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ENCRYPT EVIDENCE (LOCK VAULT)
                </button>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Ciphertext (Fernet Encrypted Block):
                </label>
                <textarea
                  rows={5}
                  value={lokiCiphertext}
                  onChange={(e) => setLokiCiphertext(e.target.value)}
                  placeholder="Encrypted payload appears here..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 12,
                    fontFamily: "monospace",
                    background: "rgba(10, 12, 18, 0.8)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "#34d399",
                    resize: "vertical",
                  }}
                />
                <button
                  onClick={handleLokiDecrypt}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "8px",
                    fontSize: 12,
                    background: "rgba(52, 211, 153, 0.2)",
                    color: "#34d399",
                    border: "1px solid #34d399",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  DECRYPT EVIDENCE (UNLOCK VAULT)
                </button>
              </div>
            </div>

            {lokiStatus && (
              <div style={{ padding: 8, background: "rgba(5, 217, 232, 0.1)", border: "1px solid var(--cyan)", borderRadius: 4, color: "var(--cyan)", fontSize: 11, marginBottom: 8 }}>
                {lokiStatus}
              </div>
            )}
            {lokiError && (
              <div style={{ padding: 8, background: "rgba(255, 42, 109, 0.1)", border: "1px solid var(--magenta)", borderRadius: 4, color: "var(--magenta)", fontSize: 11 }}>
                {lokiError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
