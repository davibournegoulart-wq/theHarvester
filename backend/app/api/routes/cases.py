import hashlib
import io
import json
import logging
import os
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.case.incident import archive_case, create_case, log_action
from app.db import get_db
from app.models.case import AuditLogEntry, Case, CaseFile, CaseGeolocation, CaseStatus
from app.models.correlation import Correlation
from app.models.identifier import Account, Identifier, IdentifierType

from app.report.export import accounts_by_discovery_source, accounts_by_platform

logger = logging.getLogger("net_scraper")

router = APIRouter(prefix="/cases", tags=["cases"])


class SaveFindingRequest(BaseModel):
    identifier_type: IdentifierType
    identifier_value: str
    platform: str
    url: str | None = None
    exists: bool = True
    discovered_by: str
    metadata_json: dict = {}


class SaveEvidenceRequest(BaseModel):
    url: str
    note: str | None = None
    archived_url: str | None = None
    target_node_id: str | None = None
    title: str | None = None


class MultiCaseGraphRequest(BaseModel):
    case_ids: list[uuid.UUID]


async def hard_delete_case_internal(case_id: uuid.UUID, db: AsyncSession):
    """Permanently delete a case and all associated files, geolocations, accounts, and audit entries."""
    case = await db.get(Case, case_id)
    if not case:
        return

    # 1. Clean up physical files from disk for all case files
    files_res = await db.execute(select(CaseFile).where(CaseFile.case_id == case_id))
    case_files = files_res.scalars().all()
    for cf in case_files:
        if cf.storage_path and os.path.exists(cf.storage_path):
            try:
                os.remove(cf.storage_path)
            except OSError as e:
                logger.warning(f"Could not remove file on disk {cf.storage_path}: {e}")

    # 2. Delete CaseGeolocation records (reference case_files via attached_file_id)
    await db.execute(delete(CaseGeolocation).where(CaseGeolocation.case_id == case_id))

    # 3. Delete CaseFile records
    await db.execute(delete(CaseFile).where(CaseFile.case_id == case_id))

    # 4. Find all identifiers in this case
    identifiers_res = await db.execute(select(Identifier.id).where(Identifier.case_id == case_id))
    identifier_ids = identifiers_res.scalars().all()

    if identifier_ids:
        # Find all accounts under these identifiers
        accounts_res = await db.execute(select(Account.id).where(Account.identifier_id.in_(identifier_ids)))
        account_ids = accounts_res.scalars().all()

        if account_ids:
            # Delete any correlation graph edges referencing these accounts
            await db.execute(
                delete(Correlation).where(
                    or_(
                        Correlation.source_account_id.in_(account_ids),
                        Correlation.target_account_id.in_(account_ids),
                    )
                )
            )
            # Delete accounts
            await db.execute(delete(Account).where(Account.id.in_(account_ids)))

        # Delete identifiers
        await db.execute(delete(Identifier).where(Identifier.id.in_(identifier_ids)))

    # 5. Delete audit log entries
    await db.execute(delete(AuditLogEntry).where(AuditLogEntry.case_id == case_id))

    # 6. Delete the case itself and commit
    await db.delete(case)
    await db.commit()


