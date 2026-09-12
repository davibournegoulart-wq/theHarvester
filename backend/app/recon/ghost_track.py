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


@dataclass
class GhostEgressIpResult:
    ip: str
    is_tor: bool = False
    isp: str = ""
    org: str = ""
    country: str = ""
    city: str = ""
    error: Optional[str] = None


@dataclass
class GhostUsernameResultItem:
    platform: str
    url: str
    status: str  # FOUND, NOT_FOUND, ERROR
    http_status: Optional[int] = None
    error: Optional[str] = None


@dataclass
class GhostUsernameScanResponse:
    username: str
    total_sites: int
    found_count: int
    results: list[GhostUsernameResultItem]


GHOSTTRACK_SOCIAL_PLATFORMS = [
    {"name": "Facebook", "url": "https://www.facebook.com/{}"},
    {"name": "Twitter", "url": "https://www.twitter.com/{}"},
    {"name": "Instagram", "url": "https://www.instagram.com/{}"},
    {"name": "LinkedIn", "url": "https://www.linkedin.com/in/{}"},
    {"name": "GitHub", "url": "https://www.github.com/{}"},
    {"name": "Pinterest", "url": "https://www.pinterest.com/{}"},
    {"name": "Tumblr", "url": "https://www.tumblr.com/{}"},
    {"name": "YouTube", "url": "https://www.youtube.com/{}"},
    {"name": "SoundCloud", "url": "https://soundcloud.com/{}"},
    {"name": "Snapchat", "url": "https://www.snapchat.com/add/{}"},
    {"name": "TikTok", "url": "https://www.tiktok.com/@{}"},
    {"name": "Behance", "url": "https://www.behance.net/{}"},
    {"name": "Medium", "url": "https://www.medium.com/@{}"},
    {"name": "Quora", "url": "https://www.quora.com/profile/{}"},
    {"name": "Flickr", "url": "https://www.flickr.com/people/{}"},
    {"name": "Periscope", "url": "https://www.periscope.tv/{}"},
    {"name": "Twitch", "url": "https://www.twitch.tv/{}"},
    {"name": "Dribbble", "url": "https://www.dribbble.com/{}"},
    {"name": "StumbleUpon", "url": "https://www.stumbleupon.com/stumbler/{}"},
    {"name": "Ello", "url": "https://www.ello.co/{}"},
    {"name": "Product Hunt", "url": "https://www.producthunt.com/@{}"},
    {"name": "Telegram", "url": "https://www.telegram.me/{}"},
    {"name": "We Heart It", "url": "https://www.weheartit.com/{}"},
]


async def check_my_ip(use_tor: bool = False) -> GhostEgressIpResult:
    """Detects investigator's active egress IP and evaluates Tor proxy status."""
    proxy_url = settings.tor_proxy_url if use_tor else None
    
    # Try ipwho.is first for rich egress metadata
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=10.0) as client:
            resp = await client.get("http://ipwho.is/", headers={"User-Agent": "GhostTrack/2.0 OSINT"})
            data = resp.json()
            if data.get("success"):
                ip = data.get("ip", "")
                conn = data.get("connection") or {}
                return GhostEgressIpResult(
                    ip=ip,
                    is_tor=use_tor,
                    isp=conn.get("isp", ""),
                    org=conn.get("org", ""),
                    country=data.get("country", ""),
                    city=data.get("city", ""),
                )
    except Exception:
        pass

    # Fallback to ipify
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=8.0) as client:
            resp = await client.get("https://api.ipify.org?format=json")
            data = resp.json()
            return GhostEgressIpResult(
                ip=data.get("ip", ""),
                is_tor=use_tor,
            )
    except Exception as exc:
        return GhostEgressIpResult(
            ip="",
            is_tor=use_tor,
            error=f"Could not resolve egress IP: {exc}",
        )


async def scan_username_ghosttrack(username: str, use_tor: bool = False) -> GhostUsernameScanResponse:
    """Executes concurrent username queries across GhostTrack's 24 social networks."""
    import asyncio

    clean_user = username.strip().lstrip("@")
    if not clean_user:
        return GhostUsernameScanResponse(username="", total_sites=0, found_count=0, results=[])

    proxy_url = settings.tor_proxy_url if use_tor else None
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    semaphore = asyncio.Semaphore(10)

    async def _check_target(client: httpx.AsyncClient, site: dict) -> GhostUsernameResultItem:
        target_url = site["url"].format(clean_user)
        async with semaphore:
            try:
                resp = await client.get(
                    target_url,
                    headers=headers,
                    follow_redirects=True,
                    timeout=8.0,
                )
                if resp.status_code == 200:
                    # Basic heuristic check for some common soft-404 redirects
                    body_lower = resp.text[:1000].lower()
                    if "not found" in body_lower or "page doesn't exist" in body_lower or "user not found" in body_lower:
                        return GhostUsernameResultItem(
                            platform=site["name"],
                            url=target_url,
                            status="NOT_FOUND",
                            http_status=resp.status_code,
                        )
                    return GhostUsernameResultItem(
                        platform=site["name"],
                        url=target_url,
                        status="FOUND",
                        http_status=resp.status_code,
                    )
                elif resp.status_code == 404:
                    return GhostUsernameResultItem(
                        platform=site["name"],
                        url=target_url,
                        status="NOT_FOUND",
                        http_status=resp.status_code,
                    )
                else:
                    return GhostUsernameResultItem(
                        platform=site["name"],
                        url=target_url,
                        status="NOT_FOUND",
                        http_status=resp.status_code,
                    )
            except Exception as e:
                return GhostUsernameResultItem(
                    platform=site["name"],
                    url=target_url,
                    status="ERROR",
                    error=str(e),
                )

    async with httpx.AsyncClient(proxy=proxy_url, verify=False) as client:
        tasks = [_check_target(client, site) for site in GHOSTTRACK_SOCIAL_PLATFORMS]
        results = await asyncio.gather(*tasks)

    found = sum(1 for r in results if r.status == "FOUND")
    # Sort with FOUND first
    sorted_results = sorted(results, key=lambda x: (0 if x.status == "FOUND" else (1 if x.status == "NOT_FOUND" else 2), x.platform))

    return GhostUsernameScanResponse(
        username=clean_user,
        total_sites=len(GHOSTTRACK_SOCIAL_PLATFORMS),
        found_count=found,
        results=sorted_results,
    )

