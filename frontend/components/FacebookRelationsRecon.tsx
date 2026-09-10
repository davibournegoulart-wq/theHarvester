"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";

type FBRelation = {
  name: string;
  userid: string;
  url_profile: string;
  picture_profile: string;
};

export default function FacebookRelationsRecon() {
  const { activeCase } = useActiveCase();
  const [userId, setUserId] = useState("");
  const [relationType, setRelationType] = useState("friends");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relations, setRelations] = useState<FBRelation[] | null>(null);

  const handleSearch = async () => {
    if (!userId.trim()) return;
    
    // Auto-extract user ID from a URL if user pasted a link
    let idToSearch = userId.trim();
    if (idToSearch.includes("facebook.com")) {
      const match = idToSearch.match(/profile\.php\?id=([0-9]+)/) || idToSearch.match(/facebook\.com\/([a-zA-Z0-9.]+)/);
      if (match && match[1]) {
        idToSearch = match[1];
        if (idToSearch === "profile.php") idToSearch = userId.trim(); // fallback
      }
    }

    setLoading(true);
    setError(null);
    setRelations(null);

    try {
      const data = await apiGet<FBRelation[]>(`/identifiers/social-id/facebook-relations/${encodeURIComponent(idToSearch)}?relation_type=${relationType}`);
      setRelations(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch relations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        FB Relations Recon 
        <span className="badge" style={{ background: "rgba(0,100,255,0.2)", color: "#00aaff" }}>RelationsFB Engine</span>
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Extract a Facebook user's public connections (Friends, Followers, Hometown, etc.) without logging in. Max 100 profiles per search.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Facebook User ID or Profile URL"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: "1 1 300px" }}
        />
        
        <select 
          className="input-field" 
          value={relationType} 
          onChange={e => setRelationType(e.target.value)}
          style={{ flex: "1 1 150px" }}
        >
          <option value="friends">Friends</option>
          <option value="followers">Followers</option>
          <option value="following">Following</option>
          <option value="hometown">Hometown</option>
          <option value="current_city">Current City</option>
          <option value="recent">Recent</option>
          <option value="high_school">High School</option>
        </select>
        
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "SEARCHING..." : "EXTRACT RELATIONS"}
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(255,0,0,0.1)", color: "var(--danger)", padding: 12, borderRadius: 4, marginBottom: 24, fontSize: 13 }}>
          {error}
        </div>
      )}

      {relations && (
        <div>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            Extracted Profiles ({relations.length})
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {relations.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13, gridColumn: "1 / -1" }}>
                No public relations found for this category or profile.
              </div>
            )}
            
            {relations.map(rel => (
              <div key={rel.userid} style={{
                background: "var(--bg-secondary)", 
                border: "1px solid var(--border)", 
                borderRadius: 4,
                padding: 12,
                display: "flex",
                alignItems: "center",
                gap: 12
              }}>
                {rel.picture_profile ? (
                  <div style={{ 
                    width: 50, 
                    height: 50, 
                    borderRadius: "50%", 
                    background: `url(${rel.picture_profile}) center/cover no-repeat`,
                    flexShrink: 0
                  }} />
                ) : (
                  <div style={{ 
                    width: 50, 
                    height: 50, 
                    borderRadius: "50%", 
                    background: "#222", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    color: "#555",
                    fontSize: 10,
                    flexShrink: 0
                  }}>
                    No Img
                  </div>
                )}
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {rel.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cyan)", fontFamily: "monospace", marginTop: 2, marginBottom: 6 }}>
                    ID: {rel.userid}
                  </div>
                  
                  <div style={{ display: "flex", gap: 8 }}>
                    <a 
                      href={rel.url_profile} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn"
                      style={{ padding: "2px 8px", fontSize: 10, textDecoration: "none" }}
                    >
                      View
                    </a>
                    <SaveToCaseButton 
                      key={`rel-${activeCase?.id}-${rel.userid}`}
                      identifierType="url" 
                      identifierValue={rel.url_profile} 
                      platform={`fb_relation_${relationType}`} 
                      discoveredBy="fb_relations"
                      metadata={{ name: rel.name, fb_id: rel.userid }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
