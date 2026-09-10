"""Checagem de existência de telefone via login/registro + metadado de operadora.

Reimplementação nativa do padrão Ignorant (existência silenciosa) + PhoneInfoga
(metadado de país/operadora/tipo de linha) + Moriarty Project (agregador).
Ver vault: Tools - Identifier Lookup.

`check_phone_existence` — técnica lida no código-fonte do Ignorant
(megadose/ignorant, GPL-3.0), reimplementada (não copiada verbatim).

⚠️ Testado ao vivo (2026-09-08): o fluxo documentado pelo Ignorant pro
Snapchat (GET cookie `xsrf_token` → POST `validate_phone_number` → checar
`status_code`) **não funciona mais** — a Snapchat redesenhou a página de
login pra uma SPA Next.js, e o endpoint agora devolve a casca do app
(HTML) em vez de JSON. O CSP da resposta mostra hCaptcha/Arkoselabs ativo
nesse fluxo, indicando proteção anti-bot reforçada. Código abaixo trata
isso como inconclusivo (retorna vazio, não quebra), mas a checagem de
telefone por login/registro está efetivamente sem fonte funcional
confirmada no momento — mesmo problema de manutenção que atinge
Ignorant/Holehe upstream.

`lookup_phone_metadata` usa `phonenumbers` (porte Python da libphonenumber
do Google) — biblioteca offline, sem chamada de rede.
"""

from dataclasses import dataclass

import httpx
import phonenumbers
from phonenumbers import carrier as phonenumbers_carrier
from phonenumbers import geocoder as phonenumbers_geocoder
from phonenumbers import timezone as phonenumbers_timezone

from app.config import settings


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
    timezones: list[str] | None = None
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

    timezones = list(phonenumbers_timezone.time_zones_for_number(parsed)) if is_valid else None
    
    return PhoneMetadata(
        country=phonenumbers_geocoder.description_for_number(parsed, "en") or None,
        carrier=phonenumbers_carrier.name_for_number(parsed, "en") or None,
        line_type=_LINE_TYPE_NAMES.get(phonenumbers.number_type(parsed), "unknown"),
        is_valid=is_valid,
        timezones=timezones,
    )


async def _check_snapchat(client: httpx.AsyncClient, phone_national: str, region_code: str) -> PhoneCheckResult | None:
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://accounts.snapchat.com",
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    }
    try:
        get_resp = await client.get(
            "https://accounts.snapchat.com", headers=headers, timeout=settings.request_timeout_seconds
        )
        xsrf_token = get_resp.cookies.get("xsrf_token")
        if not xsrf_token:
            return None

        data = {
            "phone_country_code": region_code,
            "phone_number": phone_national,
            "xsrf_token": xsrf_token,
        }
        post_resp = await client.post(
            "https://accounts.snapchat.com/accounts/validate_phone_number",
            headers=headers,
            data=data,
            timeout=settings.request_timeout_seconds,
        )
        status = post_resp.json().get("status_code")
    except (httpx.HTTPError, ValueError, KeyError):
        return None

    if status == "TAKEN_NUMBER":
        return PhoneCheckResult(service="snapchat", exists=True)
    if status == "OK":
        return PhoneCheckResult(service="snapchat", exists=False)
    return None  # bloqueio/rate-limit — inconclusivo


async def check_phone_existence(phone: str, default_region: str) -> list[PhoneCheckResult]:
    """`default_region` é o código ISO do país (ex: "US", "BR") — necessário
    pra converter o número no formato que o Snapchat espera."""
    parsed = phonenumbers.parse(phone, default_region)
    national_number = str(parsed.national_number)

    async with httpx.AsyncClient() as client:
        result = await _check_snapchat(client, national_number, default_region)

    return [result] if result is not None else []


async def check_whatsapp_existence(phone: str) -> PhoneCheckResult | None:
    """Verifica existência no WhatsApp. `phone` deve ter o código do país."""
    try:
        parsed = phonenumbers.parse(phone)
        if not phonenumbers.is_valid_number(parsed):
            return None
        phone_e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)[1:]
    except phonenumbers.NumberParseException:
        return None

    url = f"https://wa.me/{phone_e164}"
    
    async with httpx.AsyncClient() as client:
        try:
            # A HEAD request sem follow_redirects:
            # 200 = OK, tem a página com botão Message (telefone válido)
            # 302 (redirect) ou outro = não existe
            resp = await client.head(url, timeout=settings.request_timeout_seconds, follow_redirects=False)
            if resp.status_code == 200:
                return PhoneCheckResult(service="whatsapp", exists=True)
            return PhoneCheckResult(service="whatsapp", exists=False)
        except httpx.HTTPError:
            return None

async def check_telegram_existence(phone: str) -> PhoneCheckResult | None:
    """Verifica existência no Telegram. `phone` deve ter o código do país."""
    try:
        parsed = phonenumbers.parse(phone)
        if not phonenumbers.is_valid_number(parsed):
            return None
        phone_e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        return None

    url = f"https://t.me/{phone_e164}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=settings.request_timeout_seconds, follow_redirects=True)
            if resp.status_code == 200:
                if 'tgme_page_title' in resp.text and 'tgme_page_extra' not in resp.text: # telegram generic empty
                     pass
                # A heuristic: valid pages have a specific title or contact elements
                if 'Send Message' in resp.text or 'Contact' in resp.text or 'tgme_page_title' in resp.text:
                    if "If you have Telegram, you can contact" in resp.text:
                        return PhoneCheckResult(service="telegram", exists=True)
            return PhoneCheckResult(service="telegram", exists=False)
        except httpx.HTTPError:
            return None
