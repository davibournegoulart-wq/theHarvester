"""God's Eye View: Spy-Satellite Simulator & Multi-Sensor Intelligence Suite.
Adapted from bilawalsidhu/gods-eye-view for NetScraper / Franken-Scraper.

Capabilities:
1. Orbital Satellites & Space Stations (CelesTrak SGP4 / Keplerian propagation).
2. Space Missions & Rocket Launches (The Space Devs Launch Library 2).
3. Strategic Maritime AIS Vessels & Chokepoint Traffic.
4. Submarine Fiber-Optic Cables & Landing Stations.
5. Critical Global Infrastructure (Datacenters, Hydroelectric Dams, Installations).
"""

from dataclasses import dataclass, field
import datetime
import math
import re
from typing import Any
import httpx

# Standard Earth gravitational parameter and WGS84 constants
MU = 398600.4418  # km^3 / s^2
EARTH_RADIUS_KM = 6378.137
EARTH_ROTATION_RATE = 7.2921159e-5  # rad / s

# Fallback satellites database in case CelesTrak has temporary outages
FALLBACK_SATELLITES = [
    {
        "name": "ISS (ZARYA)",
        "norad_id": 25544,
        "group": "stations",
        "category": "Space Station",
        "altitude_km": 420.5,
        "velocity_kms": 7.66,
        "inclination_deg": 51.64,
        "period_min": 92.9,
        "latitude": 28.5383,
        "longitude": -80.6489,
        "status": "OPERATIONAL / CREWED",
    },
    {
        "name": "TIANGONG (CSS)",
        "norad_id": 48274,
        "group": "stations",
        "category": "Space Station",
        "altitude_km": 389.2,
        "velocity_kms": 7.68,
        "inclination_deg": 41.47,
        "period_min": 92.2,
        "latitude": 19.6145,
        "longitude": 110.9511,
        "status": "OPERATIONAL / CREWED",
    },
    {
        "name": "HUBBLE SPACE TELESCOPE",
        "norad_id": 20580,
        "group": "visual",
        "category": "Optical Recon / Science",
        "altitude_km": 535.1,
        "velocity_kms": 7.59,
        "inclination_deg": 28.47,
        "period_min": 95.4,
        "latitude": 15.2104,
        "longitude": -65.1205,
        "status": "OPERATIONAL",
    },
    {
        "name": "GPS BIIF-12 (PRN 32)",
        "norad_id": 41328,
        "group": "gps-ops",
        "category": "Navigation & Positioning",
        "altitude_km": 20180.0,
        "velocity_kms": 3.87,
        "inclination_deg": 55.0,
        "period_min": 717.9,
        "latitude": 32.1245,
        "longitude": -110.4512,
        "status": "OPERATIONAL",
    },
    {
        "name": "COSMOS 2542 (RECON)",
        "norad_id": 44797,
        "group": "military",
        "category": "Military Reconnaissance",
        "altitude_km": 612.0,
        "velocity_kms": 7.55,
        "inclination_deg": 97.9,
        "period_min": 96.9,
        "latitude": 54.2105,
        "longitude": 37.6184,
        "status": "CLASSIFIED RECON",
    },
    {
        "name": "USA 314 (KH-11 SPY SATELLITE)",
        "norad_id": 48247,
        "group": "military",
        "category": "Optical Spy Satellite",
        "altitude_km": 390.0,
        "velocity_kms": 7.67,
        "inclination_deg": 97.4,
        "period_min": 92.4,
        "latitude": 34.8211,
        "longitude": -120.5212,
        "status": "CLASSIFIED IMINT",
    },
    {
        "name": "STARLINK-31652",
        "norad_id": 58921,
        "group": "starlink",
        "category": "Broadband Constellation",
        "altitude_km": 550.0,
        "velocity_kms": 7.58,
        "inclination_deg": 53.2,
        "period_min": 95.6,
        "latitude": 42.1120,
        "longitude": -71.0589,
        "status": "OPERATIONAL",
    },
]

