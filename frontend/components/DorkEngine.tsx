"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type DorkQuery = { query: string; intent: string };

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome completo",
  first_name: "Nome",
  last_name: "Sobrenome",
  email: "E-mail",
  phone: "Telefone",
  username: "Username",
  domain: "Domínio",
  file_extension: "Extensão de arquivo (ex: pdf)",
};

export default function DorkEngine() {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dorks, setDorks] = useState<DorkQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(name: string, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== ""));
      const response = await apiFetch("/recon/dork-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? `Erro ${response.status}`);
      }
      setDorks(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar dorks");
      setDorks([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Preencha o que tiver — o motor combina os campos preenchidos em dorks prontos. Nenhuma busca é
        feita automaticamente; você abre e revisa cada resultado no navegador.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Object.entries(FIELD_LABELS).map(([name, label]) => (
          <input
            key={name}
            value={fields[name] ?? ""}
            onChange={(e) => setField(name, e.target.value)}
            placeholder={label}
            style={{ padding: 8 }}
          />
        ))}
      </div>
      <button onClick={handleGenerate} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? "Gerando..." : "Gerar dorks"}
      </button>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {dorks.length > 0 && (
        <ul style={{ marginTop: 16 }}>
          {dorks.map((d, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`} target="_blank" rel="noreferrer">
                {d.query}
              </a>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.intent}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
