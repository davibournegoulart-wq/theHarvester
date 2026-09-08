"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type PhoneMetadata = {
  country: string | null;
  carrier: string | null;
  line_type: string | null;
  is_valid: boolean;
};

type MentionQuery = { platform: string; query: string };

export default function PhoneSearch() {
  const { activeCase } = useActiveCase();
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("BR");
  const [metadata, setMetadata] = useState<PhoneMetadata | null>(null);
  const [mentionQueries, setMentionQueries] = useState<MentionQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!phone || !activeCase) return;
    setLoading(true);
    setError(null);
    try {
      const [data, mentions] = await Promise.all([
        apiGet<PhoneMetadata>(`/identifiers/phone/metadata?phone=${encodeURIComponent(phone)}&default_region=${region}`),
        apiGet<MentionQuery[]>(`/recon/phone/${encodeURIComponent(phone)}/mentions`),
      ]);
      setMetadata(data);
      setMentionQueries(mentions);

      if (data.is_valid) {
        // Falha ao salvar não deve apagar o resultado já exibido na tela.
        await apiPostJson(`/cases/${activeCase.id}/findings`, {
          identifier_type: "phone",
          identifier_value: phone,
          platform: "phone_metadata",
          exists: true,
          discovered_by: "recon.phone",
          metadata_json: { ...data },
        }).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar");
      setMetadata(null);
      setMentionQueries([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="+5511999999999"
          style={{ flex: 1, padding: 8 }}
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value.toUpperCase())}
          placeholder="BR"
          style={{ width: 60, padding: 8 }}
          maxLength={2}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {metadata && (
        <ul style={{ marginTop: 16 }}>
          <li>Válido: {metadata.is_valid ? "sim" : "não"}</li>
          <li>País: {metadata.country ?? "—"}</li>
          <li>Operadora: {metadata.carrier ?? "—"}</li>
          <li>Tipo de linha: {metadata.line_type ?? "—"}</li>
          {metadata.is_valid && (
            <li style={{ fontSize: 11, color: "var(--success)" }}>salvo automaticamente em "{activeCase?.name}"</li>
          )}
        </ul>
      )}
      {mentionQueries.length > 0 && (
        <>
          <p style={{ marginTop: 16, fontWeight: "bold" }}>
            Menções em rede social — buscas geradas, revise manualmente antes de confiar:
          </p>
          <ul>
            {mentionQueries.map((m, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(m.query)}`} target="_blank" rel="noreferrer">
                  [{m.platform}] {m.query}
                </a>{" "}
                <SaveToCaseButton
                  identifierType="phone"
                  identifierValue={phone}
                  platform={m.platform}
                  exists={true}
                  discoveredBy="recon.phone_mentions"
                  metadata={{ query: m.query }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