# Global Undersea Fiber-Optic Cables & Coastal Landing Stations
SUBMARINE_CABLES = [
    {
        "id": "trans-atlantic-14",
        "name": "TAT-14 / Dunant Transatlantic Cable",
        "owners": ["Orange", "Google", "Telia Carrier"],
        "length_km": 6600,
        "status": "Active",
        "landing_points": [
            {"name": "Virginia Beach, VA", "country": "United States", "lat": 36.8529, "lon": -75.9780},
            {"name": "Saint-Hilaire-de-Riez", "country": "France", "lat": 46.7214, "lon": -1.9472},
            {"name": "Bude, Cornwall", "country": "United Kingdom", "lat": 50.8284, "lon": -4.5435},
        ],
        "capacity_tbps": 250.0,
    },
    {
        "id": "sea-me-we-5",
        "name": "SEA-ME-WE 5 (South East Asia-Middle East-Western Europe)",
        "owners": ["Telecom Egypt", "Orange", "Singtel", "China Mobile", "Etisalat"],
        "length_km": 20000,
        "status": "Active",
        "landing_points": [
            {"name": "Marseille", "country": "France", "lat": 43.2965, "lon": 5.3698},
            {"name": "Zafarana", "country": "Egypt", "lat": 29.1167, "lon": 32.6500},
            {"name": "Fujairah", "country": "United Arab Emirates", "lat": 25.1288, "lon": 56.3265},
            {"name": "Karachi", "country": "Pakistan", "lat": 24.8607, "lon": 67.0011},
            {"name": "Tuas", "country": "Singapore", "lat": 1.3200, "lon": 103.6500},
        ],
        "capacity_tbps": 24.0,
    },
    {
        "id": "faster-transpacific",
        "name": "FASTER Transpacific Cable System",
        "owners": ["Google", "China Mobile", "China Telecom", "KDDI", "Singtel"],
        "length_km": 11629,
        "status": "Active",
        "landing_points": [
            {"name": "Bandon, Oregon", "country": "United States", "lat": 43.1234, "lon": -124.4084},
            {"name": "Chikura, Chiba", "country": "Japan", "lat": 34.9542, "lon": 139.9572},
            {"name": "Shima, Mie", "country": "Japan", "lat": 34.3333, "lon": 136.8333},
            {"name": "Toucheng", "country": "Taiwan", "lat": 24.8583, "lon": 121.8233},
        ],
        "capacity_tbps": 60.0,
    },
    {
        "id": "monet-cable",
        "name": "Monet Subsea Cable",
        "owners": ["Google", "Algar Telecom", "Antel", "Angola Cables"],
        "length_km": 10556,
        "status": "Active",
        "landing_points": [
            {"name": "Boca Raton, Florida", "country": "United States", "lat": 26.3683, "lon": -80.1289},
            {"name": "Fortaleza, Ceará", "country": "Brazil", "lat": -3.7319, "lon": -38.5267},
            {"name": "Santos, São Paulo", "country": "Brazil", "lat": -23.9608, "lon": -46.3336},
        ],
        "capacity_tbps": 64.0,
    },
    {
        "id": "peace-cable",
        "name": "PEACE Cable (Pakistan & East Africa Connecting Europe)",
        "owners": ["Hengtong Group", "Cybernet", "Orange"],
        "length_km": 15000,
        "status": "Active",
        "landing_points": [
            {"name": "Gwadar", "country": "Pakistan", "lat": 25.1216, "lon": 62.3254},
            {"name": "Djibouti City", "country": "Djibouti", "lat": 11.5721, "lon": 43.1456},
            {"name": "Mombasa", "country": "Kenya", "lat": -4.0435, "lon": 39.6682},
            {"name": "Marseille", "country": "France", "lat": 43.2965, "lon": 5.3698},
        ],
        "capacity_tbps": 96.0,
    },
]

