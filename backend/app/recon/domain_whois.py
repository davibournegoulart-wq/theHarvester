"""WHOIS de domínio via RDAP — registrante, e-mail de contato, idade do
domínio. Mesmo princípio de `recon/ip_reputation.py`: RDAP é o protocolo
público padronizado sucessor do WHOIS, com bootstrap automático pro
servidor certo (rdap.org resolve pra qual registro atende aquele TLD) — sem
precisar de lib de WHOIS bruto (protocolo antigo, porta 43).

⚠️ Confirmado ao vivo (2026-09-08): a maioria dos domínios .com/.net/.org
tem o contato do registrante **redigido por política de privacidade**
(GDPR desde 2018 — a maioria dos registradores oferece proteção por
padrão). Nesse caso `registrant_name`/`registrant_email` vêm `None` — não é
bug, é a política do registro, não dá pra contornar de forma keyless/
pública. Testado: `facebook.com` não expõe entidade "registrant" nenhuma
(só "registrar", a empresa revendedora do domínio, não o dono);
`registro.br` (.br, sem proteção de privacidade) expõe o registrante
completo. A data de registro (e portanto a idade do domínio) sempre fica
disponível, independente da política de privacidade do contato.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app.config import settings

RDAP_DOMAIN_URL = "https://rdap.org/domain/"


@dataclass
class DomainWhoisResult:
    domain: str
    registrar: str | None
    registrant_name: str | None
    registrant_email: str | None
    created_at: str | None
    age_days: int | None
    discovered_by: str = "recon.domain_whois.rdap"


def _vcard_field(vcard_array, field_name: str) -> str | None:
    if not vcard_array or len(vcard_array) < 2:
        return None
    for entry in vcard_array[1]:
        if entry[0] == field_name:
            return entry[3]
    return None


def _entity_by_role(entities: list[dict], role: str) -> dict | None:
    for entity in entities:
        if role in entity.get("roles", []):
            return entity
    return None


async def lookup_domain_whois(domain: str) -> DomainWhoisResult:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(f"{RDAP_DOMAIN_URL}{domain}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        data = response.json()

    entities = data.get("entities", [])
    registrar_entity = _entity_by_role(entities, "registrar")
    registrant_entity = _entity_by_role(entities, "registrant")

    registrar = _vcard_field(registrar_entity.get("vcardArray"), "fn") if registrar_entity else None
    registrant_name = _vcard_field(registrant_entity.get("vcardArray"), "fn") if registrant_entity else None
    registrant_email = _vcard_field(registrant_entity.get("vcardArray"), "email") if registrant_entity else None

    created_at = None
    age_days = None
    for event in data.get("events", []):
        if event.get("eventAction") == "registration":
            created_at = event.get("eventDate")
            try:
                created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                age_days = (datetime.now(timezone.utc) - created_dt).days
            except ValueError:
                pass
            break

    return DomainWhoisResult(
        domain=domain,
        registrar=registrar,
        registrant_name=registrant_name,
        registrant_email=registrant_email,
        created_at=created_at,
        age_days=age_days,
    )
