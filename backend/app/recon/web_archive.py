"""Consulta ao Wayback Machine (archive.org) — snapshots históricos de URLs.

API pública do Internet Archive, sem autenticação, sem chave.
Duas operações:
1. Disponibilidade: checa se uma URL tem algum snapshot arquivado.
2. Busca CDX: lista snapshots com timestamps, status codes e MIME types.

Uso investigativo: encontrar páginas deletadas, conteúdo alterado,
versões históricas de perfis ou sites que foram tirados do ar.
"""

from dataclasses import dataclass

import httpx

from app.config import settings

AVAILABILITY_URL = "https://archive.org/wayback/available"
CDX_URL = "https://web.archive.org/cdx/search/cdx"


@dataclass
class ArchiveSnapshot:
    timestamp: str
    url: str
    archive_url: str
    status_code: str
    mime_type: str
    discovered_by: str = "recon.web_archive"


@dataclass
class ArchiveAvailability:
    available: bool
    closest_snapshot: ArchiveSnapshot | None
    discovered_by: str = "recon.web_archive"


@dataclass
class ArchiveSearchResult:
    url: str
    total_snapshots: int
    snapshots: list[ArchiveSnapshot]
    discovered_by: str = "recon.web_archive"


async def check_archive_availability(url: str) -> ArchiveAvailability:
    """Checa se `url` tem algum snapshot no Wayback Machine."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                AVAILABILITY_URL,
                params={"url": url},
                timeout=settings.request_timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()

        snapshots = data.get("archived_snapshots", {})
        closest = snapshots.get("closest")
        if closest and closest.get("available"):
            ts = closest.get("timestamp", "")
            # `closest["url"]` já vem como a URL de arquivo completa
            # (ex: "http://web.archive.org/web/{ts}/http://exemplo.com/") —
            # prefixar de novo duplicava o host, gerando link quebrado.
            # Confirmado ao vivo (2026-09-09).
            archive_url = closest.get("url", "")
            return ArchiveAvailability(
                available=True,
                closest_snapshot=ArchiveSnapshot(
                    timestamp=ts,
                    url=url,
                    archive_url=archive_url,
                    status_code=str(closest.get("status", "")),
                    mime_type="",
                ),
            )
        return ArchiveAvailability(available=False, closest_snapshot=None)
    except (httpx.HTTPError, ValueError, KeyError):
        return ArchiveAvailability(available=False, closest_snapshot=None)


async def search_archive(url: str, limit: int = 50) -> ArchiveSearchResult:
    """Busca snapshots de `url` no Wayback Machine CDX API.

    Retorna até `limit` snapshots com timestamp, status code e MIME type.
    Cada snapshot inclui a URL de visualização no archive.org.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                CDX_URL,
                params={
                    "url": url,
                    "output": "json",
                    "limit": str(limit),
                    "fl": "timestamp,original,statuscode,mimetype",
                },
                timeout=settings.request_timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()

        if not data or len(data) < 2:
            return ArchiveSearchResult(url=url, total_snapshots=0, snapshots=[])

        # Primeira linha é o header: ["timestamp", "original", "statuscode", "mimetype"]
        rows = data[1:]  # pular header
        snapshots: list[ArchiveSnapshot] = []
        for row in rows:
            if len(row) < 4:
                continue
            ts, original, status, mime = row[0], row[1], row[2], row[3]
            snapshots.append(ArchiveSnapshot(
                timestamp=ts,
                url=original,
                archive_url=f"https://web.archive.org/web/{ts}/{original}",
                status_code=status,
                mime_type=mime,
            ))

        return ArchiveSearchResult(url=url, total_snapshots=len(snapshots), snapshots=snapshots)
    except (httpx.HTTPError, ValueError, KeyError):
        return ArchiveSearchResult(url=url, total_snapshots=0, snapshots=[])
