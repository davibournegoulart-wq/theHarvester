"""Rotas de reconhecimento — domínio, IP, crypto, dork, dark web, e novas capacidades.

Expandido (2026-09-09) com: TLS cert, web archive (CDX + availability),
cloud enum, corporate registry, document metadata, breach analytics,
Facebook breach, BSC e Polygon crypto trace.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, File, HTTPException, UploadFile, Depends, Query
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
import httpx
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db

from app.darkweb.monitor import search_dark_web
from app.recon.breach_check import (
    check_breach_directory,
    check_facebook_breach,
    get_breach_analytics,
)
from app.recon.cloud_enum import enumerate_cloud_assets
from app.recon.corporate_registry import search_corporate_registries
from app.recon.crypto_trace import trace_btc_wallet, trace_eth_wallet, trace_bsc_wallet, trace_polygon_wallet
from app.recon.document_meta import extract_document_metadata
from app.recon.domain import find_subdomains
from app.recon.domain_whois import lookup_domain_whois
from app.recon.dork_engine import DorkRequest, generate_dorks as generate_dork_engine_queries
from app.recon.dork_generator import generate_dorks
from app.recon.email_pattern import generate_permutations, verify_via_smtp
from app.recon.ip_reputation import lookup_ip
from app.recon.phone_mentions import generate_phone_mention_queries
from app.recon.reverse_image import generate_reverse_image_links
from app.recon.sanctions_check import search_sanctions
from app.recon.tls_cert import analyze_tls_certificate
from app.recon.web_archive import check_archive_availability, search_archive
from app.recon.deep_scraper import scrape_url, extract_entities
from app.recon.scrapy_crawler import run_scrapy_crawl
from app.recon.ghost_track import (
    trace_ip as run_ghost_ip_trace,
    parse_phone_intel as run_ghost_phone_intel,
    check_my_ip as run_ghost_check_my_ip,
    scan_username_ghosttrack as run_ghost_username_scan,
)
from app.recon.visual_geolocation import extract_pic2map_exif, predict_visual_geolocation
from app.recon.mail_access import run_mail_access_deep_recon, harvest_domain_emails
from app.recon.shadowbroker import (
    fetch_military_aircraft,
    detect_gps_jamming,
    fetch_nasa_firms,
    fetch_malware_c2,
    fetch_telegram_osint,
    fetch_usgs_earthquakes,
    fetch_country_dossier,
)
from app.recon.torbot import (
    check_onion_status,
    extract_onion_intel,
    crawl_onion_link_tree,
)
from app.recon.horus import (
    lookup_mac_vendor,
    lookup_bank_bin,
    lookup_wifi_bssid,
    scan_threat_intel,
    loki_vault_keygen,
    loki_vault_encrypt,
    loki_vault_decrypt,
)
from app.recon.gods_eye import (
    fetch_orbital_satellites,
    fetch_space_launches,
    fetch_submarine_cables_data,
    fetch_maritime_vessels_data,
    fetch_critical_infrastructure_data,
)
from app.recon.void_access import (
    extract_threat_entities,
    search_threat_actors,
    fetch_live_threat_feed,
    generate_yara_rule,
    generate_sigma_rule,
    generate_stix_bundle,
    run_voidaccess_investigation,
    CURATED_ONION_SEEDS,
)
import json
import os

router = APIRouter(prefix="/recon", tags=["recon"])


# ---------------------------------------------------------------------------
# Deep Scraper & Scrapy Crawler
# ---------------------------------------------------------------------------

class ScrapeTextRequest(BaseModel):
    text: str

class ScrapyCrawlRequest(BaseModel):
    url: str
    max_depth: int = 2
    max_pages: int = 15
    use_tor: bool = False

@router.get("/scrape")
async def scrape_url_endpoint(url: str, use_tor: bool = False):
    """Scrapes a URL (cleans HTML) and extracts entities (emails, phones, cpfs, crypto)."""
    return await scrape_url(url, use_tor)

@router.post("/scrape/text")
async def scrape_text_endpoint(body: ScrapeTextRequest):
    """Extracts entities from raw text provided by the user."""
    return extract_entities(body.text)

@router.post("/scrapy/crawl")
async def scrapy_crawl_endpoint(body: ScrapyCrawlRequest):
    """Runs a multi-page Scrapy spider crawl extracting links, emails, crypto, and documents."""
    return await run_scrapy_crawl(
        url=body.url,
        max_depth=body.max_depth,
        max_pages=body.max_pages,
        use_tor=body.use_tor,
    )


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Auto-Recon (reconFTW + ReconSpider + SpiderFoot synthesis)
# ---------------------------------------------------------------------------
import uuid
from app.db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

class AutoReconRequest(BaseModel):
    target: str | None = None
    email: str | None = None
    target_type: str = "email"  # "email" or "domain"
    case_id: uuid.UUID

@router.post("/auto-recon")
async def trigger_auto_recon(body: AutoReconRequest, db: AsyncSession = Depends(get_db)):
    """Executes automated multi-engine reconnaissance and injects findings into case graph."""
    from app.recon.auto_recon import run_email_auto_recon, run_domain_auto_recon
    val = (body.target or body.email or "").strip()
    if body.target_type == "domain":
        return await run_domain_auto_recon(val, body.case_id, db)
    return await run_email_auto_recon(val, body.case_id, db)


# ---------------------------------------------------------------------------
# EyeWitness, Gowitness, Breacher, RED_HAWK, Gitleaks, TruffleHog Endpoints
# ---------------------------------------------------------------------------
from app.recon.visual_inspector import audit_web_visual_and_headers
from app.recon.web_exposure import scan_web_exposure
from app.recon.secret_scanner import scan_text_for_secrets

class SecretScanRequest(BaseModel):
    text: str
    entropy_threshold: float = 3.2

@router.get("/visual/audit")
async def visual_audit_endpoint(target: str, use_tor: bool = False):
    """EyeWitness & Gowitness visual web inspection, security headers, and tech signatures."""
    return await audit_web_visual_and_headers(target, use_tor)

@router.get("/web/exposure")
async def web_exposure_endpoint(target: str, use_tor: bool = False):
    """Breacher & RED_HAWK admin panel hunter and exposure scan."""
    return await scan_web_exposure(target, use_tor)

@router.post("/secrets/scan")
async def secret_scan_endpoint(body: SecretScanRequest):
    """Gitleaks & TruffleHog secret, token and credential scanner."""
    findings = scan_text_for_secrets(body.text, body.entropy_threshold)
    return {"total_findings": len(findings), "findings": findings}


# ---------------------------------------------------------------------------
# Domínio
# ---------------------------------------------------------------------------

@router.get("/domain/{domain}/subdomains")
async def domain_subdomains(domain: str):
    return await find_subdomains(domain)


@router.get("/domain/{domain}/dorks")
async def domain_dorks(domain: str):
    return generate_dorks(domain)


@router.get("/domain/{domain}/whois")
async def domain_whois(domain: str):
    return await lookup_domain_whois(domain)


@router.get("/domain/{domain}/tls")
async def domain_tls(domain: str, port: int = 443):
    """Análise de certificado TLS de um host."""
    try:
        return await analyze_tls_certificate(domain, port)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Não foi possível conectar: {e}")


# ---------------------------------------------------------------------------
# IP
# ---------------------------------------------------------------------------

@router.get("/ip/{ip}")
async def ip_reputation(ip: str):
    return await lookup_ip(ip)


# ---------------------------------------------------------------------------
# Sanções
# ---------------------------------------------------------------------------

@router.get("/sanctions")
async def sanctions(q: str):
    return await search_sanctions(q)


# ---------------------------------------------------------------------------
# Crypto
# ---------------------------------------------------------------------------

@router.get("/crypto/btc/{address}")
async def crypto_btc(address: str):
    return await trace_btc_wallet(address)


@router.get("/crypto/eth/{address}")
async def crypto_eth(address: str):
    return await trace_eth_wallet(address)


@router.get("/crypto/bsc/{address}")
async def crypto_bsc(address: str):
    """BNB Smart Chain — via BscScan API."""
    return await trace_bsc_wallet(address)


@router.get("/crypto/polygon/{address}")
async def crypto_polygon(address: str):
    """Polygon — via PolygonScan API."""
    return await trace_polygon_wallet(address)


# ---------------------------------------------------------------------------
# E-mail pattern discovery
# ---------------------------------------------------------------------------

@router.get("/email-pattern/{domain}")
async def email_pattern(domain: str, first_name: str, last_name: str):
    candidates = generate_permutations(first_name, last_name, domain)
    verified = [
        {"email": email, "smtp_accepted": await run_in_threadpool(verify_via_smtp, email)} for email in candidates
    ]
    return verified


# ---------------------------------------------------------------------------
# Dark web
# ---------------------------------------------------------------------------

@router.get("/darkweb")
async def darkweb_search(keyword: str):
    return await search_dark_web(keyword)


# ---------------------------------------------------------------------------
# Reverse image
# ---------------------------------------------------------------------------

@router.get("/reverse-image")
async def reverse_image(image_url: str):
    return generate_reverse_image_links(image_url)

@router.post("/reverse-image/upload")
async def reverse_image_upload(file: UploadFile = File(...)):
    """Uploads an image to a temporary public host (catbox.moe) to generate reverse search links."""
    content = await file.read()
    
    from app.recon.reverse_image import extract_faces
    
    async def upload_to_catbox(client, file_bytes, filename, content_type):
        files = {'fileToUpload': (filename, file_bytes, content_type)}
        data = {'reqtype': 'fileupload'}
        response = await client.post("https://catbox.moe/user/api.php", data=data, files=files, timeout=30.0)
        if response.status_code != 200:
            return None
        url = response.text.strip()
        return url if url.startswith("http") else None

    # Upload to catbox.moe
    async with httpx.AsyncClient() as client:
        try:
            main_url = await upload_to_catbox(client, content, file.filename, file.content_type)
            if not main_url:
                raise HTTPException(status_code=500, detail="Serviço de upload retornou URL inválida ou falhou.")
                
            result = {
                "public_url": main_url,
                "links": generate_reverse_image_links(main_url),
                "faces": []
            }
            
            # Extract faces and upload them
            faces_bytes = await run_in_threadpool(extract_faces, content)
            for i, face_b in enumerate(faces_bytes):
                face_url = await upload_to_catbox(client, face_b, f"face_{i}.jpg", "image/jpeg")
                if face_url:
                    result["faces"].append({
                        "public_url": face_url,
                        "links": generate_reverse_image_links(face_url)
                    })
                    
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Email Registration (Holehe)
# ---------------------------------------------------------------------------

@router.get("/email/registrations")
async def email_registrations(email: str):
    """Verifica contas registradas usando Holehe (120+ sites)."""
    from app.recon.email_registration import check_email_registrations
    return await check_email_registrations(email)

# ---------------------------------------------------------------------------
# Web archive (Wayback Machine)
# ---------------------------------------------------------------------------

@router.get("/archive/availability")
async def archive_availability(url: str):
    """Checa se uma URL tem snapshot no Wayback Machine."""
    return await check_archive_availability(url)


@router.get("/archive/search")
async def archive_search(url: str, limit: int = 50):
    """Lista snapshots de uma URL no Wayback Machine (CDX API)."""
    return await search_archive(url, limit)


# ---------------------------------------------------------------------------
# Phone mentions
# ---------------------------------------------------------------------------

@router.get("/phone/{phone}/mentions")
async def phone_mentions(phone: str):
    return generate_phone_mention_queries(phone)


# ---------------------------------------------------------------------------
# Cloud asset discovery
# ---------------------------------------------------------------------------

@router.get("/cloud/{org_name}")
async def cloud_enum(org_name: str):
    """Descobre buckets/containers de nuvem pública baseado no nome da organização."""
    return await enumerate_cloud_assets(org_name)


# ---------------------------------------------------------------------------
# Corporate registry
# ---------------------------------------------------------------------------

@router.get("/corporate")
async def corporate_search(q: str, cnpj: str | None = None):
    """Busca em registros corporativos governamentais (SEC, Companies House, Receita Federal, ICIJ)."""
    return await search_corporate_registries(q, cnpj)


# ---------------------------------------------------------------------------
# Breach analytics (novas fontes)
# ---------------------------------------------------------------------------

@router.get("/breach/analytics")
async def breach_analytics(email: str):
    """XposedOrNot breach analytics — métricas de risco e timeline."""
    return await get_breach_analytics(email)


@router.get("/breach/directory")
async def breach_directory(email: str):
    """BreachDirectory — busca em leaks públicos."""
    return await check_breach_directory(email)


@router.get("/breach/facebook")
async def facebook_breach(phone: str):
    """Busca no vazamento Facebook 533M por número de telefone."""
    return await check_facebook_breach(phone)


# ---------------------------------------------------------------------------
# Document metadata
# ---------------------------------------------------------------------------

@router.post("/document/metadata")
async def document_metadata(file: UploadFile = File(...)):
    """Extrai metadados de documento (PDF, DOCX, XLSX)."""
    content = await file.read()
    result = extract_document_metadata(content, filename=file.filename)
    if result is None:
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Use PDF, DOCX ou XLSX.")
    return result


# ---------------------------------------------------------------------------
# Dork engine
# ---------------------------------------------------------------------------

class DorkEngineRequest(BaseModel):
    email: str | None = None
    phone: str | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    domain: str | None = None
    file_extension: str | None = None


@router.post("/dork-engine")
async def dork_engine(body: DorkEngineRequest):
    try:
        return generate_dork_engine_queries(DorkRequest(**body.model_dump()))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# GhostTrack (HunxByts/GhostTrack adaptation)
# ---------------------------------------------------------------------------

@router.get("/ghosttrack/ip")
async def ghosttrack_ip(ip: str, use_tor: bool = False):
    """GhostTrack IP Geolocation & ASN Network Tracer."""
    return await run_ghost_ip_trace(ip, use_tor=use_tor)


@router.get("/ghosttrack/phone")
def ghosttrack_phone(phone: str, default_region: str = "US"):
    """GhostTrack Phone Carrier, Timezone, and Telecommunication Parser."""
    return run_ghost_phone_intel(phone, default_region=default_region)


@router.get("/ghosttrack/my-ip")
async def ghosttrack_my_ip(use_tor: bool = False):
    """GhostTrack Show Your IP: Detect active investigator egress IP and Tor proxy status."""
    return await run_ghost_check_my_ip(use_tor=use_tor)


@router.get("/ghosttrack/username")
async def ghosttrack_username(username: str, use_tor: bool = False):
    """GhostTrack Username Tracker (TrackLu): Fast 24-platform social and developer footprint check."""
    return await run_ghost_username_scan(username, use_tor=use_tor)


# ---------------------------------------------------------------------------
# Shadowbroker: Global Threat & Multi-Domain Telemetry (BigBodyCobain/Shadowbroker)
# ---------------------------------------------------------------------------

@router.get("/shadowbroker/military-flights")
async def shadowbroker_military_flights(limit: int = 60):
    """Fetches live military, reconnaissance, and VIP flights from ADS-B telemetry."""
    return await fetch_military_aircraft(limit=limit)


@router.get("/shadowbroker/gps-jamming")
async def shadowbroker_gps_jamming():
    """Detects active GPS jamming and electronic warfare zones from transponder NAC-p degradation."""
    return await detect_gps_jamming()


@router.get("/shadowbroker/nasa-firms")
async def shadowbroker_nasa_firms(limit: int = 60):
    """Fetches real-time 24h global thermal anomalies and active fires from NASA FIRMS VIIRS satellite."""
    return await fetch_nasa_firms(limit=limit)


@router.get("/shadowbroker/malware-c2")
async def shadowbroker_malware_c2(limit: int = 50):
    """Fetches active botnet C2 servers and malicious infrastructure from abuse.ch Feodo Tracker."""
    return await fetch_malware_c2(limit=limit)


@router.get("/shadowbroker/telegram-feed")
async def shadowbroker_telegram_feed(channel: str = "osintdefender", limit: int = 20):
    """Scrapes public conflict and intelligence Telegram channels with geoparsed coordinates."""
    return await fetch_telegram_osint(channel=channel, limit=limit)


@router.get("/shadowbroker/earthquakes")
async def shadowbroker_earthquakes(limit: int = 50):
    """Fetches global seismic events (M2.5+) from USGS Hazards Program."""
    return await fetch_usgs_earthquakes(limit=limit)


@router.get("/shadowbroker/country-dossier")
async def shadowbroker_country_dossier(
    country: Optional[str] = Query(None, description="ISO Alpha-2 or Country Name"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
):
    """Fetches C4ISR geopolitical strategic dossier, Head of State, alliances, and defense posture."""
    return await fetch_country_dossier(country_code=country, lat=lat, lon=lon)


# ---------------------------------------------------------------------------
# TorBot: Dark Web OSINT & Onion Crawler (DedSecInside/TorBot)
# ---------------------------------------------------------------------------

class TorbotTargetRequest(BaseModel):
    url: str

class TorbotCrawlRequest(BaseModel):
    url: str
    depth: int = 1
    max_pages: int = 12

@router.get("/torbot/check")
async def torbot_check_endpoint(url: str):
    """Checks reachability, latency, and status code of an onion or dark web URL."""
    return await check_onion_status(url)


@router.post("/torbot/intel")
async def torbot_intel_endpoint(req: TorbotTargetRequest):
    """Deep forensic extraction of emails, crypto wallets, and exposed files from an onion site."""
    return await extract_onion_intel(req.url)


@router.post("/torbot/crawl")
async def torbot_crawl_endpoint(req: TorbotCrawlRequest):
    """Crawls dark web onion link tree and maps relationship graph."""
    return await crawl_onion_link_tree(req.url, depth=req.depth, max_pages=req.max_pages)


# ---------------------------------------------------------------------------
# Project Horus: Digital Forensics & Multi-Domain OSINT (6abd/horus)
# ---------------------------------------------------------------------------

class HorusVtRequest(BaseModel):
    target: str
    api_key: Optional[str] = None


class HorusLokiRequest(BaseModel):
    action: str  # "keygen" | "encrypt" | "decrypt"
    data: Optional[str] = ""
    key: Optional[str] = None


@router.get("/horus/mac")
async def horus_mac_lookup(mac: str = Query(..., description="Target hardware MAC address")):
    """Project Horus: MAC address hardware vendor, OUI block, and transmission classification."""
    try:
        return await lookup_mac_vendor(mac)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/horus/bin")
async def horus_bin_lookup(bin: str = Query(..., description="Target 6-8 digit Bank Identification Number")):
    """Project Horus: Bank card BIN/IIN routing, brand, tier, issuing bank, and country lookup."""
    try:
        return await lookup_bank_bin(bin)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/horus/wifi")
async def horus_wifi_lookup(
    bssid: str = Query(..., description="Target Wi-Fi BSSID access point MAC"),
    api_name: Optional[str] = None,
    api_token: Optional[str] = None
):
    """Project Horus: Wireless BSSID geolocation triangulation (Mylnikov open API + WiGLE v2)."""
    try:
        return await lookup_wifi_bssid(bssid, api_name=api_name, api_token=api_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/horus/vt")
async def horus_threat_scan(req: HorusVtRequest):
    """Project Horus: Multi-engine threat intelligence and file hash / URL / IP scanner."""
    return await scan_threat_intel(req.target, api_key=req.api_key)


@router.post("/horus/loki")
def horus_loki_vault(req: HorusLokiRequest):
    """Project Horus: Loki cryptographic evidence vault (keygen, encrypt, decrypt)."""
    action = req.action.lower()
    if action == "keygen":
        key = loki_vault_keygen()
        return {"action": "keygen", "key": key}
    elif action == "encrypt":
        if not req.key:
            raise HTTPException(status_code=400, detail="Fernet encryption key is required.")
        try:
            ciphertext = loki_vault_encrypt(req.data or "", req.key)
            return {"action": "encrypt", "ciphertext": ciphertext}
        except Exception as err:
            raise HTTPException(status_code=400, detail=f"Encryption failed: {err}")
    elif action == "decrypt":
        if not req.key:
            raise HTTPException(status_code=400, detail="Fernet encryption key is required.")
        try:
            plaintext = loki_vault_decrypt(req.data or "", req.key)
            return {"action": "decrypt", "plaintext": plaintext}
        except Exception as err:
            raise HTTPException(status_code=400, detail=f"Decryption failed: {err}")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported Loki action: {req.action}")


# ---------------------------------------------------------------------------
# God's Eye View: Spy-Satellite Simulator & Multi-Sensor Intelligence (bilawalsidhu/gods-eye-view)
# ---------------------------------------------------------------------------

@router.get("/godseye/satellites")
async def godseye_satellites(group: str = "stations"):
    """God's Eye View: Real-time orbital satellite propagation, ground tracks & velocity telemetry (CelesTrak / SGP4)."""
    return await fetch_orbital_satellites(group=group)


