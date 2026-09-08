"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

type EmailResult = {
  service: string;
  exists: boolean;
  rate_limited: boolean;
  leaked_recovery_hint: string | null;
};

export default function EmailSearch() {
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!email) return;
    setLoading(true);
    try {
      const data = await apiGet<{ services: EmailResult[] }>(`/identifiers/email/${encodeURIComponent(email)}`);
      setResults(data.services ?? []);
      setSearched(true);
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
            <li key={r.service}>
              {r.service}: {r.exists ? "cadastrado" : "não cadastrado"}
              {r.leaked_recovery_hint && ` — dica de recuperação: ${r.leaked_recovery_hint}`}
            </li>
          ))}
          {results.length === 0 && <li>Sem serviço com checagem disponível no momento.</li>}
        </ul>
      )}
    </div>
  );
}
