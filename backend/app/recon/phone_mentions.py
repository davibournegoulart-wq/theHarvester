"""Busca de menção pública de telefone em rede social — gera dork, não faz scraping.

Ver vault: Architecture Roadmap. Mesmo princípio de `recon/dork_generator.py`
e `recon/reverse_image.py`: puxar automaticamente todo post que menciona um
número exigiria API paga por rede (Twitter/X cobra) ou scraping direto do
feed de busca de cada plataforma (bloqueado por anti-bot na maioria — já
confirmado neste projeto pra vários checkers). Em vez disso, geramos a busca
certa pra cada plataforma e o investigador abre/revisa no navegador — decide
o que é achado real, evita falso positivo de coincidência numérica.

Gera duas variantes do número (formato completo como veio + só dígitos
locais, sem código de país) porque a maioria dos posts não inclui "+55" ao
escrever um telefone.
"""

from dataclasses import dataclass

PLATFORM_DOMAINS = {
    "Facebook": "facebook.com",
    "Instagram": "instagram.com",
    "Twitter/X": "x.com",
    "TikTok": "tiktok.com",
    "OLX": "olx.com.br",
    "Mercado Livre": "mercadolivre.com.br",
}


@dataclass
class PhoneMentionQuery:
    platform: str
    query: str


def _local_digits(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    # remove código de país BR (55) quando sobrar DDD + número (11 dígitos)
    if len(digits) > 11 and digits.startswith("55"):
        return digits[2:]
    return digits


def generate_phone_mention_queries(phone: str) -> list[PhoneMentionQuery]:
    local = _local_digits(phone)
    variants = [phone] if phone == local else [phone, local]

    queries = [PhoneMentionQuery(platform="Web (geral)", query=f'"{variant}"') for variant in variants]

    for platform, domain in PLATFORM_DOMAINS.items():
        for variant in variants:
            queries.append(PhoneMentionQuery(platform=platform, query=f'site:{domain} "{variant}"'))

    return queries
