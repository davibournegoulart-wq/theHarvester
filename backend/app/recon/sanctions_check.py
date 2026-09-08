"""Busca em lista de sanção — OFAC SDN / OpenSanctions.

Ver vault: Tool Decision Log e Architecture Roadmap#Fontes governamentais
oficiais. Esse é o exemplo canônico da exceção de link externo: fonte
governamental (OFAC, Tesouro dos EUA) e agregador sem fins lucrativos
(OpenSanctions), não serviço privado comercial.

⚠️ Confirmado em teste ao vivo (2026-09-08): a API da OpenSanctions retorna
401 sem API key ("No API key provided"). Corrige suposição anterior de
endpoint keyless — precisa cadastrar chave gratuita em opensanctions.org/api/
e configurar `NETSCRAPER_OPENSANCTIONS_API_KEY`.
"""

from dataclasses import dataclass

import httpx

from app.config import settings

OPENSANCTIONS_SEARCH_PATH = "/search/default"


@dataclass
class SanctionsMatch:
    name: str
    entity_type: str  # person | organization | vessel | aircraft
    list_name: str
    score: float
    discovered_by: str = "recon.sanctions_check.opensanctions"


async def search_sanctions(query: str) -> list[SanctionsMatch]:
    if not settings.opensanctions_api_key:
        raise RuntimeError(
            "NETSCRAPER_OPENSANCTIONS_API_KEY não configurado. "
            "Cadastro gratuito em https://www.opensanctions.org/api/"
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.opensanctions_url}{OPENSANCTIONS_SEARCH_PATH}",
            params={"q": query},
            # Formato do header não verificado ao vivo (não temos chave pra testar) —
            # confirmar contra a doc oficial ao configurar a primeira chave real.
            headers={"Authorization": f"ApiKey {settings.opensanctions_api_key}"},
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()

    return [
        SanctionsMatch(
            name=result.get("caption", ""),
            entity_type=result.get("schema", "unknown"),
            list_name=",".join(result.get("datasets", [])),
            score=result.get("score", 0.0),
        )
        for result in data.get("results", [])
    ]