@router.get("/godseye/launches")
async def godseye_launches():
    """God's Eye View: Space missions, launch countdowns, rockets & launchpad coordinates (Launch Library 2)."""
    return await fetch_space_launches()


@router.get("/godseye/submarine-cables")
def godseye_submarine_cables():
    """God's Eye View: Global undersea fiber-optic telecommunications cables & landing stations."""
    return fetch_submarine_cables_data()


@router.get("/godseye/vessels")
def godseye_vessels():
    """God's Eye View: Strategic maritime AIS vessels and international choke-point traffic."""
    return fetch_maritime_vessels_data()


@router.get("/godseye/critical-infra")
def godseye_critical_infra(category: str = "all"):
    """God's Eye View: Critical global infrastructure (datacenters, mega-dams, defense installations)."""
    return fetch_critical_infrastructure_data(category=category)


# ---------------------------------------------------------------------------
# Pic2Map & Netryx Astra V2 (Visual Geolocation & EXIF GPS)
# ---------------------------------------------------------------------------

@router.post("/geo/pic2map")
async def geo_pic2map(file: UploadFile = File(...)):
    """Pic2Map: Extracts precise hardware GPS coordinates, altitude, timestamp and camera metadata."""
    content = await file.read()
    return await extract_pic2map_exif(content)


