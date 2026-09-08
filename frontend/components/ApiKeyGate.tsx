"use client";

import { useEffect, useState, type ReactNode } from "react";
import { API_URL, getApiKey, setApiKey } from "@/lib/api";

export default function ApiKeyGate({ children }: { children: ReactNode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setHasKey(!!getApiKey());
  }, []);

  async function handleSubmit() {
    if (!input) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/cases/`, { headers: { "X-API-Key": input } });
      if (response.status === 401) {
        setError("Chave inválida.");
        return;
      }
      setApiKey(input);
      setHasKey(true);
    } catch {
      setError("Não foi possível conectar na API — verifique se o backend está no ar.");
    } finally {
      setChecking(false);
    }
  }

  if (hasKey === null) return null; // evita flash antes de checar localStorage

  if (!hasKey) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: 28 }}>NET SCRAPER</h1>
        <p>Informe a X-API-Key configurada no servidor (`NETSCRAPER_API_KEY`).</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="API key"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={handleSubmit} disabled={checking}>
            {checking ? "Verificando..." : "Entrar"}
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </main>
    );
  }

  return <>{children}</>;
}
