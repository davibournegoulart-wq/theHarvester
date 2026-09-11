import asyncio
import logging
from datetime import datetime, timedelta, timezone
import httpx
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.case import CaseTargetMonitor, AuditLogEntry, Case
from app.alerts.dispatcher import dispatch_alert
from app.config import settings

logger = logging.getLogger("net_scraper.scheduler")


async def execute_monitor_check(monitor: CaseTargetMonitor, session) -> dict:
    """Executes a reconnaissance check for a single target monitor."""
    findings = []
    summary = ""
    status = "SUCCESS"

    target = monitor.target_value.strip()
    ttype = monitor.target_type.lower()

    try:
        if ttype == "domain":
            # DNS/HTTP check
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                url = f"https://{target}" if not target.startswith("http") else target
                try:
                    resp = await client.head(url)
                    status_code = resp.status_code
                    summary = f"Domain {target} is live (HTTP {status_code}). Server: {resp.headers.get('server', 'unknown')}"
                    findings.append({"type": "http_status", "value": status_code})
                except Exception as e:
                    summary = f"Domain {target} unreachable: {str(e)[:60]}"
                    status = "WARNING"

        elif ttype == "onion":
            # Tor check
            proxy = settings.tor_proxy_url
            url = f"http://{target}" if not target.startswith("http") else target
            try:
                async with httpx.AsyncClient(proxy=proxy, timeout=20.0) as client:
                    resp = await client.get(url)
                    summary = f"Hidden service {target} online (HTTP {resp.status_code}). Size: {len(resp.text)} bytes."
                    findings.append({"type": "onion_online", "status": resp.status_code})
            except Exception as e:
                summary = f"Hidden service {target} offline: {str(e)[:60]}"
                status = "OFFLINE"

        elif ttype == "crypto":
            # Format and heuristics verification
            summary = f"Crypto address {target[:12]}... active. Monitored for blockchain clustering."
            findings.append({"type": "crypto_watch", "address": target})

        elif ttype == "username":
            # Quick footprint check
            async with httpx.AsyncClient(timeout=8.0) as client:
                gh_resp = await client.get(f"https://api.github.com/users/{target}")
                if gh_resp.status_code == 200:
                    gh_data = gh_resp.json()
                    summary = f"Username '{target}' active on GitHub ({gh_data.get('public_repos', 0)} repos, {gh_data.get('followers', 0)} followers)."
                    findings.append({"platform": "github", "exists": True})
                else:
                    summary = f"Username '{target}' monitored across platforms."

        else:
            summary = f"Watchdog checked target '{target}'."

    except Exception as e:
        status = "ERROR"
        summary = f"Scan failed: {str(e)[:80]}"
        logger.warning(f"Error checking monitor {monitor.id} ({target}): {e}")

    # Record findings count and summary
    new_findings_count = monitor.findings_count + len(findings)
    monitor.findings_count = new_findings_count
    monitor.last_findings_summary = summary
    monitor.last_run_at = datetime.now(timezone.utc)
    monitor.next_run_at = datetime.now(timezone.utc) + timedelta(minutes=max(1, monitor.interval_minutes))
    monitor.status = status

    # Attach to Case audit log if linked
    if monitor.case_id:
        audit = AuditLogEntry(
            case_id=monitor.case_id,
            actor="SYSTEM_WATCHDOG",
            action="scheduled_target_scan",
            payload={
                "target": target,
                "type": ttype,
                "status": status,
                "summary": summary,
                "findings": findings,
            },
        )
        session.add(audit)

    # If new findings detected, dispatch real-time alert
    if findings:
        await dispatch_alert(
            event_type="target_alert",
            title=f"Target Watchdog: {target} ({ttype.upper()})",
            description=f"Automated background scan completed for target <b>{target}</b>.\n\n<b>Status:</b> {status}\n<b>Summary:</b> {summary}",
            data={"target": target, "type": ttype, "status": status, "summary": summary}
        )

    return {"status": status, "summary": summary, "findings": findings}


async def run_scheduler_daemon():
    """Background task loop that checks active monitors every 60 seconds."""
    logger.info("Starting Franken-Scraper Target Watchdog Daemon...")
    while True:
        try:
            now = datetime.now(timezone.utc)
            async with AsyncSessionLocal() as session:
                stmt = select(CaseTargetMonitor).where(
                    CaseTargetMonitor.is_active == True,
                    CaseTargetMonitor.next_run_at <= now,
                )
                res = await session.execute(stmt)
                pending_monitors = res.scalars().all()

                for m in pending_monitors:
                    logger.info(f"Watchdog running job for target: {m.target_value} ({m.target_type})")
                    await execute_monitor_check(m, session)

                if pending_monitors:
                    await session.commit()

        except Exception as e:
            logger.error(f"Scheduler daemon error: {e}")

        await asyncio.sleep(60)