@router.post("/geo/netryx-astra")
async def geo_netryx_astra(file: UploadFile = File(...)):
    """Netryx Astra V2: Visual street-level place recognition and landmark prediction."""
    content = await file.read()
    return await predict_visual_geolocation(content)


# ---------------------------------------------------------------------------
# MailAccess (KatrielMoses/MailAccess deep OSINT)
# ---------------------------------------------------------------------------

@router.get("/email/mailaccess")
async def email_mailaccess(email: str, use_tor: bool = False):
    """MailAccess: Multi-module deep email OSINT (Hudson Rock infostealers, EmailRep, M365 tenant, MX deliverability, Name Consensus, Defender's Brief)."""
    return await run_mail_access_deep_recon(email, use_tor=use_tor)


@router.get("/email/mailaccess/harvest")
async def email_mailaccess_harvest(domain: str, use_tor: bool = False):
    """MailAccess: Organization email harvester, syntax pattern extrapolator, and role accounts auditor."""
    return await harvest_domain_emails(domain, use_tor=use_tor)


# ---------------------------------------------------------------------------
# VoidAccess (KatrielMoses/voidaccess Dark Web Threat Intel)
# ---------------------------------------------------------------------------

@router.get("/voidaccess/investigate")
async def voidaccess_investigate(query: str, category: str = "all", use_tor: bool = False):
    """VoidAccess: Multi-stage dark web investigation with entity extraction and actor mapping."""
    return await run_voidaccess_investigation(query=query, category=category, use_tor=use_tor)


