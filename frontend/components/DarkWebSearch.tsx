"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import { CheckIcon } from "@/components/FlatIcons";

type DarkWebMatch = {
  engine: string;
  result_url: string;
  title: string;
  discovered_by: string;
};

export default function DarkWebSearch() {
  const { activeCase } = useActiveCase();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<DarkWebMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function handleSearch() {
    if (!keyword) return;
    setLoading(true);
    setSearched(false);
    setError(null);
    setResults([]);
    setSavedCount(null);
    
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

  async function handleSaveAll() {
    if (!activeCase || results.length === 0) return;
    setSavingAll(true);
    const investigator = localStorage.getItem("investigator_name") || "anonymous_investigator";
    try {
      let count = 0;
      for (const r of results) {
        await apiPostJson(`/cases/${activeCase.id}/findings`, {
          identifier_type: "url",
          identifier_value: r.result_url,
          platform: `darkweb.${r.engine}`,
          url: r.result_url,
          exists: true,
          discovered_by: `darkweb.${r.engine} (${investigator})`,
          metadata_json: { title: r.title, keyword, engine: r.engine },
        });
        count++;
      }
      setSavedCount(count);
    } catch {
      alert("Error saving findings to case.");
    } finally {
      setSavingAll(false);
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Results Found ({results.length})</h3>
            <button
              onClick={handleSaveAll}
              disabled={savingAll || !activeCase}
              style={{
                fontSize: 11,
                padding: "5px 12px",
                background: savedCount !== null ? "rgba(0, 255, 159, 0.2)" : "var(--cyan)",
                color: savedCount !== null ? "var(--success)" : "#000",
                border: "1px solid var(--border)",
                fontWeight: "bold",
                cursor: activeCase ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {savedCount !== null ? (
                <>
                  <CheckIcon size={12} color="var(--success)" /> Added {savedCount} to Case
                </>
              ) : savingAll ? (
                "Saving to Case..."
              ) : (
                `+ Add All (${results.length}) to Case`
              )}
            </button>
          </div>
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {results.map((r, i) => (
              <li key={i} style={{ marginBottom: 16, background: "var(--panel-border)", padding: 12, borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, background: "var(--magenta)", color: "#fff", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                      {r.engine}
                    </span>
                    <a href={r.result_url} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: "bold", wordBreak: "break-all" }}>
                      {r.title}
                    </a>
                  </div>
                  <SaveToCaseButton
                    key={`${activeCase?.id}-${r.result_url}`}
                    identifierType="url"
                    identifierValue={r.result_url}
                    platform={`darkweb.${r.engine}`}
                    url={r.result_url}
                    discoveredBy="darkweb_monitor"
                    metadata={{ title: r.title, keyword, engine: r.engine }}
                  />
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
