import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.identifier import IdentifierType
from app.api.routes.cases import SaveFindingRequest, save_finding_route

async def _save_finding(db: AsyncSession, case_id: uuid.UUID, id_type: IdentifierType, id_val: str, plat: str, url: str | None, disc_by: str, meta: dict = {}):
    req = SaveFindingRequest(
        identifier_type=id_type,
        identifier_value=id_val,
        platform=plat,
        url=url,
        exists=True,
        discovered_by=disc_by,
        metadata_json=meta
    )
    await save_finding_route(case_id, req, db)

async def run_email_auto_recon(email: str, case_id: uuid.UUID, db: AsyncSession):
    """Executa cross-correlation ativa a partir de um email."""
    
    from app.recon.email_registration import check_email_registrations
    from app.checkers.username import check_username
    from app.recon.breach_check import get_breach_analytics
    
    tasks = []
    results = {"email": email, "extracted_username": None, "holehe_sites": [], "social_accounts": [], "breaches": None}
    
    # 1. Holehe (Registros)
    holehe_task = asyncio.create_task(check_email_registrations(email))
    
    # 2. Breach Analytics
    breach_task = asyncio.create_task(get_breach_analytics(email))
    
    # 3. Extrair username e buscar
    username = email.split('@')[0]
    results["extracted_username"] = username
    
    # Executa Holehe e Breach primeiro
    try:
        holehe_res = await holehe_task
        results["holehe_sites"] = holehe_res["registered_sites"]
        for site in holehe_res["registered_sites"]:
            await _save_finding(db, case_id, IdentifierType.EMAIL, email, f"{site} (Account)", None, "auto_recon.holehe")
    except Exception as e:
        print(f"Holehe failed in auto-recon: {e}")
        
    try:
        breach_res = await breach_task
        results["breaches"] = breach_res
        if breach_res.get("breaches_found", 0) > 0:
            await _save_finding(db, case_id, IdentifierType.EMAIL, email, "Vazamentos (Breach)", None, "auto_recon.breach", {"breaches": breach_res})
    except Exception as e:
        print(f"Breach failed in auto-recon: {e}")
        
    # Busca social pelo username extraído
    try:
        social_res = await check_username(username)
        for acc in social_res:
            if acc["exists"]:
                results["social_accounts"].append(acc)
                await _save_finding(db, case_id, IdentifierType.USERNAME, username, acc["platform"], acc["url"], f"auto_recon.{acc['discovered_by']}")
    except Exception as e:
        print(f"Username check failed in auto-recon: {e}")
        
    return results
