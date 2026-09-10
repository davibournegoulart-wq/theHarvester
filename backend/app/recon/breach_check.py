"""Checagem de vazamento conhecido — Have I Been Pwned + XposedOrNot + fontes adicionais.

Ver vault: Tool Decision Log. Provedores:
- Senha: API de k-anonimato da HIBP (pwnedpasswords.com), pública e sem chave.
- E-mail: XposedOrNot (xposedornot.com), gratuito e sem chave.
- BreachDirectory: breachdirectory.org, busca por e-mail, gratuito.
- XposedOrNot Analytics: métricas de risco e timeline de vazamentos.
- haveibeenzuckered: busca de telefone no vazamento Facebook 533M.

Expandido em 2026-09-09 com BreachDirectory, breach analytics e Facebook
breach check, inspirado nas técnicas de h8mail, pwnedOrNot e Mosint.
"""

import hashlib
from dataclasses import dataclass

import httpx

from app.config import settings

PWNED_PASSWORDS_URL = "https://api.pwnedpasswords.com/range/"
XPOSEDORNOT_URL = "https://api.xposedornot.com/v1/check-email/"
XPOSEDORNOT_ANALYTICS_URL = "https://api.xposedornot.com/v1/breach-analytics"
BREACHDIRECTORY_URL = "https://breachdirectory.org/api/v1/search/email/"
HAVEIBEENZUCKERED_URL = "https://haveibeenzuckered.com/api/check"


# ---------------------------------------------------------------------------
# Estruturas de resultado existentes (não modificar)
# ---------------------------------------------------------------------------

@dataclass
class PasswordBreachResult:
    times_seen: int
    discovered_by: str = "recon.breach_check.pwnedpasswords"


async def check_password_pwned(password: str) -> PasswordBreachResult:
    """K-anonimato: só os 5 primeiros caracteres do hash SHA-1 saem da máquina."""
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PWNED_PASSWORDS_URL}{prefix}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()

    for line in response.text.splitlines():
        line_suffix, count = line.split(":")
        if line_suffix == suffix:
            return PasswordBreachResult(times_seen=int(count))

    return PasswordBreachResult(times_seen=0)


@dataclass
class EmailBreachResult:
    breaches: list[str]
    discovered_by: str = "recon.breach_check.xposedornot"


async def check_email_breaches(email: str) -> EmailBreachResult:
    """XposedOrNot é gratuito e sem chave — sempre HTTP 200, distingue pelo corpo."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{XPOSEDORNOT_URL}{email}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        data = response.json()

    breach_lists = data.get("breaches", [])
    breaches = breach_lists[0] if breach_lists else []
    return EmailBreachResult(breaches=breaches)


# ---------------------------------------------------------------------------
# Fontes adicionais (2026-09-09)
# ---------------------------------------------------------------------------

@dataclass
class BreachDirectoryResult:
    """Resultado do BreachDirectory — busca por e-mail em base gratuita."""
    breaches: list[str]
    sources_count: int
    discovered_by: str = "recon.breach_check.breachdirectory"


async def check_breach_directory(email: str) -> BreachDirectoryResult:
    """BreachDirectory: API gratuita, sem chave, busca e-mail em leaks públicos."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BREACHDIRECTORY_URL}{email}",
                timeout=settings.request_timeout_seconds,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if response.status_code != 200:
                return BreachDirectoryResult(breaches=[], sources_count=0)
            data = response.json()
            result_data = data.get("result", [])
            breaches = []
            if isinstance(result_data, list):
                for item in result_data:
                    source = item.get("source", "") if isinstance(item, dict) else str(item)
                    if source:
                        breaches.append(source)
            return BreachDirectoryResult(breaches=breaches, sources_count=len(breaches))
    except (httpx.HTTPError, ValueError, KeyError):
        return BreachDirectoryResult(breaches=[], sources_count=0)


@dataclass
class FacebookBreachResult:
    """Resultado da busca no vazamento Facebook 533M (haveibeenzuckered)."""
    found: bool
    phone: str
    discovered_by: str = "recon.breach_check.facebook_533m"


async def check_facebook_breach(phone: str) -> FacebookBreachResult:
    """Checa se um número de telefone está no vazamento Facebook 533M via haveibeenzuckered."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                HAVEIBEENZUCKERED_URL,
                params={"phone": phone},
                timeout=settings.request_timeout_seconds,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if response.status_code != 200:
                return FacebookBreachResult(found=False, phone=phone)
            data = response.json()
            found = bool(data.get("found", False))
            return FacebookBreachResult(found=found, phone=phone)
    except (httpx.HTTPError, ValueError, KeyError):
        return FacebookBreachResult(found=False, phone=phone)


@dataclass
class BreachAnalytics:
    """Métricas de risco e timeline de vazamentos (XposedOrNot analytics)."""
    risk_score: int | None
    breach_count: int
    first_breach: str | None
    latest_breach: str | None
    discovered_by: str = "recon.breach_check.xon_analytics"


async def get_breach_analytics(email: str) -> BreachAnalytics:
    """XposedOrNot Breach Analytics — métricas de risco gratuitas, sem chave."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                XPOSEDORNOT_ANALYTICS_URL,
                params={"email": email},
                timeout=settings.request_timeout_seconds,
            )
            if response.status_code != 200:
                return BreachAnalytics(risk_score=None, breach_count=0, first_breach=None, latest_breach=None)
            data = response.json()

            # XposedOrNot retorna estrutura aninhada
            exposures = data.get("ExposedBreaches", {})
            breaches_details = exposures.get("breaches_details", [])
            breach_count = len(breaches_details)
            risk_data = data.get("BreachMetrics", {}).get("risk", {})
            risk_score = risk_data.get("risk_score") if isinstance(risk_data, dict) else None

            first_breach = None
            latest_breach = None
            if breaches_details:
                dates = [b.get("xposed_date", "") for b in breaches_details if b.get("xposed_date")]
                if dates:
                    dates.sort()
                    first_breach = dates[0]
                    latest_breach = dates[-1]

            return BreachAnalytics(
                risk_score=int(risk_score) if risk_score is not None else None,
                breach_count=breach_count,
                first_breach=first_breach,
                latest_breach=latest_breach,
            )
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return BreachAnalytics(risk_score=None, breach_count=0, first_breach=None, latest_breach=None)
