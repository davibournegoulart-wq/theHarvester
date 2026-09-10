"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import { CheckIcon, CrossIcon, AlertIcon, PhoneIcon } from "@/components/FlatIcons";

type PhoneMetadata = {
  country: string | null;
  carrier: string | null;
  line_type: string | null;
  is_valid: boolean;
};

type MentionQuery = { platform: string; query: string };

type ExistsResult = {
  platform?: string;
  exists: boolean;
  rate_limited?: boolean;
  profile_url?: string | null;
  avatar_url?: string | null;
  about?: string | null;
  last_seen?: string | null;
};
type ExistenceResponse = { phone: string; platforms: { service: string; exists: boolean; rate_limited: boolean }[] };

type GhostTrackPhone = {
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

export default function PhoneSearch() {
  const { activeCase } = useActiveCase();
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("BR");
  
  const [metadata, setMetadata] = useState<PhoneMetadata | null>(null);
  const [mentionQueries, setMentionQueries] = useState<MentionQuery[]>([]);
  const [ghostTrack, setGhostTrack] = useState<GhostTrackPhone | null>(null);
  
  const [whatsappResult, setWhatsappResult] = useState<ExistsResult | null>(null);
  const [telegramResult, setTelegramResult] = useState<ExistsResult | null>(null);
  const [platformsResult, setPlatformsResult] = useState<ExistenceResponse | null>(null);
  const [fbBreach, setFbBreach] = useState<{ breached: boolean; message: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!phone || !activeCase) return;
    setLoading(true);
    setError(null);
    setWhatsappResult(null);
    setTelegramResult(null);
    setPlatformsResult(null);
    setFbBreach(null);
    setGhostTrack(null);

    try {
      const [data, mentions] = await Promise.all([
        apiGet<PhoneMetadata>(`/identifiers/phone/metadata?phone=${encodeURIComponent(phone)}&default_region=${region}`),
        apiGet<MentionQuery[]>(`/recon/phone/${encodeURIComponent(phone)}/mentions`),
      ]);
      setMetadata(data);
      setMentionQueries(mentions);

      apiGet<GhostTrackPhone>(`/recon/ghosttrack/phone?phone=${encodeURIComponent(phone)}&default_region=${region}`).then(setGhostTrack).catch(() => {});
      apiGet<ExistsResult>(`/identifiers/phone/whatsapp?phone=${encodeURIComponent(phone)}`).then(setWhatsappResult).catch(() => {});
      apiGet<ExistsResult>(`/identifiers/phone/telegram?phone=${encodeURIComponent(phone)}`).then(setTelegramResult).catch(() => {});
      apiGet<ExistenceResponse>(`/identifiers/phone/existence?phone=${encodeURIComponent(phone)}&default_region=${region}`).then(setPlatformsResult).catch(() => {});
      apiGet<{ breached: boolean; message: string }>(`/recon/breach/facebook?phone=${encodeURIComponent(phone)}`).then(setFbBreach).catch(() => {});

    } catch (e) {
      setError(e instanceof Error ? e.message : "Error searching");
      setMetadata(null);
      setMentionQueries([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px 0" }}>
        <PhoneIcon size={18} color="var(--cyan)" /> Phone Intelligence &amp; Digital Footprint
      </h3>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="+5511999999999"
          style={{ flex: 1, padding: 8 }}
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value.toUpperCase())}
          placeholder="BR"
          style={{ width: 60, padding: 8 }}
          maxLength={2}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      
      {metadata && (
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h4 style={{ margin: "0 0 8px 0" }}>Number Metadata</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Valid:{" "}
                {metadata.is_valid ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                    <CheckIcon size={12} color="var(--success)" /> Yes
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)" }}>
                    <CrossIcon size={12} color="var(--danger)" /> No
                  </span>
                )}
              </li>
              <li>Country: {metadata.country ?? "—"}</li>
              <li>Carrier: {metadata.carrier ?? "—"}</li>
              <li>Line type: {metadata.line_type ?? "—"}</li>
              {metadata.is_valid && (
                <li style={{ marginTop: 8 }}>
                  <SaveToCaseButton
                    identifierType="phone"
                    identifierValue={phone}
                    platform="phone_metadata"
                    exists={true}
                    discoveredBy="recon.phone"
                    metadata={{ country: metadata.country, carrier: metadata.carrier, line_type: metadata.line_type }}
                  />
                </li>
              )}
            </ul>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <h4 style={{ margin: "0 0 8px 0" }}>Digital Presence</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <strong>WhatsApp:</strong>{" "}
                {whatsappResult ? (
                  <>
                    {whatsappResult.exists ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                        <CheckIcon size={12} color="var(--success)" /> Has account
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                        <CrossIcon size={12} color="var(--danger)" /> No account
                      </span>
                    )}{" "}
                    {whatsappResult.exists && (
                      <SaveToCaseButton
                        identifierType="phone"
                        identifierValue={phone}
                        platform="whatsapp"
                        exists={true}
                        discoveredBy="checkers.phone.whatsapp"
                      />
                    )}
                  </>
                ) : "Checking..."}
              </li>
              <li>
                <strong>Telegram:</strong>{" "}
                {telegramResult ? (
                  <>
                    {telegramResult.exists ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                        <CheckIcon size={12} color="var(--success)" /> Has account
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                        <CrossIcon size={12} color="var(--danger)" /> No account
                      </span>
                    )}{" "}
                    {telegramResult.exists && (
                      <SaveToCaseButton
                        identifierType="phone"
                        identifierValue={phone}
                        platform="telegram"
                        exists={true}
                        discoveredBy="checkers.phone.telegram"
                      />
                    )}
                  </>
                ) : "Checking..."}
              </li>
              {fbBreach && (
                <li>
                  <strong>Facebook 533M:</strong>{" "}
                  {fbBreach.breached ? (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)" }}>
                        <AlertIcon size={12} color="var(--danger)" /> Breached ({fbBreach.message})
                      </span>{" "}
                      <SaveToCaseButton
                        identifierType="phone"
                        identifierValue={phone}
                        platform="facebook_533m"
                        exists={true}
                        discoveredBy="checkers.phone.breach"
                      />
                    </>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                      <CheckIcon size={12} color="var(--success)" /> Clean
                    </span>
                  )}
                </li>
              )}
            </ul>
          </div>

          {ghostTrack && ghostTrack.is_valid && (
            <div style={{ width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", borderRadius: 4, padding: 14, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <PhoneIcon size={14} color="var(--cyan)" /> GhostTrack Telecom &amp; Carrier Intelligence
                </h4>
                <SaveToCaseButton
                  key={`${activeCase?.id}-ghosttrack-${phone}`}
                  identifierType="phone"
                  identifierValue={ghostTrack.international_format || phone}
                  platform="ghosttrack.telecom"
                  discoveredBy="ghosttrack"
                  metadata={{
                    carrier: ghostTrack.carrier,
                    location: ghostTrack.location,
                    timezones: ghostTrack.timezones,
                    line_type: ghostTrack.line_type,
                    e164: ghostTrack.e164_format,
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 12 }}>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>CARRIER PROVIDER:</span>
                  <strong style={{ color: ghostTrack.carrier ? "var(--cyan)" : "#fff" }}>{ghostTrack.carrier || "Unassigned / Generic"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>REGION / LOCATION:</span>
                  <strong>{ghostTrack.location || `${ghostTrack.region_code} (+${ghostTrack.country_code})`}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>LINE TYPE:</span>
                  <span style={{ padding: "1px 6px", background: "rgba(5, 217, 232, 0.15)", borderRadius: 3, color: "var(--cyan)", fontWeight: "bold" }}>
                    {ghostTrack.line_type}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>TIMEZONES:</span>
                  <span>{ghostTrack.timezones?.length ? ghostTrack.timezones.join(", ") : "Standard local"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>STANDARDIZED E.164:</span>
                  <code style={{ color: "var(--cyan)" }}>{ghostTrack.e164_format}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Caller ID and OSINT Quick Links */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--cyan)" }}>Caller ID & Spam OSINT</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={`https://www.truecaller.com/search/${(metadata?.country?.substring(0,2) || 'us').toLowerCase()}/${phone.replace('+','')}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Search on Truecaller
            </a>
            <a href={`https://sync.me/search/?number=${phone.replace('+','')}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Search on Sync.me
            </a>
            <a href={`https://whoscall.com/en/number/${phone.replace('+','')}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Search on Whoscall
            </a>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            * Note: Fully automated caller ID lookup requires a Google/Truecaller password to be stored on the backend, which violates Net Scraper security policies. Use the direct links above to query them safely from your own browser session.
          </p>
        </div>

      {platformsResult && platformsResult.platforms.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ margin: "0 0 8px 0" }}>Registrations (Login/Recovery Test)</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {platformsResult.platforms.map((p) => (
              <li key={`${activeCase?.id}-${phone}-${p.service}`} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <strong>{p.service}:</strong>{" "}
                {p.exists ? (
                  <span style={{ color: "#34d399", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CheckIcon size={12} color="#34d399" /> Registered
                  </span>
                ) : (
                  <span style={{ color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CrossIcon size={11} color="#94a3b8" /> Not registered
                  </span>
                )}
                {p.rate_limited && (
                  <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    (<AlertIcon size={11} color="#f59e0b" /> Rate Limited)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mentionQueries.length > 0 && (
        <>
          <p style={{ marginTop: 24, fontWeight: "bold" }}>
            Social media mentions — generated searches, review manually before trusting:
          </p>
          <ul>
            {mentionQueries.map((m, i) => (
              <li key={`${activeCase?.id}-${phone}-breach-${i}`} style={{ marginBottom: 6 }}>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(m.query)}`} target="_blank" rel="noreferrer">
                  [{m.platform}] {m.query}
                </a>{" "}
                <SaveToCaseButton
                  identifierType="phone"
                  identifierValue={phone}
                  platform={m.platform}
                  exists={true}
                  discoveredBy="recon.phone_mentions"
                  metadata={{ query: m.query }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
