"use client";

import { useState } from "react";
import { apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

export default function EvidenceQuickAdd() {
  const { activeCase } = useActiveCase();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeCase) return null;

  async function handleSave() {
    if (!url) return;
    setSaving(true);
    setError(null);
    try {
      await apiPostJson(`/cases/${activeCase!.id}/evidence`, { url, note: note || null });
      setSaved(true);
      setUrl("");
      setNote("");
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar evidência");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 16, fontSize: 12 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ fontSize: 11, padding: "4px 8px" }}>
          + preservar evidência (link + nota)
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL do post/página"
            style={{ padding: 6, flex: "1 1 260px" }}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="nota (opcional)"
            style={{ padding: 6, flex: "1 1 200px" }}
          />
          <button onClick={handleSave} disabled={saving || !url} style={{ fontSize: 11, padding: "4px 8px" }}>
            {saving ? "salvando..." : "salvar na trilha do caso"}
          </button>
          <button onClick={() => setOpen(false)} style={{ fontSize: 11, padding: "4px 8px" }}>
            fechar
          </button>
        </div>
      )}
      {saved && <span style={{ color: "var(--success)", marginLeft: 8 }}>evidência preservada em "{activeCase.name}"</span>}
      {error && <span style={{ color: "var(--danger)", marginLeft: 8 }}>{error}</span>}
    </div>
  );
}
