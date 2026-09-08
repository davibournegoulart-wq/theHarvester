"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type AccountResult = {
  platform: string;
  url: string;
  exists: boolean;
  discovered_by: string;
};

export default function UsernameSearch() {
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!username) return;
    setLoading(true);
    try {
      const data = await apiGet<{ accounts: AccountResult[] }>(
        `/identifiers/username/${encodeURIComponent(username)}`
      );
      setResults(data.accounts ?? []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="username"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {searched && !loading && results.length === 0 && <p>Nenhuma conta encontrada.</p>}
      <ul style={{ marginTop: 16 }}>
        {results.map((r) => (
          <li key={r.platform} style={{ marginBottom: 6 }}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.platform}
            </a>{" "}
            — via {r.discovered_by}{" "}
            <SaveToCaseButton
              identifierType="username"
              identifierValue={username}
              platform={r.platform}
              url={r.url}
              exists={r.exists}
              discoveredBy={r.discovered_by}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
