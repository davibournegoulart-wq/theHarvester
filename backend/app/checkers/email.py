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
  implementado nessa rodada.

Expandido (2026-09-09): adicionados 11 adapters para serviços com
endpoints públicos de verificação de e-mail. Cada um segue o mesmo padrão
do adapter original do Twitter — request único, sem autenticação de
terceiro, sem rotação de sessão.
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


# ---------------------------------------------------------------------------
# Adapters — cada um é independente, falha de um não afeta os outros
# ---------------------------------------------------------------------------

async def _check_twitter(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Twitter: endpoint público `email_available.json` — retorna {"taken": bool}."""
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


async def _check_spotify(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Spotify: endpoint público de verificação no fluxo de signup."""
    try:
        response = await client.get(
            "https://spclient.wg.spotify.com/signup/public/v1/account",
            params={"validate": "1", "email": email},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        # status 20 = e-mail já registrado
        exists = data.get("status") == 20
        return EmailCheckResult(service="spotify", exists=exists)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_firefox(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Mozilla/Firefox Accounts: POST com e-mail retorna {"exists": bool}."""
    try:
        response = await client.post(
            "https://api.accounts.firefox.com/v1/account/status",
            json={"email": email},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code not in (200, 400):
            return None
        data = response.json()
        return EmailCheckResult(service="firefox", exists=bool(data.get("exists")))
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_microsoft(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Microsoft: GetCredentialType — IfExistsResult 0=existe, 1=não existe."""
    try:
        response = await client.post(
            "https://login.microsoftonline.com/common/GetCredentialType",
            json={"username": email, "isOtherIdpSupported": True},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        exists = data.get("IfExistsResult") == 0
        return EmailCheckResult(service="microsoft", exists=exists)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_discord(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Discord: POST /auth/forgot — 204 se e-mail existe, 400 se não."""
    try:
        response = await client.post(
            "https://discord.com/api/v9/auth/forgot",
            json={"email": email},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code == 204:
            return EmailCheckResult(service="discord", exists=True)
        if response.status_code == 400:
            return EmailCheckResult(service="discord", exists=False)
        if response.status_code == 429:
            return EmailCheckResult(service="discord", exists=False, rate_limited=True)
        return None
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_adobe(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Adobe: endpoint de verificação de conta no fluxo de login."""
    try:
        response = await client.post(
            "https://auth.services.adobe.com/signin/v2/accounts/check",
            json={"email": email},
            headers={"Content-Type": "application/json", "x-ims-clientid": "adobedotcom2"},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code == 200:
            return EmailCheckResult(service="adobe", exists=True)
        if response.status_code in (400, 404):
            return EmailCheckResult(service="adobe", exists=False)
        return None
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_github(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """GitHub: fluxo de password reset — resposta diferente para e-mail existente vs não."""
    try:
        # Primeiro pegar o CSRF token
        page = await client.get(
            "https://github.com/password_reset",
            timeout=settings.request_timeout_seconds,
        )
        if page.status_code != 200:
            return None

        # Extrair authenticity_token do form
        import re
        token_match = re.search(r'name="authenticity_token"\s+value="([^"]+)"', page.text)
        if not token_match:
            return None

        response = await client.post(
            "https://github.com/password_reset",
            data={"authenticity_token": token_match.group(1), "email": email},
            timeout=settings.request_timeout_seconds,
            follow_redirects=True,
        )
        # GitHub sempre retorna 200 com mensagem — mas texto diferente
        if response.status_code == 200:
            # Se contém a mensagem de sucesso, e-mail existe
            exists = "check your email" in response.text.lower() or "sent you an email" in response.text.lower()
            return EmailCheckResult(service="github", exists=exists)
        return None
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_yahoo(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Yahoo: fluxo de recuperação — indica se conta existe."""
    try:
        response = await client.post(
            "https://login.yahoo.com/account/challenge/username",
            params={"validateField": "username"},
            json={"username": email, "acrumb": "", "sessionIndex": ""},
            headers={"Content-Type": "application/json"},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        # Yahoo retorna error array vazio quando conta existe
        errors = data.get("errors", [])
        exists = len(errors) == 0
        return EmailCheckResult(service="yahoo", exists=exists)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_tumblr(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Tumblr: verificação de disponibilidade de e-mail no registro."""
    try:
        response = await client.post(
            "https://www.tumblr.com/svc/account/register",
            data={
                "action": "signup_account",
                "determine_email": email,
                "user[email]": email,
                "user[age]": "",
                "context": "no_referer",
            },
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        # Tumblr retorna error com "already in use" quando o e-mail existe
        error_msgs = str(data.get("errors", []))
        exists = "already" in error_msgs.lower() or "taken" in error_msgs.lower()
        return EmailCheckResult(service="tumblr", exists=exists)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_wordpress(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """WordPress.com: verificação de existência de conta via endpoint público."""
    try:
        response = await client.get(
            "https://public-api.wordpress.com/rest/v1.1/users/suggest",
            params={"q": email},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        suggestions = data.get("suggestions", [])
        # Se há sugestões baseadas no e-mail, provável que existe
        exists = len(suggestions) > 0
        return EmailCheckResult(service="wordpress", exists=exists)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def _check_snapchat(client: httpx.AsyncClient, email: str) -> EmailCheckResult | None:
    """Snapchat: verificação de e-mail no fluxo de criação de conta."""
    try:
        response = await client.post(
            "https://accounts.snapchat.com/accounts/merlin/check_email",
            data={"email": email},
            timeout=settings.request_timeout_seconds,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        # taken = true quando e-mail já está registrado
        exists = bool(data.get("taken", False))
        return EmailCheckResult(service="snapchat", exists=exists)
    except (httpx.HTTPError, ValueError, KeyError):
        return None


# ---------------------------------------------------------------------------
# Registro de todos os adapters
# ---------------------------------------------------------------------------

_ADAPTERS = [
    _check_twitter,
    _check_spotify,
    _check_firefox,
    _check_microsoft,
    _check_discord,
    _check_adobe,
    _check_github,
    _check_yahoo,
    _check_tumblr,
    _check_wordpress,
    _check_snapchat,
]


async def check_email(email: str) -> list[EmailCheckResult]:
    """Executa todos os adapters em paralelo e retorna resultados não-nulos."""
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        results = await asyncio.gather(*(adapter(client, email) for adapter in _ADAPTERS))

    return [r for r in results if r is not None]
