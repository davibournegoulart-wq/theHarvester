"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

type WalletResult = {
  address: string;
  chain: string;
  balance: number;
  tx_count: number;
  is_sanctioned: boolean;
};

export default function CryptoTrace() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"btc" | "eth">("btc");
  const [result, setResult] = useState<WalletResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<WalletResult>(`/recon/crypto/${chain}/${encodeURIComponent(address)}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <select value={chain} onChange={(e) => setChain(e.target.value as "btc" | "eth")} style={{ padding: 8 }}>
          <option value="btc">BTC</option>
          <option value="eth">ETH</option>
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Endereço da carteira"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {result && (
        <ul style={{ marginTop: 16 }}>
          <li>Saldo: {result.balance}</li>
          <li>Transações: {result.tx_count}</li>
          <li style={{ color: result.is_sanctioned ? "var(--danger)" : "inherit", fontWeight: result.is_sanctioned ? "bold" : "normal" }}>
            {result.is_sanctioned ? "⚠️ SANCIONADO — OFAC SDN" : "Não consta na lista OFAC SDN"}
          </li>
        </ul>
      )}
    </div>
  );
}
