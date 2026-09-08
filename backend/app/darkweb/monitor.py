"""Busca multi-engine na dark web (.onion), como job interno agendado.

Reimplementação nativa do padrão OnionSearch (ver vault: Tools - Dark Web
and Bulk Data#OnionSearch). Requer proxy Tor local (SOCKS5, porta 9050
padrão) — não é ferramenta externa rodando como produto separado, é uma
lista de motor de busca `.onion` que consultamos via HTTP através do proxy.

Endereço `.onion` de motor de busca muda com frequência (saem do ar, trocam
de domínio) — os dois abaixo são seed, validar periodicamente e expandir
seguindo a lista completa do OnionSearch.
"""

from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup

# Seed inicial — expandir seguindo a lista de motores do OnionSearch
ONION_SEARCH_ENGINES = {
    "ahmia": "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/search/?q={}",
    "torgle": "http://torgle3wiwfvyq3v.onion/search?q={}",
}


@dataclass
class DarkWebMatch:
    engine: str
    result_url: str
    title: str
    discovered_by: str = "darkweb.monitor"


async def _search_engine(client: httpx.AsyncClient, engine: str, url_template: str, keyword: str) -> list[DarkWebMatch]:
    url = url_template.format(keyword)
    try:
        response = await client.get(url, timeout=20.0)
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    matches: list[DarkWebMatch] = []
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if ".onion" in href:
            matches.append(DarkWebMatch(engine=engine, result_url=href, title=link.get_text(strip=True) or href))

    return matches


async def search_dark_web(keyword: str, tor_proxy: str = "socks5://127.0.0.1:9050") -> list[DarkWebMatch]:
    """Requer um Tor daemon acessível em `tor_proxy` (ex: container `tor` no
    docker-compose, ou Tor Browser local com porta de controle exposta)."""
    results: list[DarkWebMatch] = []
    async with httpx.AsyncClient(proxy=tor_proxy, headers={"User-Agent": "Mozilla/5.0"}) as client:
        for engine, url_template in ONION_SEARCH_ENGINES.items():
            results.extend(await _search_engine(client, engine, url_template, keyword))

    return results
