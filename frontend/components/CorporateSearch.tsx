"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type CompanyInfo = {
  cnpj: string;
  name: string;
  trade_name: string;
  status: string;
  founded: string;
  capital: number;
  address: string;
  cnae_main: string;
  contact_phone: string | null;
  contact_email: string | null;
  partners: { name: string; role: string }[];
};

type SecFiling = {
  company_name: string;
  cik: string;
  filing_date: string | null;
  form_type: string | null;
  url: string | null;
};

type UkCompany = {
  name: string;
  company_number: string;
  status: string | null;
  registration_date: string | null;
  address: Record<string, any>;
};

type OffshoreLeak = {
  name: string;
  source_dataset: string;
  url: string | null;
};

type GlobalCorporateResult = {
  query: string;
  sec_filings: SecFiling[];
  uk_companies: UkCompany[];
  offshore_leaks: OffshoreLeak[];
};

export default function CorporateSearch() {
  const { activeCase } = useActiveCase();
  const [subTab, setSubTab] = useState<"global" | "cnpj">("global");

  // Global search state
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResult, setGlobalResult] = useState<GlobalCorporateResult | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // CNPJ search state
  const [cnpj, setCnpj] = useState("");
  const [result, setResult] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGlobalSearch() {
    if (!globalQuery.trim()) return;
    setGlobalLoading(true);
    setGlobalError(null);
    setGlobalResult(null);
    try {
      const data = await apiGet<GlobalCorporateResult>(
        `/identifiers/corporate/global?query=${encodeURIComponent(globalQuery.trim())}`
      );
      setGlobalResult(data);
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Error querying global registries");
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleCnpjSearch() {
    if (!cnpj) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiGet<CompanyInfo>(
        `/identifiers/corporate/cnpj?cnpj=${encodeURIComponent(cnpj)}`
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error querying CNPJ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Sub tabs: Global vs Brazil CNPJ */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setSubTab("global")}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: "none",
            borderBottom: subTab === "global" ? "2px solid var(--cyan)" : "2px solid transparent",
            color: subTab === "global" ? "var(--cyan)" : "var(--text-muted)",
            fontWeight: subTab === "global" ? "bold" : "normal",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          GLOBAL ENTERPRISES (SEC EDGAR / UK / ICIJ OFFSHORE)
        </button>
        <button
          onClick={() => setSubTab("cnpj")}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: "none",
            borderBottom: subTab === "cnpj" ? "2px solid var(--cyan)" : "2px solid transparent",
            color: subTab === "cnpj" ? "var(--cyan)" : "var(--text-muted)",
            fontWeight: subTab === "cnpj" ? "bold" : "normal",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          BRAZIL CNPJ (RECEITA FEDERAL)
        </button>
      </div>

      {/* Global Enterprise Search */}
      {subTab === "global" && (
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
            Search global corporate registries and databases simultaneously: <strong>US SEC EDGAR</strong> (10-K public filings), <strong>UK Companies House</strong>, and <strong>ICIJ Offshore Leaks</strong> (Panama/Pandora/Paradise Papers).
          </p>
          <div style={{ display: "flex", gap: 8, maxWidth: 640 }}>
            <input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
              placeholder="Company name, entity, or officer name (e.g. Apple, Glencore, Mossack)"
              style={{ flex: 1, padding: 8 }}
            />
            <button onClick={handleGlobalSearch} disabled={globalLoading}>
              {globalLoading ? "Searching..." : "Search Global"}
            </button>
          </div>
          {globalError && <p style={{ color: "var(--danger)", marginTop: 12 }}>{globalError}</p>}

          {globalResult && (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Summary Stats */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span className="badge" style={{ background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", padding: "4px 10px" }}>
                  SEC EDGAR: {globalResult.sec_filings.length} filings
                </span>
                <span className="badge" style={{ background: "rgba(225, 48, 108, 0.15)", color: "#E1306C", padding: "4px 10px" }}>
                  UK Companies: {globalResult.uk_companies.length} entities
                </span>
                <span className="badge" style={{ background: "rgba(255, 152, 0, 0.15)", color: "#FF9800", padding: "4px 10px" }}>
                  ICIJ Offshore Leaks: {globalResult.offshore_leaks.length} records
                </span>
              </div>

              {/* SEC EDGAR Results */}
              {globalResult.sec_filings.length > 0 && (
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    US SEC EDGAR Public Filings (10-K)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                    {globalResult.sec_filings.map((f, i) => (
                      <div key={`sec-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-primary)", borderRadius: 4 }}>
                        <div>
                          <strong>{f.company_name}</strong>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            CIK: {f.cik} | Form: {f.form_type || "N/A"} | Date: {f.filing_date || "N/A"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {f.url && (
                            <a href={f.url} target="_blank" rel="noreferrer" className="btn" style={{ fontSize: 11, padding: "3px 8px", textDecoration: "none" }}>
                              View SEC
                            </a>
                          )}
                          <SaveToCaseButton
                            identifierType="corporate"
                            identifierValue={`${f.company_name} (CIK:${f.cik})`}
                            platform="sec_edgar"
                            url={f.url}
                            discoveredBy="recon.corporate_registry"
                            metadata={{ cik: f.cik, form: f.form_type, date: f.filing_date }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ICIJ Offshore Leaks Results */}
              {globalResult.offshore_leaks.length > 0 && (
                <div style={{ background: "var(--bg-secondary)", border: "1px solid rgba(255,152,0,0.3)", borderRadius: 6, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#FF9800", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    ICIJ Offshore Leaks Database (Panama / Pandora / Paradise Papers)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                    {globalResult.offshore_leaks.map((o, i) => (
                      <div key={`icij-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-primary)", borderRadius: 4 }}>
                        <div>
                          <strong style={{ color: "#FF9800" }}>{o.name}</strong>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Dataset: {o.source_dataset}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {o.url && (
                            <a href={o.url} target="_blank" rel="noreferrer" className="btn" style={{ fontSize: 11, padding: "3px 8px", textDecoration: "none" }}>
                              View ICIJ
                            </a>
                          )}
                          <SaveToCaseButton
                            identifierType="corporate"
                            identifierValue={o.name}
                            platform="icij_offshore_leaks"
                            url={o.url}
                            discoveredBy="recon.corporate_registry"
                            metadata={{ dataset: o.source_dataset }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UK Companies House Results */}
              {globalResult.uk_companies.length > 0 && (
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#E1306C" }}>UK Companies House</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                    {globalResult.uk_companies.map((c, i) => (
                      <div key={`uk-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-primary)", borderRadius: 4 }}>
                        <div>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Number: {c.company_number} | Status: {c.status || "unknown"} | Created: {c.registration_date || "N/A"}
                          </div>
                        </div>
                        <SaveToCaseButton
                          identifierType="corporate"
                          identifierValue={`${c.name} (${c.company_number})`}
                          platform="uk_companies_house"
                          discoveredBy="recon.corporate_registry"
                          metadata={{ company_number: c.company_number, status: c.status }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Links to External Global Registries */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
                <h4 style={{ margin: "0 0 8px 0", color: "var(--cyan)" }}>External Worldwide Business Registries</h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  Direct deep query links for external international corporate research engines:
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={`https://opencorporates.com/companies?q=${encodeURIComponent(globalQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    OpenCorporates Global Search ↗
                  </a>
                  <a
                    href={`https://www.gleif.org/en/lei-data/access-and-use-lei-data/search-for-lei-records?search=${encodeURIComponent(globalQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    GLEIF (Global Legal Entity Identifier) ↗
                  </a>
                  <a
                    href={`https://www.dnb.com/business-directory/company-search.html?term=${encodeURIComponent(globalQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    Dun & Bradstreet ↗
                  </a>
                  <a
                    href={`https://offshoreleaks.icij.org/search?q=${encodeURIComponent(globalQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    ICIJ Full Portal ↗
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brazil CNPJ Search */}
      {subTab === "cnpj" && (
        <div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
            Consult Receita Federal Brazil corporate registry (ReceitaWS / BrasilAPI) by CNPJ number.
          </p>
          <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCnpjSearch()}
              placeholder="CNPJ (digits only, e.g. 00000000000191)"
              style={{ flex: 1, padding: 8 }}
            />
            <button onClick={handleCnpjSearch} disabled={loading}>
              {loading ? "Searching..." : "Search CNPJ"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
          {result && (
            <div style={{ marginTop: 16 }}>
              <ul style={{ paddingLeft: 20 }}>
                <li>
                  <strong>{result.name}</strong> ({result.trade_name}){" "}
                  <SaveToCaseButton
                    identifierType="corporate"
                    identifierValue={result.cnpj}
                    platform="brasil_api"
                    exists={true}
                    discoveredBy="checkers.corporate"
                    metadata={{ name: result.name, status: result.status, capital: result.capital }}
                  />
                </li>
                <li>CNPJ: {result.cnpj}</li>
                <li>Status: {result.status}</li>
                <li>Capital: R$ {result.capital.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>
                <li>Founded: {result.founded}</li>
                <li>Address: {result.address}</li>
                <li>CNAE Main: {result.cnae_main}</li>
              </ul>

              {(result.contact_phone || result.contact_email) && (
                <>
                  <h4 style={{ margin: "16px 0 8px 0" }}>Declared Contacts (Pivot)</h4>
                  <ul>
                    {result.contact_phone && (
                      <li>
                        Phone: {result.contact_phone}{" "}
                        <SaveToCaseButton
                          identifierType="phone"
                          identifierValue={result.contact_phone}
                          platform="corporate_registration"
                          exists={true}
                          discoveredBy="checkers.corporate"
                          metadata={{ source_cnpj: result.cnpj }}
                        />
                      </li>
                    )}
                    {result.contact_email && (
                      <li>
                        Email: {result.contact_email}{" "}
                        <SaveToCaseButton
                          identifierType="email"
                          identifierValue={result.contact_email}
                          platform="corporate_registration"
                          exists={true}
                          discoveredBy="checkers.corporate"
                          metadata={{ source_cnpj: result.cnpj }}
                        />
                      </li>
                    )}
                  </ul>
                </>
              )}

              {result.partners.length > 0 && (
                <>
                  <h4 style={{ margin: "16px 0 8px 0" }}>Partners (QSA)</h4>
                  <ul>
                    {result.partners.map((p, i) => (
                      <li key={`${activeCase?.id}-${result.cnpj}-${i}`}>
                        {p.name} — {p.role}{" "}
                        <SaveToCaseButton
                          identifierType="person"
                          identifierValue={p.name}
                          platform="corporate_qsa"
                          exists={true}
                          discoveredBy="checkers.corporate"
                          metadata={{ role: p.role, source_cnpj: result.cnpj }}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
