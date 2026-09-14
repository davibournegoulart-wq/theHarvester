"""Shadowbroker: Real-time multi-domain geospatial intelligence and threat telemetry.
Ported and adapted from BigBodyCobain/Shadowbroker.

Aggregates:
1. Military & VIP Flights (ADS-B live telemetry via opendata.adsb.fi)
2. GPS Jamming & Electronic Warfare Detection (NAC-p degradation grid analysis)
3. NASA FIRMS Active Thermal & Wildfire Hotspots (NOAA-20 VIIRS 24h satellite feed)
4. Cyber Threat & Botnet C2 Infrastructure (abuse.ch Feodo Tracker)
5. Telegram Conflict OSINT Web Feeds (public channel web previews & geoparsing)
6. USGS Global Seismic Activity (M2.5+ earthquakes)
"""

from __future__ import annotations

import csv
import io
import json
import logging
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("app.recon.shadowbroker")

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Country centroids for geocoding threat intelligence IP addresses
COUNTRY_CENTROIDS: Dict[str, tuple[float, float]] = {
    "AF": (33.0, 65.0), "AL": (41.0, 20.0), "DZ": (28.0, 3.0), "AR": (-34.0, -64.0),
    "AU": (-25.0, 134.0), "AT": (47.5, 14.0), "BE": (50.8, 4.0), "BR": (-10.0, -51.0),
    "CA": (62.0, -96.0), "CN": (35.0, 105.0), "DE": (51.0, 10.0), "FR": (46.0, 2.0),
    "GB": (54.0, -2.0), "IN": (22.0, 79.0), "IR": (32.0, 53.0), "IT": (42.8, 12.5),
    "JP": (36.0, 138.0), "KR": (36.0, 128.0), "MX": (23.5, -102.0), "NL": (52.5, 5.5),
    "PL": (52.0, 19.5), "RU": (60.0, 100.0), "SG": (1.35, 103.8), "TW": (23.7, 121.0),
    "UA": (49.0, 32.0), "US": (38.0, -97.0), "VN": (16.0, 106.0), "IL": (31.0, 35.0),
    "SY": (35.0, 38.0), "IQ": (33.0, 44.0), "TR": (39.0, 35.0), "RO": (46.0, 25.0),
}

# Geoparsing dictionary for conflict reporting in Ukraine, Middle East, and worldwide
GEOPARSE_LOCATIONS: Dict[str, tuple[float, float]] = {
    # Ukraine & Eastern Europe
    "kyiv": (50.4501, 30.5234), "kiev": (50.4501, 30.5234),
    "kharkiv": (49.9935, 36.2304), "kharkov": (49.9935, 36.2304),
    "odesa": (46.4825, 30.7233), "odessa": (46.4825, 30.7233),
    "dnipro": (48.4647, 35.0462), "zaporizhzhia": (47.8388, 35.1396),
    "donetsk": (48.0159, 37.8028), "luhansk": (48.5740, 39.3078),
    "crimea": (45.3453, 34.4997), "sevastopol": (44.6167, 33.5254),
    "lviv": (49.8397, 24.0297), "kursk": (51.7304, 36.1927),
    "belgorod": (50.5954, 36.5873), "bryansk": (53.2434, 34.3640),
    "voronezh": (51.6755, 39.2089), "rostov": (47.2357, 39.7015),
    "moscow": (55.7558, 37.6173), "saint petersburg": (59.9343, 30.3351),
    # Middle East & Red Sea
    "gaza": (31.5017, 34.4668), "tel aviv": (32.0853, 34.7818),
    "jerusalem": (31.7683, 35.2137), "beirut": (33.8938, 35.5018),
    "damascus": (33.5138, 36.2765), "aleppo": (36.2021, 37.1343),
    "baghdad": (33.3152, 44.3661), "erbil": (36.1901, 44.0091),
    "tehran": (35.6892, 51.3890), "isfahan": (32.6546, 51.6680),
    "sanaa": (15.3694, 44.1910), "hodeidah": (14.7978, 42.9545),
    "aden": (12.7855, 45.0187), "red sea": (20.0, 38.5),
    "strait of hormuz": (26.5667, 56.2500), "gulf of aden": (12.0, 48.0),
    # Asia Pacific
    "taipei": (25.0330, 121.5654), "taiwan strait": (24.0, 119.5),
    "south china sea": (12.0, 113.0), "manila": (14.5995, 120.9842),
    "beijing": (39.9042, 116.4074), "seoul": (37.5665, 126.9780),
    "pyongyang": (39.0392, 125.7625), "tokyo": (35.6762, 139.6503),
}


