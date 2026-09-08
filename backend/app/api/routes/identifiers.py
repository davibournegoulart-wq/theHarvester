from fastapi import APIRouter, File, HTTPException, UploadFile

from app.checkers.email import check_email
from app.checkers.facebook_pivot import extract_facebook_id, marketplace_url_for_id
from app.checkers.google_account import lookup_gaia_profile
from app.checkers.gravatar import lookup_gravatar
from app.checkers.image_exif import extract_exif
from app.checkers.phone import lookup_phone_metadata
from app.checkers.social_id_pivot import extract_instagram_id, extract_tiktok_id
from app.checkers.username import check_username
from app.config import settings
from app.recon.breach_check import check_password_pwned

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
    return await extract_tiktok_id(username)


@router.post("/image/exif")
async def image_exif(file: UploadFile = File(...)):
    content = await file.read()
    try:
        return extract_exif(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível ler os metadados dessa imagem.")
