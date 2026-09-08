import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.case.incident import archive_case, create_case, log_action
from app.db import get_db
from app.models.case import AuditLogEntry, Case
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


@router.post("/{case_id}/archive")
async def archive_case_route(case_id: uuid.UUID, actor: str, db: AsyncSession = Depends(get_db)):
    case = await db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return await archive_case(db, case, actor)


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
