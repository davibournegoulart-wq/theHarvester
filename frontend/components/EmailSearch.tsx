"use client";

import { useState } from "react";
import { apiFetch, apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

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

type GravatarResult = {
  exists: boolean;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  location: string | null;
  description: string | null;
  job_title: string | null;
  company: string | null;
  verified_accounts: { url: string; service_label: string }[] | null;
};

type EmailBreachResult = { breaches: string[] };

export default function EmailSearch() {
  const { activeCase } = useActiveCase();
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [googleResult, setGoogleResult] = useState<GoogleAccountResult | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [gravatarResult, setGravatarResult] = useState<GravatarResult | null>(null);
  const [breachResult, setBreachResult] = useState<EmailBreachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!email || !activeCase) return;
    setLoading(true);
    setGoogleError(null);
    setGoogleResult(null);
    try {
      const data = await apiGet<{ services: EmailResult[] }>(`/identifiers/email/${encodeURIComponent(email)}`);
      const services = data.services ?? [];
      setResults(services);
      setSearched(true);

      // Cada passo é independente — falha de rede num não deve travar os outros.
      await Promise.all(
        services
          .filter((r) => r.exists)
          .map((r) =>
            apiPostJson(`/cases/${activeCase.id}/findings`, {
              identifier_type: "email",
              identifier_value: email,
              platform: r.service,
              exists: r.exists,
              discovered_by: "checkers.email",
              metadata_json: { rate_limited: r.rate_limited, leaked_recovery_hint: r.leaked_recovery_hint },
            }).catch(() => {})
          )
      );

      try {
        const googleResponse = await apiFetch(`/identifiers/google-account/${encodeURIComponent(email)}`);
        if (googleResponse.ok) {
          const google: GoogleAccountResult = await googleResponse.json();
          setGoogleResult(google);
          if (google.gaia_id) {
            await apiPostJson(`/cases/${activeCase.id}/findings`, {
              identifier_type: "email",
              identifier_value: email,
              platform: "google",
              url: google.profile_photo_url,
              exists: true,
              discovered_by: "checkers.google_account",
              metadata_json: { gaia_id: google.gaia_id, is_public_profile: google.is_public_profile },
            }).catch(() => {});
          }
        } else {
          const body = await googleResponse.json().catch(() => null);
          setGoogleError(body?.detail ?? `Erro ${googleResponse.status}`);
        }
      } catch (e) {
        setGoogleError(e instanceof Error ? e.message : "Erro ao consultar conta Google");
      }

      try {
        const gravatar = await apiGet<GravatarResult>(`/identifiers/gravatar/${encodeURIComponent(email)}`);
        setGravatarResult(gravatar);
        if (gravatar.exists) {
          await apiPostJson(`/cases/${activeCase.id}/findings`, {
            identifier_type: "email",
            identifier_value: email,
            platform: "gravatar",
            url: gravatar.profile_url,
            exists: true,
            discovered_by: "checkers.gravatar",
            metadata_json: {
              display_name: gravatar.display_name,
              location: gravatar.location,
              company: gravatar.company,
              verified_accounts: gravatar.verified_accounts,
            },
          }).catch(() => {});
        }
      } catch {
        // Gravatar indisponível não deve travar o restante da busca já exibida.
      }

      try {
        const breach = await apiGet<EmailBreachResult>(`/identifiers/breach/email?email=${encodeURIComponent(email)}`);
        setBreachResult(breach);
        if (breach.breaches.length > 0) {
          await apiPostJson(`/cases/${activeCase.id}/findings`, {
            identifier_type: "email",
            identifier_value: email,
            platform: "xposedornot",
            exists: true,
            discovered_by: "recon.breach_check.xposedornot",
            metadata_json: { breaches: breach.breaches },
          }).catch(() => {});
        }
      } catch {
        // Serviço de vazamento indisponível não deve travar o restante da busca já exibida.
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
      {searched && !loading && results.some((r) => r.exists) && (
        <p style={{ fontSize: 11, color: "var(--success)" }}>salvo automaticamente em "{activeCase?.name}"</p>
      )}
      {searched && !loading && (
        <ul style={{ marginTop: 16 }}>
          {results.map((r) => (
            <li key={r.service} style={{ marginBottom: 6 }}>
              {r.service}: {r.exists ? "cadastrado" : "não cadastrado"}
              {r.leaked_recovery_hint && ` — dica de recuperação: ${r.leaked_recovery_hint}`}
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
            </ul>
          )}
        </>
      )}

      {gravatarResult && gravatarResult.exists && (
        <>
          <p style={{ fontSize: 12, marginTop: 16, fontWeight: "bold" }}>Gravatar (perfil público opt-in):</p>
          <ul>
            {gravatarResult.display_name && <li>Nome: {gravatarResult.display_name}</li>}
            {gravatarResult.location && <li>Localização: {gravatarResult.location}</li>}
            {gravatarResult.job_title && <li>Cargo: {gravatarResult.job_title}</li>}
            {gravatarResult.company && <li>Empresa: {gravatarResult.company}</li>}
            {gravatarResult.profile_url && (
              <li>
                <a href={gravatarResult.profile_url} target="_blank" rel="noreferrer">
                  Ver perfil completo
                </a>
              </li>
            )}
            {gravatarResult.verified_accounts && gravatarResult.verified_accounts.length > 0 && (
              <li>
                Contas verificadas vinculadas:
                <ul>
                  {gravatarResult.verified_accounts.map((v, i) => (
                    <li key={i}>
                      <a href={v.url} target="_blank" rel="noreferrer">
                        {v.service_label}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </>
      )}

      {breachResult && (
        <>
          <p style={{ fontSize: 12, marginTop: 16, fontWeight: "bold" }}>Vazamentos conhecidos (XposedOrNot):</p>
          {breachResult.breaches.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum vazamento conhecido pra esse e-mail.</p>
          ) : (
            <p style={{ fontSize: 12 }}>
              Encontrado em {breachResult.breaches.length} vazamento(s): {breachResult.breaches.slice(0, 15).join(", ")}
              {breachResult.breaches.length > 15 && ` e mais ${breachResult.breaches.length - 15}`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
