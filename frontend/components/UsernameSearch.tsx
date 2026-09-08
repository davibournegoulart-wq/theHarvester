"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

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
      const data = await apiGet<{ accounts: AccountResult[] }>(
        `/identifiers/username/${encodeURIComponent(username)}`
      );
      const accounts = data.accounts ?? [];
      setResults(accounts);
      setSearched(true);

      // Salvar achado não deve travar o resto do fluxo (pivô de ID) se a rede
      // falhar num request isolado — cada save é independente.
      await Promise.all(
        accounts.map((r) =>
          apiPostJson(`/cases/${activeCase.id}/findings`, {
            identifier_type: "username",
            identifier_value: username,
            platform: r.platform,
            url: r.url,
            exists: r.exists,
            discovered_by: r.discovered_by,
            metadata_json: {},
          }).catch(() => {})
        )
      );

      const [instagramId, tiktokId] = await Promise.all([
        apiGet<SocialIdResult>(`/identifiers/social-id/instagram/${encodeURIComponent(username)}`).catch(() => null),
        apiGet<SocialIdResult>(`/identifiers/social-id/tiktok/${encodeURIComponent(username)}`).catch(() => null),
      ]);
      const foundIds = [instagramId, tiktokId].filter((r): r is SocialIdResult => r !== null && !!r.user_id);
      setSocialIds(foundIds);

      await Promise.all(
        foundIds.map((r) =>
          apiPostJson(`/cases/${activeCase.id}/findings`, {
            identifier_type: "username",
            identifier_value: username,
            platform: `${r.platform}_id`,
            exists: true,
            discovered_by: "checkers.social_id_pivot",
            metadata_json: { user_id: r.user_id, sec_uid: r.sec_uid },
          }).catch(() => {})
        )
      );
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
      {searched && !loading && results.length > 0 && (
        <p style={{ fontSize: 11, color: "var(--success)" }}>salvo automaticamente em "{activeCase?.name}"</p>
      )}
      <ul style={{ marginTop: 16 }}>
        {results.map((r) => (
          <li key={r.platform} style={{ marginBottom: 6 }}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.platform}
            </a>{" "}
            — via {r.discovered_by}
          </li>
        ))}
      </ul>
      {socialIds.length > 0 && (
        <>
          <p style={{ marginTop: 16, fontWeight: "bold" }}>
            ID interno (persiste mesmo se o @username mudar):
          </p>
          <ul>
            {socialIds.map((r) => (
              <li key={r.platform}>
                {r.platform}: {r.user_id}
                {r.sec_uid && ` (secUid: ${r.sec_uid})`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
