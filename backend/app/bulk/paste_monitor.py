"""Monitoramento de paste site público (Pastebin) via archive público.

Ver vault: Tool Decision Log. Mesma lógica do darkweb/monitor.py, mas pra
vazamento postado em paste site indexado publicamente. Roda como job
agendado (APScheduler), não como scraping contínuo agressivo — o archive
público lista só as pastes mais recentes, então polling de baixa frequência
(ex: a cada alguns minutos) é suficiente e não sobrecarrega o serviço.

Confirmado ao vivo (2026-09-08): `pastebin.com/archive` lista IDs recentes
(`href="/{id}?source=archive"`), conteúdo em `pastebin.com/raw/{id}` sem
autenticação.
"""

import asyncio
import re
from dataclasses import dataclass

import httpx

from app.config import settings

ARCHIVE_URL = "https://pastebin.com/archive"
RAW_URL = "https://pastebin.com/raw/"
_PASTE_ID_RE = re.compile(r'href="/([a-zA-Z0-9]{8})\?source=archive"')


@dataclass
class PasteMatch:
    paste_url: str
    keyword_matched: str
    snippet: str
    discovered_by: str = "bulk.paste_monitor"


async def _list_recent_paste_ids(client: httpx.AsyncClient) -> list[str]:
    response = await client.get(ARCHIVE_URL, timeout=settings.request_timeout_seconds)
    response.raise_for_status()
    return list(dict.fromkeys(_PASTE_ID_RE.findall(response.text)))  # dedup mantendo ordem


def _find_matches(paste_id: str, body: str, keywords: list[str]) -> list[PasteMatch]:
    matches = []
    body_lower = body.lower()
    for keyword in keywords:
        keyword_lower = keyword.lower()
        if keyword_lower in body_lower:
            snippet_start = max(body_lower.find(keyword_lower) - 40, 0)
            matches.append(
                PasteMatch(
                    paste_url=f"https://pastebin.com/{paste_id}",
                    keyword_matched=keyword,
                    snippet=body[snippet_start : snippet_start + 120],
                )
            )
    return matches


async def scan_recent_pastes(keywords: list[str]) -> list[PasteMatch]:
    semaphore = asyncio.Semaphore(settings.max_concurrent_checks)

    async def fetch_and_match(client: httpx.AsyncClient, paste_id: str) -> list[PasteMatch]:
        async with semaphore:
            try:
                response = await client.get(f"{RAW_URL}{paste_id}", timeout=settings.request_timeout_seconds)
                response.raise_for_status()
            except httpx.HTTPError:
                return []
        return _find_matches(paste_id, response.text, keywords)

    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        try:
            paste_ids = await _list_recent_paste_ids(client)
        except httpx.HTTPError:
            return []

        results = await asyncio.gather(*(fetch_and_match(client, paste_id) for paste_id in paste_ids))

    return [match for sublist in results for match in sublist]