# ---------------------------------------------------------------------------
# 1. Military Aircraft ADS-B Telemetry
# ---------------------------------------------------------------------------

async def fetch_military_aircraft(limit: int = 60) -> List[Dict[str, Any]]:
    """Fetches live military, reconnaissance, and ISR flights from adsb.fi."""
    url = "https://opendata.adsb.fi/api/v2/mil"
    results: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                raw_aircraft = data.get("ac", [])
                
                for ac in raw_aircraft:
                    lat = ac.get("lat")
                    lon = ac.get("lon")
                    if lat is None or lon is None:
                        continue

                    hex_code = (ac.get("hex") or "").strip().upper()
                    callsign = (ac.get("flight") or "").strip() or "UNKNOWN"
                    ac_type = (ac.get("t") or "").strip() or "MIL"
                    desc = (ac.get("desc") or "").strip() or "Military Aircraft"
                    alt_baro = ac.get("alt_baro")
                    speed = ac.get("gs")
                    track = ac.get("track")
                    squawk = ac.get("squawk") or "N/A"
                    emergency = ac.get("emergency") or "none"
                    registration = ac.get("r") or "MIL"
                    nac_p = ac.get("nac_p")

                    results.append({
                        "id": f"mil-{hex_code}",
                        "hex": hex_code,
                        "callsign": callsign,
                        "type": ac_type,
                        "description": desc,
                        "registration": registration,
                        "latitude": float(lat),
                        "longitude": float(lon),
                        "altitude_feet": alt_baro if alt_baro != "ground" else 0,
                        "ground_speed_kts": speed,
                        "heading_deg": track,
                        "squawk": squawk,
                        "emergency": emergency,
                        "nac_p": nac_p,
                        "category": "military_flight",
                        "source": "Shadowbroker ADS-B Intercept",
                    })

                    if len(results) >= limit:
                        break
    except Exception as e:
        logger.error(f"Error fetching military aircraft: {e}")

    return results


# ---------------------------------------------------------------------------
# 2. GPS Jamming & Electronic Warfare Detection
# ---------------------------------------------------------------------------

async def detect_gps_jamming() -> List[Dict[str, Any]]:
    """Detects GPS jamming and spoofing zones via aircraft NAC-p degradation binning."""
    jamming_zones: List[Dict[str, Any]] = []
    
    try:
        flights = await fetch_military_aircraft(limit=120)
        
        # Grid bins: key is (int(lat), int(lon))
        grid: Dict[str, Dict[str, int]] = {}
        
        for f in flights:
            lat = f.get("latitude")
            lon = f.get("longitude")
            nac_p = f.get("nac_p")
            if lat is None or lon is None or nac_p is None:
                continue

            cell_key = f"{int(math.floor(lat))}:{int(math.floor(lon))}"
            if cell_key not in grid:
                grid[cell_key] = {"total": 0, "degraded": 0, "lat": int(math.floor(lat)), "lon": int(math.floor(lon))}

            grid[cell_key]["total"] += 1
            # NAC-p <= 6 or nac_p == 0 signifies degraded or lost GPS accuracy
            if nac_p <= 6 or nac_p == 0:
                grid[cell_key]["degraded"] += 1

        for cell_key, counts in grid.items():
            total = counts["total"]
            degraded = counts["degraded"]
            if degraded > 0:
                ratio = degraded / total
                severity = "HIGH" if ratio >= 0.5 else ("MEDIUM" if ratio >= 0.25 else "LOW")
                
                center_lat = counts["lat"] + 0.5
                center_lon = counts["lon"] + 0.5

                jamming_zones.append({
                    "id": f"jam-{cell_key}",
                    "latitude": center_lat,
                    "longitude": center_lon,
                    "total_aircraft": total,
                    "degraded_aircraft": degraded,
                    "degraded_percentage": round(ratio * 100, 1),
                    "severity": severity,
                    "description": f"GPS Jamming / EW Anomaly Zone ({degraded}/{total} flights reporting degraded NAC-p)",
                    "source": "Shadowbroker NAC-p Transponder Analysis",
                })
    except Exception as e:
        logger.error(f"Error analyzing GPS jamming: {e}")

    return jamming_zones


