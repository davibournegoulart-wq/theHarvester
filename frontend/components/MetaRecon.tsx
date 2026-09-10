"use client";

import { useState } from "react";
import FacebookMarketplaceRecon from "./FacebookMarketplaceRecon";
import FacebookRelationsRecon from "./FacebookRelationsRecon";
import { apiGet } from "@/lib/api";
import SaveToCaseButton from "./SaveToCaseButton";
import { CheckIcon, CrossIcon } from "@/components/FlatIcons";

// The ID Pivot from ToolsPanel
function FacebookPivot() {
  const [profileUrl, setProfileUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!profileUrl) return;
    setLoading(true);
    setResult(null);
    try {
      // Net Scraper backend logic for FB Pivot? Or just do a simple extract
      let username = profileUrl;
      if (profileUrl.includes("facebook.com")) {
        const match = profileUrl.match(/facebook\.com\/([a-zA-Z0-9.]+)/);
        if (match) username = match[1];
      }
      const data: any = await apiGet(`/identifiers/social-id/facebook-marketplace/${encodeURIComponent(username)}`);
      setResult({ username, id: data?.seller?.id || "Not found natively, try manual extraction" });
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-secondary)" }}>
      <h3 style={{ margin: "0 0 8px 0", color: "var(--cyan)" }}>Facebook Pivot (ID Extraction)</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input 
          className="input-field" 
          placeholder="https://facebook.com/username" 
          value={profileUrl} 
          onChange={e => setProfileUrl(e.target.value)} 
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleSearch}>{loading ? "..." : "Extract ID"}</button>
      </div>
      {result && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--bg-primary)", borderRadius: 4 }}>
          {result.error ? (
            <span style={{ color: "var(--danger)" }}>{result.error}</span>
          ) : (
            <div>
              <strong>Extracted ID:</strong> <span style={{ fontFamily: "monospace", color: "var(--cyan)" }}>{result.id}</span>
              <div style={{ marginTop: 8 }}>
                <SaveToCaseButton identifierType="username" identifierValue={result.id} platform="facebook" discoveredBy="meta_pivot" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InstagramRecon() {
  const [username, setUsername] = useState("");
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleInspect = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setProfileData(null);
    const clean = username.trim().replace("@", "");
    try {
      const data: any = await apiGet(`/identifiers/instagram/profile/${encodeURIComponent(clean)}`);
      setProfileData(data);
    } catch (e: any) {
      setProfileData({ error: e.message, username: clean });
    }
    setLoading(false);
  };

  const clean = username.trim().replace("@", "");

  return (
    <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-secondary)" }}>
      <h3 style={{ margin: "0 0 8px 0", color: "#E1306C", display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
        Instagram Deep Recon & ID Pivot
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Natively extracts permanent numeric `profile_id` to track targets across username changes, and generates direct links to web mirror viewers (Imginn, Picuki).
      </p>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input 
          className="input-field" 
          placeholder="Instagram Username (e.g. zuck)" 
          value={username} 
          onChange={e => setUsername(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && handleInspect()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleInspect} disabled={loading}>
          {loading ? "INSPECTING..." : "NATIVE INSPECT"}
        </button>
      </div>

      {profileData && (
        <div style={{ marginTop: 16, padding: 14, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6 }}>
          {profileData.profile_id ? (
            <div>
              <div style={{ color: "#E1306C", fontWeight: "bold", fontSize: 14 }}>
                PERMANENT NUMERIC ID: <span style={{ fontFamily: "monospace", color: "var(--cyan)" }}>{profileData.profile_id}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Target can change their @handle, but this internal Instagram identifier remains unchanged.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <SaveToCaseButton
                  identifierType="username"
                  identifierValue={clean}
                  platform="instagram"
                  url={`https://www.instagram.com/${clean}/`}
                  discoveredBy="recon.instagram_deep"
                  metadata={{ profile_id: profileData.profile_id }}
                />
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Target @{clean} profile reached. Use the external mirrors below if the account is age-restricted or login-gated.
            </div>
          )}
        </div>
      )}

      {clean && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: "bold" }}>
            ANONYMOUS THIRD-PARTY MIRRORS & STORY VIEWERS (BYPASS LOGIN WALLS):
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={`https://imginn.com/${clean}/`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Imginn Mirror ↗
            </a>
            <a href={`https://www.picuki.com/profile/${clean}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Picuki Viewer ↗
            </a>
            <a href={`https://www.instagram.com/${clean}/`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>
              Instagram Official ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppRecon() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkWhatsApp = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const data = await apiGet(`/identifiers/phone/whatsapp?phone=${encodeURIComponent(phone)}`);
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-secondary)" }}>
      <h3 style={{ margin: "0 0 8px 0", color: "#25D366" }}>WhatsApp Recon</h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Validate if a phone number is registered on WhatsApp and generate direct chat links.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input 
          className="input-field" 
          placeholder="+1234567890" 
          value={phone} 
          onChange={e => setPhone(e.target.value)} 
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={checkWhatsApp}>{loading ? "..." : "Validate"}</button>
      </div>
      {result && (
        <div style={{ marginTop: 12 }}>
          {result.error ? (
            <span style={{ color: "var(--danger)" }}>{result.error}</span>
          ) : (
            <div style={{ padding: 12, background: "var(--bg-primary)", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <strong>Status:</strong>{" "}
              {result.exists ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                  <CheckIcon size={12} color="var(--success)" /> Registered on WhatsApp
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--danger)" }}>
                  <CrossIcon size={12} color="var(--danger)" /> Not registered
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <a href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ textDecoration: "none" }}>Open Direct Chat (WA.me)</a>
      </div>
    </div>
  );
}

export default function MetaRecon() {
  const [activeSubTab, setActiveSubTab] = useState("facebook");

  return (
    <div className="card" style={{ padding: 0, height: "calc(100vh - 180px)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ margin: 0, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
          </svg>
          META OSINT SUITE
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0 0" }}>Unified intelligence tools for Facebook, Instagram, and WhatsApp.</p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
        <button 
          className="btn" 
          style={{ flex: 1, borderRadius: 0, border: "none", borderBottom: activeSubTab === "facebook" ? "2px solid var(--cyan)" : "2px solid transparent", color: activeSubTab === "facebook" ? "var(--cyan)" : "inherit" }}
          onClick={() => setActiveSubTab("facebook")}
        >
          FACEBOOK
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, borderRadius: 0, border: "none", borderBottom: activeSubTab === "instagram" ? "2px solid #E1306C" : "2px solid transparent", color: activeSubTab === "instagram" ? "#E1306C" : "inherit" }}
          onClick={() => setActiveSubTab("instagram")}
        >
          INSTAGRAM
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, borderRadius: 0, border: "none", borderBottom: activeSubTab === "whatsapp" ? "2px solid #25D366" : "2px solid transparent", color: activeSubTab === "whatsapp" ? "#25D366" : "inherit" }}
          onClick={() => setActiveSubTab("whatsapp")}
        >
          WHATSAPP
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {activeSubTab === "facebook" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <FacebookPivot />
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--border)", fontWeight: "bold" }}>
                Relations (Friends/Followers)
              </div>
              <FacebookRelationsRecon />
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--border)", fontWeight: "bold" }}>
                Marketplace Recon
              </div>
              <FacebookMarketplaceRecon />
            </div>
          </div>
        )}

        {activeSubTab === "instagram" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <InstagramRecon />
          </div>
        )}

        {activeSubTab === "whatsapp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <WhatsAppRecon />
          </div>
        )}
      </div>
    </div>
  );
}