async def auto_purge_expired_trash(db: AsyncSession):
    """Auto-purge cases that have stayed in the trash bin for more than 30 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    res = await db.execute(
        select(Case.id).where(
            Case.deleted_at.is_not(None),
            Case.deleted_at < cutoff
        )
    )
    expired_ids = res.scalars().all()
    for cid in expired_ids:
        try:
            await hard_delete_case_internal(cid, db)
            logger.info(f"Auto-purged expired case {cid} past 30-day retention.")
        except Exception as e:
            logger.error(f"Error auto-purging expired case {cid}: {e}")


@router.get("/")
async def list_cases_route(db: AsyncSession = Depends(get_db)):
    """List active investigations (excluding items in Trash Bin)."""
    await auto_purge_expired_trash(db)
    result = await db.execute(
        select(Case).where(Case.deleted_at.is_(None)).order_by(Case.created_at.desc())
    )
    return result.scalars().all()


@router.get("/trash")
async def list_trash_cases_route(db: AsyncSession = Depends(get_db)):
    """List cases currently in the Trash Bin with days remaining until permanent deletion."""
    await auto_purge_expired_trash(db)
    result = await db.execute(
        select(Case).where(Case.deleted_at.is_not(None)).order_by(Case.deleted_at.desc())
    )
    cases = result.scalars().all()
    now = datetime.now(timezone.utc)
    trash_items = []
    for c in cases:
        days_in_trash = (now - c.deleted_at).days if c.deleted_at else 0
        days_remaining = max(0, 30 - days_in_trash)
        trash_items.append({
            "id": str(c.id),
            "name": c.name,
            "status": c.status.value if hasattr(c.status, "value") else c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
            "days_remaining": days_remaining,
            "retention_days": 30,
        })
    return trash_items


@router.post("/trash/empty")
async def empty_trash_route(db: AsyncSession = Depends(get_db)):
    """Permanently purge all cases currently in the Trash Bin."""
    res = await db.execute(select(Case.id).where(Case.deleted_at.is_not(None)))
    trashed_ids = res.scalars().all()
    count = 0
    for cid in trashed_ids:
        await hard_delete_case_internal(cid, db)
        count += 1
    return {"status": "emptied", "purged_count": count}


@router.post("/")
async def create_case_route(name: str, db: AsyncSession = Depends(get_db)):
    case = await create_case(db, name)
    return case


@router.get("/{case_id}")
async def get_case_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("/{case_id}/audit-log")
async def get_case_audit_log_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AuditLogEntry).where(AuditLogEntry.case_id == case_id).order_by(AuditLogEntry.created_at)
    )
    return result.scalars().all()


@router.patch("/{case_id}/status")
async def update_case_status_route(case_id: uuid.UUID, status: CaseStatus, actor: str, db: AsyncSession = Depends(get_db)):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    case.status = status
    await db.commit()
    await log_action(db, case.id, actor=actor, action=f"case_status_{status.value}")
    return case

@router.patch("/{case_id}/name")
async def update_case_name_route(case_id: uuid.UUID, name: str, actor: str, db: AsyncSession = Depends(get_db)):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    case.name = name
    await db.commit()
    await log_action(db, case.id, actor=actor, action=f"case_renamed", payload={"new_name": name})
    return case


@router.post("/{case_id}/merge")
async def merge_cases_route(case_id: uuid.UUID, source_case_id: uuid.UUID, actor: str = "investigator", db: AsyncSession = Depends(get_db)):
    """Merge source_case into target case (case_id).
    Moves all Identifiers and AuditLogEntries from source to target,
    logs the merge action, and archives the source case.
    """
    if case_id == source_case_id:
        raise HTTPException(status_code=400, detail="Cannot merge a case into itself")

    target_case = await db.get(Case, case_id)
    if target_case is None:
        raise HTTPException(status_code=404, detail="Target case not found")

    source_case = await db.get(Case, source_case_id)
    if source_case is None:
        raise HTTPException(status_code=404, detail="Source case not found")

    # Move identifiers
    from sqlalchemy import update
    await db.execute(
        update(Identifier).where(Identifier.case_id == source_case_id).values(case_id=case_id)
    )

    # Move audit log entries
    await db.execute(
        update(AuditLogEntry).where(AuditLogEntry.case_id == source_case_id).values(case_id=case_id)
    )

    # Log the merge event on the target case
    await log_action(
        db,
        case_id,
        actor=actor,
        action="case_merged",
        payload={
            "merged_from_id": str(source_case_id),
            "merged_from_name": source_case.name,
        },
    )

    # Archive the source case
    source_case.status = CaseStatus.ARCHIVED
    source_case.name = f"{source_case.name} (Merged into {target_case.name})"
    await db.commit()

    return {
        "status": "success",
        "target_case_id": str(case_id),
        "merged_source_id": str(source_case_id),
        "message": f"Successfully merged '{source_case.name}' into '{target_case.name}'",
    }


@router.delete("/{case_id}")
async def delete_case_route(
    case_id: uuid.UUID,
    permanent: bool = False,
    actor: str = "investigator",
    db: AsyncSession = Depends(get_db)
):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if permanent:
        await hard_delete_case_internal(case_id, db)
        return {"status": "permanently_deleted", "id": str(case_id)}
    else:
        case.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        await log_action(
            db,
            case_id,
            actor=actor,
            action="case_moved_to_trash",
            payload={"case_name": case.name, "retention_days": 30}
        )
        return {"status": "trashed", "id": str(case_id), "retention_days": 30}


@router.post("/{case_id}/restore")
async def restore_case_route(case_id: uuid.UUID, actor: str = "investigator", db: AsyncSession = Depends(get_db)):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.deleted_at is None:
        return {"status": "not_in_trash", "id": str(case_id), "name": case.name}

    case.deleted_at = None
    await db.commit()
    await log_action(db, case.id, actor=actor, action="case_restored_from_trash", payload={"case_name": case.name})
    return {"status": "restored", "id": str(case_id), "name": case.name}


@router.get("/{case_id}/export-zip")
async def export_case_zip_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Export complete case dossier, evidence, reports, STIX 2.1 bundle and raw files into a ZIP archive."""
    from app.report.stix_export import generate_stix_bundle

    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    # Gather all case data
    idents_res = await db.execute(select(Identifier).where(Identifier.case_id == case_id))
    identifiers = idents_res.scalars().all()

    accs_res = await db.execute(select(Account).join(Identifier).where(Identifier.case_id == case_id))
    accounts = accs_res.scalars().all()

    logs_res = await db.execute(select(AuditLogEntry).where(AuditLogEntry.case_id == case_id).order_by(AuditLogEntry.created_at.asc()))
    audit_log = logs_res.scalars().all()

    geos_res = await db.execute(select(CaseGeolocation).where(CaseGeolocation.case_id == case_id).order_by(CaseGeolocation.created_at.asc()))
    geolocations = geos_res.scalars().all()

    files_res = await db.execute(select(CaseFile).where(CaseFile.case_id == case_id).order_by(CaseFile.created_at.asc()))
    case_files = files_res.scalars().all()

    # Generate STIX bundle
    stix_bundle = generate_stix_bundle(case, identifiers, accounts, audit_log)

    safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in case.name)
    timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Build Markdown dossier report
    report_md = f"""# OSINT Investigation Dossier: {case.name}
**Export Date**: {timestamp_str}
**Case ID**: `{case.id}`
**Status**: {case.status.value if hasattr(case.status, 'value') else case.status}
**Created At**: {case.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if case.created_at else "N/A"}

---

## 1. Executive Summary
This archive contains the forensic intelligence dossier, target profiles, audit trail, and raw evidentiary artifacts collected for **{case.name}**.

- **Total Identifiers Investigated**: {len(identifiers)}
- **Discovered Accounts/Platforms**: {len(accounts)}
- **Geointelligence Pinpoints**: {len(geolocations)}
- **Forensic Assets / Databank Files**: {len(case_files)}
- **Audit Log Operations**: {len(audit_log)}

---

## 2. Target Identifiers & Discovered Profiles
"""
    for ident in identifiers:
        report_md += f"\n### Target: `{ident.value}` ({ident.type.value if hasattr(ident.type, 'value') else ident.type})\n"
        linked_accounts = [a for a in accounts if a.identifier_id == ident.id]
        if not linked_accounts:
            report_md += "_No active accounts discovered for this identifier._\n"
        else:
            report_md += "| Platform | URL | Discovered By | Verified Active |\n"
            report_md += "|---|---|---|---|\n"
            for acc in linked_accounts:
                report_md += f"| {acc.platform} | {acc.url or 'N/A'} | {acc.discovered_by} | {'Yes' if acc.exists else 'No'} |\n"

    report_md += "\n---\n\n## 3. Geointelligence & Location Tracing\n"
    if not geolocations:
        report_md += "_No geolocations recorded._\n"
    else:
        report_md += "| Label | Latitude | Longitude | Source | Description |\n"
        report_md += "|---|---|---|---|---|\n"
        for geo in geolocations:
            report_md += f"| {geo.label} | {geo.latitude:.6f} | {geo.longitude:.6f} | {geo.source} | {geo.description or 'N/A'} |\n"

    report_md += "\n---\n\n## 4. Forensic Databank Assets\n"
    if not case_files:
        report_md += "_No files attached to case._\n"
    else:
        report_md += "| Filename | Typology | Size | Source URL |\n"
        report_md += "|---|---|---|---|\n"
        for cf in case_files:
            report_md += f"| {cf.original_filename} | {cf.typology} | {cf.file_size} bytes | {cf.source_url or 'Local Upload'} |\n"

    report_md += "\n---\n\n## 5. Forensic Audit Trail (Immutable)\n"
    for log in audit_log:
        ts = log.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if log.created_at else "N/A"
        report_md += f"- **[{ts}]** `{log.actor}` executed `{log.action}`\n"

    # Build ZIP archive in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Report
        zf.writestr("dossier_report.md", report_md)

        # 2. Case Summary JSON
        case_summary = {
            "id": str(case.id),
            "name": case.name,
            "status": case.status.value if hasattr(case.status, 'value') else case.status,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "deleted_at": case.deleted_at.isoformat() if case.deleted_at else None,
            "export_timestamp": timestamp_str,
        }
        zf.writestr("case_summary.json", json.dumps(case_summary, indent=2))

        # 3. Identifiers and Accounts JSON
        idents_data = []
        for ident in identifiers:
            linked_accs = [
                {
                    "id": str(a.id),
                    "platform": a.platform,
                    "url": a.url,
                    "exists": a.exists,
                    "discovered_by": a.discovered_by,
                    "metadata": a.metadata_json,
                    "discovered_at": a.discovered_at.isoformat() if a.discovered_at else None,
                }
                for a in accounts if a.identifier_id == ident.id
            ]
            idents_data.append({
                "id": str(ident.id),
                "type": ident.type.value if hasattr(ident.type, 'value') else ident.type,
                "value": ident.value,
                "created_at": ident.created_at.isoformat() if ident.created_at else None,
                "accounts": linked_accs,
            })
        zf.writestr("identifiers_and_accounts.json", json.dumps(idents_data, indent=2))

        # 4. STIX 2.1 Bundle
        zf.writestr("stix2_bundle.json", json.dumps(stix_bundle, indent=2))

        # 5. Audit Trail JSON
        audit_data = [
            {
                "id": str(l.id),
                "actor": l.actor,
                "action": l.action,
                "payload": l.payload,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in audit_log
        ]
        zf.writestr("audit_trail.json", json.dumps(audit_data, indent=2))

        # 6. Geolocations JSON
        geos_data = [
            {
                "id": str(g.id),
                "latitude": g.latitude,
                "longitude": g.longitude,
                "label": g.label,
                "description": g.description,
                "source": g.source,
                "source_url": g.source_url,
                "attached_file_id": str(g.attached_file_id) if g.attached_file_id else None,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g in geolocations
        ]
        zf.writestr("geolocations.json", json.dumps(geos_data, indent=2))

        # 7. Files and Manifest
        manifest = []
        used_names = set()
        for idx, cf in enumerate(case_files):
            file_hash = None
            raw_content = None
            if cf.storage_path and os.path.exists(cf.storage_path):
                try:
                    with open(cf.storage_path, "rb") as f_in:
                        raw_content = f_in.read()
                        file_hash = hashlib.sha256(raw_content).hexdigest()
                except Exception as e:
                    logger.warning(f"Could not read file {cf.storage_path} for zip export: {e}")

            clean_filename = os.path.basename(cf.original_filename or f"file_{idx}")
            clean_filename = "".join(c if c.isalnum() or c in (".", "-", "_") else "_" for c in clean_filename)
            if clean_filename in used_names:
                clean_filename = f"{idx:02d}_{clean_filename}"
            used_names.add(clean_filename)

            zip_file_path = f"files/{clean_filename}"
            if raw_content is not None:
                zf.writestr(zip_file_path, raw_content)

            manifest.append({
                "id": str(cf.id),
                "original_filename": cf.original_filename,
                "zip_path": zip_file_path,
                "typology": cf.typology,
                "file_size": cf.file_size,
                "mime_type": cf.mime_type,
                "sha256": file_hash,
                "source_url": cf.source_url,
                "created_at": cf.created_at.isoformat() if cf.created_at else None,
            })

        zf.writestr("files_manifest.json", json.dumps(manifest, indent=2))

    zip_bytes = zip_buffer.getvalue()
    filename_header = f'attachment; filename="Case_{safe_name}_dossier.zip"'
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": filename_header,
            "Content-Length": str(len(zip_bytes)),
        },
    )


