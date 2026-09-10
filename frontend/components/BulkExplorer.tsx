"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { FolderIcon, SearchIcon } from "@/components/FlatIcons";

type DatasetPreview = {
  columns: string[];
  row_count: number;
  sample_rows: Record<string, string>[];
};

type PasteMatch = {
  paste_url: string;
  keyword_matched: string;
  snippet: string;
};

type DarkWebMatch = {
  engine: string;
  result_url: string;
  title: string;
};

export default function BulkExplorer() {
  const [path, setPath] = useState("/data/bulk_uploads/");
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterResults, setFilterResults] = useState<Record<string, string>[] | null>(null);
  const [keywords, setKeywords] = useState("");
  const [pasteResults, setPasteResults] = useState<PasteMatch[] | null>(null);
  const [darkwebKeyword, setDarkwebKeyword] = useState("");
  const [darkwebResults, setDarkwebResults] = useState<DarkWebMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInspect() {
    if (!path) return;
    setLoading(true);
    setError(null);
    setFilterResults(null);
    try {
      setPreview(await apiGet<DatasetPreview>(`/bulk/inspect?path=${encodeURIComponent(path)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inspecting file");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilter() {
    if (!path || !filterQuery) return;
    setLoading(true);
    try {
      setFilterResults(await apiGet<Record<string, string>[]>(`/bulk/filter?path=${encodeURIComponent(path)}&query=${encodeURIComponent(filterQuery)}`));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasteScan() {
    if (!keywords) return;
    setLoading(true);
    try {
      setPasteResults(await apiGet<PasteMatch[]>(`/bulk/paste-monitor?keywords=${encodeURIComponent(keywords)}`));
    } finally {
      setLoading(false);
    }
  }

  async function handleDarkwebSearch() {
    if (!darkwebKeyword) return;
    setLoading(true);
    try {
      setDarkwebResults(await apiGet<DarkWebMatch[]>(`/recon/darkweb?keyword=${encodeURIComponent(darkwebKeyword)}`));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <FolderIcon size={18} color="var(--cyan)" />
        <h3 style={{ margin: 0 }}>Dump & CSV Dataset Explorer</h3>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Place datasets or breach dumps inside <code>data/bulk_uploads/</code> (mounted volume) and specify the container path, e.g.: <code>/data/bulk_uploads/dump.csv</code>.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={path} onChange={(e) => setPath(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button onClick={handleInspect} disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Inspecting..." : "Inspect"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {preview && (
        <>
          <p style={{ fontSize: 13, color: "var(--cyan)", fontWeight: 500 }}>
            {preview.row_count.toLocaleString()} row(s) detected &middot; columns: {preview.columns.join(", ")}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              placeholder="Filter (full-text search across any column)..."
              style={{ flex: 1, padding: 8 }}
            />
            <button onClick={handleFilter} disabled={loading} style={{ padding: "8px 16px" }}>
              Filter
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} style={{ textAlign: "left", borderBottom: "1px solid var(--panel-border)", padding: 4 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(filterResults ?? preview.sample_rows).map((row, i) => (
                  <tr key={i}>
                    {preview.columns.map((c) => (
                      <td key={c} style={{ padding: 4, borderBottom: "1px solid var(--panel-border)" }}>
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 style={{ marginTop: 32 }}>Paste Site Monitor (Pastebin)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Search keyword across public paste archives — may be throttled under public Pastebin rate-limits.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePasteScan()}
          placeholder="comma-separated keywords..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handlePasteScan} disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {pasteResults && (
        <ul style={{ marginTop: 8 }}>
          {pasteResults.map((m, i) => (
            <li key={i}>
              <a href={m.paste_url} target="_blank" rel="noreferrer">
                {m.paste_url}
              </a>{" "}
              — <strong>{m.keyword_matched}</strong>: <span style={{ fontSize: 12 }}>{m.snippet}</span>
            </li>
          ))}
          {pasteResults.length === 0 && <li style={{ color: "var(--text-muted)" }}>No results (or Pastebin is currently unavailable).</li>}
        </ul>
      )}

      <h3 style={{ marginTop: 32 }}>Dark Web Monitor (Ahmia via Tor)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Requires the <code>tor</code> compose container to be running. Onion services go down frequently — empty results
        may indicate instability on their end, not a bug.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={darkwebKeyword}
          onChange={(e) => setDarkwebKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDarkwebSearch()}
          placeholder="keyword"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleDarkwebSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {darkwebResults && (
        <ul style={{ marginTop: 8 }}>
          {darkwebResults.map((m, i) => (
            <li key={i}>
              [{m.engine}]{" "}
              <a href={m.result_url} target="_blank" rel="noreferrer">
                {m.title}
              </a>
            </li>
          ))}
          {darkwebResults.length === 0 && (
            <li style={{ color: "var(--text-muted)" }}>No results (or .onion service is currently unavailable).</li>
          )}
        </ul>
      )}
    </div>
  );
}
