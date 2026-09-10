"use client";

import { useState } from "react";
import { apiGet, apiPostJson, apiFetch } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import { SpiderIcon, KeyIcon } from "@/components/FlatIcons";

type ScrapedSecret = {
  rule_name: string;
  severity: string;
  masked_value: string;
  entropy: number;
  length: number;
  discovered_by: string;
};

type ScrapedEntities = {
  emails: string[];
  phones: string[];
  btc_addresses: string[];
  eth_addresses: string[];
  cpfs: string[];
  secrets?: ScrapedSecret[];
};

type ScrapyPage = {
  url: string;
  status: number;
  title: string;
  depth: number;
  emails: string[];
  phones: string[];
  btc_wallets: string[];
  eth_wallets: string[];
  documents: { url: string; ext: string; filename: string }[];
};

type ScrapyResult = {
  target_url: string;
  pages_crawled: number;
  summary: {
    emails_found: string[];
    phones_found: string[];
    btc_wallets: string[];
    eth_wallets: string[];
    documents_found: { url: string; ext: string; filename: string }[];
  };
  pages: ScrapyPage[];
};

export default function DeepScraperTool() {
  const { activeCase } = useActiveCase();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"url" | "scrapy" | "text">("scrapy");
  const [useTor, setUseTor] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [maxPages, setMaxPages] = useState<number>(15);
  const [result, setResult] = useState<ScrapedEntities | null>(null);
  const [scrapyResult, setScrapyResult] = useState<ScrapyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  async function handleExtract() {
    setLoading(true);
    setError(null);
    setResult(null);
    setScrapyResult(null);
    setSavedItems(new Set());
    try {
      if (mode === "scrapy") {
        if (!url) throw new Error("Please enter a target URL for Scrapy.");
        const data = await apiPostJson<ScrapyResult>(`/recon/scrapy/crawl`, {
          url,
          max_depth: Number(maxDepth),
          max_pages: Number(maxPages),
          use_tor: useTor,
        });
        setScrapyResult(data);
      } else if (mode === "url") {
        if (!url) throw new Error("Please enter a URL.");
        setResult(await apiGet<ScrapedEntities>(`/recon/scrape?url=${encodeURIComponent(url)}&use_tor=${useTor}`));
      } else {
        if (!text) throw new Error("Please enter text.");
        setResult(await apiPostJson<ScrapedEntities>(`/recon/scrape/text`, { text }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(type: string, value: string, sourceUrl?: string) {
    if (!activeCase) {
      alert("Please select an active case first.");
      return;
    }
    const investigator = localStorage.getItem("investigator_name") || "anonymous_investigator";
    
    try {
      await apiPostJson(`/cases/${activeCase.id}/findings`, {
        identifier_type: type,
        identifier_value: value,
        platform: sourceUrl || (mode === "text" ? "Text/Manual Dork" : url),
        exists: true,
        discovered_by: `scrapy_spider (${investigator})`
      });
      setSavedItems(new Set(savedItems).add(`${type}:${value}`));
    } catch (e) {
      alert("Error saving finding.");
    }
  }

  const hasResults = result && (
    result.emails.length > 0 ||
    result.phones.length > 0 ||
    result.btc_addresses.length > 0 ||
    result.eth_addresses.length > 0 ||
    result.cpfs.length > 0
  );

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ color: "var(--cyan)" }}>Deep Scraper & Scrapy Spider (Multi-depth OSINT)</h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 750 }}>
        Extract intelligence from websites or text dumps. Use <strong>Scrapy Spider</strong> to follow internal links, harvest emails, phones, crypto wallets, and uncover documents (.pdf, .docx, .xlsx, .zip) across deep pages.
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" checked={mode === "scrapy"} onChange={() => setMode("scrapy")} />
          <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--accent)" }}>Scrapy Spider (Multi-Page Crawl)</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" checked={mode === "url"} onChange={() => setMode("url")} />
          <span style={{ fontSize: 13 }}>Single Web Page</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" checked={mode === "text"} onChange={() => setMode("text")} />
          <span style={{ fontSize: 13 }}>Paste Text / Dump</span>
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 650 }}>
        {mode !== "text" ? (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                placeholder={mode === "scrapy" ? "https://target-domain.com or onion url..." : "https://pastebin.com/..."}
                style={{ flex: 1, padding: 8 }}
              />
            </div>
            {mode === "scrapy" && (
              <div style={{ display: "flex", gap: 16, alignItems: "center", background: "var(--surface)", padding: 8, borderRadius: 4, border: "1px solid var(--border)" }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  Depth Limit:
                  <select value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} style={{ padding: 4 }}>
                    <option value={1}>1 (Entry page only)</option>
                    <option value={2}>2 (Follow direct links)</option>
                    <option value={3}>3 (Deep follow - 3 levels)</option>
                  </select>
                </label>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  Max Pages:
                  <select value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} style={{ padding: 4 }}>
                    <option value={5}>5 pages</option>
                    <option value={15}>15 pages</option>
                    <option value={30}>30 pages</option>
                    <option value={50}>50 pages</option>
                  </select>
                </label>
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
              <input type="checkbox" checked={useTor} onChange={(e) => setUseTor(e.target.checked)} />
              Route through Tor Proxy (anonymity & .onion support)
            </label>
          </>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text dump here..."
            style={{ width: "100%", height: 120, padding: 8, background: "var(--panel)", color: "var(--text)", border: "1px solid var(--panel-border)" }}
          />
        )}
        <button onClick={handleExtract} disabled={loading} style={{ width: 180, marginTop: 8 }}>
          {loading ? (mode === "scrapy" ? "Scrapy Crawling..." : "Extracting...") : (mode === "scrapy" ? "Run Scrapy Spider" : "Extract Entities")}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>}

      {/* Scrapy Spider Results UI */}
      {scrapyResult && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 8 }}>
              <SpiderIcon size={18} color="var(--cyan)" />
              Scrapy Crawl Complete: {scrapyResult.pages_crawled} pages analyzed
            </h4>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
            {/* Emails */}
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h5 style={{ margin: "0 0 8px 0", color: "var(--accent)" }}>Emails ({scrapyResult.summary.emails_found.length})</h5>
              {scrapyResult.summary.emails_found.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None found</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 12, wordBreak: "break-all" }}>
                  {scrapyResult.summary.emails_found.map((em) => (
                    <li key={em} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span>{em}</span>
                      <button
                        onClick={() => handleSave("email", em)}
                        disabled={savedItems.has(`email:${em}`)}
                        style={{ fontSize: 10, padding: "2px 6px", background: savedItems.has(`email:${em}`) ? "var(--success)" : "var(--panel)" }}
                      >
                        {savedItems.has(`email:${em}`) ? "Saved" : "+"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Phones */}
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h5 style={{ margin: "0 0 8px 0", color: "var(--accent)" }}>Phones ({scrapyResult.summary.phones_found.length})</h5>
              {scrapyResult.summary.phones_found.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None found</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 12, wordBreak: "break-all" }}>
                  {scrapyResult.summary.phones_found.map((ph) => (
                    <li key={ph} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span>{ph}</span>
                      <button
                        onClick={() => handleSave("phone", ph)}
                        disabled={savedItems.has(`phone:${ph}`)}
                        style={{ fontSize: 10, padding: "2px 6px", background: savedItems.has(`phone:${ph}`) ? "var(--success)" : "var(--panel)" }}
                      >
                        {savedItems.has(`phone:${ph}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Crypto */}
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h5 style={{ margin: "0 0 8px 0", color: "var(--accent)" }}>
                Crypto Wallets ({scrapyResult.summary.btc_wallets.length + scrapyResult.summary.eth_wallets.length})
              </h5>
              {scrapyResult.summary.btc_wallets.length === 0 && scrapyResult.summary.eth_wallets.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None found</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 12, wordBreak: "break-all" }}>
                  {scrapyResult.summary.btc_wallets.map((b) => (
                    <li key={b} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span>BTC: {b.slice(0, 10)}...</span>
                      <button
                        onClick={() => handleSave("crypto", b)}
                        disabled={savedItems.has(`crypto:${b}`)}
                        style={{ fontSize: 10, padding: "2px 6px" }}
                      >
                        +
                      </button>
                    </li>
                  ))}
                  {scrapyResult.summary.eth_wallets.map((eth) => (
                    <li key={eth} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span>ETH: {eth.slice(0, 10)}...</span>
                      <button
                        onClick={() => handleSave("crypto", eth)}
                        disabled={savedItems.has(`crypto:${eth}`)}
                        style={{ fontSize: 10, padding: "2px 6px" }}
                      >
                        +
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Discovered Documents */}
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h5 style={{ margin: "0 0 8px 0", color: "var(--accent)" }}>Documents & Files ({scrapyResult.summary.documents_found.length})</h5>
              {scrapyResult.summary.documents_found.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None found</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 12, wordBreak: "break-all" }}>
                  {scrapyResult.summary.documents_found.slice(0, 8).map((doc, idx) => (
                    <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span title={doc.url}>[{doc.ext.toUpperCase()}] {doc.filename.slice(0, 20)}</span>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--cyan)" }}>
                        Link
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Detailed Crawled Pages List */}
          <details style={{ background: "var(--surface)", padding: 12, borderRadius: 4, border: "1px solid var(--border)" }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>
              View Crawled Pages Detail ({scrapyResult.pages.length} Pages)
            </summary>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {scrapyResult.pages.map((p, idx) => (
                <div key={idx} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: "bold" }}>
                      {p.title || p.url}
                    </a>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Depth: {p.depth} | Status: {p.status}</span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{p.url}</div>
                  {(p.emails.length > 0 || p.phones.length > 0 || p.documents.length > 0) && (
                    <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
                      {p.emails.length > 0 && <span style={{ color: "var(--cyan)" }}>Emails: {p.emails.join(", ")}</span>}
                      {p.phones.length > 0 && <span style={{ color: "var(--success)" }}>Phones: {p.phones.join(", ")}</span>}
                      {p.documents.length > 0 && <span style={{ color: "var(--warning)" }}>Docs: {p.documents.length} files</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Legacy/Single Page results */}
      {result && !hasResults && (
        <p style={{ marginTop: 16, color: "var(--text-muted)" }}>No entities found in document.</p>
      )}

      {hasResults && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          {result.emails.length > 0 && (
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--cyan)" }}>Emails ({result.emails.length})</h4>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13, wordBreak: "break-all" }}>
                {result.emails.map(e => (
                  <li key={e} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    {e} 
                    <button 
                      onClick={() => handleSave("email", e)} 
                      disabled={savedItems.has(`email:${e}`)}
                      style={{ fontSize: 10, padding: "2px 4px", background: savedItems.has(`email:${e}`) ? "var(--success)" : "var(--panel)" }}>
                      {savedItems.has(`email:${e}`) ? "Saved" : "+"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {result.phones.length > 0 && (
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--cyan)" }}>Phones ({result.phones.length})</h4>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13, wordBreak: "break-all" }}>
                {result.phones.map(e => (
                  <li key={e} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    {e}
                    <button 
                      onClick={() => handleSave("phone", e)} 
                      disabled={savedItems.has(`phone:${e}`)}
                      style={{ fontSize: 10, padding: "2px 4px", background: savedItems.has(`phone:${e}`) ? "var(--success)" : "var(--panel)" }}>
                      {savedItems.has(`phone:${e}`) ? "Saved" : "+"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {result.cpfs.length > 0 && (
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--cyan)" }}>CPFs / CNPJs ({result.cpfs.length})</h4>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13, wordBreak: "break-all" }}>
                {result.cpfs.map(e => (
                  <li key={e} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    {e}
                    <button 
                      onClick={() => handleSave("corporate", e)} 
                      disabled={savedItems.has(`corporate:${e}`)}
                      style={{ fontSize: 10, padding: "2px 4px", background: savedItems.has(`corporate:${e}`) ? "var(--success)" : "var(--panel)" }}>
                      {savedItems.has(`corporate:${e}`) ? "Saved" : "+"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {(result.btc_addresses.length > 0 || result.eth_addresses.length > 0) && (
            <div style={{ border: "1px solid var(--border)", padding: 12, background: "var(--surface)", borderRadius: 4 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "var(--cyan)" }}>Crypto</h4>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13, wordBreak: "break-all" }}>
                {result.btc_addresses.map(e => (
                  <li key={e} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    BTC: {e}
                    <button onClick={() => handleSave("crypto", e)} disabled={savedItems.has(`crypto:${e}`)} style={{ fontSize: 10, padding: "2px 4px" }}>+</button>
                  </li>
                ))}
                {result.eth_addresses.map(e => (
                  <li key={e} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    ETH: {e}
                    <button onClick={() => handleSave("crypto", e)} disabled={savedItems.has(`crypto:${e}`)} style={{ fontSize: 10, padding: "2px 4px" }}>+</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.secrets && result.secrets.length > 0 && (
            <div style={{ border: "1px solid #ff0055", padding: 12, background: "rgba(255, 0, 85, 0.05)", borderRadius: 4, gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, color: "#ff5577", display: "flex", alignItems: "center", gap: 8 }}>
                  <KeyIcon size={16} color="#ff5577" />
                  Exposed Secrets &amp; API Keys ({result.secrets.length})
                </h4>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Gitleaks / TruffleHog entropy engine
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 12 }}>
                {result.secrets.map((sec, idx) => (
                  <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "4px 8px", background: "#080c14", border: "1px solid var(--panel-border)" }}>
                    <div>
                      <span style={{ color: "#ff0055", fontWeight: "bold", marginRight: 8 }}>[{sec.severity}]</span>
                      <strong>{sec.rule_name}:</strong> <code style={{ color: "var(--cyan)", marginLeft: 6 }}>{sec.masked_value}</code>
                      <span style={{ color: "var(--text-muted)", fontSize: 10, marginLeft: 10 }}>Entropy: {sec.entropy}</span>
                    </div>
                    <button
                      onClick={() => handleSave("corporate", `${sec.rule_name}: ${sec.masked_value}`)}
                      disabled={savedItems.has(`corporate:${sec.rule_name}: ${sec.masked_value}`)}
                      style={{ fontSize: 10, padding: "2px 6px", background: savedItems.has(`corporate:${sec.rule_name}: ${sec.masked_value}`) ? "var(--success)" : "var(--panel)" }}
                    >
                      {savedItems.has(`corporate:${sec.rule_name}: ${sec.masked_value}`) ? "Saved" : "+ Save"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
