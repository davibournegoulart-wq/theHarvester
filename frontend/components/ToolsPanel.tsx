"use client";

import { useState } from "react";
import { apiFetch, apiGet, apiPostJson } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";

type ReverseImageLink = { engine: string; search_url: string };
type FacebookPivotResult = { facebook_id: string | null; marketplace_url: string | null };
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

function ReverseImageTool() {
  const [imageUrl, setImageUrl] = useState("");
  const [links, setLinks] = useState<ReverseImageLink[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!imageUrl) return;
    setLoading(true);
    try {
      setLinks(await apiGet<ReverseImageLink[]>(`/recon/reverse-image?image_url=${encodeURIComponent(imageUrl)}`));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Busca reversa de imagem</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Gera o link pronto pra cada motor — nenhuma busca é feita aqui, você abre e revisa visualmente.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="https://.../foto.jpg"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Gerando..." : "Gerar links"}
        </button>
      </div>
      {links.length > 0 && (
        <ul style={{ marginTop: 12 }}>
          {links.map((l) => (
            <li key={l.engine}>
              <a href={l.search_url} target="_blank" rel="noreferrer">
                {l.engine}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FacebookPivotTool() {
  const { activeCase } = useActiveCase();
  const [profileUrl, setProfileUrl] = useState("");
  const [result, setResult] = useState<FacebookPivotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSearch() {
    if (!profileUrl || !activeCase) return;
    setLoading(true);
    setSaved(false);
    try {
      const data = await apiGet<FacebookPivotResult>(`/identifiers/facebook/pivot?profile_url=${encodeURIComponent(profileUrl)}`);
      setResult(data);
      if (data.facebook_id) {
        await apiPostJson(`/cases/${activeCase.id}/findings`, {
          identifier_type: "username",
          identifier_value: data.facebook_id,
          platform: "facebook",
          url: data.marketplace_url,
          exists: true,
          discovered_by: "checkers.facebook_pivot",
          metadata_json: { source_profile_url: profileUrl },
        });
        setSaved(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Pivô de Facebook (ID + Marketplace)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Extrai o ID numérico de um perfil público do Facebook — não requer login.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="https://www.facebook.com/usuario"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {result && (
        <ul style={{ marginTop: 12 }}>
          <li>ID: {result.facebook_id ?? "não encontrado"}</li>
          {result.marketplace_url && (
            <li>
              <a href={result.marketplace_url} target="_blank" rel="noreferrer">
                Ver no Marketplace
              </a>
            </li>
          )}
          {saved && <li style={{ fontSize: 11, color: "var(--success)" }}>salvo automaticamente em "{activeCase?.name}"</li>}
        </ul>
      )}
    </div>
  );
}

function ImageExifTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImageExifResult | null>(null);
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
      const response = await apiFetch("/identifiers/image/exif", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Erro ${response.status}`);
      }
      setResult(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar imagem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Metadado EXIF de imagem (local/GPS)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Lê GPS/data/câmera embutidos no arquivo original — puro metadado, sem terceiro. A maioria das redes sociais
        remove isso ao processar upload, então só funciona com o arquivo original (ex: enviado direto por
        WhatsApp/e-mail), não com foto baixada do feed.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ flex: 1 }} />
        <button onClick={handleExtract} disabled={loading || !file}>
          {loading ? "Lendo..." : "Extrair metadado"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {result && (
        <ul style={{ marginTop: 12 }}>
          <li>Data da foto: {result.taken_at ?? "não disponível"}</li>
          <li>Câmera: {result.camera_make ?? "—"} {result.camera_model ?? ""}</li>
          {result.has_gps ? (
            <li>
              GPS: {result.latitude?.toFixed(5)}, {result.longitude?.toFixed(5)} —{" "}
              <a href={result.maps_url ?? undefined} target="_blank" rel="noreferrer">
                ver no mapa
              </a>
            </li>
          ) : (
            <li>Sem coordenada GPS no arquivo (comum em foto que já passou por rede social).</li>
          )}
        </ul>
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
      <h3>Senha vazada (Have I Been Pwned)</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        K-anonimato: só os 5 primeiros caracteres do hash SHA-1 saem da sua máquina, nunca a senha em texto claro.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          placeholder="senha a checar"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={handleCheck} disabled={loading}>
          {loading ? "Checando..." : "Checar"}
        </button>
      </div>
      {result && (
        <p style={{ marginTop: 12 }}>
          {result.times_seen === 0
            ? "Não encontrada em nenhum vazamento conhecido."
            : `Encontrada em vazamentos ${result.times_seen.toLocaleString("pt-BR")} vez(es).`}
        </p>
      )}
    </div>
  );
}

export default function ToolsPanel() {
  return (
    <div>
      <ReverseImageTool />
      <ImageExifTool />
      <FacebookPivotTool />
      <PasswordBreachTool />
    </div>
  );
}