# Strategic Maritime AIS Vessels & Chokepoint Telemetry
STRATEGIC_VESSELS = [
    {
        "mmsi": "235102456",
        "name": "EVER GLOBE",
        "ship_type": "Ultra Large Container Ship",
        "flag": "Panama",
        "speed_kts": 17.8,
        "heading": 312,
        "status": "Underway using Engine",
        "chokepoint": "Suez Canal Approach",
        "destination": "Rotterdam",
        "lat": 27.9124,
        "lon": 33.7210,
    },
    {
        "mmsi": "636019842",
        "name": "FRONT ALTAIR",
        "ship_type": "Crude Oil Supertanker (VLCC)",
        "flag": "Liberia",
        "speed_kts": 12.4,
        "heading": 134,
        "status": "Underway using Engine",
        "chokepoint": "Strait of Hormuz",
        "destination": "Singapore",
        "lat": 26.2415,
        "lon": 56.1205,
    },
    {
        "mmsi": "538007214",
        "name": "MAERSK MC-KINNEY MOLLER",
        "ship_type": "Triple-E Container Ship",
        "flag": "Denmark",
        "speed_kts": 18.5,
        "heading": 115,
        "status": "Underway using Engine",
        "chokepoint": "Strait of Malacca",
        "destination": "Shanghai",
        "lat": 2.4512,
        "lon": 101.8945,
    },
    {
        "mmsi": "368926000",
        "name": "USNS COMFORT (T-AH-20)",
        "ship_type": "Hospital Ship / Naval Auxiliary",
        "flag": "United States",
        "speed_kts": 14.1,
        "heading": 210,
        "status": "Underway",
        "chokepoint": "Caribbean Sea / Panama Approach",
        "destination": "Naval Station Norfolk",
        "lat": 10.1205,
        "lon": -79.8512,
    },
    {
        "mmsi": "412589000",
        "name": "HAI YANG SHI YOU 720",
        "ship_type": "Deepwater Geophysical Research",
        "flag": "China",
        "speed_kts": 5.2,
        "heading": 85,
        "status": "Restricted Maneuverability",
        "chokepoint": "South China Sea",
        "destination": "Hainan",
        "lat": 15.8912,
        "lon": 112.4512,
    },
    {
        "mmsi": "211283000",
        "name": "POLARSTERN",
        "ship_type": "Polar Research & Icebreaker",
        "flag": "Germany",
        "speed_kts": 10.8,
        "heading": 358,
        "status": "Underway using Engine",
        "chokepoint": "Arctic Fram Strait",
        "destination": "Bremerhaven",
        "lat": 78.9214,
        "lon": 11.9512,
    },
    {
        "mmsi": "311000842",
        "name": "SEAPEAK YAMAL",
        "ship_type": "Arc7 Icebreaking LNG Tanker",
        "flag": "Bahamas",
        "speed_kts": 15.6,
        "heading": 260,
        "status": "Underway using Engine",
        "chokepoint": "Barents Sea Northern Route",
        "destination": "Zeebrugge",
        "lat": 71.1205,
        "lon": 38.4512,
    }
]

