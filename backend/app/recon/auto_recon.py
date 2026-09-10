"""Automated Reconnaissance Pipeline (reconFTW + ReconSpider + SpiderFoot synthesis).
Orchestrates automated footprinting across multiple OSINT dimensions (Email, Domain, Username),
correlating findings and persisting positive results directly into the Case Graph.
"""

import asyncio
import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.identifier import IdentifierType
from app.api.routes.cases import SaveFindingRequest, save_finding_route


async def _save_finding(
    db: AsyncSession,
    case_id: uuid.UUID,
    id_type: IdentifierType,
    id_val: str,
    plat: str,
    url: str | None,
    disc_by: str,
    meta: dict = {},
):
    try:
        req = SaveFindingRequest(
            identifier_type=id_type,
            identifier_value=id_val,
            platform=plat,
            url=url,
            exists=True,
            discovered_by=disc_by,
            metadata_json=meta,
        )
        await save_finding_route(case_id, req, db)
    except Exception:
        pass


async def run_email_auto_recon(email: str, case_id: uuid.UUID, db: AsyncSession) -> dict[str, Any]:
    """Runs automated correlation starting from an email seed."""
    from app.recon.email_registration import check_email_registrations
    from app.checkers.username import check_username
    from app.recon.breach_check import get_breach_analytics

    results: dict[str, Any] = {
        "seed_type": "email",
        "target": email,
        "extracted_username": None,
        "holehe_sites": [],
        "social_accounts": [],
        "breaches": None,
    }

    holehe_task = asyncio.create_task(check_email_registrations(email))
    breach_task = asyncio.create_task(get_breach_analytics(email))

    username = email.split("@")[0]
    results["extracted_username"] = username

    # Holehe
    try:
        holehe_res = await holehe_task
        results["holehe_sites"] = holehe_res.get("registered_sites", [])
        for site in results["holehe_sites"]:
            await _save_finding(db, case_id, IdentifierType.EMAIL, email, f"{site} (Account)", None, "auto_recon.holehe")
    except Exception:
        pass

    # Breach
    try:
        breach_res = await breach_task
        results["breaches"] = breach_res
        if breach_res.get("breaches_found", 0) > 0:
            await _save_finding(db, case_id, IdentifierType.EMAIL, email, "Breached Credentials", None, "auto_recon.breach", {"breaches": breach_res})
    except Exception:
        pass

    # Username pivot
    try:
        social_res = await check_username(username)
        for acc in social_res:
            if acc.get("exists"):
                results["social_accounts"].append(acc)
                await _save_finding(db, case_id, IdentifierType.USERNAME, username, acc["platform"], acc.get("url"), f"auto_recon.{acc.get('discovered_by')}")
    except Exception:
        pass

    return results


async def run_domain_auto_recon(domain: str, case_id: uuid.UUID, db: AsyncSession) -> dict[str, Any]:
    """Runs automated domain footprinting (subdomains, DNS, visual headers, admin exposure)."""
    from app.recon.domain import find_subdomains
    from app.recon.visual_inspector import audit_web_visual_and_headers
    from app.recon.web_exposure import scan_web_exposure

    results: dict[str, Any] = {
        "seed_type": "domain",
        "target": domain,
        "subdomains": [],
        "visual_audit": None,
        "exposure": None,
    }

    sub_task = asyncio.create_task(find_subdomains(domain))
    vis_task = asyncio.create_task(audit_web_visual_and_headers(domain))
    exp_task = asyncio.create_task(scan_web_exposure(domain))

    try:
        sub_res = await sub_task
        sub_list = sub_res.get("subdomains", []) if isinstance(sub_res, dict) else []
        results["subdomains"] = sub_list
        for sub in sub_list[:15]:
            sub_name = sub.get("subdomain") if isinstance(sub, dict) else str(sub)
            await _save_finding(db, case_id, IdentifierType.DOMAIN, sub_name, "Subdomain", f"https://{sub_name}", "auto_recon.theHarvester")
    except Exception:
        pass

    try:
        vis_res = await vis_task
        results["visual_audit"] = vis_res
        if vis_res.get("server_banner") and vis_res["server_banner"] != "N/A":
            await _save_finding(db, case_id, IdentifierType.DOMAIN, domain, f"Server: {vis_res['server_banner']}", vis_res.get("final_url"), "auto_recon.eyewitness", {"technologies": vis_res.get("detected_technologies", [])})
    except Exception:
        pass

    try:
        exp_res = await exp_task
        results["exposure"] = exp_res
        for exp in exp_res.get("discovered", [])[:5]:
            if exp.get("is_accessible"):
                await _save_finding(db, case_id, IdentifierType.DOMAIN, domain, f"Open Path: {exp.get('path')}", exp.get("url"), "auto_recon.breacher", {"risk": exp.get("risk_level")})
    except Exception:
        pass

    return results
