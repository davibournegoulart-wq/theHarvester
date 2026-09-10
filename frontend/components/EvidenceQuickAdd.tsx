"use client";

import { useState } from "react";
import { apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

type ArchiveAvailability = {
  available: boolean;
  closest_snapshot: { timestamp: string; archive_url: string } | null;
};

export default function EvidenceQuickAdd() {
  const { activeCase } = useActiveCase();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingWayback, setCheckingWayback] = useState(false);
  const [wayback, setWayback] = useState<ArchiveAvailability | null>(null);

  if (!activeCase) return null;

  async function handleCheckWayback() {
    if (!url) return;
    setCheckingWayback(true);
    setWayback(null);
    try {
      setWayback(await apiGet<ArchiveAvailability>(`/recon/archive/availability?url=${encodeURIComponent(url)}`));
    } catch {
      // Wayback rate-limits easily — unavailability should not block manual saving.
    } finally {
      setCheckingWayback(false);
    }
  }

  async function handleSave() {
    if (!url) return;
    setSaving(true);
    setError(null);
    try {
      await apiPostJson(`/cases/${activeCase!.id}/evidence`, {
        url,
        note: note || null,
        archived_url: wayback?.available ? wayback.closest_snapshot?.archive_url : null,
      });
      setSaved(true);
      setUrl("");
      setNote("");
      setWayback(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving evidence");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ fontSize: 12 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ fontSize: 11, padding: "4px 8px" }}>
          + preserve evidence (link + note)
        </button>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Post/page URL"
              style={{ padding: 6, flex: "1 1 260px" }}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="note (optional)"
              style={{ padding: 6, flex: "1 1 200px" }}
            />
            <button onClick={handleCheckWayback} disabled={checkingWayback || !url} style={{ fontSize: 11, padding: "4px 8px" }}>
              {checkingWayback ? "checking..." : "check archive (Wayback)"}
            </button>
            <button onClick={handleSave} disabled={saving || !url} style={{ fontSize: 11, padding: "4px 8px" }}>
              {saving ? "saving..." : "save to case trail"}
            </button>
            <button onClick={() => setOpen(false)} style={{ fontSize: 11, padding: "4px 8px" }}>
              close
            </button>
          </div>
          {wayback && (
            <div style={{ marginTop: 6, color: wayback.available ? "var(--success)" : "var(--text-muted)" }}>
              {wayback.available ? (
                <>
                  archived copy already exists from earlier —{" "}
                  <a href={wayback.closest_snapshot?.archive_url} target="_blank" rel="noreferrer">
                    view on Wayback Machine
                  </a>{" "}
                  (will be saved together)
                </>
              ) : (
                "no archived copy found"
              )}
            </div>
          )}
        </div>
      )}
      {saved && <span style={{ color: "var(--success)", marginLeft: 8 }}>evidence preserved in "{activeCase.name}"</span>}
      {error && <span style={{ color: "var(--danger)", marginLeft: 8 }}>{error}</span>}
    </div>
  );
}
