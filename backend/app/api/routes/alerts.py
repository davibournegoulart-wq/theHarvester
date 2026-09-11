import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from app.db import AsyncSessionLocal
from app.models.case import AlertWebhook
from app.alerts.dispatcher import dispatch_alert

router = APIRouter(prefix="/alerts", tags=["Alerts & Webhooks"])
logger = logging.getLogger("net_scraper.api.alerts")


class WebhookCreate(BaseModel):
    name: str
    url: str
    platform: str = "generic"  # discord, telegram, slack, generic
    events: list[str] = ["evidence_added", "target_alert", "spider_match", "case_created"]
    secret_token: str | None = None
    is_active: bool = True


@router.get("/webhooks")
async def list_webhooks():
    """List all configured alerting webhooks."""
    async with AsyncSessionLocal() as session:
        stmt = select(AlertWebhook).order_by(AlertWebhook.created_at.desc())
        res = await session.execute(stmt)
        webhooks = res.scalars().all()
        return [
            {
                "id": str(w.id),
                "name": w.name,
                "url": w.url[:30] + "..." if len(w.url) > 30 else w.url,
                "full_url": w.url,
                "platform": w.platform,
                "events": w.events,
                "is_active": w.is_active,
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "last_triggered_at": w.last_triggered_at.isoformat() if w.last_triggered_at else None,
                "last_status": w.last_status,
            }
            for w in webhooks
        ]


@router.post("/webhooks")
async def create_webhook(wh: WebhookCreate):
    """Register a new webhook for real-time dispatch."""
    if not wh.url.startswith("http://") and not wh.url.startswith("https://"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    async with AsyncSessionLocal() as session:
        new_wh = AlertWebhook(
            name=wh.name,
            url=wh.url,
            platform=wh.platform,
            events=wh.events,
            secret_token=wh.secret_token,
            is_active=wh.is_active,
        )
        session.add(new_wh)
        await session.commit()
        await session.refresh(new_wh)
        return {
            "status": "created",
            "id": str(new_wh.id),
            "name": new_wh.name,
            "platform": new_wh.platform,
        }


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str):
    """Sends a verification test ping to the specified webhook."""
    try:
        uid = uuid.UUID(webhook_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook UUID")

    async with AsyncSessionLocal() as session:
        wh = await session.get(AlertWebhook, uid)
        if not wh:
            raise HTTPException(status_code=404, detail="Webhook not found")

        # Dispatch single test
        results = await dispatch_alert(
            event_type="test_ping",
            title="SYSTEM TEST // PING_OK",
            description=(
                "This is a verified test payload transmitted by Franken-Scraper Tactical OSINT Engine.\n"
                "Your alerting endpoint is active and ready to receive real-time forensic updates."
            ),
            data={
                "engine": "Franken-Scraper",
                "status": "OPERATIONAL",
                "test_timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {"status": "dispatched", "results": results}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str):
    """Delete an alerting webhook."""
    try:
        uid = uuid.UUID(webhook_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook UUID")

    async with AsyncSessionLocal() as session:
        wh = await session.get(AlertWebhook, uid)
        if not wh:
            raise HTTPException(status_code=404, detail="Webhook not found")
        await session.delete(wh)
        await session.commit()
        return {"status": "deleted"}
