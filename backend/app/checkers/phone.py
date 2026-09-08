"""Checagem de existência de telefone via login/registro + metadado de operadora.

Reimplementação nativa do padrão Ignorant (existência silenciosa) + PhoneInfoga
(metadado de país/operadora/tipo de linha) + Moriarty Project (agregador).
Ver vault: Tools - Identifier Lookup.

`lookup_phone_metadata` usa `phonenumbers` (porte Python da libphonenumber do
Google) — biblioteca offline, sem chamada de rede, sem depender do PhoneInfoga
(projeto sem manutenção ativa).

`check_phone_existence` fica como TODO: cada serviço (Amazon, Instagram,
Snapchat) tem endpoint de registro/login próprio que muda com frequência —
implementar exige validação contra o endpoint real de cada um antes de
confiar no resultado, para não devolver falso positivo/negativo silencioso.
"""

from dataclasses import dataclass

import phonenumbers
from phonenumbers import carrier as phonenumbers_carrier
from phonenumbers import geocoder as phonenumbers_geocoder


@dataclass
class PhoneCheckResult:
    service: str
    exists: bool
    rate_limited: bool = False
    discovered_by: str = "checkers.phone"


@dataclass
class PhoneMetadata:
    country: str | None
    carrier: str | None
    line_type: str | None  # mobile / fixed_line / voip / unknown
    is_valid: bool
    discovered_by: str = "checkers.phone.metadata"


_LINE_TYPE_NAMES = {
    phonenumbers.PhoneNumberType.MOBILE: "mobile",
    phonenumbers.PhoneNumberType.FIXED_LINE: "fixed_line",
    phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
    phonenumbers.PhoneNumberType.VOIP: "voip",
    phonenumbers.PhoneNumberType.PAGER: "pager",
    phonenumbers.PhoneNumberType.PERSONAL_NUMBER: "personal_number",
    phonenumbers.PhoneNumberType.TOLL_FREE: "toll_free",
    phonenumbers.PhoneNumberType.PREMIUM_RATE: "premium_rate",
}


def lookup_phone_metadata(phone: str, default_region: str | None = None) -> PhoneMetadata:
    """`phone` pode vir com `+55...` (default_region ignorado) ou sem código de
    país (nesse caso `default_region` como "BR"/"US"/etc é obrigatório)."""
    parsed = phonenumbers.parse(phone, default_region)
    is_valid = phonenumbers.is_valid_number(parsed)

    return PhoneMetadata(
        country=phonenumbers_geocoder.description_for_number(parsed, "en") or None,
        carrier=phonenumbers_carrier.name_for_number(parsed, "en") or None,
        line_type=_LINE_TYPE_NAMES.get(phonenumbers.number_type(parsed), "unknown"),
        is_valid=is_valid,
    )


async def check_phone_existence(phone: str, country_code: str) -> list[PhoneCheckResult]:
    raise NotImplementedError("Ver vault: Tools - Identifier Lookup#Ignorant para o padrão de fluxo login/registro.")