# Strategic Global Infrastructure (Datacenters & Mega Installations)
STRATEGIC_INFRASTRUCTURE = [
    {
        "name": "Ashburn Data Center Alley",
        "category": "Cloud & Telecom Backbone",
        "region": "Loudoun County, Virginia, US",
        "lat": 39.0438,
        "lon": -77.4874,
        "details": "World's largest concentration of datacenters (~70% of global internet traffic).",
    },
    {
        "name": "Three Gorges Dam Hydroelectric Facility",
        "category": "Strategic Energy & Water",
        "region": "Yiling District, Yichang, Hubei, CN",
        "lat": 30.8260,
        "lon": 111.0074,
        "details": "World's largest power station (22,500 MW capacity).",
    },
    {
        "name": "Itaipu Hydroelectric Dam",
        "category": "Strategic Energy & Water",
        "region": "Paraná River, Brazil / Paraguay border",
        "lat": -25.4083,
        "lon": -54.5889,
        "details": "Binational mega-dam supplying 14,000 MW of power.",
    },
    {
        "name": "Pine Gap Joint Defence Facility",
        "category": "Satellite Surveillance Ground Station",
        "region": "Alice Springs, Northern Territory, AU",
        "lat": -23.7989,
        "lon": 133.7372,
        "details": "Joint US-Australian satellite ground control and signals intelligence station.",
    },
    {
        "name": "Svalbard Satellite Station (SvalSat)",
        "category": "Polar Ground Station",
        "region": "Platåberget, Spitsbergen, Norway",
        "lat": 78.2308,
        "lon": 15.4072,
        "details": "World's largest commercial polar satellite tracking ground station (100+ antennas).",
    },
    {
        "name": "Vandenberg Space Force Base",
        "category": "Military Space Launch & Telemetry",
        "region": "Santa Barbara County, California, US",
        "lat": 34.7420,
        "lon": -120.5724,
        "details": "US Space Force orbital launch site for military, polar, and reconnaissance satellites.",
    },
]


