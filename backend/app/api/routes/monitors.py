import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.case import CaseTargetMonitor, Case
from app.scheduler.daemon import execute_monitor_check

router = APIRouter(prefix="/monitors", tags=["Target Watchdog & Scheduler"])
logger = logging.getLogger("net_scraper.api.monitors")


class MonitorCreate(BaseModel):
    case_id: str
    target_type: str  # username, domain, crypto, onion, social
    target_value: str
    interval_minutes: int = 60  # default 1 hour


@router.get("")
async def list_monitors(case_id: str | None = None):
    """List scheduled target monitors, optionally filtered by case."""
    async with AsyncSessionLocal() as session:
        stmt = select(CaseTargetMonitor).order_by(CaseTargetMonitor.created_at.desc())
        if case_id:
            try:
                cid = uuid.UUID(case_id)
                stmt = stmt.where(CaseTargetMonitor.case_id == cid)
            except ValueError:
                pass

        res = await session.execute(stmt)
        monitors = res.scalars().all()
        return [
            {
                "id": str(m.id),
                "case_id": str(m.case_id),
                "target_type": m.target_type,
                "target_value": m.target_value,
                "interval_minutes": m.interval_minutes,
                "status": m.status,
                "findings_count": m.findings_count,
                "last_findings_summary": m.last_findings_summary,
                "last_run_at": m.last_run_at.isoformat() if m.last_run_at else None,
                "next_run_at": m.next_run_at.isoformat() if m.next_run_at else None,
                "is_active": m.is_active,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in monitors
        ]


@router.post("")
async def create_monitor(m: MonitorCreate):
    """Register a new scheduled monitor for automated background re-checks."""
    try:
        cid = uuid.UUID(m.case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Case UUID")

    async with AsyncSessionLocal() as session:
        case = await session.get(Case, cid)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        monitor = CaseTargetMonitor(
            case_id=cid,
            target_type=m.target_type.lower(),
            target_value=m.target_value.strip(),
            interval_minutes=max(1, m.interval_minutes),
            next_run_at=datetime.now(timezone.utc),  # Run immediately on creation
        )
        session.add(monitor)
        await session.commit()
        await session.refresh(monitor)

        # Trigger initial check immediately
        await execute_monitor_check(monitor, session)
        await session.commit()

        return {
            "status": "created",
            "id": str(monitor.id),
            "target": monitor.target_value,
            "next_run_at": monitor.next_run_at.isoformat(),
        }


@router.post("/{monitor_id}/run-now")
async def trigger_run_now(monitor_id: str):
    """Forces an immediate reconnaissance check for a specific monitor."""
    try:
        mid = uuid.UUID(monitor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Monitor UUID")

    async with AsyncSessionLocal() as session:
        monitor = await session.get(CaseTargetMonitor, mid)
        if not monitor:
            raise HTTPException(status_code=404, detail="Monitor not found")

        result = await execute_monitor_check(monitor, session)
        await session.commit()
        return {"status": "completed", "result": result}


@router.delete("/{monitor_id}")
async def delete_monitor(monitor_id: str):
    """Deletes a target monitor."""
    try:
        mid = uuid.UUID(monitor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Monitor UUID")

    async with AsyncSessionLocal() as session:
        monitor = await session.get(CaseTargetMonitor, mid)
        if not monitor:
            raise HTTPException(status_code=404, detail="Monitor not found")
        await session.delete(monitor)
        await session.commit()
        return {"status": "deleted"}
