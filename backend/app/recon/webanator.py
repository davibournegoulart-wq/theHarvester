"""Webanator Open Webcam & CCTV Stream Reconnaissance Engine (K3ysTr0K3R/Webanator adaptation).

Scrapes and extracts open webcam and surveillance streams by country and region:
- Camera IP / Port / MJPG Snapshot stream URL
- Geolocation (City, Region, Country, Latitude, Longitude, ZIP)
- Hardware manufacturer / model (Axis, Sony, Panasonic, Hikvision, etc.)
- Active HTTP status verification with SOCKS5/Tor proxy fallback
"""

import re
import asyncio
from dataclasses import dataclass
from typing import Optional, List, Dict
import httpx
from bs4 import BeautifulSoup
from app.config import settings

# Supported countries from Webanator
WEBANATOR_COUNTRIES: List[Dict[str, str]] = [
    {"code": "US", "name": "United States", "flag": "🇺🇸"},
    {"code": "BR", "name": "Brazil", "flag": "🇧🇷"},
    {"code": "CA", "name": "Canada", "flag": "🇨🇦"},
    {"code": "MX", "name": "Mexico", "flag": "🇲🇽"},
    {"code": "DE", "name": "Germany", "flag": "🇩🇪"},
    {"code": "FR", "name": "France", "flag": "🇫🇷"},
    {"code": "NL", "name": "Netherlands", "flag": "🇳🇱"},
    {"code": "CH", "name": "Switzerland", "flag": "🇨🇭"},
    {"code": "RO", "name": "Romania", "flag": "🇷🇴"},
    {"code": "JP", "name": "Japan", "flag": "🇯🇵"},
    {"code": "CN", "name": "China", "flag": "🇨🇳"},
    {"code": "IN", "name": "India", "flag": "🇮🇳"},
    {"code": "RU", "name": "Russia", "flag": "🇷🇺"},
    {"code": "ZA", "name": "South Africa", "flag": "🇿🇦"},
    {"code": "NG", "name": "Nigeria", "flag": "🇳🇬"},
    {"code": "FI", "name": "Finland", "flag": "🇫🇮"},
    {"code": "EE", "name": "Estonia", "flag": "🇪🇪"},
    {"code": "BY", "name": "Belarus", "flag": "🇧🇾"},
    {"code": "SI", "name": "Slovenia", "flag": "🇸🇮"},
    {"code": "MY", "name": "Malaysia", "flag": "🇲🇾"},
    {"code": "AE", "name": "United Arab Emirates", "flag": "🇦🇪"},
    {"code": "TW", "name": "Taiwan", "flag": "🇹🇼"},
    {"code": "TZ", "name": "Tanzania", "flag": "🇹🇿"},
    {"code": "MG", "name": "Madagascar", "flag": "🇲🇬"},
    {"code": "AS", "name": "American Samoa", "flag": "🇦🇸"},
    {"code": "GB", "name": "United Kingdom", "flag": "🇬🇧"},
    {"code": "IT", "name": "Italy", "flag": "🇮🇹"},
    {"code": "ES", "name": "Spain", "flag": "🇪🇸"},
    {"code": "AU", "name": "Australia", "flag": "🇦🇺"},
]

@dataclass
class WebcamItem:
    id: str
    ip: str
    port: int
    stream_url: str
    snapshot_url: str
    title: str
    city: str
    region: str
    country: str
    country_code: str
    latitude: Optional[float]
    longitude: Optional[float]
    zip_code: str
    timezone: str
    manufacturer: str
    is_online: bool = True
    http_status: int = 200

@dataclass
class WebcamSearchResponse:
    country_code: str
    country_name: str
    page: int
    total_found: int
    webcams: List[WebcamItem]
    error: Optional[str] = None


