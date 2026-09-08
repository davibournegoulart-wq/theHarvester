"""Geolocalização/ASN de IP via RDAP — protocolo público, sem chave.

Ver vault: Tool Decision Log. RDAP (rdap.org) é o sucessor padronizado do
WHOIS, mantido pelos Regional Internet Registries — não é serviço privado,
é infraestrutura pública da internet.
"""

from dataclasses import dataclass

import httpx

from app.config import settings

RDAP_BOOTSTRAP_URL = "https://rdap.org/ip/"


@dataclass
class IPReputationResult:
    ip: str
    asn_holder: str | None
    country: str | None
    raw: dict
    discovered_by: str = "recon.ip_reputation.rdap"


async def lookup_ip(ip: str) -> IPReputationResult:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(f"{RDAP_BOOTSTRAP_URL}{ip}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        data = response.json()

    entities = data.get("entities", [])
    holder = entities[0].get("handle") if entities else None
    country = data.get("country")

    return IPReputationResult(ip=ip, asn_holder=holder, country=country, raw=data)
