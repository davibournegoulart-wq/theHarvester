"""Web Surface Exposure & Admin Panel Finder (Breacher + RED_HAWK synthesis).
Probes common administrative entrypoints, control panels, robots.txt, sitemaps,
and sensitive exposed files without requiring invasive vulnerability scanning.
"""

from __future__ import annotations

import asyncio
from typing import Any
import httpx


ADMIN_PATHS = [
    "/admin",
    "/administrator",
    "/admin/login",
    "/cpanel",
    "/login",
    "/wp-login.php",
    "/wp-admin",
    "/dashboard",
    "/panel",
    "/user/login",
    "/admin.php",
    "/manage",
    "/portal",
    "/api/v1",
    "/server-status",
    "/robots.txt",
    "/sitemap.xml",
    "/.git/HEAD",
    "/.env",
    "/crossdomain.xml",
]


async def scan_web_exposure(target_domain: str, use_tor: bool = False, max_concurrency: int = 10) -> dict[str, Any]:
    """Scans for exposed administrative endpoints, robots.txt, and sensitive files on a domain."""
    base = target_domain.strip().rstrip("/")
    if not base.startswith("http://") and not base.startswith("https://"):
        base = f"https://{base}"

    proxies = "socks5://127.0.0.1:9050" if use_tor else None
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    discovered: list[dict[str, Any]] = []
    sem = asyncio.Semaphore(max_concurrency)

    async def _probe_path(client: httpx.AsyncClient, path: str):
        url = f"{base}{path}"
        async with sem:
            try:
                resp = await client.get(url, follow_redirects=False)
                # Any 200, 301, 302, 401, 403 means the endpoint exists
                if resp.status_code in (200, 301, 302, 401, 403):
                    is_open = resp.status_code == 200
                    risk = "HIGH" if (path in ("/.env", "/.git/HEAD") and is_open) else "MEDIUM" if is_open else "LOW"
                    discovered.append({
                        "path": path,
                        "url": url,
                        "status_code": resp.status_code,
                        "is_accessible": is_open,
                        "content_length": len(resp.content),
                        "risk_level": risk,
                        "redirect_location": resp.headers.get("location"),
                    })
            except Exception:
                pass

    try:
        async with httpx.AsyncClient(proxy=proxies, verify=False, timeout=6.0, headers=headers) as client:
            tasks = [_probe_path(client, p) for p in ADMIN_PATHS]
            await asyncio.gather(*tasks)

        # Sort discovered: Accessible first, then by risk
        risk_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        discovered.sort(key=lambda x: (not x["is_accessible"], risk_order.get(x["risk_level"], 3)))

        return {
            "target": target_domain,
            "base_url": base,
            "total_probed": len(ADMIN_PATHS),
            "endpoints_found": len(discovered),
            "discovered": discovered,
        }
    except Exception as e:
        return {
            "target": target_domain,
            "base_url": base,
            "total_probed": len(ADMIN_PATHS),
            "endpoints_found": 0,
            "discovered": [],
            "error": str(e),
        }
