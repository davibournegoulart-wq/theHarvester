"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type DnsRecord = { type: string; value: string };
type Subdomain = { subdomain: string; ip: string };

type DomainResult = {
  dns_records: DnsRecord[];
  subdomains: Subdomain[];
};

export default function DomainRecon() {
  const { activeCase } = useActiveCase();
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<DomainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!domain || !activeCase) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiGet<DomainResult>(`/identifiers/domain/recon?domain=${encodeURIComponent(domain)}`);
      setResult(data);

      
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error querying domain");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="example.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Scanning..." : "Recon"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          
          
          <h4 style={{ margin: "16px 0 8px 0", display: "flex", alignItems: "center", gap: 8 }}>
            DNS Records
            <SaveToCaseButton key={`${activeCase?.id}-${domain}`} 
              identifierType="domain" 
              identifierValue={domain} 
              platform="dns" 
              exists={true}
              discoveredBy="checkers.domain" 
              metadata={{ dns_records: result.dns_records.length, subdomains: result.subdomains.length }} 
            />
          </h4>
          <table style={{ width: "100%", maxWidth: 600, textAlign: "left", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Type</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {result.dns_records.map((r, i) => (
                <tr key={i}>
                  <td>{r.type}</td>
                  <td style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{r.value}</td>
                </tr>
              ))}
              {result.dns_records.length === 0 && (
                <tr>
                  <td colSpan={2}>No records found.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h4 style={{ margin: "16px 0 8px 0" }}>Subdomains (Brute Force/CT)</h4>
          <ul style={{ paddingLeft: 20 }}>
            {result.subdomains.map((s, i) => (
              <li key={i}>
                <strong>{s.subdomain}</strong> (IP: {s.ip})
              </li>
            ))}
            {result.subdomains.length === 0 && <li>No subdomains found.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
