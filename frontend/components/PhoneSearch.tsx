"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import { CheckIcon, CrossIcon, AlertIcon } from "@/components/FlatIcons";

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

export default function PhoneSearch() {
  const { activeCase } = useActiveCase();
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("BR");
  
  const [metadata, setMetadata] = useState<PhoneMetadata | null>(null);
  const [mentionQueries, setMentionQueries] = useState<MentionQuery[]>([]);
  
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

    try {
      const [data, mentions] = await Promise.all([
        apiGet<PhoneMetadata>(`/identifiers/phone/metadata?phone=${encodeURIComponent(phone)}&default_region=${region}`),
        apiGet<MentionQuery[]>(`/recon/phone/${encodeURIComponent(phone)}/mentions`),
      ]);
      setMetadata(data);
      setMentionQueries(mentions);

      if (data.is_valid) {
        
      }

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