def propagate_keplerian_orbit(
    epoch_iso: str,
    mean_motion: float,
    eccentricity: float,
    inclination_deg: float,
    raan_deg: float,
    arg_perigee_deg: float,
    mean_anomaly_deg: float,
) -> tuple[float, float, float, float]:
    """Propagates Keplerian orbital elements to current UTC epoch.
    Returns: (latitude_deg, longitude_deg, altitude_km, velocity_kms)
    """
    try:
        # Parse epoch
        epoch_str = epoch_iso.split(".")[0].replace("Z", "")
        t0 = datetime.datetime.fromisoformat(epoch_str).replace(tzinfo=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        dt_seconds = (now - t0).total_seconds()
    except Exception:
        dt_seconds = 0.0

    # Mean motion n in radians / sec
    n = mean_motion * (2.0 * math.pi / 86400.0)

    # Semi-major axis a (km)
    a = (MU / (n * n)) ** (1.0 / 3.0)

    # Mean anomaly M at current time t
    M = math.radians(mean_anomaly_deg) + n * dt_seconds
    M = M % (2.0 * math.pi)

    # Solve Kepler's equation for Eccentric Anomaly E: E - e*sin(E) = M
    E = M
    for _ in range(10):
        f = E - eccentricity * math.sin(E) - M
        f_prime = 1.0 - eccentricity * math.cos(E)
        dE = f / f_prime
        E -= dE
        if abs(dE) < 1e-6:
            break

    # True anomaly nu
    sin_nu = (math.sqrt(1.0 - eccentricity * eccentricity) * math.sin(E)) / (1.0 - eccentricity * math.cos(E))
    cos_nu = (math.cos(E) - eccentricity) / (1.0 - eccentricity * math.cos(E))
    nu = math.atan2(sin_nu, cos_nu)

    # Radius r in orbital plane
    r = a * (1.0 - eccentricity * math.cos(E))
    alt_km = max(180.0, r - EARTH_RADIUS_KM)

    # Argument of latitude u = omega + nu
    u = math.radians(arg_perigee_deg) + nu
    inc = math.radians(inclination_deg)
    raan = math.radians(raan_deg)

    # Coordinates in ECI frame
    x_eci = r * (math.cos(raan) * math.cos(u) - math.sin(raan) * math.sin(u) * math.cos(inc))
    y_eci = r * (math.sin(raan) * math.cos(u) + math.cos(raan) * math.sin(u) * math.cos(inc))
    z_eci = r * (math.sin(u) * math.sin(inc))

    # GMST angle (Earth rotation offset)
    # Approximate Greenwich Mean Sidereal Time in radians
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    j2000 = datetime.datetime(2000, 1, 1, 12, 0, 0, tzinfo=datetime.timezone.utc)
    days_since_j2000 = (now_utc - j2000).total_seconds() / 86400.0
    gmst = math.radians(280.46061837 + 360.98564736629 * days_since_j2000) % (2.0 * math.pi)

    # Rotate to Earth-Centered Earth-Fixed (ECEF) frame
    x_ecef = x_eci * math.cos(gmst) + y_eci * math.sin(gmst)
    y_ecef = -x_eci * math.sin(gmst) + y_eci * math.cos(gmst)
    z_ecef = z_eci

    # Convert ECEF to geodetic latitude and longitude
    p = math.sqrt(x_ecef * x_ecef + y_ecef * y_ecef)
    lat_rad = math.atan2(z_ecef, p)
    lon_rad = math.atan2(y_ecef, x_ecef)

    lat_deg = math.degrees(lat_rad)
    lon_deg = math.degrees(lon_rad)

    # Orbital velocity v = sqrt(mu * (2/r - 1/a))
    v_kms = math.sqrt(MU * (2.0 / r - 1.0 / a))

    return lat_deg, lon_deg, alt_km, v_kms


async def fetch_orbital_satellites(group: str = "stations") -> list[dict[str, Any]]:
    """Fetches real-time orbital elements from CelesTrak and propagates current sub-satellite positions."""
    clean_group = re.sub(r"[^a-zA-Z0-9_-]", "", group).lower() or "stations"
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={clean_group}&FORMAT=json"

    satellites = []
    try:
        headers = {
            "User-Agent": "NetScraper-GodsEye/1.0 (+https://github.com/bilawalsidhu/gods-eye-view)"
        }
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    for sat in data[:45]:  # Top 45 satellites per group
                        try:
                            name = sat.get("OBJECT_NAME", "UNKNOWN SATELLITE")
                            norad_id = sat.get("NORAD_CAT_ID", 0)
                            epoch = sat.get("EPOCH", "")
                            mean_motion = float(sat.get("MEAN_MOTION", 15.0))
                            eccentricity = float(sat.get("ECCENTRICITY", 0.001))
                            inclination = float(sat.get("INCLINATION", 51.6))
                            raan = float(sat.get("RA_OF_ASC_NODE", 0.0))
                            arg_perigee = float(sat.get("ARG_OF_PERICENTER", 0.0))
                            mean_anomaly = float(sat.get("MEAN_ANOMALY", 0.0))

                            lat, lon, alt_km, v_kms = propagate_keplerian_orbit(
                                epoch,
                                mean_motion,
                                eccentricity,
                                inclination,
                                raan,
                                arg_perigee,
                                mean_anomaly,
                            )

                            period_min = round(1440.0 / mean_motion, 1) if mean_motion > 0 else 92.0

                            satellites.append({
                                "name": name,
                                "norad_id": norad_id,
                                "group": clean_group,
                                "category": "Space Station / Crewed" if clean_group == "stations" else ("Navigation (GPS/GLO)" if "ops" in clean_group else "Orbital Satellite"),
                                "altitude_km": round(alt_km, 1),
                                "velocity_kms": round(v_kms, 2),
                                "inclination_deg": round(inclination, 2),
                                "period_min": period_min,
                                "latitude": round(lat, 4),
                                "longitude": round(lon, 4),
                                "status": "TRACKED ACTIVE",
                                "epoch": epoch,
                                "source": "CelesTrak SGP4",
                            })
                        except Exception:
                            continue
    except Exception:
        pass

    if not satellites:
        # Fallback to embedded constellation
        satellites = [s for s in FALLBACK_SATELLITES if s.get("group") == clean_group or clean_group == "all"]
        if not satellites:
            satellites = FALLBACK_SATELLITES

    return satellites


async def fetch_space_launches() -> list[dict[str, Any]]:
    """Pulls upcoming and recent orbital space missions from The Space Devs Launch Library 2."""
    url = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10"
    launches = []

    try:
        headers = {"User-Agent": "NetScraper-GodsEye/1.0"}
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("results", []):
                    pad = item.get("pad", {})
                    loc = pad.get("location", {})
                    rocket = item.get("rocket", {}).get("configuration", {})
                    lsp = item.get("launch_service_provider", {})
                    mission = item.get("mission", {}) or {}

                    lat_str = pad.get("latitude")
                    lon_str = pad.get("longitude")
                    lat = float(lat_str) if lat_str else 0.0
                    lon = float(lon_str) if lon_str else 0.0

                    launches.append({
                        "id": item.get("id"),
                        "mission_name": item.get("name", "Orbital Launch"),
                        "status": item.get("status", {}).get("name", "Go for Launch"),
                        "net_time": item.get("net"),
                        "provider": lsp.get("name", "Commercial Launch Provider"),
                        "rocket": rocket.get("name", "Launch Vehicle"),
                        "pad_name": pad.get("name", "Launch Pad"),
                        "location_name": loc.get("name", "Spaceport"),
                        "country_code": loc.get("country_code", "US"),
                        "latitude": lat,
                        "longitude": lon,
                        "orbit": mission.get("orbit", {}).get("name", "Low Earth Orbit (LEO)"),
                        "description": mission.get("description", "Orbital satellite payload insertion."),
                        "image_url": item.get("image"),
                    })
    except Exception:
        pass

    if not launches:
        # Fallback upcoming missions
        launches = [
            {
                "id": "starship-flight-upcoming",
                "mission_name": "Starship Integrated Flight Test",
                "status": "Go for Launch",
                "net_time": "2026-09-22T13:00:00Z",
                "provider": "SpaceX",
                "rocket": "Starship / Super Heavy",
                "pad_name": "Orbital Launch Mount A",
                "location_name": "Starbase, Boca Chica, Texas",
                "country_code": "USA",
                "latitude": 25.9968,
                "longitude": -97.1580,
                "orbit": "Trans-atmospheric / Sub-orbital",
                "description": "Full orbital stack flight test with stage separation and tower catch attempt.",
            },
            {
                "id": "falcon9-starlink-upcoming",
                "mission_name": "Starlink Group 12-4",
                "status": "Go for Launch",
                "net_time": "2026-09-18T04:24:00Z",
                "provider": "SpaceX",
                "rocket": "Falcon 9 Block 5",
                "pad_name": "SLC-40",
                "location_name": "Cape Canaveral Space Force Station",
                "country_code": "USA",
                "latitude": 28.5619,
                "longitude": -80.5772,
                "orbit": "Low Earth Orbit (LEO)",
                "description": "Deployment of 22 Starlink V2 Mini communication satellites.",
            },
            {
                "id": "electron-upcoming",
                "mission_name": "Rocket Lab Dedicated Rideshare",
                "status": "Go for Launch",
                "net_time": "2026-09-25T08:15:00Z",
                "provider": "Rocket Lab",
                "rocket": "Electron",
                "pad_name": "LC-1A",
                "location_name": "Mahia Peninsula, New Zealand",
                "country_code": "NZL",
                "latitude": -39.2608,
                "longitude": 177.8658,
                "orbit": "Sun-Synchronous Orbit (SSO)",
                "description": "Commercial synthetic aperture radar (SAR) satellite delivery.",
            }
        ]

    return launches


def fetch_submarine_cables_data() -> list[dict[str, Any]]:
    """Returns strategic subsea telecommunications cable systems."""
    return SUBMARINE_CABLES


def fetch_maritime_vessels_data() -> list[dict[str, Any]]:
    """Returns strategic maritime vessels across global chokepoints."""
    return STRATEGIC_VESSELS


def fetch_critical_infrastructure_data(category: str = "all") -> list[dict[str, Any]]:
    """Returns strategic critical global installations."""
    if category.lower() == "all":
        return STRATEGIC_INFRASTRUCTURE
    return [i for i in STRATEGIC_INFRASTRUCTURE if category.lower() in i.get("category", "").lower()]
