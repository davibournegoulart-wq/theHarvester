"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "./SaveToCaseButton";
import { PinIcon, BoxIcon } from "@/components/FlatIcons";

type FBItem = {
  item_id: string;
  price: string | null;
  status: string | null;
  is_live: boolean;
  name: string | null;
  picture: string | null;
  delivery: string | null;
  location: string | null;
  category_id: string | null;
};

type FBGroup = {
  id: string;
  name: string;
};

type FBSellerProfile = {
  seller_id: string;
  seller_name: string | null;
  total_items: number;
  rating: any;
  locations: string[];
  deliveries: string[];
  items: FBItem[];
  groups: FBGroup[];
};

export default function FacebookMarketplaceRecon() {
  const { activeCase } = useActiveCase();
  const [sellerId, setSellerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<FBSellerProfile | null>(null);

  const handleSearch = async () => {
    if (!sellerId.trim()) return;
    
    // Auto-extract seller ID from a URL if user pasted a link
    let idToSearch = sellerId.trim();
    if (idToSearch.includes("facebook.com")) {
      const match = idToSearch.match(/profile\/([0-9]+)/) || idToSearch.match(/sellerId=([0-9]+)/);
      if (match && match[1]) {
        idToSearch = match[1];
      }
    }

    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const data = await apiGet<FBSellerProfile>(`/identifiers/social-id/facebook-marketplace/${encodeURIComponent(idToSearch)}`);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch seller profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        FB Marketplace Recon 
        <span className="badge" style={{ background: "rgba(0,100,255,0.2)", color: "#00aaff" }}>SellerFB Engine</span>
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Extract a Facebook seller's inventory, average rating, locations, and joined public groups using their Seller ID or Profile URL.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          className="input-field"
          placeholder="e.g. 100000854445353 or fb.com/marketplace/profile/..."
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "SEARCHING..." : "ANALYZE SELLER"}
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(255,0,0,0.1)", color: "var(--danger)", padding: 12, borderRadius: 4, marginBottom: 24, fontSize: 13 }}>
          {error}
        </div>
      )}

      {profile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Seller Overview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>SELLER ID</div>
              <div style={{ fontFamily: "monospace", color: "var(--cyan)", fontSize: 16, wordBreak: "break-all" }}>
                {profile.seller_id}
                <SaveToCaseButton 
                  key={`id-${activeCase?.id}-${profile.seller_id}`}
                  identifierType="url" 
                  identifierValue={`https://www.facebook.com/marketplace/profile/${profile.seller_id}`} 
                  platform="facebook_marketplace" 
                  discoveredBy="fb_marketplace"
                  metadata={{ name: profile.seller_name }}
                />
              </div>
            </div>

            <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>NAME</div>
              <div style={{ fontSize: 16 }}>{profile.seller_name || "Unknown"}</div>
            </div>

            <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>TOTAL ITEMS</div>
              <div style={{ fontSize: 16, color: "var(--success)" }}>{profile.total_items}</div>
            </div>
            
            <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>RATINGS AVERAGE</div>
              <div style={{ fontSize: 16, color: "gold" }}>
                {profile.rating?.seller_stats?.five_star_ratings_average ? 
                  `${parseFloat(profile.rating.seller_stats.five_star_ratings_average).toFixed(1)} / 5.0` : 
                  "No Rating"
                }
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
             {/* Locations & Deliveries */}
             <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em" }}>DETECTED LOCATIONS</div>
                {profile.locations.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                    {profile.locations.map(l => <li key={l}>{l}</li>)}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>None detected.</div>
                )}
             </div>

             {/* Groups */}
             <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 4, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em" }}>PUBLIC GROUPS JOINED</div>
                {profile.groups.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                    {profile.groups.map(g => (
                      <li key={g.id}>
                        <a href={`https://www.facebook.com/groups/${g.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                          {g.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>None detected.</div>
                )}
             </div>
          </div>

          {/* Items Grid */}
          <h3 style={{ margin: "16px 0 0 0", fontSize: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            Inventory Items (Sample)
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
            {profile.items.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No items found or extracted.</div>
            )}
            {profile.items.map(item => (
              <div key={item.item_id} style={{
                background: "var(--bg-secondary)", 
                border: "1px solid var(--border)", 
                borderRadius: 4,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column"
              }}>
                {item.picture ? (
                  <div style={{ height: 150, background: `url(${item.picture}) center/cover no-repeat` }} />
                ) : (
                  <div style={{ height: 150, background: "#222", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
                    No Image
                  </div>
                )}
                
                <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {item.name || "Unknown Item"}
                  </div>
                  <div style={{ fontSize: 15, color: "var(--success)", marginBottom: 8 }}>
                    {item.price || "Contact for price"}
                  </div>
                  
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "auto", marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    {item.location && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <PinIcon size={12} color="var(--cyan)" /> {item.location}
                      </div>
                    )}
                    {item.delivery && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <BoxIcon size={12} color="var(--text-muted)" /> {item.delivery}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: "flex", gap: 8 }}>
                    <a 
                      href={`https://www.facebook.com/marketplace/item/${item.item_id}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn"
                      style={{ flex: 1, textAlign: "center", textDecoration: "none", fontSize: 11, padding: "4px 8px" }}
                    >
                      View Link
                    </a>
                    <SaveToCaseButton 
                      key={`item-${activeCase?.id}-${item.item_id}`}
                      identifierType="url" 
                      identifierValue={`https://www.facebook.com/marketplace/item/${item.item_id}`} 
                      platform="facebook_marketplace" 
                      discoveredBy="fb_marketplace_item"
                      metadata={{ name: item.name, price: item.price }}
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
