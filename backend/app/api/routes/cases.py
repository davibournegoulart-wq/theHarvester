import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.case.incident import archive_case, create_case
from app.db import get_db
from app.models.case import AuditLogEntry, Case

router = APIRouter(prefix="/cases", tags=["cases"])


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