# ---------------------------------------------------------------------------
# 3. NASA FIRMS Active Thermal & Wildfire Hotspots
# ---------------------------------------------------------------------------

async def fetch_nasa_firms(limit: int = 60) -> List[Dict[str, Any]]:
    """Streams NOAA-20 VIIRS 24h active thermal anomalies / fire detection."""
    url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv"
    hotspots: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=25.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                reader = csv.DictReader(io.StringIO(resp.text))
                for i, row in enumerate(reader):
                    try:
                        lat = float(row.get("latitude") or 0)
                        lon = float(row.get("longitude") or 0)
                        frp = float(row.get("frp") or 0)
                        brightness = float(row.get("bright_ti4") or 0)
                        acq_date = row.get("acq_date") or ""
                        acq_time = row.get("acq_time") or ""
                        daynight = row.get("daynight") or "D"

                        if lat == 0 and lon == 0:
                            continue

                        hotspots.append({
                            "id": f"firms-{i}",
                            "latitude": lat,
                            "longitude": lon,
                            "radiative_power_mw": frp,
                            "brightness_kelvin": brightness,
                            "acquisition_date": f"{acq_date} {acq_time} UTC",
                            "daynight": "Day" if daynight == "D" else "Night",
                            "confidence": row.get("confidence") or "nominal",
                            "satellite": "NOAA-20 VIIRS",
                            "source": "NASA FIRMS Satellite Observation",
                        })

                        if len(hotspots) >= limit:
                            break
                    except Exception:
                        continue
    except Exception as e:
        logger.error(f"Error fetching NASA FIRMS fires: {e}")

    return hotspots


# ---------------------------------------------------------------------------
# 4. Cyber Threat & Botnet C2 Hotspots
# ---------------------------------------------------------------------------

