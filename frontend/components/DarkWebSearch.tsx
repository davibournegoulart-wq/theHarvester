"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

type DarkWebMatch = {
  engine: string;
  result_url: string;
  title: string;
  discovered_by: string;
};

export default function DarkWebSearch() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<DarkWebMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!keyword) return;
    setLoading(true);
    setSearched(false);
    setError(null);
    setResults([]);
    
    try {
      const data = await apiGet<DarkWebMatch[]>(`/recon/darkweb?keyword=${encodeURIComponent(keyword)}`);
      setResults(data);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error querying Dark Web");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ color: "var(--cyan)", marginBottom: 8 }}>DARK WEB MONITOR</h2>
      <p style={{ maxWidth: 700, color: "var(--text-muted)", fontSize: 14 }}>
        Native query via Tor proxy (SOCKS5). Current engines: Ahmia and Torch.
        Search is performed 100% on the local backend without exposing your real IP on the onion network.
        May take 10 to 30 seconds due to Tor network latency.
      </p>

      <div style={{ display: "flex", gap: 8, maxWidth: 600, marginTop: 24 }}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g.: CPF, name, crypto wallet, term"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading} style={{ width: 120 }}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      
      {error && <p style={{ color: "var(--danger)", marginTop: 16 }}>{error}</p>}

      {searched && results.length === 0 && (
        <p style={{ marginTop: 16 }}>No results found for "{keyword}".</p>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Results Found ({results.length})</h3>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {results.map((r, i) => (
              <li key={i} style={{ marginBottom: 16, background: "var(--panel-border)", padding: 12, borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, background: "var(--magenta)", color: "#fff", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                    {r.engine}
                  </span>
                  <a href={r.result_url} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: "bold", wordBreak: "break-all" }}>
                    {r.title}
                  </a>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", wordBreak: "break-all" }}>
                  {r.result_url}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