@router.get("/voidaccess/actors")
def voidaccess_actors(search: str = ""):
    """VoidAccess: Query threat actor dossiers and ransomware groups."""
    return search_threat_actors(search)


@router.get("/voidaccess/seeds")
def voidaccess_seeds(category: str = "all"):
    """VoidAccess: Curated onion seeds library."""
    if category == "all":
        return CURATED_ONION_SEEDS
    return [s for s in CURATED_ONION_SEEDS if s.category == category]


@router.post("/voidaccess/extract")
def voidaccess_extract(payload: dict):
    """VoidAccess: High-precision regex & NER entity extractor for IOCs, crypto, and onions."""
    text = payload.get("text", "")
    return extract_threat_entities(text)


@router.get("/voidaccess/feeds")
async def voidaccess_feeds():
    """VoidAccess: Live dark web ransomware extortion and botnet C2 threat feeds."""
    return await fetch_live_threat_feed()


@router.post("/voidaccess/export")
def voidaccess_export(payload: dict):
    """VoidAccess: Generate STIX 2.1, YARA, or Sigma detection rules from threat indicators."""
    fmt = payload.get("format", "yara").lower()
    text = payload.get("text", "")
    title = payload.get("title", "Threat Indicator Detection")
    entities = extract_threat_entities(text)

    if fmt == "yara":
        rule = generate_yara_rule(title, entities)
        return {"format": "yara", "content": rule}
    elif fmt == "sigma":
        rule = generate_sigma_rule(title, entities)
        return {"format": "sigma", "content": rule}
    elif fmt == "stix":
        bundle = generate_stix_bundle(title, entities)
        return {"format": "stix", "content": bundle}
    else:
        lines = ["Type,Indicator"]
        for btc in entities.cryptocurrency:
            lines.append(f"{btc['type']}_address,{btc['address']}")
        for o in entities.onion_urls:
            lines.append(f"onion_url,{o}")
        for h in entities.hashes:
            lines.append(f"hash_{h['type']},{h['hash']}")
        for c in entities.cves:
            lines.append(f"cve,{c}")
        return {"format": "csv", "content": "\n".join(lines)}


# ---------------------------------------------------------------------------
# Search-by-Image (dessant/search-by-image reverse engine links)
# ---------------------------------------------------------------------------

@router.get("/reverse-image/engines")
def reverse_image_engines(url: str):
    """Search-by-Image: Multi-engine reverse search link generation."""
    return generate_reverse_image_links(url)


# ---------------------------------------------------------------------------
# Bellingcat Open Source Investigation Toolkit (bellingcat/toolkit)
# ---------------------------------------------------------------------------

@router.get("/bellingcat/toolkit")
def bellingcat_toolkit(category: str | None = None, query: str | None = None):
    """Bellingcat Open Source Investigation Toolkit directory."""
    path = os.path.join(os.path.dirname(__file__), "../../data/bellingcat_toolkit.json")
    if not os.path.exists(path):
        path = "/Users/rollframe/Documents/Net_Scraper/app/backend/app/data/bellingcat_toolkit.json"

    tools = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            tools = json.load(f)

    if category and category.lower() != "all":
        tools = [t for t in tools if t.get("category", "").lower() == category.lower()]

    if query and query.strip():
        q = query.strip().lower()
        tools = [
            t for t in tools
            if q in t.get("name", "").lower()
            or q in t.get("description", "").lower()
            or any(q in tag.lower() for tag in t.get("tags", []))
        ]

    return tools
 
 
# ---------------------------------------------------------------------------
# InstaLooter (althonos/InstaLooter, stask/insta-looter, bakercp/ofxInstaLooter)
# ---------------------------------------------------------------------------

