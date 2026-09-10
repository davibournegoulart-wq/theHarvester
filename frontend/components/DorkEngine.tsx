"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";

type DorkQuery = { query: string; intent: string; category?: string };

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  username: "Username",
  domain: "Domain",
  file_extension: "File extension (e.g. pdf)",
};

const CATEGORY_LABELS: Record<string, string> = {
  Geral: "General",
  Vazamento: "Leaks / Breaches",
  "Relacionamentos (Dating)": "Dating",
  Currículo: "Resume / CV",
  "Registro Público (BR)": "Public Records (BR)",
  Fórum: "Forum",
};

const INTENT_LABELS: Record<string, string> = {
  "perfil LinkedIn": "LinkedIn profile",
  "perfil/menção no Facebook": "Facebook profile/mention",
  "perfil/menção no Twitter/X": "Twitter/X profile/mention",
  "perfil/menção no Instagram": "Instagram profile/mention",
  "perfil/menção em site de relacionamentos": "Dating site profile/mention",
  "currículo publicado": "Published resume/CV",
  "processo judicial público (Brasil)": "Public court records (Brazil)",
  "registro público agregado (Brasil)": "Aggregated public records (Brazil)",
  "menção em fórum (Reddit/Quora)": "Forum mention (Reddit/Quora)",
  "menção em fórum genérico": "Generic forum mention",
  "vazamento em paste site": "Paste site leak",
  "possível vazamento de credencial": "Possible credential leak",
  "menção em grupo do Facebook": "Facebook group mention",
  "anúncio no Facebook Marketplace": "Facebook Marketplace listing",
  'menção junto de "whatsapp"': 'Mention alongside "whatsapp"',
};

export default function DorkEngine() {
  const { activeCase } = useActiveCase();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dorks, setDorks] = useState<DorkQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  function setField(name: string, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSaveToDatabank(targetUrl: string, typology: string = "dork_dump") {
    if (!activeCase) {
      alert("Please select or activate a Case first to save files into its databank.");
      return;
    }
    setSavingUrl(targetUrl);
    setSavedFeedback(null);
    try {
      await apiFetch(
        `/cases/${activeCase.id}/files/download-remote?url=${encodeURIComponent(
          targetUrl
        )}&typology=${encodeURIComponent(typology)}`,
        { method: "POST" }
      );
      setSavedFeedback(`Saved file from ${targetUrl} to case databank!`);
      setTimeout(() => setSavedFeedback(null), 4000);
    } catch (e) {
      alert("Failed to save remote file: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingUrl(null);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== ""));
      const response = await apiFetch("/recon/dork-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? `Error ${response.status}`);
      }
      setDorks(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generating dorks");
      setDorks([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Fill in whatever you have — the engine combines the filled fields into ready-to-use dorks. No search is
        performed automatically; you open and review each result in the browser.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Object.entries(FIELD_LABELS).map(([name, label]) => (
          <input
            key={name}
            value={fields[name] ?? ""}
            onChange={(e) => setField(name, e.target.value)}
            placeholder={label}
            style={{ padding: 8 }}
          />
        ))}
      </div>
      <button onClick={handleGenerate} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? "Generating..." : "Generate dorks"}
      </button>
      {savedFeedback && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(0, 255, 159, 0.15)", border: "1px solid var(--success)", color: "var(--success)", borderRadius: 4, fontSize: 12 }}>
          {savedFeedback}
        </div>
      )}

      {dorks.length > 0 && (
        <div style={{ marginTop: 20, padding: 12, background: "rgba(5, 217, 232, 0.05)", border: "1px solid rgba(5, 217, 232, 0.3)", borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 4 }}>
            SAVE DISCOVERED FILE TO CASE DATABANK
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px 0" }}>
            Found a document or leak through the Google Dorks? Enter the direct URL below to preserve it immediately in the active case drive:
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="dork-direct-url"
              placeholder="https://example.com/confidential_leak.pdf"
              style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
            />
            <button
              onClick={() => {
                const el = document.getElementById("dork-direct-url") as HTMLInputElement;
                if (el && el.value.trim()) {
                  handleSaveToDatabank(el.value.trim(), "dork_dump");
                  el.value = "";
                }
              }}
              disabled={!!savingUrl}
              style={{ fontSize: 12, padding: "6px 12px", background: "var(--cyan)", color: "#000", fontWeight: "bold" }}
            >
              {savingUrl ? "Preserving..." : "Save to Databank"}
            </button>
          </div>
        </div>
      )}

      {dorks.length > 0 &&
        Object.entries(groupByCategory(dorks)).map(([category, group]) => (
          <div key={category} style={{ marginTop: 16 }}>
            <p style={{ fontWeight: "bold", marginBottom: 4 }}>{category}</p>
            <ul style={{ marginTop: 0 }}>
              {group.map((d, i) => (
                <li
                  key={i}
                  style={{
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    background: "rgba(0,0,0,0.2)",
                    padding: "8px 12px",
                    borderRadius: 4,
                    border: "1px solid var(--panel-border)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`} target="_blank" rel="noreferrer" style={{ fontWeight: "bold" }}>
                        {d.query}
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", textDecoration: "none", border: "1px solid rgba(5, 217, 232, 0.4)" }}
                      >
                        Open Google ↗
                      </a>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{INTENT_LABELS[d.intent] ?? d.intent}</div>
                  </div>
                  <SaveToCaseButton
                    key={`${activeCase?.id}-${d.query}`}
                    identifierType="url"
                    identifierValue={d.query}
                    platform="google.dork"
                    discoveredBy="dork_engine"
                    metadata={{ category, intent: d.intent }}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

function groupByCategory(dorks: DorkQuery[]): Record<string, DorkQuery[]> {
  const groups: Record<string, DorkQuery[]> = {};
  for (const dork of dorks) {
    const rawCategory = dork.category ?? "General";
    const category = CATEGORY_LABELS[rawCategory] ?? rawCategory;
    (groups[category] ??= []).push(dork);
  }
  return groups;
}
