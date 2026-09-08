"""Checagem de vazamento conhecido — Have I Been Pwned.

Ver vault: Tool Decision Log. Dois endpoints diferentes:
- Senha: API de k-anonimato (pwnedpasswords.com), pública e sem chave —
  implementado abaixo, nunca envia a senha em texto claro, só os 5
  primeiros caracteres do hash SHA-1.
- E-mail: endpoint de breach por conta exige API key paga da HIBP — fica
  como TODO, não é keyless como o de senha.
"""

import hashlib
from dataclasses import dataclass

import httpx

from app.config import settings

PWNED_PASSWORDS_URL = "https://api.pwnedpasswords.com/range/"


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


async def check_email_breaches(email: str, hibp_api_key: str) -> list[str]:
    raise NotImplementedError("Endpoint de breach por conta da HIBP exige API key paga — plugar quando disponível.")