@router.get("/instagram/instalooter/profile")
async def instalooter_profile(username: str, use_tor: bool = False):
    """InstaLooter profile intelligence and metadata extraction."""
    from app.recon.insta_looter import loot_profile
    return await loot_profile(username, use_tor=use_tor)


@router.get("/instagram/instalooter/post")
async def instalooter_post(post_ref: str, use_tor: bool = False):
    """InstaLooter post/reel media and caption extraction."""
    from app.recon.insta_looter import loot_post
    return await loot_post(post_ref, use_tor=use_tor)


@router.post("/instagram/instalooter/cli")
async def instalooter_cli(
    target: str,
    target_type: str = "user",
    count: int = 5,
    get_videos: bool = False,
    dump_only: bool = True,
    username_auth: str | None = None,
    password_auth: str | None = None,
):
    """Executes InstaLooter CLI inside container."""
    from app.recon.insta_looter import run_instalooter_cli
    return await run_instalooter_cli(
        target=target,
        target_type=target_type,
        count=count,
        get_videos=get_videos,
        dump_only=dump_only,
        username_auth=username_auth,
        password_auth=password_auth,
    )


@router.post("/instagram/instalooter/attach-case")
async def instalooter_attach_case(
    case_id: uuid.UUID,
    media_url: str,
    filename: str = "instagram_media.jpg",
    typology: str = "image",
    db: AsyncSession = Depends(get_db),
):
    """Downloads an external Instagram media URL directly into the active case databank."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(filename)[1] or ".jpg"
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        r = await client.get(media_url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed downloading media from CDN")
        content = r.content

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology=typology,
        source_url=media_url,
        file_size=len(content),
        mime_type="image/jpeg" if ext.lower() in [".jpg", ".jpeg"] else "video/mp4",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="InstaLooter",
        action="file_looted_from_instagram",
        payload={
            "filename": filename,
            "source_url": media_url,
            "size": len(content),
        },
    )

    return {
        "status": "success",
        "file_id": str(file_id),
        "filename": safe_stored_name,
        "original_filename": filename,
        "file_size": len(content),
    }


# ---------------------------------------------------------------------------
# LinkdTime (Luca Garofalo / Lucksi/LinkdTime adaptation)
# ---------------------------------------------------------------------------

class LinkdTimelineRequest(BaseModel):
    urls: List[str]
    timezone_offset: float = 0.0


@router.get("/linkedin/linkdtime")
def linkedin_linkdtime_decode(url_or_id: str, timezone_offset: float = 0.0):
    """Decompiles a single LinkedIn snowflake ID or activity link to exact publication time."""
    from app.recon.linkdtime_engine import parse_linkedin_url
    result = parse_linkedin_url(url_or_id, timezone_offset)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/linkedin/linkdtime/timeline")
def linkedin_linkdtime_timeline(req: LinkdTimelineRequest):
    """Generates an interactive chronological activity timeline and active-hour pattern analysis."""
    from app.recon.linkdtime_engine import build_linkedin_timeline
    return build_linkedin_timeline(req.urls, req.timezone_offset)


# ---------------------------------------------------------------------------
# Facebook-Stalker (Anand Mudgerikar / Facebook-Stalker adaptation)
# ---------------------------------------------------------------------------

class FacebookStalkerMatrixRequest(BaseModel):
    target: str
    contacts: List[Dict[str, Any]]


@router.get("/facebook/stalker/profile")
async def facebook_stalker_profile(target: str, use_tor: bool = False):
    """Resolves Facebook target UID, generates Graph Search dorks and mobile bypass endpoints."""
    from app.recon.facebook_stalker import resolve_facebook_id, generate_stalker_graph_dorks
    profile = await resolve_facebook_id(target, use_tor=use_tor)
    dorks = generate_stalker_graph_dorks(profile.get("uid") or target)
    return {
        "profile": profile,
        "dorks": dorks,
    }


@router.post("/facebook/stalker/matrix")
def facebook_stalker_matrix(req: FacebookStalkerMatrixRequest):
    """Calculates social closeness edge weights (+5, +4, +3, +2, +1) and ranks associates."""
    from app.recon.facebook_stalker import calculate_interaction_matrix
    return calculate_interaction_matrix(req.target, req.contacts)


# ---------------------------------------------------------------------------
# Osintgram (Datalux/Osintgram adaptation)
# ---------------------------------------------------------------------------

@router.get("/instagram/osintgram")
async def instagram_osintgram_recon(username: str, use_tor: bool = False):
    """Full Osintgram scan: info, photodes AI alt-text, hashtags, fwersemail, fwersnumber, addrs."""
    from app.recon.osintgram_engine import run_osintgram_recon
    return await run_osintgram_recon(username, use_tor=use_tor)


# ---------------------------------------------------------------------------
# Instaloader (instaloader/instaloader adaptation)
# ---------------------------------------------------------------------------

@router.get("/instagram/instaloader/profile")
async def instagram_instaloader_profile(
    username: str,
    use_tor: bool = False,
    username_auth: str | None = None,
    password_auth: str | None = None,
):
    """Fetches profile metrics via Instaloader with crawler fallback."""
    from app.recon.instaloader_engine import instaloader_fetch_profile
    return await instaloader_fetch_profile(
        target_username=username,
        username_auth=username_auth,
        password_auth=password_auth,
        use_tor=use_tor,
    )


@router.get("/instagram/instaloader/post")
async def instagram_instaloader_post(shortcode: str, use_tor: bool = False):
    """Fetches post details and CDN media via Instaloader."""
    from app.recon.instaloader_engine import instaloader_fetch_post
    return await instaloader_fetch_post(shortcode, use_tor=use_tor)


# ---------------------------------------------------------------------------
# Social Media OSINT Tools Collection (osintambition adaptation)
# ---------------------------------------------------------------------------

@router.get("/social-tools-collection")
def get_social_tools_collection(
    query: str | None = None,
    platform: str | None = None,
    category: str | None = None,
):
    """Search and filter the 165+ social media OSINT tools catalog."""
    from app.recon.social_tools_collection import search_social_tools, get_platforms, get_categories
    tools = search_social_tools(query=query, platform=platform, category=category)
    return {
        "total": len(tools),
        "platforms": get_platforms(),
        "categories": get_categories(),
        "tools": tools,
    }


# ---------------------------------------------------------------------------
# Telegram Ultimate Scraper & Forensic Intelligence Engine
# ---------------------------------------------------------------------------

@router.get("/telegram/ultimate-scrape")
async def telegram_ultimate_scrape(
    target: str,
    limit: int = 50,
    query: str | None = None,
    media_type: str | None = None,
    use_tor: bool = False,
):
    """Scrapes Telegram channel messages, forward origins, media, and extracts forensic entities."""
    from app.recon.telegram_ultimate_scraper import scrape_telegram_channel_ultimate
    return await scrape_telegram_channel_ultimate(
        target=target,
        limit=limit,
        query_filter=query,
        media_filter=media_type,
        use_tor=use_tor,
    )


@router.post("/telegram/attach-evidence")
async def telegram_attach_evidence(
    case_id: uuid.UUID,
    media_url: str,
    filename: str = "telegram_evidence.jpg",
    typology: str = "image",
    db: AsyncSession = Depends(get_db),
):
    """Downloads Telegram media directly into the active case evidence vault."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(filename)[1] or ".jpg"
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        r = await client.get(media_url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed downloading media from Telegram CDN")
        content = r.content

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology=typology,
        source_url=media_url,
        file_size=len(content),
        mime_type="image/jpeg" if ext.lower() in [".jpg", ".jpeg"] else "video/mp4",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="TelegramUltimateScraper",
        action="file_looted_from_telegram",
        payload={
            "filename": filename,
            "source_url": media_url,
            "size": len(content),
        },
    )

    return {
        "status": "success",
        "file_id": str(file_id),
        "filename": safe_stored_name,
        "original_filename": filename,
        "file_size": len(content),
    }


