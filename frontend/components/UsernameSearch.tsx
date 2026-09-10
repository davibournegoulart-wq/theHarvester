"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";

type AccountResult = {
  platform: string;
  url: string;
  exists: boolean;
  discovered_by: string;
};

type SocialIdResult = { platform: string; user_id: string | null; sec_uid: string | null };

export default function UsernameSearch() {
  const { activeCase } = useActiveCase();
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [socialIds, setSocialIds] = useState<SocialIdResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!username || !activeCase) return;
    setLoading(true);
    try {
      const data = await apiGet<{ accounts: AccountResult[] }>(`/identifiers/username/${encodeURIComponent(username)}`);
      setResults(data.accounts ?? []);
      setSearched(true);

      const [instagramId, tiktokId] = await Promise.all([
        apiGet<SocialIdResult>(`/identifiers/social-id/instagram/${encodeURIComponent(username)}`).catch(() => null),
        apiGet<SocialIdResult>(`/identifiers/social-id/tiktok/${encodeURIComponent(username)}`).catch(() => null),
      ]);
      setSocialIds([instagramId, tiktokId].filter((r): r is SocialIdResult => r !== null && !!r.user_id));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="username"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {searched && !loading && results.length === 0 && <p>No accounts found.</p>}
      <ul style={{ marginTop: 16 }}>
        {results.map((r) => (
          <li key={`${activeCase?.id}-${username}-${r.platform}`} style={{ marginBottom: 6 }}>
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
      {socialIds.length > 0 && (
        <>
          <p style={{ marginTop: 16, fontWeight: "bold" }}>
            Internal ID (persists even if the @username changes):
          </p>
          <ul>
            {socialIds.map((r) => (
              <li key={`${activeCase?.id}-${username}-${r.platform}`} style={{ marginBottom: 6 }}>
                {r.platform}: {r.user_id}
                {r.sec_uid && ` (secUid: ${r.sec_uid})`} {" "}
                <SaveToCaseButton 
                  identifierType="username" 
                  identifierValue={username} 
                  platform={`${r.platform}_id`} 
                  discoveredBy="checkers.social_id_pivot" 
                  metadata={{ user_id: r.user_id, sec_uid: r.sec_uid }} 
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
