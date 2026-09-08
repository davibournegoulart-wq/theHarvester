"""Checagem de existência de e-mail via fluxo de "esqueci minha senha"/registro.

Reimplementação nativa do padrão Holehe/Quidam (ver vault: Tools -
Identifier Lookup). Técnica confirmada lendo o código-fonte atual e
mantido do Holehe (megadose/holehe, GPL-3.0) em 2026-09-08 — não copiado
verbatim, reimplementado a partir do entendimento de qual endpoint/payload
cada serviço usa.

Cada serviço tem endpoint e formato de resposta próprios — não dá pra
generalizar num JSON simples como o username checker. Cada adapter é uma
função async isolada; um serviço quebrando (endpoint mudou, bloqueio
anti-bot) não deve derrubar a checagem dos outros.

⚠️ Verificado ao vivo (2026-09-08), request único por serviço (não
repetido, para não gerar padrão de tráfego que pareça abuso contra
sistema de autenticação de terceiro):
- Twitter: endpoint `email_available.json` ainda funciona, retorna
  `{"taken": bool}` — implementado.
- Pinterest: `EmailExistsResource` retornou 403 (bloqueio anti-bot) — não
  implementado, tratado como indisponível.
- Instagram/Imgur: fluxo exige CSRF token + POST multi-etapa — footprint
  de tráfego mais alto contra sistema de autenticação de produção; não
  implementado nessa rodada, TODO se for realmente necessário.
"""

import asyncio
from dataclasses import dataclass

import httpx

from app.config import settings


@dataclass
class EmailCheckResult:
    service: str
    exists: bool
    rate_limited: bool = False
    leaked_recovery_hint: str | None = None  # ex: e-mail/telefone parcialmente ofuscado
    discovered_by: str = "checkers.email"


async def _check_twitter(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    try:
        response = await client.get(
            "https://api.twitter.com/i/users/email_available.json",
            params={"email": email},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        return EmailCheckResult(service="twitter", exists=bool(data.get("taken")))
    except (httpx.HTTPError, ValueError, KeyError):
        return None


_ADAPTERS = [_check_twitter]


async def check_email(email: str) -> list[EmailCheckResult]:
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        results = await asyncio.gather(*(adapter(client, email) for adapter in _ADAPTERS))

    return [r for r in results if r is not None]
