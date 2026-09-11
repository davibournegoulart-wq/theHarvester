import logging
from datetime import datetime, timezone
import httpx
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.case import AlertWebhook

logger = logging.getLogger("net_scraper.alerts")


async def dispatch_alert(event_type: str, title: str, description: str, data: dict | None = None) -> list[dict]:
    """Asynchronously dispatches an intelligence alert to all registered and active webhooks."""
    results = []
    data = data or {}

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(AlertWebhook).where(AlertWebhook.is_active == True)
            res = await session.execute(stmt)
            webhooks = res.scalars().all()

            if not webhooks:
                return []

            async with httpx.AsyncClient(timeout=8.0) as client:
                for wh in webhooks:
                    # Check if webhook subscribes to this event
                    if wh.events and event_type not in wh.events and "*" not in wh.events:
                        continue

                    payload = {}
                    headers = {"Content-Type": "application/json"}
                    if wh.secret_token:
                        headers["X-Webhook-Secret"] = wh.secret_token

                    # Format per target platform
                    if wh.platform == "discord":
                        fields = []
                        for k, v in list(data.items())[:6]:
                            fields.append({"name": str(k).replace("_", " ").upper(), "value": str(v)[:100], "inline": True})
                        payload = {
                            "username": "Franken-Scraper OSINT",
                            "avatar_url": "https://raw.githubusercontent.com/davibournegoulart-wq/theHarvester/main/franken_scraper_logo.jpg",
                            "embeds": [
                                {
                                    "title": f"⚡ INTEL ALERT: {title}",
                                    "description": description[:1800],
                                    "color": 0x05D9E8,
                                    "fields": fields,
                                    "footer": {
                                        "text": f"Franken-Scraper Forensic Engine • Event: {event_type}"
                                    },
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                }
                            ]
                        }
                    elif wh.platform == "telegram":
                        payload = {
                            "text": (
                                f"🚨 <b>[FRANKEN-SCRAPER OSINT ALERT]</b>\n"
                                f"<b>Event:</b> <code>{event_type}</code>\n"
                                f"<b>Title:</b> {title}\n\n"
                                f"{description}\n"
                            ),
                            "parse_mode": "HTML",
                            "disable_web_page_preview": True,
                        }
                    elif wh.platform == "slack":
                        payload = {
                            "text": f"🚨 *[FRANKEN-SCRAPER]* {title}\n>{description}",
                        }
                    else:
                        payload = {
                            "system": "franken-scraper",
                            "event": event_type,
                            "title": title,
                            "description": description,
                            "payload": data,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }

                    status_str = "PENDING"
                    try:
                        resp = await client.post(wh.url, json=payload, headers=headers)
                        status_str = f"HTTP_{resp.status_code}"
                        results.append({"webhook_id": str(wh.id), "name": wh.name, "status": status_str})
                    except Exception as e:
                        status_str = f"ERROR: {str(e)[:50]}"
                        logger.warning(f"Failed to dispatch webhook '{wh.name}' to {wh.url}: {e}")
                        results.append({"webhook_id": str(wh.id), "name": wh.name, "status": status_str})

                    wh.last_triggered_at = datetime.now(timezone.utc)
                    wh.last_status = status_str

            await session.commit()
    except Exception as e:
        logger.error(f"Error during alert dispatch: {e}")

    return results
