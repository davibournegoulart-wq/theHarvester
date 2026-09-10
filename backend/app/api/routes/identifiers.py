from fastapi import APIRouter, File, HTTPException, UploadFile

from app.checkers.email import check_email
from app.checkers.facebook_pivot import extract_facebook_id, marketplace_url_for_id
from app.checkers.google_account import lookup_gaia_profile
from app.checkers.gravatar import lookup_gravatar
from app.checkers.image_exif import extract_exif
from app.checkers.phone import (
    check_phone_existence,
    check_telegram_existence,
    check_whatsapp_existence,
    lookup_phone_metadata,
)
from app.checkers.social_id_pivot import extract_instagram_id, extract_tiktok_id
from app.checkers.username import check_username
from app.config import settings
from app.recon.breach_check import check_email_breaches, check_password_pwned

router = APIRouter(prefix="/identifiers", tags=["identifiers"])


@router.get("/username/{username}")
async def username_lookup(username: str):
    results = await check_username(username)
    return {"username": username, "accounts": results}


@router.get("/email/{email}")
async def email_lookup(email: str):
    results = await check_email(email)
    return {"email": email, "services": results}


@router.get("/breach/password")
async def password_breach(password: str):
    result = await check_password_pwned(password)
    return result


@router.get("/breach/email")
async def email_breach(email: str):
    return await check_email_breaches(email)


@router.get("/phone/metadata")
async def phone_metadata(phone: str, default_region: str | None = None):
    return lookup_phone_metadata(phone, default_region)


@router.get("/facebook/pivot")
async def facebook_pivot(profile_url: str):
    facebook_id = await extract_facebook_id(profile_url)
    if facebook_id is None:
        return {"facebook_id": None, "marketplace_url": None}
    return {"facebook_id": facebook_id, "marketplace_url": marketplace_url_for_id(facebook_id)}


@router.get("/google-account/{email}")
async def google_account_lookup(email: str):
    """Usa a sessão Google configurada em `NETSCRAPER_GOOGLE_SESSION_COOKIES`
    (env var do servidor, nunca enviada pelo frontend) — ver checkers/google_account.py."""
    if not settings.google_session_cookies:
        raise HTTPException(
            status_code=503,
            detail="NETSCRAPER_GOOGLE_SESSION_COOKIES não configurado no servidor. "
            "Copie os cookies da sua própria sessão Google logada (DevTools > Application > "
            "Cookies > google.com, mínimo SAPISID) e configure como JSON nessa env var.",
        )
    return await lookup_gaia_profile(email, settings.google_session_cookies)


@router.get("/gravatar/{email}")
async def gravatar_lookup(email: str):
    return await lookup_gravatar(email)


@router.get("/social-id/instagram/{username}")
async def instagram_id_pivot(username: str):
    return await extract_instagram_id(username)


@router.get("/social-id/tiktok/{username}")
async def tiktok_id_pivot(username: str):
    from app.recon.tiktok_recon import scrape_tiktok_profile
    return await scrape_tiktok_profile(username)


@router.get("/tiktok/profile/{username}")
async def tiktok_profile_endpoint(username: str):
    from app.recon.tiktok_recon import scrape_tiktok_profile
    return await scrape_tiktok_profile(username)


@router.get("/tiktok/video")
async def tiktok_video_endpoint(url_or_id: str):
    from app.recon.tiktok_recon import scrape_tiktok_video
    return await scrape_tiktok_video(url_or_id)