async def _fetch_camera_details(client: httpx.AsyncClient, detail_url: str, base_cam: WebcamItem) -> WebcamItem:
    """Fetches full camera details page to extract precise lat/lon, timezone, and manufacturer."""
    try:
        resp = await client.get(detail_url, timeout=8.0)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Extract links for city, region, timezone, manufacturer
            for a in soup.find_all("a", class_="camera-details__link"):
                href = a.get("href", "")
                text = a.get_text(strip=True)
                if "/byregion/" in href and not base_cam.region:
                    base_cam.region = text
                elif "/bycity/" in href and not base_cam.city:
                    base_cam.city = text
                elif "/bytimezone/" in href:
                    base_cam.timezone = text
                elif "/bytype/" in href:
                    base_cam.manufacturer = text

            # Extract latitude and longitude from cells
            lat_m = re.search(r'Latitude:\s*</div>\s*<div[^>]*>\s*([0-9.-]+)', resp.text)
            if lat_m:
                try:
                    base_cam.latitude = float(lat_m.group(1))
                except ValueError:
                    pass

            lon_m = re.search(r'Longitude:\s*</div>\s*<div[^>]*>\s*([0-9.-]+)', resp.text)
            if lon_m:
                try:
                    base_cam.longitude = float(lon_m.group(1))
                except ValueError:
                    pass

            zip_m = re.search(r'ZIP:\s*</div>\s*<div[^>]*>\s*([a-zA-Z0-9 -]+)', resp.text)
            if zip_m:
                base_cam.zip_code = zip_m.group(1).strip()
    except Exception:
        pass
    return base_cam


async def search_webcams_by_country(
    country_code: str,
    page: int = 1,
    max_results: int = 12,
    use_tor: bool = False
) -> WebcamSearchResponse:
    """Scrapes open surveillance webcams from Insecam by country code."""
    c_code = country_code.strip().upper()
    country_info = next((c for c in WEBANATOR_COUNTRIES if c["code"] == c_code), {"name": c_code, "flag": ""})
    country_name = country_info["name"]

    proxy_url = settings.tor_proxy_url if use_tor else None
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    url = f"http://www.insecam.org/en/bycountry/{c_code}/?page={page}"

    try:
        async with httpx.AsyncClient(proxy=proxy_url, headers=headers, timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return WebcamSearchResponse(
                    country_code=c_code,
                    country_name=country_name,
                    page=page,
                    total_found=0,
                    webcams=[],
                    error=f"Insecam returned status HTTP {resp.status_code}",
                )

            soup = BeautifulSoup(resp.text, "html.parser")
            items = soup.find_all("div", class_="thumbnail-item")

            base_cams: List[tuple[WebcamItem, str]] = []
            for item in items[:max_results]:
                img = item.find("img", class_="thumbnail-item__img")
                a = item.find("a")
                if not img or not a:
                    continue

                snapshot_url = img.get("src") or ""
                detail_path = a.get("href") or ""
                detail_url = f"http://www.insecam.org{detail_path}" if detail_path.startswith("/") else detail_path
                title = img.get("title") or item.get_text(strip=True)

                # Parse IP and port from stream/snapshot URL
                ip_match = re.search(r'http://(\d+\.\d+\.\d+\.\d+):(\d+)', snapshot_url)
                ip = ip_match.group(1) if ip_match else ""
                port = int(ip_match.group(2)) if ip_match else 80

                # Extract city from title e.g. "Live camera Axis in Richmond Hill, United States"
                city = ""
                city_match = re.search(r'in\s+([^,]+),\s*([^,\n]+)', title)
                if city_match:
                    city = city_match.group(1).strip()

                cam_id = re.search(r'/view/(\d+)/', detail_path)
                cam_id_str = cam_id.group(1) if cam_id else f"{ip}_{port}"

                cam_item = WebcamItem(
                    id=cam_id_str,
                    ip=ip,
                    port=port,
                    stream_url=snapshot_url,
                    snapshot_url=snapshot_url,
                    title=title,
                    city=city,
                    region="",
                    country=country_name,
                    country_code=c_code,
                    latitude=None,
                    longitude=None,
                    zip_code="",
                    timezone="",
                    manufacturer="",
                )
                base_cams.append((cam_item, detail_url))

            # Concurrently fetch coordinate and manufacturer details
            tasks = [_fetch_camera_details(client, detail_url, cam) for cam, detail_url in base_cams]
            detailed_cams = await asyncio.gather(*tasks)

            return WebcamSearchResponse(
                country_code=c_code,
                country_name=country_name,
                page=page,
                total_found=len(detailed_cams),
                webcams=list(detailed_cams),
            )

    except Exception as exc:
        return WebcamSearchResponse(
            country_code=c_code,
            country_name=country_name,
            page=page,
            total_found=0,
            webcams=[],
            error=str(exc),
        )


async def check_camera_online(stream_url: str) -> dict:
    """Checks if a camera stream is actively responding."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.head(stream_url)
            return {
                "online": resp.status_code in (200, 204, 206, 301, 302),
                "http_status": resp.status_code,
                "server": resp.headers.get("server", "Unknown"),
            }
    except Exception as e:
        return {"online": False, "error": str(e)}