async def fetch_malware_c2(limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches active botnet C2 servers from abuse.ch Feodo Tracker."""
    url = "https://feodotracker.abuse.ch/downloads/ipblocklist.json"
    threats: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                entries = resp.json()
                if isinstance(entries, list):
                    for idx, entry in enumerate(entries[:limit]):
                        cc = entry.get("country") or "US"
                        coords = COUNTRY_CENTROIDS.get(cc, (38.0, -97.0))
                        
                        jitter_lat = ((idx * 173.7) % 200 - 100) / 100.0 * 2.5
                        jitter_lon = ((idx * 293.1) % 200 - 100) / 100.0 * 2.5

                        threats.append({
                            "id": f"feodo-{idx}",
                            "ip": entry.get("ip_address"),
                            "port": entry.get("dst_port"),
                            "malware": entry.get("malware") or "Unknown Botnet",
                            "status": entry.get("status") or "active",
                            "country": cc,
                            "latitude": round(coords[0] + jitter_lat, 4),
                            "longitude": round(coords[1] + jitter_lon, 4),
                            "first_seen": entry.get("first_seen"),
                            "last_online": entry.get("last_online"),
                            "threat_type": "botnet_c2",
                            "source": "abuse.ch Feodo Tracker",
                        })
    except Exception as e:
        logger.error(f"Error fetching Malware C2 threats: {e}")

    return threats


# ---------------------------------------------------------------------------
# 5. Telegram Conflict OSINT Web Previews
# ---------------------------------------------------------------------------

async def fetch_telegram_osint(channel: str = "osintdefender", limit: int = 20) -> List[Dict[str, Any]]:
    """Scrapes public Telegram channel web previews and geoparses locations."""
    clean_channel = re.sub(r"[^a-zA-Z0-9_]", "", channel.lower().replace("@", ""))
    url = f"https://t.me/s/{clean_channel}"
    posts: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html_text = resp.text
                
                message_matches = re.findall(
                    r'<div class="tgme_widget_message_wrap js-widget_message_wrap"[\s\S]*?</div>\s*</div>\s*</div>',
                    html_text,
                    re.IGNORECASE
                )
                
                for raw_block in message_matches[-limit:]:
                    date_match = re.search(
                        r'<a class="tgme_widget_message_date" href="([^"]+)".*?<time datetime="([^"]+)"',
                        raw_block,
                        re.IGNORECASE
                    )
                    post_url = date_match.group(1) if date_match else f"https://t.me/{clean_channel}"
                    post_time = date_match.group(2) if date_match else ""

                    text_match = re.search(
                        r'<div class="tgme_widget_message_text[^>]*>([\s\S]*?)</div>',
                        raw_block,
                        re.IGNORECASE
                    )
                    raw_content = text_match.group(1) if text_match else ""
                    clean_text = re.sub(r"<[^>]+>", " ", raw_content).strip()
                    clean_text = " ".join(clean_text.split())

                    if not clean_text:
                        continue

                    img_match = re.search(r"background-image:url\('([^']+)'\)", raw_block, re.IGNORECASE)
                    photo_url = img_match.group(1) if img_match else None

                    matched_location = None
                    coords = None
                    text_lower = clean_text.lower()
                    for loc_name, loc_coords in GEOPARSE_LOCATIONS.items():
                        if re.search(r"\b" + re.escape(loc_name) + r"\b", text_lower):
                            matched_location = loc_name.title()
                            coords = loc_coords
                            break

                    posts.append({
                        "id": f"tg-{abs(hash(post_url))}",
                        "channel": f"@{clean_channel}",
                        "text": clean_text,
                        "url": post_url,
                        "timestamp": post_time,
                        "photo_url": photo_url,
                        "location": matched_location,
                        "latitude": coords[0] if coords else None,
                        "longitude": coords[1] if coords else None,
                        "source": f"Telegram OSINT (@{clean_channel})",
                    })

                posts.reverse()
    except Exception as e:
        logger.error(f"Error fetching Telegram OSINT: {e}")

    return posts


# ---------------------------------------------------------------------------
# 6. USGS Seismic & Earthquakes Feed
# ---------------------------------------------------------------------------

async def fetch_usgs_earthquakes(limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches M2.5+ earthquake events from USGS."""
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    quakes: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                for f in features[:limit]:
                    props = f.get("properties", {})
                    coords = f.get("geometry", {}).get("coordinates", [])
                    if len(coords) >= 2:
                        lon = coords[0]
                        lat = coords[1]
                        depth = coords[2] if len(coords) > 2 else 0

                        time_ms = props.get("time") or 0
                        time_str = datetime.fromtimestamp(time_ms / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

                        quakes.append({
                            "id": f["id"],
                            "magnitude": props.get("mag"),
                            "place": props.get("place") or "Unknown Location",
                            "latitude": lat,
                            "longitude": lon,
                            "depth_km": depth,
                            "time": time_str,
                            "url": props.get("url"),
                            "source": "USGS Earthquake Hazards Program",
                        })
    except Exception as e:
        logger.error(f"Error fetching USGS earthquakes: {e}")

    return quakes


# ---------------------------------------------------------------------------
# 7. Strategic Country Dossiers & Geopolitical Intel
# ---------------------------------------------------------------------------

STRATEGIC_COUNTRY_PROFILES: Dict[str, Dict[str, Any]] = {
    "US": {
        "country": "United States",
        "iso_code": "US",
        "capital": "Washington, D.C.",
        "head_of_state": "Joe Biden (President)",
        "population": "335 Million",
        "alliances": ["NATO (Founding Member)", "Five Eyes (US/UK/CA/AU/NZ)", "AUKUS", "Quad"],
        "defense_readiness": "DEFCON 3 (Standard Global Posture)",
        "nuclear_triad": "Operational (Minuteman III ICBMs, Ohio-class SSBNs, B-2/B-52H)",
        "primary_airbases": ["Andrews AFB", "Nellis AFB", "Ramstein AB (Europe forward)", "Al Udeid (CENTCOM)"],
        "strategic_posture": "Global power projection, Indo-Pacific deterrence, Atlantic maritime security.",
        "sanctions_enforcement": "OFAC Primary Regulator",
    },
    "RU": {
        "country": "Russian Federation",
        "iso_code": "RU",
        "capital": "Moscow",
        "head_of_state": "Vladimir Putin (President)",
        "population": "144 Million",
        "alliances": ["CSTO (Collective Security Treaty Org)", "BRICS+", "SCO (Shanghai Cooperation Org)"],
        "defense_readiness": "High Strategic Alert (Special Military Operation)",
        "nuclear_triad": "Operational (Yars/Sarmat ICBMs, Borei SSBNs, Tu-160/Tu-95MS)",
        "primary_airbases": ["Engels-2", "Olenya", "Hmeymim AB (Syria)", "Kubinka"],
        "strategic_posture": "Strategic buffer maintenance, Black Sea access, electronic warfare dominance.",
        "sanctions_enforcement": "Subject to comprehensive OFAC/EU/UK sanctions.",
    },
    "CN": {
        "country": "People's Republic of China",
        "iso_code": "CN",
        "capital": "Beijing",
        "head_of_state": "Xi Jinping (President & CMC Chairman)",
        "population": "1.41 Billion",
        "alliances": ["SCO", "BRICS+", "China-Russia Strategic Partnership"],
        "defense_readiness": "Elevated (Taiwan Strait & South China Sea Maritime Drills)",
        "nuclear_triad": "Expanding Triad (DF-41/DF-31AG ICBMs, Type 094 SSBNs, H-6N)",
        "primary_airbases": ["Hainan Yulin Naval Base", "Fiery Cross Reef", "Zhangzhou AFB", "Hotan"],
        "strategic_posture": "Anti-Access/Area Denial (A2/AD), South China Sea militarization, Belt and Road.",
        "sanctions_enforcement": "Selective Entity List export controls.",
    },
    "UA": {
        "country": "Ukraine",
        "iso_code": "UA",
        "capital": "Kyiv",
        "head_of_state": "Volodymyr Zelenskyy (President)",
        "population": "38 Million",
        "alliances": ["NATO Aspirant", "EU Candidate", "Ukraine Defense Contact Group"],
        "defense_readiness": "Martial Law / Full Combat Mobilization",
        "nuclear_triad": "Non-nuclear (Budapest Memorandum 1994)",
        "primary_airbases": ["Starokostiantyniv", "Myrhorod", "Vasylkiv", "Odesa"],
        "strategic_posture": "Territorial defense, sovereign airspace protection, Black Sea grain corridor.",
        "sanctions_enforcement": "Coordinated Western allied support.",
    },
    "IL": {
        "country": "Israel",
        "iso_code": "IL",
        "capital": "Jerusalem",
        "head_of_state": "Benjamin Netanyahu (Prime Minister)",
        "population": "9.8 Million",
        "alliances": ["Major Non-NATO Ally (MNNA)", "Abraham Accords"],
        "defense_readiness": "War Footing (Multi-Front Operations)",
        "nuclear_triad": "Deliberate Ambiguity (Jericho III, Dolphin-class cruise missiles)",
        "primary_airbases": ["Nevatim AFB (F-35I)", "Tel Nof AFB", "Ramat David", "Palmachim"],
        "strategic_posture": "Iron Dome / David's Sling / Arrow multi-tier missile defense, regional deterrence.",
        "sanctions_enforcement": "Western defense intelligence integration.",
    },
    "IR": {
        "country": "Islamic Republic of Iran",
        "iso_code": "IR",
        "capital": "Tehran",
        "head_of_state": "Ali Khamenei (Supreme Leader) / Masoud Pezeshkian (President)",
        "population": "88 Million",
        "alliances": ["Axis of Resistance", "SCO", "BRICS+"],
        "defense_readiness": "Elevated Alert (IRGC Aerospace Forces)",
        "nuclear_triad": "Uranium enrichment threshold state (Fordo, Natanz)",
        "primary_airbases": ["Isfahan 8th Tactical Air Base", "Bandar Abbas Naval Base", "Oghab 44 underground base"],
        "strategic_posture": "Asymmetric drone and ballistic missile proliferation (Shahed-136, Fateh-110), Strait of Hormuz chokepoint control.",
        "sanctions_enforcement": "Subject to comprehensive OFAC/UN primary and secondary sanctions.",
    },
    "TW": {
        "country": "Taiwan (Republic of China)",
        "iso_code": "TW",
        "capital": "Taipei",
        "head_of_state": "Lai Ching-te (President)",
        "population": "23.5 Million",
        "alliances": ["Taiwan Relations Act security partnership with United States"],
        "defense_readiness": "Constant ADIZ Intercept Readiness",
        "nuclear_triad": "Non-nuclear state",
        "primary_airbases": ["Hsinchu AFB (Mirage 2000)", "Chiayi AFB (F-16V)", "Hualien AFB (underground bunkers)"],
        "strategic_posture": "Porcupine defense strategy, semiconductor supply chain security, Strait surveillance.",
        "sanctions_enforcement": "US export controls enforcement.",
    },
    "GB": {
        "country": "United Kingdom",
        "iso_code": "GB",
        "capital": "London",
        "head_of_state": "King Charles III / Keir Starmer (Prime Minister)",
        "population": "67 Million",
        "alliances": ["NATO (Permanent Nuclear Member)", "Five Eyes", "AUKUS"],
        "defense_readiness": "Standard NATO Alert",
        "nuclear_triad": "Continuous At-Sea Deterrent (CASD) Vanguard-class Trident SSBNs",
        "primary_airbases": ["RAF Waddington (ISR / RC-135)", "RAF Lossiemouth (Typhoon QRA)", "HMNB Clyde"],
        "strategic_posture": "GIUK gap surveillance, European northern flank security, global carrier strike.",
        "sanctions_enforcement": "UK OFSI Sanctions Authority.",
    },
    "BR": {
        "country": "Brazil",
        "iso_code": "BR",
        "capital": "Brasília",
        "head_of_state": "Luiz Inácio Lula da Silva (President)",
        "population": "215 Million",
        "alliances": ["BRICS+", "Mercosur", "UNASUR", "South Atlantic Peace and Cooperation Zone"],
        "defense_readiness": "Standard Peacetime",
        "nuclear_triad": "Non-nuclear (Treaty of Tlatelolco, Submarino Nuclear PROSUB program)",
        "primary_airbases": ["Base Aérea de Anápolis (Gripen E)", "Base Aérea de Santa Cruz", "Base Naval de Mocanguê"],
        "strategic_posture": "Amazon Basin sovereignty (SISFRON), Blue Amazon maritime economic zone defense, diplomatic non-alignment.",
        "sanctions_enforcement": "Multilateral UN compliance.",
    },
}


async def fetch_country_dossier(country_code: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None) -> Dict[str, Any]:
    """Returns strategic intelligence dossier for a country."""
    clean_code = (country_code or "").upper().strip()

    # If coordinates given, and country_code was not explicitly given or not in profiles, resolve closest centroid
    if lat is not None and lon is not None and (not clean_code or clean_code not in STRATEGIC_COUNTRY_PROFILES):
        closest_code = "US"
        min_dist = 999999.0
        for code, (clat, clon) in COUNTRY_CENTROIDS.items():
            dist = math.hypot(lat - clat, lon - clon)
            if dist < min_dist:
                min_dist = dist
                closest_code = code
        clean_code = closest_code
    elif not clean_code:
        clean_code = "US"

    profile = STRATEGIC_COUNTRY_PROFILES.get(clean_code)
    if profile:
        return profile

    # Fallback generic profile
    return {
        "country": f"Sovereign Entity ({clean_code})",
        "iso_code": clean_code,
        "capital": "Regional Capital",
        "head_of_state": "National Leadership",
        "population": "Unpublished Telemetry",
        "alliances": ["United Nations Member State"],
        "defense_readiness": "Regional Sovereignty Patrol",
        "nuclear_triad": "Non-nuclear signatory",
        "primary_airbases": ["National Defense Installation"],
        "strategic_posture": "Territorial integrity and sovereign airspace monitoring.",
        "sanctions_enforcement": "International sanctions database lookup available.",
    }
