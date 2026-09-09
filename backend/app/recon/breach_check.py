"""Checagem de vazamento conhecido — Have I Been Pwned + XposedOrNot.

Ver vault: Tool Decision Log. Dois provedores diferentes:
- Senha: API de k-anonimato da HIBP (pwnedpasswords.com), pública e sem
  chave — nunca envia a senha em texto claro, só os 5 primeiros
  caracteres do hash SHA-1.
- E-mail: endpoint de breach por conta da própria HIBP exige API key
  paga — ficou muito tempo como TODO. Confirmado ao vivo (2026-09-09):
  XposedOrNot (xposedornot.com) tem o mesmo tipo de busca, **gratuito e
  sem chave**. Sempre responde HTTP 200 (até pra e-mail não encontrado),
  então a distinção é pelo corpo: `{"breaches": [[...]]}` quando acha,
  `{"Error": "Not found"}` quando não.
"""

import hashlib
from dataclasses import dataclass

import httpx

from app.config import settings

PWNED_PASSWORDS_URL = "https://api.pwnedpasswords.com/range/"
XPOSEDORNOT_URL = "https://api.xposedornot.com/v1/check-email/"


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
