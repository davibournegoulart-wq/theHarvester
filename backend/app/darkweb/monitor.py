"""Busca multi-engine na dark web (.onion), como job interno agendado.

Reimplementação nativa do padrão OnionSearch (ver vault: Tools - Dark Web
and Bulk Data#OnionSearch). Requer proxy Tor (SOCKS5) — não é ferramenta
externa rodando como produto separado, é uma lista de motor de busca
`.onion` que consultamos via HTTP através do proxy.

⚠️ Validado ao vivo (2026-09-08) contra um daemon Tor real
(`dockurr/tor` no docker-compose):
- **torgle**: endereço `.onion` do seed está morto (`ProxyError: General
  SOCKS server failure` — o serviço saiu do ar). Removido do seed.
- **ahmia**: tem um campo honeypot anti-scraping oculto no form de busca
  (nome/valor hexadecimal que muda a cada carregamento da home) — sem
  incluir esse campo, a busca redireciona de volta pra home em vez de
  buscar. Implementado o fluxo de 2 passos (buscar home → extrair token →
  buscar com token). Confirmado que o fluxo de request chega no endpoint
  certo (nginx responde 504, não mais redirect pra home) — mas o serviço
  Ahmia em si estava fora do ar (504 Gateway Time-out) em toda tentativa
  durante o teste, então o seletor CSS do resultado (`li.result h4 a`)
  **não foi confirmado contra uma resposta real de busca bem-sucedida** —
  mesmo padrão de instabilidade do crt.sh/Pastebin. Revalidar o seletor
  quando o serviço estiver disponível. Tratado como inconclusivo, não quebra.

Onion de motor de busca muda/cai com frequência — revalidar periodicamente
e expandir seguindo a lista completa do OnionSearch.

**Torch adicionado (2026-09-09)**: mesmo padrão do Ahmia (fluxo de 2
passos — busca a home pra pegar um token de sessão, depois busca de
verdade com ele). Confirmado ao vivo: token vem em
`<input name=tkn value="...">`, sem aspas no fechamento (tag mal-formada,
por isso o regex não pode assumir aspas nos dois lados). Resultado real
confirmado (busca por "bitcoin" trouxe onion de exchange/mixer real).
Seletor: `td b a` dentro da tabela de resultado.
"""

import asyncio
import re
from dataclasses import dataclass

import httpx
from bs4 import BeautifulSoup

from app.config import settings

AHMIA_BASE = "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion"
_AHMIA_HONEYPOT_RE = re.compile(r'<input type="hidden" name="([a-f0-9]+)" value="([a-f0-9]+)">')

TORCH_BASE = "http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rplyvk3noyd.onion"
_TORCH_TOKEN_RE = re.compile(r'name=tkn value="([a-f0-9]+)')


@dataclass
class DarkWebMatch:
    engine: str
    result_url: str
    title: str
    discovered_by: str = "darkweb.monitor"


async def _search_ahmia(client: httpx.AsyncClient, keyword: str) -> list[DarkWebMatch]:
    try:
        home = await client.get(f"{AHMIA_BASE}/", timeout=30.0)
        home.raise_for_status()
        match = _AHMIA_HONEYPOT_RE.search(home.text)
        if not match:
            return []
        honeypot_name, honeypot_value = match.groups()

        response = await client.get(
            f"{AHMIA_BASE}/search/",
            params={"q": keyword, honeypot_name: honeypot_value},
            timeout=45.0,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    matches: list[DarkWebMatch] = []
    for link in soup.select("li.result h4 a"):
        href = link.get("href", "")
        matches.append(DarkWebMatch(engine="ahmia", result_url=href, title=link.get_text(strip=True) or href))

    return matches


async def _search_torch(client: httpx.AsyncClient, keyword: str) -> list[DarkWebMatch]:
    try:
        home = await client.get(f"{TORCH_BASE}/cgi-bin/omega/omega", timeout=30.0)
        home.raise_for_status()
        match = _TORCH_TOKEN_RE.search(home.text)
        if not match:
            return []
        token = match.group(1)

        response = await client.get(
            f"{TORCH_BASE}/cgi-bin/omega/omega",
            params={"P": keyword, "DEFAULTOP": "and", "DB": "default", "FMT": "query", "xDB": "default", "xFILTERS": ".~~", "tkn": token},
            timeout=45.0,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    matches: list[DarkWebMatch] = []
    for link in soup.select("td b a"):
        href = link.get("href", "")
        matches.append(DarkWebMatch(engine="torch", result_url=href, title=link.get_text(strip=True) or href))

    return matches


async def search_dark_web(keyword: str, tor_proxy: str | None = None) -> list[DarkWebMatch]:
    """Requer um Tor daemon acessível em `tor_proxy` (default:
    `settings.tor_proxy_url`, que já aponta pro container `tor` do
    docker-compose). Roda todos os motores em paralelo, junta o resultado —
    um motor falhando não derruba os outros."""
    proxy = tor_proxy or settings.tor_proxy_url
    async with httpx.AsyncClient(proxy=proxy, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        results = await asyncio.gather(
            _search_ahmia(client, keyword),
            _search_torch(client, keyword),
        )
    return [match for engine_results in results for match in engine_results]
