"""Extração de ID numérico interno de perfil público — Instagram e TikTok.

Mesmo princípio de `checkers/facebook_pivot.py`: usa só dado que a própria
página pública expõe (JSON embutido no HTML pra hidratação client-side do
React/Vue), sem login, sem sessão. Serve pra rastrear a mesma pessoa
através de troca de @username — o ID numérico interno não muda mesmo que
o @username mude.

Confirmado ao vivo (2026-09-08):
- Instagram: campo `profile_id` no HTML da página de perfil.
- TikTok: campo `id` dentro de `webapp.user-detail.userInfo.user` (JSON
  embutido em `__UNIVERSAL_DATA_FOR_REHYDRATION__`). `secUid` também
  disponível — identificador opaco mais moderno usado pela API interna.
- Twitter/X: **não implementado** — a página serve casca vazia de SPA sem
  dado de usuário embutido no HTML (mesmo problema documentado em
  `checkers/username.py`); extrair o ID exigiria API oficial paga ou
  sessão autenticada, fora do escopo do projeto.
"""

import re
from dataclasses import dataclass

import httpx

_INSTAGRAM_ID_RE = re.compile(r'"profile_id":"(\d+)"')
_TIKTOK_ID_RE = re.compile(r'"id":"(\d+)","shortId"')
_TIKTOK_SECUID_RE = re.compile(r'"secUid":"([A-Za-z0-9_-]+)"')


@dataclass
class SocialIdResult:
    platform: str
    user_id: str | None
    sec_uid: str | None = None
    discovered_by: str = "checkers.social_id_pivot"


async def extract_instagram_id(username: str) -> SocialIdResult:
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        response = await client.get(f"https://www.instagram.com/{username}/", timeout=8.0)
    match = _INSTAGRAM_ID_RE.search(response.text)
    return SocialIdResult(platform="instagram", user_id=match.group(1) if match else None)


async def extract_tiktok_id(username: str) -> SocialIdResult:
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        response = await client.get(f"https://www.tiktok.com/@{username}", timeout=8.0)
    id_match = _TIKTOK_ID_RE.search(response.text)
    secuid_match = _TIKTOK_SECUID_RE.search(response.text)
    return SocialIdResult(
        platform="tiktok",
        user_id=id_match.group(1) if id_match else None,
        sec_uid=secuid_match.group(1) if secuid_match else None,
    )
