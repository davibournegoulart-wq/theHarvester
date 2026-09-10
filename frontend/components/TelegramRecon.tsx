"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import SaveToCaseButton from "./SaveToCaseButton";

type TelegramDeepData = {
  username: string;
  title: string | null;
  description: string | null;
  avatar_url: string | null;
  subscribers: string | null;
  is_verified: boolean;
  is_channel_or_group: boolean;
  tme_url: string;
  recent_posts: { text: string }[];
  tgstat_info?: { indexed: boolean; url?: string; title?: string };
  lyzem_results?: { title: string; url: string }[];
};

export default function TelegramRecon() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("username");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);

    if (type === "phone") {
      try {
        const data: any = await apiGet(`/identifiers/phone/telegram?phone=${encodeURIComponent(query.trim())}`);
        setResult({ type: "phone", exists: data.exists, query: query.trim() });
      } catch (e: any) {
        setResult({ type: "error", error: e.message });
      }
    } else {
      const cleanUser = query.trim().replace("@", "");
      try {
        const deepData: TelegramDeepData = await apiGet(`/identifiers/telegram/deep?username=${encodeURIComponent(cleanUser)}`);
        setResult({ type: "username", query: cleanUser, deep: deepData });
      } catch (e: any) {
        setResult({ type: "username", query: cleanUser, deep: null, error: e.message });
      }
    }

    setLoading(false);
  };

  return (
    <div className="card">
      <h2 style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 16px 0", color: "#0088cc" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        TELEGRAM DEEP RECON
        <span className="badge" style={{ background: "rgba(0, 136, 204, 0.2)", color: "#0088cc" }}>Native Engine</span>
      </h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <select className="input-field" value={type} onChange={(e) => setType(e.target.value)} style={{ width: 160 }}>
          <option value="username">Username / Channel</option>
          <option value="phone">Phone Number</option>
        </select>
        <input
          className="input-field"
          placeholder={type === "phone" ? "+1234567890" : "Username or Channel (e.g. durov, telegram)"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "SEARCHING..." : "DEEP SEARCH"}
        </button>
      </div>

      {result?.type === "phone" && (
        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 12px 0" }}>Phone Verification Result</h3>
          <div style={{ fontSize: 16 }}>
            {result.exists ? "Registered on Telegram" : "Not registered"}
          </div>
          <div style={{ marginTop: 12 }}>
            <a href={`https://t.me/+${result.query.replace("+", "")}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Open in Telegram App
            </a>
          </div>
        </div>
      )}

      {result?.type === "username" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* NATIVE TELEGRAM DOSSIER CARD */}
          {result.deep && (
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                {result.deep.avatar_url && (
                  <img
                    src={result.deep.avatar_url}
                    alt={result.query}
                    style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--cyan)" }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, color: "var(--cyan)" }}>
                      {result.deep.title || `@${result.query}`}
                    </h3>
                    {result.deep.is_verified && (
                      <span style={{ color: "#0088cc", fontSize: 14 }} title="Verified Channel">✓ VERIFIED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    @{result.query} {result.deep.subscribers && `• ${result.deep.subscribers}`}
                  </div>
                  {result.deep.description && (
                    <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.4, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                      {result.deep.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <a href={result.deep.tme_url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
                      Open in Telegram
                    </a>
                    <SaveToCaseButton
                      identifierType="username"
                      identifierValue={result.query}
                      platform="telegram"
                      url={result.deep.tme_url}
                      discoveredBy="recon.telegram_deep"
                      metadata={{
                        title: result.deep.title,
                        subscribers: result.deep.subscribers,
                        description: result.deep.description,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* RECENT POSTS INSPECTOR */}
              {result.deep.recent_posts && result.deep.recent_posts.length > 0 && (
                <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "var(--cyan)", fontSize: 13, textTransform: "uppercase" }}>
                    Recent Channel Messages & Announcements ({result.deep.recent_posts.length})
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.deep.recent_posts.map((p: any, idx: number) => (
                      <div key={idx} style={{ padding: "10px 14px", background: "var(--bg-primary)", borderRadius: 6, borderLeft: "3px solid var(--cyan)", fontSize: 12, lineHeight: 1.5 }}>
                        {p.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* TGSTAT IN-APP INTELLIGENCE */}
              {result.deep.tgstat_info && (
                <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#0088cc", fontSize: 13, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    TGStat Intelligence Engine
                    <span className="badge" style={{ background: "rgba(0,136,204,0.15)", color: "#0088cc", fontSize: 10 }}>In-App Scraped</span>
                  </h4>
                  <div style={{ padding: "10px 14px", background: "var(--bg-primary)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 13 }}>
                        Status in TGStat Directory: <strong>{result.deep.tgstat_info.indexed ? "✓ Indexed & Tracked" : "Not yet indexed"}</strong>
                      </span>
                      {result.deep.tgstat_info.title && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          Indexed Name: {result.deep.tgstat_info.title}
                        </div>
                      )}
                    </div>
                    {result.deep.tgstat_info.url && (
                      <a href={result.deep.tgstat_info.url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none", fontSize: 11 }}>
                        View TGStat Profile ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* LYZEM IN-APP SEARCH RESULTS (CROSS-CHANNEL INDEX) */}
              {result.deep.lyzem_results && result.deep.lyzem_results.length > 0 && (
                <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 10px 0", color: "var(--cyan)", fontSize: 13, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Lyzem Global Directory Matches ({result.deep.lyzem_results.length})
                    <span className="badge" style={{ background: "rgba(5,217,232,0.15)", color: "var(--cyan)", fontSize: 10 }}>In-App Scraped</span>
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                    {result.deep.lyzem_results.map((l: any, idx: number) => (
                      <div key={idx} style={{ padding: "8px 12px", background: "var(--bg-primary)", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }} title={l.title}>
                          {l.title}
                        </span>
                        <a href={l.url} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize: 10, padding: "2px 6px", textDecoration: "none" }}>
                          Open ↗
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXTERNAL INTELLIGENCE PIVOTS */}
          <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 6, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 12px 0", color: "var(--cyan)" }}>External Intelligence Engines</h4>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              Pivot the target against external Telegram indexing services to discover cross-group affiliations, subscriber history, and forwarded message trees.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              <a href={`https://tgstat.com/channel/@${result.query}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
                TGStat Analytics ↗
              </a>
              <a href={`https://telemetr.io/en/channels?search=${result.query}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
                Telemetr DB ↗
              </a>
              <a href={`https://lyzem.com/search?q=${result.query}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
                Lyzem Global Search ↗
              </a>
              <a href={`https://search.telegago.com/?q=${result.query}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
                Telegago Web Search ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {result?.type === "error" && (
        <div style={{ color: "var(--danger)" }}>{result.error}</div>
      )}
    </div>
  );
}