# ---------------------------------------------------------------------------
# VKontakte (VK) Ultimate Harvester
# ---------------------------------------------------------------------------

@router.get("/vk/ultimate-harvest")
async def vk_ultimate_harvest(
    target: str,
    limit: int = 50,
    filter_type: str = "all",
    use_tor: bool = False,
):
    """Harvests VKontakte profiles, groups, wall posts, attachments, and forensic entities."""
    from app.recon.vk_ultimate_harvester import harvest_vk_ultimate
    return await harvest_vk_ultimate(
        target=target,
        limit=limit,
        filter_type=filter_type,
        use_tor=use_tor,
    )


@router.post("/vk/attach-evidence")
async def vk_attach_evidence(
    case_id: uuid.UUID,
    media_url: str,
    filename: str = "vk_evidence.jpg",
    typology: str = "image",
    db: AsyncSession = Depends(get_db),
):
    """Downloads VKontakte media directly into the active case evidence vault."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(filename)[1] or ".jpg"
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://vk.com/",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        r = await client.get(media_url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed downloading media from VK CDN")
        content = r.content

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology=typology,
        source_url=media_url,
        file_size=len(content),
        mime_type="image/jpeg" if ext.lower() in [".jpg", ".jpeg"] else "video/mp4",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="VkUltimateHarvester",
        action="file_looted_from_vk",
        payload={
            "filename": filename,
            "source_url": media_url,
            "size": len(content),
        },
    )

    return {
        "status": "success",
        "file_id": str(file_id),
        "filename": safe_stored_name,
        "original_filename": filename,
        "file_size": len(content),
    }


# ---------------------------------------------------------------------------
# TikTok Ultimate Scraper
# ---------------------------------------------------------------------------

@router.get("/tiktok/ultimate-scrape")
async def tiktok_ultimate_scrape_route(
    target: str,
    use_tor: bool = False,
):
    """Scrapes TikTok profile and extracts forensic entities."""
    from app.recon.tiktok_recon import scrape_tiktok_ultimate
    return await scrape_tiktok_ultimate(username_or_url=target, use_tor=use_tor)


@router.post("/tiktok/attach-evidence")
async def tiktok_attach_evidence(
    case_id: uuid.UUID,
    media_url: str,
    filename: str = "tiktok_evidence.jpg",
    typology: str = "image",
    db: AsyncSession = Depends(get_db),
):
    """Downloads TikTok media/avatar directly into the active case evidence vault."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(filename)[1] or ".jpg"
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        r = await client.get(media_url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed downloading media from TikTok CDN")
        content = r.content

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology=typology,
        source_url=media_url,
        file_size=len(content),
        mime_type="image/jpeg" if ext.lower() in [".jpg", ".jpeg"] else "video/mp4",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="TikTokUltimateScraper",
        action="file_looted_from_tiktok",
        payload={
            "filename": filename,
            "source_url": media_url,
            "size": len(content),
        },
    )

    return {
        "status": "success",
        "file_id": str(file_id),
        "filename": safe_stored_name,
        "original_filename": filename,
        "file_size": len(content),
    }


@router.get("/youtube/ultimate-scrape")
async def youtube_ultimate_scrape(
    target: str = Query(..., description="YouTube channel handle, channel ID, vanity URL, or video URL/ID"),
    limit: int = Query(30, ge=1, le=100, description="Max videos to parse"),
    use_tor: bool = Query(False, description="Route request through Tor SOCKS5 proxy"),
):
    """Scrapes YouTube channel dossier, video catalog, or single video with speech captions."""
    from app.recon.youtube_ultimate_scraper import scrape_youtube_channel_ultimate
    return await scrape_youtube_channel_ultimate(
        target=target,
        limit=limit,
        use_tor=use_tor,
    )


@router.get("/youtube/video-details")
async def youtube_video_details(
    video_id: str = Query(..., description="YouTube video ID or URL"),
    use_tor: bool = Query(False, description="Route request through Tor SOCKS5 proxy"),
):
    """Deep-dives into a single video: extracts full metadata, speech transcript, and entities."""
    from app.recon.youtube_ultimate_scraper import scrape_youtube_video_details
    return await scrape_youtube_video_details(
        video_id_or_url=video_id,
        use_tor=use_tor,
    )