@router.get("/{case_id}/report")
async def get_case_report_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    result = await db.execute(
        select(Account).join(Identifier).where(Identifier.case_id == case_id)
    )
    accounts = result.scalars().all()

    return {
        "by_platform": accounts_by_platform(accounts),
        "by_discovery_source": accounts_by_discovery_source(accounts),
    }

@router.get("/{case_id}/stix")
async def get_case_stix_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.report.stix_export import generate_stix_bundle
    
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    idents_res = await db.execute(select(Identifier).where(Identifier.case_id == case_id))
    identifiers = idents_res.scalars().all()

    accs_res = await db.execute(select(Account).join(Identifier).where(Identifier.case_id == case_id))
    accounts = accs_res.scalars().all()

    logs_res = await db.execute(select(AuditLogEntry).where(AuditLogEntry.case_id == case_id))
    audit_log = logs_res.scalars().all()

    return generate_stix_bundle(case, identifiers, accounts, audit_log)


@router.post("/{case_id}/findings")
async def save_finding_route(case_id: uuid.UUID, body: SaveFindingRequest, db: AsyncSession = Depends(get_db)):
    """Anexa manualmente um achado de uma busca (username/email/telefone/etc.) a um caso.

    É o único jeito de um Identifier/Account nascer vinculado a um caso — as rotas de
    busca em identifiers.py são stateless por design (não gravam nada sozinhas), o
    investigador decide o que vira evidência oficial clicando "salvar no caso".
    """
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    result = await db.execute(
        select(Identifier).where(
            Identifier.case_id == case_id,
            Identifier.type == body.identifier_type,
            Identifier.value == body.identifier_value,
        )
    )
    identifier = result.scalar_one_or_none()
    if identifier is None:
        identifier = Identifier(case_id=case_id, type=body.identifier_type, value=body.identifier_value)
        db.add(identifier)
        await db.flush()

    result = await db.execute(
        select(Account).where(
            Account.identifier_id == identifier.id,
            Account.platform == body.platform,
            Account.url == body.url,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = Account(
            identifier_id=identifier.id,
            platform=body.platform,
            url=body.url,
            exists=body.exists,
            metadata_json=body.metadata_json,
            discovered_by=body.discovered_by,
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)
        await log_action(
            db,
            case_id,
            actor="investigador",
            action="finding_saved",
            payload={
                "identifier_type": body.identifier_type.value,
                "identifier_value": body.identifier_value,
                "platform": body.platform,
            },
        )
    return account


@router.post("/{case_id}/evidence")
async def save_evidence_route(case_id: uuid.UUID, body: SaveEvidenceRequest, db: AsyncSession = Depends(get_db)):
    """Preserva um link como evidência na trilha de auditoria imutável."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    payload = {
        "url": body.url,
        "note": body.note,
        "title": body.title,
        "target_node_id": body.target_node_id,
        "archived_url": body.archived_url,
    }

    return await log_action(
        db,
        case_id,
        actor="investigador",
        action="evidence_saved",
        payload=payload,
    )


# --- CASE FILE ATTACHMENTS & DATABANK STORAGE ---

STORAGE_DIR = os.environ.get("NETSCRAPER_DATA_DIR", "/app/data/databank")
os.makedirs(STORAGE_DIR, exist_ok=True)


@router.get("/{case_id}/files")
async def list_case_files(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """List all files in this case's databank."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    res = await db.execute(select(CaseFile).where(CaseFile.case_id == case_id).order_by(CaseFile.created_at.desc()))
    files = res.scalars().all()
    return [
        {
            "id": str(f.id),
            "case_id": str(f.case_id),
            "filename": f.filename,
            "original_filename": f.original_filename,
            "typology": f.typology,
            "file_size": f.file_size,
            "mime_type": f.mime_type,
            "source_url": f.source_url,
            "created_at": f.created_at.isoformat(),
        }
        for f in files
    ]


@router.post("/{case_id}/files/upload")
async def upload_case_file(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    typology: str = Form("document"),
    source_url: str | None = Form(None),
    target_node_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload any evidence document, image, or dork dump to case databank."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    file_id = uuid.uuid4()
    ext = os.path.splitext(file.filename or "")[1]
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(STORAGE_DIR, safe_stored_name)

    content = await file.read()
    file_size = len(content)

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    effective_source = source_url or (f"node:{target_node_id}" if target_node_id else None)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=file.filename or safe_stored_name,
        typology=typology,
        source_url=effective_source,
        file_size=file_size,
        mime_type=file.content_type,
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="investigador",
        action="file_uploaded",
        payload={
            "file_id": str(case_file.id),
            "filename": case_file.original_filename,
            "typology": typology,
            "size": file_size,
            "target_node_id": target_node_id,
        },
    )

    return {
        "id": str(case_file.id),
        "filename": case_file.filename,
        "original_filename": case_file.original_filename,
        "typology": case_file.typology,
        "file_size": case_file.file_size,
        "target_node_id": target_node_id,
        "created_at": case_file.created_at.isoformat(),
    }


@router.post("/{case_id}/files/download-remote")
async def download_remote_web_file(
    case_id: uuid.UUID,
    url: str,
    typology: str = "dork_dump",
    custom_name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Directly downloads and saves a web document (e.g. from Google Dorks results)
    into the local case databank so it is preserved even if removed from the original website.
    """
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=20.0) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            content = resp.content
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to download web file: {e}")

    file_id = uuid.uuid4()
    orig_name = custom_name or os.path.basename(url.split("?")[0]) or f"downloaded_{file_id}"
    ext = os.path.splitext(orig_name)[1]
    safe_stored_name = f"{case_id}_{file_id}{ext}"
    dest_path = os.path.join(STORAGE_DIR, safe_stored_name)

    with open(dest_path, "wb") as out_f:
        out_f.write(content)

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=orig_name,
        typology=typology,
        source_url=url,
        file_size=len(content),
        mime_type=resp.headers.get("content-type"),
        storage_path=dest_path,
    )
    db.add(case_file)
    await db.commit()
    await db.refresh(case_file)

    await log_action(
        db,
        case_id,
        actor="investigador",
        action="web_document_downloaded",
        payload={
            "filename": orig_name,
            "source_url": url,
            "typology": typology,
            "size": len(content),
        },
    )

    return {
        "id": str(case_file.id),
        "filename": case_file.filename,
        "original_filename": case_file.original_filename,
        "typology": case_file.typology,
        "source_url": case_file.source_url,
        "file_size": case_file.file_size,
    }


@router.get("/{case_id}/files/{file_id}/download")
async def download_case_file(case_id: uuid.UUID, file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Download an uploaded/saved file from databank storage."""
    res = await db.execute(select(CaseFile).where(CaseFile.id == file_id, CaseFile.case_id == case_id))
    case_file = res.scalar_one_or_none()
    if case_file is None or not os.path.exists(case_file.storage_path):
        raise HTTPException(status_code=404, detail="File not found on databank disk")

    return FileResponse(
        path=case_file.storage_path,
        filename=case_file.original_filename,
        media_type=case_file.mime_type or "application/octet-stream",
    )


@router.delete("/{case_id}/files/{file_id}")
async def delete_case_file(case_id: uuid.UUID, file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Completely delete file from databank and disk."""
    res = await db.execute(select(CaseFile).where(CaseFile.id == file_id, CaseFile.case_id == case_id))
    case_file = res.scalar_one_or_none()
    if case_file is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Detach any geolocations pointing to this file
    await db.execute(
        update(CaseGeolocation)
        .where(CaseGeolocation.attached_file_id == file_id)
        .values(attached_file_id=None)
    )

    # Completely remove physical file from disk
    if case_file.storage_path and os.path.exists(case_file.storage_path):
        try:
            os.remove(case_file.storage_path)
        except OSError as e:
            logger.warning(f"Could not remove physical file {case_file.storage_path}: {e}")

    await db.delete(case_file)
    await db.commit()
    return {"status": "deleted", "id": str(file_id)}


# ---------------------------------------------------------------------------
# Case Geointelligence & Tracing (Locations, Pinned Documents, Links)
# ---------------------------------------------------------------------------

class CreateGeolocationRequest(BaseModel):
    latitude: float
    longitude: float
    label: str
    description: str | None = None
    source: str = "manual"
    source_url: str | None = None
    attached_file_id: uuid.UUID | None = None


@router.get("/{case_id}/geolocations")
async def list_case_geolocations(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """List all geolocated pinpoints, tracks, and linked files for this case."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    res = await db.execute(
        select(CaseGeolocation)
        .where(CaseGeolocation.case_id == case_id)
        .order_by(CaseGeolocation.created_at.asc())
    )
    geos = res.scalars().all()
    results = []
    for g in geos:
        file_info = None
        if g.attached_file_id:
            f_res = await db.get(CaseFile, g.attached_file_id)
            if f_res:
                file_info = {
                    "id": str(f_res.id),
                    "filename": f_res.filename,
                    "original_filename": f_res.original_filename,
                    "typology": f_res.typology,
                    "size": f_res.file_size,
                }

        results.append({
            "id": str(g.id),
            "case_id": str(g.case_id),
            "latitude": g.latitude,
            "longitude": g.longitude,
            "label": g.label,
            "description": g.description,
            "source": g.source,
            "source_url": g.source_url,
            "attached_file_id": str(g.attached_file_id) if g.attached_file_id else None,
            "attached_file": file_info,
            "created_at": g.created_at.isoformat(),
        })
    return results


@router.post("/{case_id}/geolocations")
async def add_case_geolocation(
    case_id: uuid.UUID,
    body: CreateGeolocationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a new geographic coordinate, pinned document, or location tracing to the case."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    geo = CaseGeolocation(
        id=uuid.uuid4(),
        case_id=case_id,
        latitude=body.latitude,
        longitude=body.longitude,
        label=body.label,
        description=body.description,
        source=body.source,
        source_url=body.source_url,
        attached_file_id=body.attached_file_id,
    )
    db.add(geo)
    await db.commit()
    await db.refresh(geo)

    await log_action(
        db,
        case_id,
        actor="investigador",
        action="geolocation_pinned",
        payload={
            "label": geo.label,
            "latitude": geo.latitude,
            "longitude": geo.longitude,
            "source": geo.source,
            "attached_file_id": str(geo.attached_file_id) if geo.attached_file_id else None,
        },
    )

    return {
        "id": str(geo.id),
        "case_id": str(geo.case_id),
        "latitude": geo.latitude,
        "longitude": geo.longitude,
        "label": geo.label,
        "description": geo.description,
        "source": geo.source,
        "source_url": geo.source_url,
        "attached_file_id": str(geo.attached_file_id) if geo.attached_file_id else None,
        "created_at": geo.created_at.isoformat(),
    }


@router.delete("/{case_id}/geolocations/{geo_id}")
async def delete_case_geolocation(
    case_id: uuid.UUID,
    geo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a geolocation pin from the case."""
    res = await db.execute(
        select(CaseGeolocation).where(
            CaseGeolocation.id == geo_id,
            CaseGeolocation.case_id == case_id,
        )
    )
    geo = res.scalar_one_or_none()
    if geo is None:
        raise HTTPException(status_code=404, detail="Geolocation not found")

    await db.delete(geo)
    await db.commit()
    return {"status": "deleted", "id": str(geo_id)}


@router.delete("/{case_id}/geolocations")
async def clear_case_geolocations(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Clear all geolocations and map tracings for this case."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    await db.execute(delete(CaseGeolocation).where(CaseGeolocation.case_id == case_id))
    await db.commit()
    return {"status": "cleared", "case_id": str(case_id)}


@router.post("/custom-graph")
async def get_custom_multi_case_graph_route(body: MultiCaseGraphRequest, db: AsyncSession = Depends(get_db)):
    """Generates correlation graph for any chosen 2 or more cases."""
    from app.case.multi_case_graph import get_graph_elements_for_case_list
    from app.graph.engine import build_graph, compute_metrics, to_frontend_json, GraphEdge, GraphNode

    nodes_raw, edges_raw = await get_graph_elements_for_case_list(db, body.case_ids)
    nodes = [GraphNode(**n) for n in nodes_raw]
    edges = [GraphEdge(**e) for e in edges_raw]
    graph = build_graph(edges, nodes)
    metrics = compute_metrics(graph)
    return to_frontend_json(graph, metrics)


@router.get("/all/graph")
async def get_all_cases_graph_route(db: AsyncSession = Depends(get_db)):
    from app.case.graph_builder import get_graph_elements_for_case
    from app.graph.engine import build_graph, compute_metrics, to_frontend_json, GraphEdge, GraphNode
    
    nodes_raw, edges_raw = await get_graph_elements_for_case(db, None)
    nodes = [GraphNode(**n) for n in nodes_raw]
    edges = [GraphEdge(**e) for e in edges_raw]
    graph = build_graph(edges, nodes)
    metrics = compute_metrics(graph)
    return to_frontend_json(graph, metrics)


@router.get("/{case_id}/graph")
async def get_case_graph_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.case.graph_builder import get_graph_elements_for_case
    from app.graph.engine import build_graph, compute_metrics, to_frontend_json, GraphEdge, GraphNode
    
    nodes_raw, edges_raw = await get_graph_elements_for_case(db, case_id)
    nodes = [GraphNode(**n) for n in nodes_raw]
    edges = [GraphEdge(**e) for e in edges_raw]
    graph = build_graph(edges, nodes)
    metrics = compute_metrics(graph)
    return to_frontend_json(graph, metrics)

