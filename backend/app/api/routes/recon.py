from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.darkweb.monitor import search_dark_web
from app.recon.crypto_trace import trace_btc_wallet, trace_eth_wallet
from app.recon.domain import find_subdomains
from app.recon.dork_engine import DorkRequest, generate_dorks as generate_dork_engine_queries
from app.recon.dork_generator import generate_dorks
from app.recon.email_pattern import generate_permutations, verify_via_smtp
from app.recon.ip_reputation import lookup_ip
from app.recon.phone_mentions import generate_phone_mention_queries
from app.recon.reverse_image import generate_reverse_image_links
from app.recon.sanctions_check import search_sanctions

router = APIRouter(prefix="/recon", tags=["recon"])


@router.get("/domain/{domain}/subdomains")
async def domain_subdomains(domain: str):
    return await find_subdomains(domain)


@router.get("/domain/{domain}/dorks")
async def domain_dorks(domain: str):
    return generate_dorks(domain)


@router.get("/ip/{ip}")
async def ip_reputation(ip: str):
    return await lookup_ip(ip)


@router.get("/sanctions")
async def sanctions(q: str):
    return await search_sanctions(q)


@router.get("/crypto/btc/{address}")
async def crypto_btc(address: str):
    return await trace_btc_wallet(address)


@router.get("/crypto/eth/{address}")
async def crypto_eth(address: str):
    return await trace_eth_wallet(address)


@router.get("/email-pattern/{domain}")
async def email_pattern(domain: str, first_name: str, last_name: str):
    candidates = generate_permutations(first_name, last_name, domain)
    verified = [
        {"email": email, "smtp_accepted": await run_in_threadpool(verify_via_smtp, email)} for email in candidates
    ]
    return verified


@router.get("/darkweb")
async def darkweb_search(keyword: str):
    return await search_dark_web(keyword)


@router.get("/reverse-image")
async def reverse_image(image_url: str):
    return generate_reverse_image_links(image_url)


@router.get("/phone/{phone}/mentions")
async def phone_mentions(phone: str):
    return generate_phone_mention_queries(phone)


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
