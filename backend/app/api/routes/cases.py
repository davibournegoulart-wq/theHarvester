import os
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.case.incident import archive_case, create_case, log_action
from app.db import get_db
from app.models.case import AuditLogEntry, Case, CaseFile, CaseGeolocation, CaseStatus
from app.models.identifier import Account, Identifier, IdentifierType

from app.report.export import accounts_by_discovery_source, accounts_by_platform

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


class MultiCaseGraphRequest(BaseModel):
    case_ids: list[uuid.UUID]


@router.get("/")
async def list_cases_route(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    return result.scalars().all()


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
async def delete_case_route(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    # Manually delete related to avoid foreign key constraints since cascade is not set
    identifiers = await db.execute(select(Identifier.id).where(Identifier.case_id == case_id))
    identifier_ids = identifiers.scalars().all()
    if identifier_ids:
        await db.execute(delete(Account).where(Account.identifier_id.in_(identifier_ids)))
    
    await db.execute(delete(Identifier).where(Identifier.case_id == case_id))
    await db.execute(delete(AuditLogEntry).where(AuditLogEntry.case_id == case_id))
    
    await db.delete(case)
    await db.commit()
    return {"status": "deleted"}


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
    """Preserva um link como evidência na trilha de auditoria imutável — sem
    baixar nenhum conteúdo. Registra que aquela URL existia com aquele
    timestamp (o próprio `created_at` do log), pra caso o post seja apagado
    depois. Alternativa nativa ao baixador de mídia de terceiro (recusado —
    ver Tools - Excluded (Risk Review) no vault)."""
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    return await log_action(
        db,
        case_id,
        actor="investigador",
        action="evidence_saved",
        payload={"url": body.url, "note": body.note},
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

    case_file = CaseFile(
        id=file_id,
        case_id=case_id,
        filename=safe_stored_name,
        original_filename=file.filename or safe_stored_name,
        typology=typology,
        source_url=source_url,
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
            "filename": case_file.original_filename,
            "typology": typology,
            "size": file_size,
        },
    )

    return {
        "id": str(case_file.id),
        "filename": case_file.filename,
        "original_filename": case_file.original_filename,
        "typology": case_file.typology,
        "file_size": case_file.file_size,
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
    """Delete file from databank and disk."""
    res = await db.execute(select(CaseFile).where(CaseFile.id == file_id, CaseFile.case_id == case_id))
    case_file = res.scalar_one_or_none()
    if case_file is None:
        raise HTTPException(status_code=404, detail="File not found")

    if os.path.exists(case_file.storage_path):
        try:
            os.remove(case_file.storage_path)
        except Exception:
            pass

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

