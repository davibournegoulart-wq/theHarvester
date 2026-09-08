from fastapi import APIRouter

from app.checkers.email import check_email
from app.checkers.facebook_pivot import extract_facebook_id, marketplace_url_for_id
from app.checkers.phone import lookup_phone_metadata
from app.checkers.username import check_username
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