@router.post("/youtube/attach-evidence")
async def youtube_attach_evidence(
    case_id: uuid.UUID,
    media_url: str,
    filename: str = "youtube_evidence.jpg",
    typology: str = "image",
    db: AsyncSession = Depends(get_db),
):
    """Downloads YouTube media (avatar, banner, video thumbnail) directly into the active case evidence vault."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(filename)[1] or ".jpg"
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.youtube.com/",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        r = await client.get(media_url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed downloading media from YouTube CDN")
        content = r.content

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology=typology,
        source_url=media_url,
        file_size=len(content),
        mime_type="image/jpeg" if ext.lower() in [".jpg", ".jpeg"] else "application/octet-stream",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="YouTubeUltimateScraper",
        action="file_looted_from_youtube",
        payload={
            "filename": filename,
            "source_url": media_url,
            "size": len(content),
        },
    )

    return {
        "status": "success",
        "file_id": str(file_id),
        "filename": safe_stored_name,
        "original_filename": filename,
        "file_size": len(content),
    }


# ---------------------------------------------------------------------------
# X (former Twitter) Ultimate Recon & Forensic Scraper
# ---------------------------------------------------------------------------

@router.get("/x/ultimate-scrape")
async def x_ultimate_scrape(
    target: str = Query(..., description="X / Twitter username (@handle), profile URL, or tweet URL/ID"),
    limit: int = Query(50, ge=1, le=100, description="Max tweets to ingest"),
    use_tor: bool = Query(False, description="Route request through Tor SOCKS5 proxy"),
):
    """Scrapes X / Twitter profile dossier, timeline tweets, bot analysis, and entities."""
    from app.recon.x_twitter_ultimate_scraper import scrape_x_profile_ultimate
    return await scrape_x_profile_ultimate(
        username_or_url=target,
        limit=limit,
        use_tor=use_tor,
    )


@router.get("/x/tweet-details")
async def x_tweet_details(
    tweet_id: str = Query(..., description="X / Twitter tweet ID or status URL"),
    use_tor: bool = Query(False, description="Route request through Tor SOCKS5 proxy"),
):
    """Deep-dives into a single tweet: author, metrics, media attachments, and entities."""
    from app.recon.x_twitter_ultimate_scraper import scrape_x_tweet_details
    return await scrape_x_tweet_details(
        tweet_id_or_url=tweet_id,
        use_tor=use_tor,
    )


@router.post("/x/attach-evidence")
async def x_attach_evidence(
    case_id: uuid.UUID,
    media_url: str,
    filename: str = "x_evidence.jpg",
    typology: str = "image",
    db: AsyncSession = Depends(get_db),
):
    """Downloads X / Twitter media (avatar, banner, tweet photos) into active case evidence vault."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(filename)[1] or ".jpg"
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://x.com/",
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        r = await client.get(media_url)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed downloading media from X / Twitter CDN")
        content = r.content

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology=typology,
        source_url=media_url,
        file_size=len(content),
        mime_type="image/jpeg" if ext.lower() in [".jpg", ".jpeg"] else "application/octet-stream",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="XUltimateScraper",
        action="file_looted_from_x",
        payload={
            "filename": filename,
            "source_url": media_url,
            "size": len(content),
        },
    )

    return {
        "status": "success",
        "file_id": str(file_id),
        "filename": safe_stored_name,
        "original_filename": filename,
        "file_size": len(content),
    }


# ---------------------------------------------------------------------------
# Social Media Analytics & Monitoring Engine
# ---------------------------------------------------------------------------

@router.get("/social-analytics/analyze")
async def social_analytics_analyze(
    target: str,
    query_type: str = "keyword",
    limit: int = 50,
    use_tor: bool = False,
):
    """Executes multi-platform stream discovery, sentiment radar, threat levels, and posting cadence analytics."""
    from app.recon.social_analytics import run_social_media_analytics
    return await run_social_media_analytics(
        target=target,
        query_type=query_type,
        limit=limit,
        use_tor=use_tor,
    )


@router.get("/social-analytics/tools")
async def social_analytics_tools():
    """Returns curated Social Media Monitoring & Analytics platforms (Hootsuite, Buffer, Brandwatch, Audiense)."""
    from app.recon.social_analytics import MONITORING_PLATFORMS
    return {"tools": MONITORING_PLATFORMS}


