"""Pivô de identidade: perfil Facebook público -> ID -> Marketplace.

Reimplementação nativa do padrão FB2MKTP/SellerFB (ver vault: Tools -
Identifier Lookup#FB2MKTP e SellerFB). Usa só dado que a própria página
pública do Facebook/Marketplace expõe — sem login, sem sessão.

`extract_facebook_id` busca o ID numérico nas meta tags OpenGraph
(`og:url`/`al:ios:url`) que o Facebook expõe em qualquer página pública de
perfil — mesmo mecanismo que o FB2MKTP usa por baixo.

`lookup_marketplace_seller` fica como TODO: a página do Marketplace exige
parsing de HTML dinâmico (React hidratado), diferente da meta tag simples
do perfil — precisa de abordagem mais robusta (ex: extrair do JSON embutido
no `<script type="application/json">` da página) antes de confiar no dado.
"""

import re
from dataclasses import dataclass

import httpx

FB_ID_PATTERNS = [
    re.compile(r'"userID":"(\d+)"'),
    re.compile(r'al:ios:url" content="fb://profile/(\d+)"'),
    re.compile(r'"entity_id":"(\d+)"'),
]


@dataclass
class MarketplaceSellerInfo:
    facebook_id: str
    marketplace_url: str
    linked_locations: list[str]
    active_listings_count: int
    rating: float | None
    discovered_by: str = "checkers.facebook_pivot"


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


async def lookup_marketplace_seller(facebook_id: str) -> MarketplaceSellerInfo:
    raise NotImplementedError(
        "Parsing de HTML dinâmico da página do Marketplace — extrair do JSON "
        "embutido em <script type='application/json'>, não da meta tag simples."
    )
