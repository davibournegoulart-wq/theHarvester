"use client";

import { useEffect, useState, useRef } from "react";
import { apiGet, apiFetch } from "@/lib/api";
import { DownloadIcon } from "@/components/FlatIcons";

export type CaseFileItem = {
  id: string;
  case_id: string;
  filename: string;
  original_filename: string;
  typology: string;
  file_size: number;
  mime_type?: string;
  source_url?: string;
  created_at: string;
};

const TYPOLOGY_CONFIG: Record<
  string,
  { label: string; iconSvg: string; color: string; bg: string }
> = {
  document: {
    label: "Document / PDF",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    color: "#05D9E8",
    bg: "rgba(5, 217, 232, 0.12)",
  },
  dork_dump: {
    label: "Dork Web Dump",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
    color: "#FF2A6D",
    bg: "rgba(255, 42, 109, 0.12)",
  },
  evidence: {
    label: "Forensic Evidence",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
    color: "#00FF9F",
    bg: "rgba(0, 255, 159, 0.12)",
  },
  corporate: {
    label: "Corporate Dossier",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="8.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/><line x1="12" y1="6" x2="12.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/></svg>`,
    color: "#D1F7FF",
    bg: "rgba(209, 247, 255, 0.12)",
  },
  image: {
    label: "Image / Photo",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    color: "#FFB800",
    bg: "rgba(255, 184, 0, 0.12)",
  },
  audio_video: {
    label: "Audio / Video",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    color: "#A259FF",
    bg: "rgba(162, 89, 255, 0.12)",
  },
  other: {
    label: "General File",
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
    color: "#888888",
    bg: "rgba(136, 136, 136, 0.12)",
  },
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function CaseFilesDatabank({
  caseId,
  caseName,
}: {
  caseId: string;
  caseName: string;
}) {
  const [files, setFiles] = useState<CaseFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedTypology, setSelectedTypology] = useState("document");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [downloadingRemote, setDownloadingRemote] = useState(false);
  const [filterTypology, setFilterTypology] = useState<string>("ALL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    setLoading(true);
    try {
      const data = await apiGet<CaseFileItem[]>(`/cases/${caseId}/files`);
      setFiles(data || []);
    } catch (e) {
      console.error("Error loading case files:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (caseId) {
      loadFiles();
    }
  }, [caseId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("typology", selectedTypology);

        await apiFetch(`/cases/${caseId}/files/upload`, {
          method: "POST",
          body: formData,
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFiles();
    } catch (err) {
      alert("Error uploading file to databank: " + err);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoteDownload() {
    if (!remoteUrl.trim()) return;
    setDownloadingRemote(true);
    try {
      await apiFetch(
        `/cases/${caseId}/files/download-remote?url=${encodeURIComponent(
          remoteUrl.trim()
        )}&typology=${encodeURIComponent(selectedTypology)}`,
        { method: "POST" }
      );
      setRemoteUrl("");
      await loadFiles();
    } catch (err) {
      alert("Error downloading remote document: " + err);
    } finally {
      setDownloadingRemote(false);
    }
  }

  async function handleDeleteFile(fileId: string, filename: string) {
    if (!confirm(`Permanently delete "${filename}" entirely from disk and case database? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/cases/${caseId}/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to delete file (${res.status}): ${errText}`);
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      alert("Error deleting file: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleExportAllZip() {
    try {
      const res = await apiFetch(`/cases/${caseId}/export-zip`);
      if (!res.ok) {
        throw new Error(`Failed to export ZIP (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = caseName.replace(/[^a-zA-Z0-9_\-]/g, "_");
      a.download = `Case_${safeName}_files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error downloading files ZIP: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function getDownloadUrl(fileId: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8100";
    return `${apiBase}/cases/${caseId}/files/${fileId}/download`;
  }

  const filteredFiles =
    filterTypology === "ALL"
      ? files
      : files.filter((f) => f.typology === filterTypology);

  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        background: "var(--panel)",
        border: "1px solid var(--cyan)",
        borderRadius: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--panel-border)",
          paddingBottom: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: "var(--cyan)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              dangerouslySetInnerHTML={{
                __html: TYPOLOGY_CONFIG.dork_dump.iconSvg,
              }}
              style={{ display: "inline-flex", color: "var(--cyan)" }}
            />
            CASE DATABANK & FILE STORAGE: {caseName.toUpperCase()}
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Secure local drive. Preserves web dumps, dork captures, and evidence documents permanently even if deleted from source web servers.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Total Stored: <strong>{files.length}</strong> file(s) (
            {formatBytes(files.reduce((acc, f) => acc + (f.file_size || 0), 0))})
          </div>
          <button
            onClick={handleExportAllZip}
            disabled={files.length === 0}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: "bold",
              background: "rgba(0, 255, 159, 0.12)",
              borderColor: "#00FF9F",
              color: "#00FF9F",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: files.length === 0 ? "not-allowed" : "pointer",
            }}
            title="Download complete case dossier & all raw files in a ZIP archive"
          >
            <DownloadIcon size={13} />
            EXPORT ZIP
          </button>
        </div>
      </div>

      {/* Upload and Capture Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          background: "rgba(5, 217, 232, 0.04)",
          border: "1px dashed rgba(5, 217, 232, 0.3)",
          borderRadius: 6,
          padding: 16,
          marginBottom: 20,
        }}
      >
        {/* Upload Local File */}
        <div>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
            UPLOAD FILE TO DATABANK
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Typology:</label>
            <select
              value={selectedTypology}
              onChange={(e) => setSelectedTypology(e.target.value)}
              style={{
                flex: 1,
                padding: "4px 8px",
                fontSize: 12,
                background: "var(--bg)",
                border: "1px solid var(--panel-border)",
                color: "var(--text)",
                borderRadius: 4,
              }}
            >
              {Object.entries(TYPOLOGY_CONFIG).map(([key, conf]) => (
                <option key={key} value={key}>
                  {conf.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ fontSize: 12, width: "100%" }}
          />
          {uploading && (
            <div style={{ fontSize: 11, color: "var(--cyan)", marginTop: 4 }}>
              Uploading to secure databank...
            </div>
          )}
        </div>

        {/* Remote Document Grabber */}
        <div>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
            SNAPSHOT / DOWNLOAD REMOTE WEB URL
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px 0" }}>
            Directly fetch & preserve PDF/Doc found via Dork or web search:
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="url"
              placeholder="https://target.com/leaked-docs/report.pdf"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRemoteDownload()}
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 12,
                background: "var(--bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: 4,
                color: "var(--text)",
              }}
            />
            <button
              onClick={handleRemoteDownload}
              disabled={downloadingRemote || !remoteUrl.trim()}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: "var(--cyan)",
                color: "#000",
                fontWeight: "bold",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
              }}
            >
              {downloadingRemote ? "Saving..." : "Grab"}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Filter:</span>
        <button
          onClick={() => setFilterTypology("ALL")}
          style={{
            padding: "2px 8px",
            fontSize: 11,
            borderRadius: 4,
            cursor: "pointer",
            background: filterTypology === "ALL" ? "var(--cyan)" : "transparent",
            color: filterTypology === "ALL" ? "#000" : "var(--text)",
            border: "1px solid var(--panel-border)",
          }}
        >
          All ({files.length})
        </button>
        {Object.entries(TYPOLOGY_CONFIG).map(([key, conf]) => {
          const count = files.filter((f) => f.typology === key).length;
          if (count === 0) return null;
          const active = filterTypology === key;
          return (
            <button
              key={key}
              onClick={() => setFilterTypology(key)}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 4,
                cursor: "pointer",
                background: active ? conf.color : "transparent",
                color: active ? "#000" : conf.color,
                border: `1px solid ${conf.color}`,
              }}
            >
              {conf.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Files Grid / List */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 16 }}>Loading databank files...</div>
      ) : filteredFiles.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-muted)",
            border: "1px dashed var(--panel-border)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          No files stored in this case databank yet. Upload documents, photos, or capture web files above.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filteredFiles.map((file) => {
            const typo = TYPOLOGY_CONFIG[file.typology] || TYPOLOGY_CONFIG.other;
            return (
              <div
                key={file.id}
                style={{
                  background: "var(--bg)",
                  border: `1px solid ${typo.color}33`,
                  borderRadius: 6,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: typo.bg,
                      color: typo.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    dangerouslySetInnerHTML={{ __html: typo.iconSvg }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: "bold",
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={file.original_filename}
                    >
                      {file.original_filename}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: typo.bg,
                          color: typo.color,
                          fontWeight: "bold",
                        }}
                      >
                        {typo.label}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {formatBytes(file.file_size)}
                      </span>
                    </div>
                    {file.source_url && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={file.source_url}
                      >
                        Source: {file.source_url}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      Stored: {new Date(file.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 8,
                    borderTop: "1px solid var(--panel-border)",
                  }}
                >
                  <a
                    href={getDownloadUrl(file.id)}
                    download={file.original_filename}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 4,
                      background: "rgba(5, 217, 232, 0.15)",
                      color: "var(--cyan)",
                      textDecoration: "none",
                      border: "1px solid rgba(5, 217, 232, 0.4)",
                      fontWeight: "bold",
                    }}
                  >
                    <DownloadIcon size={12} color="var(--cyan)" /> Download
                  </a>
                  <button
                    onClick={() => handleDeleteFile(file.id, file.original_filename)}
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      borderRadius: 4,
                      background: "transparent",
                      color: "var(--danger)",
                      border: "1px solid rgba(255, 42, 109, 0.3)",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
