"""Gerador de Google Dorks a partir de um domínio-alvo.

Base de conhecimento inspirada no catálogo do GHDB (ver vault: Tools -
Domain and Org Recon#Google Hacking Database (GHDB)). Isso só GERA a query
de texto — a busca em si é feita pelo usuário no motor de busca (não
automatizamos scraping de resultado de busca aqui, pra não violar ToS de
motor de busca).
"""

from dataclasses import dataclass

# Padrões seed — expandir seguindo o catálogo do GHDB
DORK_TEMPLATES = [
    'site:{domain} "@{domain}"',
    'site:{domain} filetype:pdf',
    'site:{domain} intitle:"index of"',
    'site:{domain} inurl:admin',
    'site:{domain} inurl:login',
    'site:{domain} ext:sql | ext:env | ext:log',
]


@dataclass
class DorkQuery:
    query: str
    intent: str


def generate_dorks(domain: str) -> list[DorkQuery]:
    return [DorkQuery(query=t.format(domain=domain), intent=t) for t in DORK_TEMPLATES]
