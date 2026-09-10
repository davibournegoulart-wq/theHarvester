"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type CryptoResult = {
  currency: string;
  address: string;
  balance: number;
  total_received: number;
  total_sent: number;
  tx_count: number;
};

export default function CryptoTrace() {
  const { activeCase } = useActiveCase();
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("BTC");
  const [result, setResult] = useState<CryptoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!address || !activeCase) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiGet<CryptoResult>(
        `/identifiers/crypto/address?currency=${currency}&address=${encodeURIComponent(address)}`
      );
      setResult(data);

      
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error querying address");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ padding: 8 }}>
          <option value="BTC">Bitcoin (BTC)</option>
          <option value="ETH">Ethereum (ETH)</option>
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Wallet address"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Tracing..." : "Trace"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          
          <ul style={{ paddingLeft: 20 }}>
            <li>
              <strong>Currency:</strong> {result.currency}
            </li>
            <li style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
              <strong>Address:</strong> {result.address}{" "}
              <SaveToCaseButton key={`${activeCase?.id}-${result.address}`} 
                identifierType="crypto" 
                identifierValue={result.address} 
                platform={result.currency} 
                exists={true}
                discoveredBy="checkers.crypto" 
                metadata={{ balance: result.balance, tx_count: result.tx_count }} 
              />
            </li>
            <li>
              <strong>Balance:</strong> {result.balance} {result.currency}
            </li>
            <li>
              <strong>Total Received:</strong> {result.total_received} {result.currency}
            </li>
            <li>
              <strong>Total Sent:</strong> {result.total_sent} {result.currency}
            </li>
            <li>
              <strong>Transactions:</strong> {result.tx_count}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
