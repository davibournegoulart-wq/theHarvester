"""Checagem de existência de username por site, via request HTTP direto.

Reimplementação nativa da técnica usada por Sherlock/Blackbird/WhatsMyName
(ver vault: Tools - Identifier Lookup). `sites.json` é uma lista própria,
seed inicial usando o mesmo padrão de detecção — mas cada site precisa do
método certo, confirmado ao vivo (ver notas abaixo), senão gera falso
positivo em massa.

⚠️ Descoberta em teste ao vivo (2026-09-08): checagem ingênua "status code
!= 404 => existe" dá falso positivo pra maioria dos sites modernos:
- Sites com anti-bot (GitLab, Reddit, Medium) bloqueiam requisição
  não-autenticada com **403**, não 404 — 403 não é "existe", é "não
  conseguimos checar". Removidos do seed até ter estratégia melhor
  (headers de navegador real, ou sessão).
- Sites SPA (Instagram, Pinterest, Twitch) servem a casca da aplicação com
  **200** mesmo pra perfil inexistente — precisam checar o `<title>`
  renderizado no HTML (que essas plataformas ainda geram server-side pra
  SEO), não o status code.
- TikTok não expõe nem status code nem title útil em fetch estático — fora
  do seed até reverse-engenheirar o JSON interno (`SIGI_STATE`) ou usar
  browser headless.

Nenhum request de autenticação, nenhuma sessão de terceiro — só GET público.
"""

import asyncio
import html
import json
import re
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import settings

SITES_PATH = Path(__file__).parent / "sites.json"

_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


@dataclass
class UsernameCheckResult:
    platform: str
    url: str
    exists: bool
    discovered_by: str = "checkers.username"


def _load_sites() -> dict:
    return json.loads(SITES_PATH.read_text())


def _extract_title(body: str) -> str:
    match = _TITLE_RE.search(body)
    return html.unescape(match.group(1)).strip() if match else ""


def _evaluate(definition: dict, username: str, status_code: int, body: str) -> bool | None:
    """Retorna True (existe), False (não existe), ou None (inconclusivo —
    não conseguimos confirmar nenhum dos dois, ex: bloqueio anti-bot)."""
    error_type = definition["error_type"]

    if error_type == "status_code":
        if status_code == definition["not_found_code"]:
            return False
        if status_code == 200:
            return True
        return None  # 403/429/5xx etc — inconclusivo, não é "existe"

    if error_type == "message":
        if status_code != 200:
            return None
        return definition["not_found_text"] not in body

    if error_type == "title_regex":
        if status_code != 200:
            return None
        title = _extract_title(body)
        pattern = definition["found_pattern"].format(re.escape(username))
        return bool(re.search(pattern, title, re.IGNORECASE))

    if error_type == "title_not_generic":
        if status_code != 200:
            return None
        title = _extract_title(body)
        return title != "" and title != definition["generic_title"]

    return None


async def _check_one(client: httpx.AsyncClient, platform: str, definition: dict, username: str) -> UsernameCheckResult | None:
    url = definition["url"].format(username)
    try:
        response = await client.get(url, timeout=settings.request_timeout_seconds, follow_redirects=True)
    except httpx.HTTPError:
        return None

    exists = _evaluate(definition, username, response.status_code, response.text)
    if exists is None:
        return None

    return UsernameCheckResult(platform=platform, url=url, exists=exists)


async def check_username(username: str) -> list[UsernameCheckResult]:
    """Verifica `username` em todos os sites de `sites.json`, em paralelo.
    Resultado inconclusivo (bloqueio anti-bot, timeout) é omitido — nunca
    reportado como "existe" por segurança contra falso positivo."""
    sites = _load_sites()
    semaphore = asyncio.Semaphore(settings.max_concurrent_checks)

    async def bound_check(platform: str, definition: dict) -> UsernameCheckResult | None:
        async with semaphore:
            return await _check_one(client, platform, definition, username)

    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        tasks = [bound_check(platform, definition) for platform, definition in sites.items()]
        results = await asyncio.gather(*tasks)

    return [r for r in results if r is not None and r.exists]
