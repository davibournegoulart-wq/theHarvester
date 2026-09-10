"use client";

import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";

type CountryListItem = {
  country: string;
  count: number;
};

type Resource = {
  name: string;
  url: string;
  description: string;
};

type CountryDetails = {
  country: string;
  resources: Resource[];
};

export default function GlobalOSINT() {
  const { activeCase } = useActiveCase();
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [details, setDetails] = useState<CountryDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCountries();
  }, [search]);

  useEffect(() => {
    if (selectedCountry) {
      fetchDetails(selectedCountry);
    }
  }, [selectedCountry]);

  const fetchCountries = async () => {
    try {
      const q = search ? `?query=${encodeURIComponent(search)}` : "";
      const res = await apiGet<{ countries: CountryListItem[] }>(`/arsenal/countries${q}`);
      setCountries(res.countries);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDetails = async (c: string) => {
    setLoading(true);
    try {
      const res = await apiGet<CountryDetails>(`/arsenal/countries/${encodeURIComponent(c)}`);
      setDetails(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", padding: 0 }}>
      <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 12, margin: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          GLOBAL OSINT TRACKER
          <span className="badge" style={{ background: "rgba(0,255,100,0.2)", color: "#00ff66" }}>240+ Territories</span>
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0 0" }}>
          Specific intelligence resources, local search engines, and databases segmented by country.
        </p>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 300, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search country..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {countries.map(c => (
              <div 
                key={c.country}
                onClick={() => setSelectedCountry(c.country)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: selectedCountry === c.country ? "rgba(0,255,200,0.1)" : "transparent",
                  color: selectedCountry === c.country ? "var(--cyan)" : "inherit",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: 14, fontWeight: selectedCountry === c.country ? "bold" : "normal" }}>
                  {c.country}
                </span>
                <span className="badge" style={{ fontSize: 10, background: "rgba(255,255,255,0.1)" }}>
                  {c.count} tools
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "var(--bg-secondary)" }}>
          {!selectedCountry && (
            <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 100 }}>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </div>
              <h3>Select a country or territory from the sidebar</h3>
              <p>To view its specific OSINT resources</p>
            </div>
          )}

          {loading && selectedCountry && (
            <div style={{ color: "var(--cyan)" }}>Loading resources for {selectedCountry}...</div>
          )}

          {details && !loading && (
            <div>
              <h2 style={{ fontSize: 24, margin: "0 0 24px 0", color: "var(--text)" }}>
                {details.country} OSINT Resources
              </h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {details.resources.map((res, i) => (
                  <div key={i} style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16
                  }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: 15, color: "var(--cyan)" }}>
                        {res.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {res.description}
                      </p>
                      <a 
                        href={res.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#00ffcc", textDecoration: "none" }}
                      >
                        {res.url.length > 60 ? res.url.substring(0, 60) + '...' : res.url} ↗
                      </a>
                    </div>
                    <div>
                      <SaveToCaseButton 
                        identifierType="url"
                        identifierValue={res.url}
                        platform={`global_osint_${details.country.toLowerCase().replace(/ /g, '_')}`}
                        discoveredBy="global_osint"
                        metadata={{ name: res.name, country: details.country }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
