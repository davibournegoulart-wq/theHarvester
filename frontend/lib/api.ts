export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

const API_KEY_STORAGE_KEY = "net-scraper-api-key";

export const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "change-me-net-scraper-insecure-default";

export function getApiKey(): string {
  if (typeof window === "undefined") return DEFAULT_API_KEY;
  try {
    const stored = window.localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored && stored.trim().length > 0) return stored.trim();
    return DEFAULT_API_KEY;
  } catch {
    return DEFAULT_API_KEY;
  }
}

export function setApiKey(key: string): void {
  try {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch {
    // localStorage indisponível (modo privado, etc) — a chave só vale pra sessão atual
  }
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", getApiKey());
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
