"use client";

import { useState } from "react";
import { apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

type IdentifierType = "email" | "phone" | "username" | "domain";

type Props = {
  identifierType: IdentifierType;
  identifierValue: string;
  platform: string;
  url?: string | null;
  exists?: boolean;
  discoveredBy: string;
  metadata?: Record<string, unknown>;
};

export default function SaveToCaseButton({
  identifierType,
  identifierValue,
  platform,
  url = null,
  exists = true,
  discoveredBy,
  metadata = {},
}: Props) {
  const { activeCase } = useActiveCase();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeCase) {
    return (
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        selecione um caso ativo na aba "Casos" pra salvar
      </span>
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiPostJson(`/cases/${activeCase!.id}/findings`, {
        identifier_type: identifierType,
        identifier_value: identifierValue,
        platform,
        url,
        exists,
        discovered_by: discoveredBy,
        metadata_json: metadata,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <span style={{ fontSize: 11, color: "var(--success)" }}>salvo em "{activeCase.name}"</span>;
  }

  return (
    <span>
      <button onClick={handleSave} disabled={saving} style={{ fontSize: 11, padding: "2px 6px" }}>
        {saving ? "salvando..." : `salvar no caso "${activeCase.name}"`}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--danger)", marginLeft: 6 }}>{error}</span>}
    </span>
  );
}
