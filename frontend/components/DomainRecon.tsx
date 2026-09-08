"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

type Subdomain = { subdomain: string };
type Dork = { query: string; intent: string };
type IpInfo = { ip: string; asn_holder: string | null; country: string | null };

export default function DomainRecon() {
  const [domain, setDomain] = useState("");
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [dorks, setDorks] = useState<Dork[]>([]);
  const [ip, setIp] = useState("");
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDomainSearch() {
    if (!domain) return;
    setLoading(true);
    try {
      const [subs, dorkList] = await Promise.all([
        apiGet<Subdomain[]>(`/recon/domain/${encodeURIComponent(domain)}/subdomains`),
        apiGet<Dork[]>(`/recon/domain/${encodeURIComponent(domain)}/dorks`),
      ]);
      setSubdomains(subs);
      setDorks(dorkList);
    } finally {
      setLoading(false);
    }
  }

  async function handleIpSearch() {
    if (!ip) return;
    setLoading(true);
    try {
      setIpInfo(await apiGet<IpInfo>(`/recon/ip/${encodeURIComponent(ip)}`));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Domínio</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDomainSearch()}
          placeholder="exemplo.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleDomainSearch} disabled={loading}>
          Buscar
        </button>
      </div>
      {subdomains.length > 0 && (
        <>
          <p style={{ marginTop: 8, fontWeight: "bold" }}>Subdomínios (crt.sh) — pode vir vazio se estiver instável:</p>
          <ul>
            {subdomains.slice(0, 20).map((s) => (
              <li key={s.subdomain}>{s.subdomain}</li>
            ))}
          </ul>
        </>
      )}
      {dorks.length > 0 && (
        <>
          <p style={{ marginTop: 8, fontWeight: "bold" }}>Dorks sugeridos:</p>
          <ul>
            {dorks.map((d) => (
              <li key={d.query}>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`} target="_blank" rel="noreferrer">
                  {d.query}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 style={{ marginTop: 24 }}>Reputação de IP</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleIpSearch()}
          placeholder="1.1.1.1"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleIpSearch} disabled={loading}>
          Buscar
        </button>
      </div>
      {ipInfo && (
        <ul style={{ marginTop: 8 }}>
          <li>ASN: {ipInfo.asn_holder ?? "—"}</li>
          <li>País: {ipInfo.country ?? "—"}</li>
        </ul>
      )}
    </div>
  );
}