@router.post("/social-analytics/attach-evidence")
async def social_analytics_attach_evidence(
    case_id: uuid.UUID,
    target: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Attaches a full social media analytics forensic report to the active case file vault."""
    from app.models.case import Case, CaseFile
    from app.case.incident import log_action

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    storage_dir = "/data/case_files"
    os.makedirs(storage_dir, exist_ok=True)

    file_id = uuid.uuid4()
    filename = f"social_analytics_{re.sub(r'[^a-zA-Z0-9_-]', '_', target)}.json"
    safe_stored_name = f"{case_id}_{file_id}.json"
    dest_path = os.path.join(storage_dir, safe_stored_name)

    import json
    content_str = json.dumps(payload, indent=2, ensure_ascii=False)
    content_bytes = content_str.encode("utf-8")

    with open(dest_path, "wb") as f:
        f.write(content_bytes)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=filename,
        typology="document",
        source_url=f"internal://social-analytics/{target}",
        file_size=len(content_bytes),
        mime_type="application/json",
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="SocialMediaAnalytics",
        action="analytics_dossier_vaulted",
        payload={
            "target": target,
            "filename": filename,
            "total_mentions": payload.get("total_mentions", 0),
            "threat_level": payload.get("threat_level", "ROUTINE"),
        },
    )


# ============================================================================
# DIGITAL IMAGE FORENSICS (Forensically & Forensic Image Analysis Toolkit)
# ============================================================================

import base64
from app.recon.forensic_image import (
    perform_ela,
    detect_clones,
    generate_noise_map,
    analyze_luminance_gradient,
    detect_jpeg_ghost,
    detect_resampling,
    detect_steganography_lsb,
    compute_hashes,
    compute_hamming_distance,
    extract_exif_forensics,
    run_full_forensic_analysis,
)


class ForensicAnalyzeRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    use_tor: bool = False


class ForensicElaRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    quality: int = 95
    error_scale: float = 10.0
    overlay_opacity: float = 0.5
    use_tor: bool = False


class ForensicCloneRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    block_size: int = 16
    threshold: float = 0.96
    min_distance: int = 40
    use_tor: bool = False


class ForensicCompareRequest(BaseModel):
    image1_base64: Optional[str] = None
    image2_base64: Optional[str] = None
    image1_url: Optional[str] = None
    image2_url: Optional[str] = None
    use_tor: bool = False


async def _resolve_image_bytes(
    image_url: Optional[str] = None,
    image_base64: Optional[str] = None,
    use_tor: bool = False,
) -> bytes:
    """Helper to resolve image bytes from either Base64 or remote URL."""
    if image_base64:
        # Strip data URL header if present (e.g. data:image/png;base64,...)
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        return base64.b64decode(image_base64)

    if image_url:
        proxies = "socks5://127.0.0.1:9050" if use_tor else None
        async with httpx.AsyncClient(proxy=proxies, timeout=25.0, verify=False) as client:
            resp = await client.get(image_url)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch image from URL: HTTP {resp.status_code}",
                )
            return resp.content

    raise HTTPException(
        status_code=400,
        detail="Either image_url or image_base64 must be provided.",
    )


@router.post("/image-forensics/upload")
async def forensic_image_upload(file: UploadFile = File(...)):
    """Accepts an uploaded image file and runs complete digital image forensics analysis."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    result = await run_in_threadpool(run_full_forensic_analysis, content)
    # Include original image data URL so frontend can display side-by-side
    b64_orig = base64.b64encode(content).decode("utf-8")
    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "jpeg"
    mime = "image/png" if ext == "png" else "image/jpeg"
    result["original_image"] = f"data:{mime};base64,{b64_orig}"
    result["filename"] = file.filename
    result["file_size"] = len(content)
    return result


@router.post("/image-forensics/analyze")
async def forensic_image_analyze(req: ForensicAnalyzeRequest):
    """Runs complete digital image forensics on an image URL or Base64 string."""
    image_bytes = await _resolve_image_bytes(req.image_url, req.image_base64, req.use_tor)
    result = await run_in_threadpool(run_full_forensic_analysis, image_bytes)

    b64_orig = base64.b64encode(image_bytes).decode("utf-8")
    result["original_image"] = f"data:image/jpeg;base64,{b64_orig}"
    result["file_size"] = len(image_bytes)
    return result


@router.post("/image-forensics/ela")
async def forensic_image_ela(req: ForensicElaRequest):
    """Dynamic Error Level Analysis with customizable quality, error scaling, and opacity."""
    image_bytes = await _resolve_image_bytes(req.image_url, req.image_base64, req.use_tor)
    return await run_in_threadpool(
        perform_ela,
        image_bytes,
        req.quality,
        req.error_scale,
        req.overlay_opacity,
    )


@router.post("/image-forensics/clones")
async def forensic_image_clones(req: ForensicCloneRequest):
    """Dynamic Copy-Move Forgery / Clone detection with customizable sensitivity thresholds."""
    image_bytes = await _resolve_image_bytes(req.image_url, req.image_base64, req.use_tor)
    return await run_in_threadpool(
        detect_clones,
        image_bytes,
        req.block_size,
        req.threshold,
        req.min_distance,
    )


@router.post("/image-forensics/compare")
async def forensic_image_compare(req: ForensicCompareRequest):
    """Compares two images using cryptographic and perceptual hashes (Hamming distance)."""
    bytes1 = await _resolve_image_bytes(req.image1_url, req.image1_base64, req.use_tor)
    bytes2 = await _resolve_image_bytes(req.image2_url, req.image2_base64, req.use_tor)

    hashes1 = await run_in_threadpool(compute_hashes, bytes1)
    hashes2 = await run_in_threadpool(compute_hashes, bytes2)

    p_dist = compute_hamming_distance(
        hashes1["perceptual"]["phash"],
        hashes2["perceptual"]["phash"],
    )
    a_dist = compute_hamming_distance(
        hashes1["perceptual"]["ahash"],
        hashes2["perceptual"]["ahash"],
    )
    d_dist = compute_hamming_distance(
        hashes1["perceptual"]["dhash"],
        hashes2["perceptual"]["dhash"],
    )

    is_identical = hashes1["cryptographic"]["sha256"] == hashes2["cryptographic"]["sha256"]
    is_perceptual_match = p_dist <= 10  # 10 bit flips out of 64 indicates near identical/rescaled

    return {
        "status": "success",
        "is_exact_match": is_identical,
        "is_perceptual_match": is_perceptual_match,
        "phash_distance": p_dist,
        "ahash_distance": a_dist,
        "dhash_distance": d_dist,
        "image1_hashes": hashes1,
        "image2_hashes": hashes2,
    }


# ---------------------------------------------------------------------------
# OSIRIS — Real-time Global Intelligence & Reconnaissance Engine
# ---------------------------------------------------------------------------
from app.recon.osiris_intel import (
    fetch_earthquakes as osiris_fetch_earthquakes,
    fetch_active_fires as osiris_fetch_active_fires,
    fetch_conflict_zones as osiris_fetch_conflict_zones,
    fetch_live_news_streams as osiris_fetch_live_news,
    fetch_cctv_directory as osiris_fetch_cctv,
    fetch_space_weather as osiris_fetch_space_weather,
    fetch_defense_markets as osiris_fetch_defense_markets,
    search_ofac_sanctions as osiris_search_sanctions,
    fetch_osiris_summary as osiris_fetch_summary,
)


@router.get("/osiris/earthquakes")
async def osiris_earthquakes(min_magnitude: float = 2.5):
    """OSIRIS: Real-time seismic events from USGS (M2.5+ with depth, magnitude, epicenter)."""
    return await osiris_fetch_earthquakes(min_magnitude=min_magnitude)


@router.get("/osiris/fires")
async def osiris_fires():
    """OSIRIS: Active wildfire and thermal anomalies from NASA FIRMS (VIIRS/MODIS) and EONET volcanoes."""
    return await osiris_fetch_active_fires()


@router.get("/osiris/conflicts")
async def osiris_conflicts():
    """OSIRIS: 13 active global conflict & war zones with frontlines, belligerents, and threat levels."""
    return await osiris_fetch_conflict_zones()


@router.get("/osiris/live-news")
async def osiris_live_news():
    """OSIRIS: 25+ live broadcast news streams with geolocation and embeddable live feeds."""
    return await osiris_fetch_live_news()


@router.get("/osiris/cctv")
async def osiris_cctv(region: str | None = None, limit: int = 150):
    """OSIRIS: Worldwide public traffic & CCTV surveillance directory with live snapshots."""
    return await osiris_fetch_cctv(region=region, limit=limit)


@router.get("/osiris/space-weather")
async def osiris_space_weather():
    """OSIRIS: Real-time NOAA SWPC planetary Kp-index, geomagnetic storm alerts, and solar flares."""
    return await osiris_fetch_space_weather()


@router.get("/osiris/defense-markets")
async def osiris_defense_markets():
    """OSIRIS: Defense aerospace equities, strategic energy, commodities, and maritime chokepoint alerts."""
    return await osiris_fetch_defense_markets()


@router.get("/osiris/sanctions")
async def osiris_sanctions(query: str, limit: int = 25):
    """OSIRIS: US OFAC SDN Sanctions lookup backed by OpenSanctions mirror."""
    return await osiris_search_sanctions(query=query, limit=limit)


@router.get("/osiris/summary")
async def osiris_summary():
    """OSIRIS: Aggregated real-time situational awareness metrics ticker."""
    return await osiris_fetch_summary()


# ---------------------------------------------------------------------------
# SOCMINT — Social Media Intelligence Routes
# Sources: SnapIntel (Kr0wZ), Snapchat-Checker (OSINT-Trace),
#          Social-Media-OSINT (The-Osint-Toolbox), OSINT-Tools-Library,
#          Social-Media-OSINT-Tools-CollectionNow (SENSEiXENUS)
# ---------------------------------------------------------------------------
from app.recon.socmint import (
    snap_profile as socmint_snap_profile,
    get_socmint_tool_directory as socmint_tool_dir,
)


@router.get("/socmint/snapchat")
async def socmint_snapchat_profile(username: str):
    """
    SOCMINT: Snapchat profile intelligence lookup.
    Adapted from SnapIntel (Kr0wZ/SnapIntel): fetches snapchat.com/add/{username}
    and parses __NEXT_DATA__ JSON to extract profile, stories, highlights, spotlights,
    lenses, subscriber count, Snapcode, Bitmoji and badge information.
    """
    return await socmint_snap_profile(username=username.strip())


@router.get("/socmint/tools")
async def socmint_tools_directory():
    """
    SOCMINT: Curated social media OSINT tool directory.
    Compiled from: Social-Media-OSINT (The-Osint-Toolbox),
    OSINT-Tools-Library (The-OSINT-Newsletter),
    Social-Media-OSINT-Tools-CollectionNow (SENSEiXENUS).
    Covers: Snapchat, Instagram, Twitter/X, Facebook, LinkedIn,
    Reddit, Telegram, YouTube, and multi-platform tools.
    """
    return socmint_tool_dir()
