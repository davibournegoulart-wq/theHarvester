"""Monitoramento de paste site público (Pastebin e similares).

Ver vault: Tool Decision Log. Mesma lógica do darkweb/monitor.py, mas pra
vazamento postado em paste site indexado publicamente. Roda como job
agendado (APScheduler), não como scraping contínuo agressivo.

TODO: usar o endpoint público de "archive" do Pastebin (lista de posts
recentes) + filtro por keyword — não requer autenticação.
"""

from dataclasses import dataclass


@dataclass
class PasteMatch:
    paste_url: str
    keyword_matched: str
    snippet: str
    discovered_by: str = "bulk.paste_monitor"


async def scan_recent_pastes(keywords: list[str]) -> list[PasteMatch]:
    raise NotImplementedError("Consumir o endpoint público de archive do Pastebin, filtrar por `keywords`.")
