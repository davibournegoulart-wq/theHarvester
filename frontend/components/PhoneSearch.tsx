"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

type PhoneMetadata = {
  country: string | null;
  carrier: string | null;
  line_type: string | null;
  is_valid: boolean;
};

export default function PhoneSearch() {
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("BR");
  const [metadata, setMetadata] = useState<PhoneMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<PhoneMetadata>(
        `/identifiers/phone/metadata?phone=${encodeURIComponent(phone)}&default_region=${region}`
      );
      setMetadata(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar");
      setMetadata(null);
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
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {metadata && (
        <ul style={{ marginTop: 16 }}>
          <li>Válido: {metadata.is_valid ? "sim" : "não"}</li>
          <li>País: {metadata.country ?? "—"}</li>
          <li>Operadora: {metadata.carrier ?? "—"}</li>
          <li>Tipo de linha: {metadata.line_type ?? "—"}</li>
        </ul>
      )}
    </div>
  );
}
