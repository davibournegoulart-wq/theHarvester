"""Perfil público Gravatar por e-mail — mesma técnica que o Epieos usa.

Ver vault: Tools - Identifier Lookup. API pública v3 do Gravatar, sem chave
— hash SHA-256 do e-mail normalizado (minúsculo, sem espaço) identifica o
perfil. Gravatar é opt-in: só devolve dado se a pessoa criou um perfil
público vinculado àquele e-mail (nome, localização, empresa, contas
verificadas de outras redes) — nunca extrai nada que a pessoa não tenha
explicitamente publicado.

Confirmado ao vivo (2026-09-08): 404 quando não existe perfil pra aquele
e-mail (não é erro, é resultado válido — a maioria dos e-mails não tem
Gravatar). `verified_accounts` é o campo mais valioso pra pivô: lista
outras redes que a pessoa vinculou e confirmou dono do perfil.
"""

import hashlib
from dataclasses import dataclass

import httpx

from app.config import settings

GRAVATAR_API_URL = "https://api.gravatar.com/v3/profiles/"


@dataclass
class GravatarProfile:
    exists: bool
    display_name: str | None = None
    profile_url: str | None = None
    avatar_url: str | None = None
    location: str | None = None
    description: str | None = None
    job_title: str | None = None
    company: str | None = None
    verified_accounts: list[dict] | None = None
    discovered_by: str = "checkers.gravatar"


def _email_hash(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


async def lookup_gravatar(email: str) -> GravatarProfile:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{GRAVATAR_API_URL}{_email_hash(email)}", timeout=settings.request_timeout_seconds)

    if response.status_code == 404:
        return GravatarProfile(exists=False)
    response.raise_for_status()
    data = response.json()

    return GravatarProfile(
        exists=True,
        display_name=data.get("display_name") or None,
        profile_url=data.get("profile_url"),
        avatar_url=data.get("avatar_url"),
        location=data.get("location") or None,
        description=data.get("description") or None,
        job_title=data.get("job_title") or None,
        company=data.get("company") or None,
        verified_accounts=data.get("verified_accounts") or [],
    )
