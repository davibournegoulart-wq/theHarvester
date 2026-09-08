"use client";

import { useState } from "react";
import { apiFetch, apiGet } from "@/lib/api";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type EmailResult = {
  service: string;
  exists: boolean;
  rate_limited: boolean;
  leaked_recovery_hint: string | null;
};

type GoogleAccountResult = {
  gaia_id: string | null;
  profile_photo_url: string | null;
  is_public_profile: boolean;
};

export default function EmailSearch() {
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [googleResult, setGoogleResult] = useState<GoogleAccountResult | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!email) return;
    setLoading(true);
    setGoogleError(null);
    setGoogleResult(null);
    try {
      const data = await apiGet<{ services: EmailResult[] }>(`/identifiers/email/${encodeURIComponent(email)}`);
      setResults(data.services ?? []);
      setSearched(true);

      const googleResponse = await apiFetch(`/identifiers/google-account/${encodeURIComponent(email)}`);
      if (googleResponse.ok) {
        setGoogleResult(await googleResponse.json());
      } else {
        const body = await googleResponse.json().catch(() => null);
        setGoogleError(body?.detail ?? `Erro ${googleResponse.status}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="email@dominio.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {searched && !loading && (
        <ul style={{ marginTop: 16 }}>
          {results.map((r) => (
            <li key={r.service} style={{ marginBottom: 6 }}>
              {r.service}: {r.exists ? "cadastrado" : "não cadastrado"}
              {r.leaked_recovery_hint && ` — dica de recuperação: ${r.leaked_recovery_hint}`}{" "}
              {r.exists && (
                <SaveToCaseButton
                  identifierType="email"
                  identifierValue={email}
                  platform={r.service}
                  exists={r.exists}
                  discoveredBy="checkers.email"
                  metadata={{ rate_limited: r.rate_limited, leaked_recovery_hint: r.leaked_recovery_hint }}
                />
              )}
            </li>
          ))}
          {results.length === 0 && <li>Sem serviço com checagem disponível no momento.</li>}
        </ul>
      )}

      {searched && !loading && (
        <>
          <p style={{ fontSize: 12, marginTop: 16 }}>
            Conta Google (requer sessão do investigador configurada no servidor — ver README):
          </p>
          {googleError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{googleError}</p>}
          {googleResult && (
            <ul>
              <li>Gaia ID: {googleResult.gaia_id ?? "não encontrado"}</li>
              <li>Perfil público: {googleResult.is_public_profile ? "sim" : "não"}</li>
              {googleResult.profile_photo_url && (
                <li>
                  <a href={googleResult.profile_photo_url} target="_blank" rel="noreferrer">
                    Foto de perfil
                  </a>
                </li>
              )}
              {googleResult.gaia_id && (
                <li>
                  <SaveToCaseButton
                    identifierType="email"
                    identifierValue={email}
                    platform="google"
                    url={googleResult.profile_photo_url}
                    exists={true}
                    discoveredBy="checkers.google_account"
                    metadata={{ gaia_id: googleResult.gaia_id, is_public_profile: googleResult.is_public_profile }}
                  />
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
