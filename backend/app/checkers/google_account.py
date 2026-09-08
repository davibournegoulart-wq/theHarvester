"""OSINT de conta Google via sessão da própria conta do investigador.

Reimplementação nativa da técnica do GHunt (mxrch/GHunt, AGPL-3.0) — lido
o código-fonte real (`ghunt/apis/peoplepa.py`, `ghunt/helpers/utils.py`)
pra entender o mecanismo, não copiado verbatim.

Autenticação via **SAPISIDHASH**: esquema documentado e usado pelo próprio
Google pra request autenticado só com cookie, sem token OAuth clássico —
por isso isso NÃO é "fazer login com e-mail/senha" nem tela de consentimento
OAuth. É a sessão que já existe no seu navegador (você já logado no
google.com) sendo usada pra assinar o request. Fórmula:
`{timestamp}_{sha1(f"{timestamp} {SAPISID} {origin}")}`.

`cookies` deve vir da SUA PRÓPRIA sessão Google logada (nunca sessão de
terceiro) — copiado do navegador (DevTools → Application → Cookies →
google.com), mínimo o cookie `SAPISID`.

A "API key" abaixo não é segredo — é identificador de app público, embutido
no JS que `photos.google.com` entrega a qualquer visitante (visível no
DevTools de qualquer navegador). A segurança real do request vem do
SAPISIDHASH+cookie, não dessa chave.

⚠️ Limitação confirmada lendo o código-fonte atual do GHunt (2026-09-08):
o próprio mantenedor documentou que o Google bloqueou a extração de nome
desse endpoint (`ghunt/parsers/people.py`: "Google patched the names :/
very sad", campo de nome vem sempre vazio agora). Só Gaia ID e foto de
perfil continuam funcionando — não implementado suporte a nome.
"""

import hashlib
import time
from dataclasses import dataclass

import httpx

PEOPLE_LOOKUP_URL = "https://people-pa.clients6.google.com/v2/people/lookup"
PHOTOS_API_KEY = "AIzaSyAa2odBewW-sPJu3jMORr0aNedh3YlkiQc"
PHOTOS_ORIGIN = "https://photos.google.com"


@dataclass
class GoogleAccountProfile:
    email: str
    gaia_id: str | None
    profile_photo_url: str | None
    is_public_profile: bool
    discovered_by: str = "checkers.google_account"


def _gen_sapisidhash(sapisid: str, origin: str, timestamp: str | None = None) -> str:
    ts = timestamp or str(int(time.time()))
    digest = hashlib.sha1(f"{ts} {sapisid} {origin}".encode()).hexdigest()
    return f"{ts}_{digest}"


async def lookup_gaia_profile(email: str, cookies: dict[str, str]) -> GoogleAccountProfile:
    """`cookies`: jar da sua própria sessão Google logada. Mínimo `SAPISID`
    — idealmente o jar inteiro (SID, HSID, SSID, APISID, SAPISID,
    __Secure-*) pra evitar inconsistência que o Google possa rejeitar."""
    if "SAPISID" not in cookies:
        raise ValueError("cookies precisa conter ao menos o SAPISID da sua própria sessão Google logada.")

    headers = {
        "Authorization": f"SAPISIDHASH {_gen_sapisidhash(cookies['SAPISID'], PHOTOS_ORIGIN)}",
        "X-Goog-Api-Key": PHOTOS_API_KEY,
        "Origin": PHOTOS_ORIGIN,
        "Referer": PHOTOS_ORIGIN,
    }
    params = {
        "id": email,
        "type": "EMAIL",
        "matchType": "EXACT",
        "requestMask.includeField.paths": ["person.metadata", "person.photo", "person.email"],
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(PEOPLE_LOOKUP_URL, params=params, headers=headers, cookies=cookies, timeout=15.0)
        response.raise_for_status()
        data = response.json()

    people = data.get("people") or {}
    if not people:
        return GoogleAccountProfile(email=email, gaia_id=None, profile_photo_url=None, is_public_profile=False)

    person_data = next(iter(people.values()))
    gaia_id = person_data.get("personId")
    photo_url = next((p.get("url") for p in person_data.get("photo", [])), None)

    return GoogleAccountProfile(
        email=email,
        gaia_id=gaia_id,
        profile_photo_url=photo_url,
        is_public_profile=gaia_id is not None,
    )