@router.get("/social-id/facebook-marketplace/{seller_id}")
async def facebook_marketplace_recon(seller_id: str):
    from app.recon.facebook_marketplace import scrape_marketplace_seller
    try:
        return await scrape_marketplace_seller(seller_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/social-id/facebook-relations/{user_id}")
async def facebook_relations_recon(user_id: str, relation_type: str = "friends"):
    from app.recon.facebook_relations import scrape_facebook_relations
    try:
        return await scrape_facebook_relations(user_id, relation_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/image/exif")
async def image_exif(file: UploadFile = File(...)):
    content = await file.read()
    try:
        return extract_exif(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível ler os metadados dessa imagem.")


@router.get("/phone/existence")
async def phone_existence(phone: str, default_region: str = "BR"):
    """Checa existência de telefone em plataformas via login/registro."""
    results = await check_phone_existence(phone, default_region)
    return {"phone": phone, "platforms": results}


@router.get("/phone/whatsapp")
async def phone_whatsapp(phone: str):
    """Checa se o número existe no WhatsApp."""
    result = await check_whatsapp_existence(phone)
    return result


@router.get("/phone/telegram")
async def phone_telegram(phone: str):
    """Checa se o número existe no Telegram."""
    result = await check_telegram_existence(phone)
    return result


@router.get("/telegram/deep")
async def telegram_deep_lookup(username: str):
    """Deep scrape of a Telegram channel/user/group directly without external API keys."""
    from app.recon.telegram_deep import scrape_telegram_target
    profile = await scrape_telegram_target(username)
    return {
        "username": profile.username,
        "title": profile.title,
        "description": profile.description,
        "avatar_url": profile.avatar_url,
        "subscribers": profile.subscribers,
        "is_verified": profile.is_verified,
        "is_channel_or_group": profile.is_channel_or_group,
        "tme_url": profile.tme_url,
        "recent_posts": [{"text": p.text} for p in profile.recent_posts],
        "tgstat_info": profile.tgstat_info,
        "lyzem_results": profile.lyzem_results,
    }


@router.get("/flights/military")
async def flights_military_tracking():
    """Live global military aircraft feed via ADS-B open transponder data."""
    from app.recon.flight_tracking import track_military_aircraft
    res = await track_military_aircraft()
    return {
        "query": res.query,
        "total_found": res.total_found,
        "aircraft": [
            {
                "hex": a.hex_code,
                "flight": a.flight,
                "registration": a.registration,
                "type": a.aircraft_type,
                "altitude": a.alt_baro,
                "speed": a.ground_speed,
                "lat": a.lat,
                "lon": a.lon,
                "track": a.track,
                "category": a.category,
            }
            for a in res.aircraft
        ],
    }


@router.get("/flights/search")
async def flights_search(identifier: str):
    """Search live flights by Callsign, Hex code or tail registration."""
    from app.recon.flight_tracking import search_aircraft_by_callsign_or_hex
    res = await search_aircraft_by_callsign_or_hex(identifier)
    return {
        "query": res.query,
        "total_found": res.total_found,
        "aircraft": [
            {
                "hex": a.hex_code,
                "flight": a.flight,
                "registration": a.registration,
                "type": a.aircraft_type,
                "altitude": a.alt_baro,
                "speed": a.ground_speed,
                "lat": a.lat,
                "lon": a.lon,
                "track": a.track,
                "category": a.category,
            }
            for a in res.aircraft
        ],
    }


@router.get("/instagram/profile/{username}")
async def instagram_profile_lookup(username: str):
    """Inspect Instagram profile ID and public endpoints."""
    from app.checkers.social_id_pivot import extract_instagram_id
    res = await extract_instagram_id(username)
    return {
        "username": username,
        "profile_id": res.user_id,
        "url": f"https://www.instagram.com/{username}/",
        "has_id": res.user_id is not None,
    }


# --- SHIM ENDPOINTS FOR FRONTEND TOOLS ---

@router.get("/domain/recon")
async def domain_recon_shim(domain: str):
    import urllib.parse
    if not domain.startswith("http"):
        domain = "http://" + domain
    parsed = urllib.parse.urlparse(domain)
    domain = parsed.netloc or parsed.path
    domain = domain.split(":")[0] # remove port if any

    import dns.resolver
    from app.recon.domain import find_subdomains
    subdomains_raw = await find_subdomains(domain)
    subdomains = []
    for s in subdomains_raw:
        subdomains.append({"subdomain": s.subdomain, "ip": "unknown"}) # dns resolving omitted for speed, or can be done
    
    dns_records = []
    for rtype in ["A", "MX", "TXT", "NS"]:
        try:
            answers = dns.resolver.resolve(domain, rtype)
            for rdata in answers:
                dns_records.append({"type": rtype, "value": rdata.to_text()})
        except Exception:
            pass
            
    return {"dns_records": dns_records, "subdomains": subdomains}

@router.get("/corporate/global")
async def corporate_global_search(query: str):
    from app.recon.corporate_registry import search_corporate_registries
    res = await search_corporate_registries(query)
    return {
        "query": query,
        "sec_filings": [
            {
                "company_name": f.company_name,
                "cik": f.identifier,
                "filing_date": f.filing_date,
                "form_type": f.form_type,
                "url": f.url,
            }
            for f in res.sec_filings
        ],
        "uk_companies": [
            {
                "name": c.name,
                "company_number": c.identifier,
                "status": c.status,
                "registration_date": c.registration_date,
                "address": c.extra.get("address", {}),
            }
            for c in res.uk_companies
        ],
        "offshore_leaks": [
            {
                "name": o.name,
                "source_dataset": o.source_dataset,
                "url": o.url,
            }
            for o in res.offshore_leaks
        ],
    }

@router.get("/corporate/cnpj")
async def corporate_cnpj_shim(cnpj: str):
    from app.recon.corporate_registry import search_corporate_registries
    res = await search_corporate_registries("", cnpj)
    for c in res.br_companies:
        if c.identifier == cnpj.replace(".", "").replace("/", "").replace("-", ""):
            return {
                "cnpj": c.identifier,
                "name": c.name,
                "trade_name": c.trade_name or c.name,
                "status": c.status or "unknown",
                "founded": c.registration_date or "unknown",
                "capital": float(c.extra.get("capital_social") or 0.0),
                "address": "Brazil",
                "cnae_main": c.extra.get("atividade_principal", [{}])[0].get("text", "unknown") if c.extra.get("atividade_principal") else "unknown",
                "contact_phone": None,
                "contact_email": None,
                "partners": []
            }
    raise HTTPException(status_code=404, detail="CNPJ not found in BrasilAPI/ReceitaWS")

@router.get("/crypto/address")
async def crypto_address_shim(currency: str, address: str):
    from app.recon.crypto_trace import trace_btc_wallet, trace_eth_wallet
    if currency.upper() == "BTC":
        res = await trace_btc_wallet(address)
    else:
        res = await trace_eth_wallet(address)
    
    return {
        "currency": currency.upper(),
        "address": res.address,
        "balance": res.balance,
        "total_received": 0.0,
        "total_sent": 0.0,
        "tx_count": res.tx_count
    }
