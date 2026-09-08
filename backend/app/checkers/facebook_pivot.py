"""Pivô de identidade: perfil Facebook público -> ID -> Marketplace.

Reimplementação nativa do padrão FB2MKTP/SellerFB (ver vault: Tools -
Identifier Lookup#FB2MKTP e SellerFB). Usa só dado que a própria página
pública do Facebook expõe — sem login, sem sessão.

`extract_facebook_id` busca o ID numérico nas meta tags OpenGraph
(`og:url`/`al:ios:url`) que o Facebook expõe em qualquer página pública de
perfil — mesmo mecanismo que o FB2MKTP usa por baixo. Testado ao vivo
contra facebook.com/zuck.

O restante do que SellerFB oferecia (dado de vendedor do Marketplace:
localização, grupos, avaliação) **não é implementável dentro do limite de
risco do projeto**: confirmado ao vivo (2026-09-08) que
`facebook.com/marketplace/profile/{id}` devolve parede de login
(`CAALoginCometHeaderLoginForm`) pra visitante não autenticado — diferente
do perfil básico, que expõe meta tag pública. Contornar isso exigiria
sessão autenticada, mesma categoria de risco do Nqntnqnqmb/Toutatis (ver
[[Tools - Excluded (Risk Review)]] no vault). Decisão de escopo, não
pendência técnica — por isso não há stub dessa função aqui.
"""

import re

import httpx

FB_ID_PATTERNS = [
    re.compile(r'"userID":"(\d+)"'),
    re.compile(r'al:ios:url" content="fb://profile/(\d+)"'),
    re.compile(r'"entity_id":"(\d+)"'),
]


async def extract_facebook_id(profile_url: str) -> str | None:
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        response = await client.get(profile_url, timeout=8.0)

    for pattern in FB_ID_PATTERNS:
        match = pattern.search(response.text)
        if match:
            return match.group(1)

    return None


def marketplace_url_for_id(facebook_id: str) -> str:
    return f"https://www.facebook.com/marketplace/profile/{facebook_id}/"
