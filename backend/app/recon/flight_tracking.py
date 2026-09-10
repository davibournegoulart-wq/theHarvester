"""ADS-B Exchange / Open Sky Flight Tracking Engine.
Tracks real-time military, VIP, government, and civilian aircraft,
callsigns, transponders, altitude, and positions using open ADS-B feeds.
"""

from dataclasses import dataclass, field
import httpx

from app.config import settings

@dataclass
class AircraftInfo:
    hex_code: str
    flight: str | None
    registration: str | None
    aircraft_type: str | None
    alt_baro: int | str | None
    ground_speed: float | None
    lat: float | None
    lon: float | None
    track: float | None
    category: str | None = None
    discovered_by: str = "recon.adsb_exchange"

@dataclass
class FlightTrackingResult:
    query: str
    query_type: str
    total_found: int
    aircraft: list[AircraftInfo] = field(default_factory=list)
    discovered_by: str = "recon.adsb_exchange"

async def track_military_aircraft() -> FlightTrackingResult:
    """Retrieves all currently active military aircraft globally."""
    headers = {"User-Agent": "NetScraper OSINT Flight Recon"}
    aircraft_list = []
    
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=12.0) as client:
        try:
            resp = await client.get("https://api.adsb.lol/v2/mil")
            if resp.status_code == 200:
                data = resp.json()
                for ac in data.get("ac", [])[:50]:  # Top 50 airborne military
                    aircraft_list.append(AircraftInfo(
                        hex_code=ac.get("hex", "unknown"),
                        flight=ac.get("flight", "").strip() or None,
                        registration=ac.get("r"),
                        aircraft_type=ac.get("t"),
                        alt_baro=ac.get("alt_baro"),
                        ground_speed=ac.get("gs"),
                        lat=ac.get("lat"),
                        lon=ac.get("lon"),
                        track=ac.get("track"),
                        category="Military / Government",
                    ))
        except Exception:
            pass

    return FlightTrackingResult(
        query="GLOBAL_MILITARY",
        query_type="military",
        total_found=len(aircraft_list),
        aircraft=aircraft_list,
    )

async def search_aircraft_by_callsign_or_hex(identifier: str) -> FlightTrackingResult:
    """Searches for active aircraft by callsign, tail registration or hex code."""
    clean_id = identifier.strip().upper()
    headers = {"User-Agent": "NetScraper OSINT Flight Recon"}
    aircraft_list = []

    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
        # Try callsign first
        try:
            resp = await client.get(f"https://api.adsb.lol/v2/callsign/{clean_id}")
            if resp.status_code == 200:
                data = resp.json()
                for ac in data.get("ac", []):
                    aircraft_list.append(AircraftInfo(
                        hex_code=ac.get("hex", "unknown"),
                        flight=ac.get("flight", "").strip() or clean_id,
                        registration=ac.get("r"),
                        aircraft_type=ac.get("t"),
                        alt_baro=ac.get("alt_baro"),
                        ground_speed=ac.get("gs"),
                        lat=ac.get("lat"),
                        lon=ac.get("lon"),
                        track=ac.get("track"),
                        category="Civilian / Commercial",
                    ))
        except Exception:
            pass

        # If not found by callsign, try hex
        if not aircraft_list:
            try:
                resp = await client.get(f"https://api.adsb.lol/v2/hex/{clean_id.lower()}")
                if resp.status_code == 200:
                    data = resp.json()
                    for ac in data.get("ac", []):
                        aircraft_list.append(AircraftInfo(
                            hex_code=ac.get("hex", clean_id),
                            flight=ac.get("flight", "").strip() or None,
                            registration=ac.get("r"),
                            aircraft_type=ac.get("t"),
                            alt_baro=ac.get("alt_baro"),
                            ground_speed=ac.get("gs"),
                            lat=ac.get("lat"),
                            lon=ac.get("lon"),
                            track=ac.get("track"),
                            category="Direct Hex Match",
                        ))
            except Exception:
                pass

    return FlightTrackingResult(
        query=clean_id,
        query_type="identifier",
        total_found=len(aircraft_list),
        aircraft=aircraft_list,
    )
