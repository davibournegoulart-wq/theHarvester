"""GhostTrack Reconnaissance Engine (HunxByts/GhostTrack adaptation).

Provides:
1. IP Tracking & Network Intelligence (via ipwho.is with SOCKS5/Tor fallback):
   - Geolocation (Lat/Lon, City, Region, Country, Postal, Borders)
   - Connection (ASN, ISP, Organization, Domain)
   - Timezone, Current Time, Currency, Calling Code
2. Deep Phone Parsing & Carrier / Timezone resolution (via Google phonenumbers):
   - Telecom carrier provider
   - Geocoded location description
   - Standard timezones list
   - Line type (Mobile, Fixed-Line, VoIP, Toll-Free)
   - Standardized international formats (E.164, RFC3966)
"""

from dataclasses import dataclass
from typing import Any, Optional
import httpx
import phonenumbers
from phonenumbers import carrier, geocoder, timezone

from app.config import settings


@dataclass
class GhostIpResult:
    ip: str
    is_valid: bool
    ip_type: str = ""
    continent: str = ""
    country: str = ""
    country_code: str = ""
    region: str = ""
    city: str = ""
    postal: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maps_url: str = ""
    is_eu: bool = False
    calling_code: str = ""
    capital: str = ""
    borders: list[str] = None  # type: ignore
    asn: str = ""
    org: str = ""
    isp: str = ""
    domain: str = ""
    timezone_id: str = ""
    timezone_abbr: str = ""
    utc_offset: str = ""
    current_time: str = ""
    error: Optional[str] = None


@dataclass
class GhostPhoneResult:
    raw_input: str
    is_valid: bool
    is_possible: bool
    carrier: str = ""
    location: str = ""
    timezones: list[str] = None  # type: ignore
    international_format: str = ""
    e164_format: str = ""
    national_number: str = ""
    country_code: int = 0
    region_code: str = ""
    line_type: str = ""
    error: Optional[str] = None


async def trace_ip(ip: str, use_tor: bool = False) -> GhostIpResult:
    """Queries ipwho.is to extract complete network and geographical intelligence."""
    clean_ip = ip.strip()
    if not clean_ip:
        return GhostIpResult(ip=clean_ip, is_valid=False, error="IP address cannot be empty")

    proxy_url = settings.tor_proxy_url if use_tor else None
    url = f"http://ipwho.is/{clean_ip}"

    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=12.0) as client:
            resp = await client.get(url, headers={"User-Agent": "GhostTrack/2.0 OSINT"})
            data = resp.json()

            if not data.get("success", False):
                msg = data.get("message") or "IP lookup returned unresolvable status"
                return GhostIpResult(ip=clean_ip, is_valid=False, error=msg)

            lat = data.get("latitude")
            lon = data.get("longitude")
            maps_url = f"https://www.google.com/maps/@{lat},{lon},12z" if lat and lon else ""

            conn = data.get("connection") or {}
            tz = data.get("timezone") or {}
            borders_raw = data.get("borders") or ""
            borders = [b.strip() for b in borders_raw.split(",") if b.strip()] if isinstance(borders_raw, str) else []

            return GhostIpResult(
                ip=data.get("ip", clean_ip),
                is_valid=True,
                ip_type=data.get("type", "IPv4"),
                continent=data.get("continent", ""),
                country=data.get("country", ""),
                country_code=data.get("country_code", ""),
                region=data.get("region", ""),
                city=data.get("city", ""),
                postal=data.get("postal", ""),
                latitude=float(lat) if lat is not None else None,
                longitude=float(lon) if lon is not None else None,
                maps_url=maps_url,
                is_eu=bool(data.get("is_eu", False)),
                calling_code=str(data.get("calling_code", "")),
                capital=data.get("capital", ""),
                borders=borders,
                asn=str(conn.get("asn", "")),
                org=conn.get("org", ""),
                isp=conn.get("isp", ""),
                domain=conn.get("domain", ""),
                timezone_id=tz.get("id", ""),
                timezone_abbr=tz.get("abbr", ""),
                utc_offset=str(tz.get("utc", "") or tz.get("offset", "")),
                current_time=tz.get("current_time", ""),
            )
    except Exception as exc:
        return GhostIpResult(ip=clean_ip, is_valid=False, error=str(exc))


def parse_phone_intel(raw_phone: str, default_region: str = "US") -> GhostPhoneResult:
    """Extracts telecommunication carrier, country code, line type, and timezones."""
    target = raw_phone.strip()
    if not target.startswith("+") and not target.isdigit():
        target = f"+{target}" if any(c.isdigit() for c in target) else target

    try:
        parsed = phonenumbers.parse(target, default_region)
        is_valid = phonenumbers.is_valid_number(parsed)
        is_possible = phonenumbers.is_possible_number(parsed)

        carrier_name = carrier.name_for_number(parsed, "en") or ""
        location_desc = geocoder.description_for_number(parsed, "en") or ""
        tz_list = list(timezone.time_zones_for_number(parsed))

        line_type_raw = phonenumbers.number_type(parsed)
        type_str = "UNKNOWN"
        if line_type_raw == phonenumbers.PhoneNumberType.MOBILE:
            type_str = "MOBILE"
        elif line_type_raw == phonenumbers.PhoneNumberType.FIXED_LINE:
            type_str = "FIXED_LINE"
        elif line_type_raw == phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE:
            type_str = "FIXED_OR_MOBILE"
        elif line_type_raw == phonenumbers.PhoneNumberType.TOLL_FREE:
            type_str = "TOLL_FREE"
        elif line_type_raw == phonenumbers.PhoneNumberType.VOIP:
            type_str = "VOIP"

        formatted_intl = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
        formatted_e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        region_code = phonenumbers.region_code_for_number(parsed) or ""

        return GhostPhoneResult(
            raw_input=raw_phone,
            is_valid=is_valid,
            is_possible=is_possible,
            carrier=carrier_name,
            location=location_desc,
            timezones=tz_list,
            international_format=formatted_intl,
            e164_format=formatted_e164,
            national_number=str(parsed.national_number),
            country_code=parsed.country_code,
            region_code=region_code,
            line_type=type_str,
        )
    except Exception as exc:
        return GhostPhoneResult(raw_input=raw_phone, is_valid=False, is_possible=False, error=str(exc))
