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
from app.recon.ghost_track import trace_ip as run_ghost_ip_trace, parse_phone_intel as run_ghost_phone_intel
from app.recon.visual_geolocation import extract_pic2map_exif, predict_visual_geolocation
from app.recon.mail_access import run_mail_access_deep_recon
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
    """MailAccess: Multi-module deep email OSINT (Hudson Rock infostealers, EmailRep, M365 tenant, MX deliverability)."""
    return await run_mail_access_deep_recon(email, use_tor=use_tor)


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





