"""Recon de domínio/organização a partir de fonte passiva pública.

Reimplementação nativa do padrão theHarvester (ver vault: Tools - Domain and
Org Recon#theHarvester). Fonte inicial: crt.sh (log de certificado
transparente, JSON público, sem autenticação) — mesma fonte que o
theHarvester usa como um dos providers.

⚠️ Confirmado em teste ao vivo (2026-09-08): crt.sh retorna 502 com
frequência (serviço comunitário gratuito, uma única instância Postgres por
trás, notoriamente instável sob carga). O código já trata isso (retorna
lista vazia em vez de quebrar), mas não confiar em `find_subdomains` como
única fonte — TODO: adicionar segunda fonte passiva (ex: dataset de DNS
público) como fallback quando crt.sh estiver fora do ar.
"""

from dataclasses import dataclass

import httpx

from app.config import settings

CRTSH_URL = "https://crt.sh/"


@dataclass
class SubdomainResult:
    subdomain: str
    discovered_by: str = "recon.domain.crtsh"


async def find_subdomains(domain: str) -> list[SubdomainResult]:
    """Consulta o crt.sh (log público de certificado transparente) por `domain`."""
    params = {"q": f"%.{domain}", "output": "json"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(CRTSH_URL, params=params, timeout=settings.request_timeout_seconds)
            response.raise_for_status()
        except httpx.HTTPError:
            return []

    seen: set[str] = set()
    results: list[SubdomainResult] = []
    for entry in response.json():
        for name in entry.get("name_value", "").split("\n"):
            name = name.strip().lower()
            if name and name not in seen and name.endswith(domain):
                seen.add(name)
                results.append(SubdomainResult(subdomain=name))

    return results
