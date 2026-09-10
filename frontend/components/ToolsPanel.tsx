"use client";

import { useState } from "react";
import { apiGet, apiFetch, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import DeepScraperTool from "./DeepScraperTool";

type ReverseImageLink = { engine: string; search_url: string };
type PasswordBreachResult = { times_seen: number };
type ImageExifResult = {
  has_gps: boolean;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  taken_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
};

type DocumentMetadata = {
  title: string | null;
  author: string | null;
  creation_date: string | null;
  modification_date: string | null;
  creator_tool: string | null;
  company: string | null;
  producer: string | null;
  page_count: number | null;
  encrypted: boolean;
};

function formatPdfDate(dateStr: string | null) {
  if (!dateStr) return "not available";
  if (dateStr.startsWith("D:")) {
    const year = dateStr.slice(2, 6);
    const month = dateStr.slice(6, 8);
    const day = dateStr.slice(8, 10);
    const hour = dateStr.slice(10, 12);
    const min = dateStr.slice(12, 14);
    const sec = dateStr.slice(14, 16);
    return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
  }
  return dateStr;
}

function DocumentMetadataTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch("/recon/document/metadata", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Error ${response.status}`);
      }
      setResult(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error processing document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Document Metadata (PDF/DOCX/XLSX)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Extracts author information, creation software, and revision history.
      </p>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input type="file" accept=".pdf,.docx,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ flex: 1 }} />
        <button onClick={handleExtract} disabled={loading || !file}>
          {loading ? "Reading..." : "Extract metadata"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>}
      {result && (
        <ul style={{ marginTop: 12, border: "1px solid var(--border)", padding: "12px 24px", background: "var(--surface)", borderRadius: 4 }}>
          <li>Title: {result.title ?? "—"}</li>
          <li>Author: {result.author ?? "—"}</li>
          <li>Created on: {formatPdfDate(result.creation_date)}</li>
          <li>Modified on: {formatPdfDate(result.modification_date)}</li>
          <li>Software / Creator: {result.creator_tool ?? "—"}</li>
          <li>Company: {result.company ?? "—"}</li>
          <li>Producer (PDF): {result.producer ?? "—"}</li>
          <li>Page Count: {result.page_count ?? "—"}</li>
          <li>Encrypted: {result.encrypted ? "Yes" : "No"}</li>
        </ul>
      )}
    </div>
  );
}

function ReverseImageTool() {
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [links, setLinks] = useState<ReverseImageLink[]>([]);
  const [faces, setFaces] = useState<{public_url: string, links: ReverseImageLink[]}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  async function handleSearch() {
    if (!imageUrl && !file) return;
    setLoading(true);
    setError(null);
    setPublicUrl(null);
    setLinks([]);
    setFaces([]);
    
    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await apiFetch("/recon/reverse-image/upload", { method: "POST", body: formData });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.detail ?? `Error ${response.status}`);
        }
        const data = await response.json();
        setLinks(data.links);
        setPublicUrl(data.public_url);
        setFaces(data.faces || []);
      } else {
        setLinks(await apiGet<ReverseImageLink[]>(`/recon/reverse-image?image_url=${encodeURIComponent(imageUrl)}`));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error processing image");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Reverse Image Search</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Generates ready-to-use links for each search engine. Provide a public URL or upload a file.
        <br />
        <strong style={{color: "var(--warning)"}}>OPSEC Notice (Upload):</strong> When uploading a local file, it will be temporarily hosted on a public server (Catbox) so search engines can access it.
        <br />
        <strong style={{color: "var(--info)"}}>Automatic Feature:</strong> Local images are analyzed by AI (OpenCV) and faces are automatically extracted for targeted searches.
      </p>
      
      <div style={{ display: "flex", gap: 8, flexDirection: "column", maxWidth: 600 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={imageUrl}
            onChange={(e) => { setImageUrl(e.target.value); setFile(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Public URL: https://.../photo.jpg"
            style={{ flex: 1, padding: 8 }}
            disabled={!!file}
          />
          <span style={{ padding: "8px 0" }}>or</span>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setFile(e.target.files[0]);
                setImageUrl("");
              } else {
                setFile(null);
              }
            }} 
            style={{ flex: 1 }} 
            disabled={!!imageUrl}
          />
        </div>
        
        <button onClick={handleSearch} disabled={loading || (!imageUrl && !file)} style={{ width: 120 }}>
          {loading ? "Processing..." : "Generate links"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>}
      
      {publicUrl && (
        <p style={{ fontSize: 12, marginTop: 12 }}>
          Temporary image generated: <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
        </p>
      )}

      {links.length > 0 && (
        <ul style={{ marginTop: publicUrl ? 4 : 12 }}>
          {links.map((l) => (
            <li key={l.engine}>
              <a href={l.search_url} target="_blank" rel="noreferrer">
                Search original image on {l.engine}
              </a>
            </li>
          ))}
        </ul>
      )}

      {faces.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, background: "var(--surface)", borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Detected Faces ({faces.length})</h4>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            If searching the whole photo yields no results (due to background or noise), 
            search specifically with the extracted crops:
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {faces.map((f, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", padding: 8, borderRadius: 8 }}>
                <img src={f.public_url} alt="Face" style={{ width: 100, height: 100, objectFit: "cover", display: "block", marginBottom: 8, borderRadius: 4 }} />
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                  {f.links.map(l => (
                    <li key={l.engine}>
                      <a href={l.search_url} target="_blank" rel="noreferrer">{l.engine}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



function ImageExifTool() {
  const { activeCase } = useActiveCase();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImageExifResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [pinned, setPinned] = useState(false);

  async function handleExtract() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPinned(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch("/identifiers/image/exif", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Error ${response.status}`);
      }
      setResult(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error processing image");
    } finally {
      setLoading(false);
    }
  }

  async function handlePinToCase() {
    if (!activeCase || !result?.latitude || !result?.longitude) return;
    setPinning(true);
    try {
      // 1. First optionally upload the photo to the case file databank
      let attachedFileId: string | null = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("typology", "image");
        const uploadRes = await apiFetch(`/cases/${activeCase.id}/files/upload`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploaded = await uploadRes.json();
          attachedFileId = uploaded.id;
        }
      }

      // 2. Add Geolocation pin
      await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
        latitude: result.latitude,
        longitude: result.longitude,
        label: file ? `EXIF: ${file.name}` : "EXIF Photo GPS",
        description: `Camera: ${result.camera_make || ""} ${result.camera_model || ""}. Taken: ${result.taken_at || "N/A"}`,
        source: "ImageExifTool",
        attached_file_id: attachedFileId,
      });
      setPinned(true);
    } catch (e) {
      alert("Error pinning geolocation to case: " + e);
    } finally {
      setPinning(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Image EXIF Metadata (location/GPS)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Reads embedded GPS/date/camera from the original file — pure metadata, no third party. Most social networks
        strip this when processing uploads, so it only works with the original file (e.g. sent directly via
        WhatsApp/email), not with photos downloaded from feeds.
      </p>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ flex: 1 }} />
        <button onClick={handleExtract} disabled={loading || !file}>
          {loading ? "Reading..." : "Extract metadata"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12, background: "var(--surface)", border: "1px solid var(--border)", padding: 12, borderRadius: 4, maxWidth: 600 }}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            <li>Photo date: {result.taken_at ?? "not available"}</li>
            <li>Camera: {result.camera_make ?? "—"} {result.camera_model ?? ""}</li>
            {result.has_gps ? (
              <li style={{ marginTop: 6, color: "var(--cyan)", fontWeight: "bold" }}>
                GPS: {result.latitude?.toFixed(5)}, {result.longitude?.toFixed(5)} —{" "}
                <a href={result.maps_url ?? undefined} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                  external map ↗
                </a>
              </li>
            ) : (
              <li>No GPS coordinates in file (common in photos that went through social media).</li>
            )}
          </ul>
          {result.has_gps && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={handlePinToCase}
                disabled={pinning || pinned || !activeCase}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  background: pinned ? "var(--success)" : "var(--cyan)",
                  color: "#000",
                  fontWeight: "bold",
                }}
              >
                {pinned ? "✓ Pinned to Case Geointelligence Map" : pinning ? "Pinning & Storing..." : "+ Pin Location & Photo to Active Case Map"}
              </button>
              {!activeCase && <span style={{ fontSize: 11, color: "var(--warning)", marginLeft: 8 }}>(Select an active case first)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function EmailRegistrationTool() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{registered_sites: string[], total_checked: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    if (!email) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiGet<{registered_sites: string[], total_checked: number}>(`/recon/email/registrations?email=${encodeURIComponent(email)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error checking email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Email Registrations</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Scans over 120 websites, social networks, and forums checking if the email is associated with a registered account, using the password recovery mechanism.
      </p>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          placeholder="example@gmail.com"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleCheck} disabled={loading}>
          {loading ? "Scanning..." : "Check"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 14 }}>
            Checked across {result.total_checked} sites. Found on <strong>{result.registered_sites.length}</strong> site(s):
          </p>
          <ul style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 4, marginTop: 8, fontSize: 13, background: "var(--surface)" }}>
            {result.registered_sites.map(site => (
              <li key={site} style={{ marginBottom: 4 }}>{site}</li>
            ))}
            {result.registered_sites.length === 0 && (
              <li style={{ color: "var(--text-muted)", listStyle: "none" }}>No accounts found.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function PasswordBreachTool() {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<PasswordBreachResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck() {
    if (!password) return;
    setLoading(true);
    try {
      setResult(await apiGet<PasswordBreachResult>(`/identifiers/breach/password?password=${encodeURIComponent(password)}`));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Breached Password (Have I Been Pwned)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        K-anonymity: only the first 5 characters of the SHA-1 hash leave your machine, never the plain-text password.
      </p>
      <div style={{ display: "flex", gap: 8, maxWidth: 600 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          placeholder="password to check"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleCheck} disabled={loading}>
          {loading ? "Checking..." : "Check"}
        </button>
      </div>
      {result && (
        <p style={{ marginTop: 12 }}>
          {result.times_seen === 0
            ? "Not found in any known breach."
            : `Found in breaches ${result.times_seen.toLocaleString("en-US")} time(s).`}
        </p>
      )}
    </div>
  );
}

export default function ToolsPanel() {
  return (
    <div>
      <DeepScraperTool />
      <ReverseImageTool />
      <ImageExifTool />
      <DocumentMetadataTool />
      <EmailRegistrationTool />
      <PasswordBreachTool />
    </div>
  );
}

