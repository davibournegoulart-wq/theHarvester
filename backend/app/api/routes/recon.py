"""Rotas de reconhecimento — domínio, IP, crypto, dork, dark web, e novas capacidades.

Expandido (2026-09-09) com: TLS cert, web archive (CDX + availability),
cloud enum, corporate registry, document metadata, breach analytics,
Facebook breach, BSC e Polygon crypto trace.
"""

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
import httpx

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
    target: str
    target_type: str = "email"  # "email" or "domain"
    case_id: uuid.UUID

@router.post("/auto-recon")
async def trigger_auto_recon(body: AutoReconRequest, db: AsyncSession = Depends(get_db)):
    """Executes automated multi-engine reconnaissance and injects findings into case graph."""
    from app.recon.auto_recon import run_email_auto_recon, run_domain_auto_recon
    if body.target_type == "domain":
        return await run_domain_auto_recon(body.target, body.case_id, db)
    return await run_email_auto_recon(body.target, body.case_id, db)


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
