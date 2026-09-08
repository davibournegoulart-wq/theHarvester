"use client";

import { useState } from "react";

type AccountResult = {
  platform: string;
  url: string;
  exists: boolean;
  discovered_by: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

export default function Home() {
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!username) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/identifiers/username/${encodeURIComponent(username)}`);
      const data = await response.json();
      setResults(data.accounts ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Net Scraper — Identificador → Contas</h1>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      <ul style={{ marginTop: 24 }}>
        {results.map((r) => (
          <li key={r.platform}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.platform}
            </a>{" "}
            — via {r.discovered_by}
          </li>
        ))}
      </ul>
    </main>
  );
}
