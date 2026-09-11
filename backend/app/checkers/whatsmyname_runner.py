"""WhatsMyName OSINT Engine Runner.
Integrates https://whatsmyname.app / https://github.com/WebBreacher/WhatsMyName
High-performance asynchronous username enumeration across 700+ websites and services.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any
import httpx

WMN_DATA_URL = "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json"
CACHE_FILE = "/tmp/wmn-data.json"
CACHE_TTL = 86400  # 24 hours

_cached_wmn_data: dict[str, Any] | None = None


async def get_whatsmyname_data() -> dict[str, Any]:
    """Load, cache, and return WhatsMyName dataset."""
    global _cached_wmn_data
    if _cached_wmn_data is not None:
        return _cached_wmn_data

    # Check local disk cache
    if os.path.exists(CACHE_FILE):
        try:
            mtime = os.path.getmtime(CACHE_FILE)
            if (time.time() - mtime) < CACHE_TTL:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    _cached_wmn_data = json.load(f)
                    return _cached_wmn_data
        except Exception:
            pass

    # Fetch from remote GitHub repository
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(WMN_DATA_URL)
            if resp.status_code == 200:
                data = resp.json()
                _cached_wmn_data = data
                try:
                    with open(CACHE_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f)
                except Exception:
                    pass
                return data
    except Exception:
        pass

    # Fallback to cached file if exists even if expired
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _cached_wmn_data = json.load(f)
                return _cached_wmn_data
        except Exception:
            pass

    return {"sites": [], "categories": []}


async def _check_site(
    client: httpx.AsyncClient,
    site: dict[str, Any],
    username: str,
    semaphore: asyncio.Semaphore,
) -> dict[str, Any] | None:
    """Check a single site for username existence."""
    async with semaphore:
        name = site.get("name", "Unknown")
        uri_check = site.get("uri_check", "")
        if not uri_check:
            return None

        # Format URL
        url = uri_check.replace("{account}", username)
        pretty_url = site.get("uri_pretty", "").replace("{account}", username) if site.get("uri_pretty") else url
        cat = site.get("cat", "general")
        e_code = site.get("e_code")
        e_string = site.get("e_string")
        m_code = site.get("m_code")
        m_string = site.get("m_string")
        post_body = site.get("post_body")
        headers = site.get("headers", {})

        req_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        if headers:
            req_headers.update(headers)

        start_time = time.time()
        try:
            if post_body:
                body = post_body.replace("{account}", username)
                resp = await client.post(url, content=body, headers=req_headers)
            else:
                resp = await client.get(url, headers=req_headers)

            duration_ms = round((time.time() - start_time) * 1000)
            status_code = resp.status_code
            text = resp.text

            # If WAF / forbidden / rate limit blocked without being the target e_code, mark as unavailable/error
            is_claimed = False
            if status_code in (403, 429, 500, 502, 503, 504) and e_code not in (status_code,):
                is_claimed = False
            elif e_code is not None and status_code == e_code:
                if e_string:
                    is_claimed = (e_string in text)
                elif m_string:
                    is_claimed = (m_string not in text)
                else:
                    is_claimed = True
            elif e_code is None and status_code in (200, 301, 302):
                if e_string:
                    is_claimed = (e_string in text)
                elif m_string and m_code:
                    is_claimed = (status_code != m_code and m_string not in text)

            return {
                "platform": name,
                "category": cat,
                "url": pretty_url,
                "url_check": url,
                "status": "CLAIMED" if is_claimed else "AVAILABLE",
                "status_code": status_code,
                "response_time_ms": duration_ms,
                "discovered_by": "whatsmyname",
            }
        except Exception:
            return None


async def run_whatsmyname_scan(
    username: str,
    categories: list[str] | None = None,
    limit: int | None = None,
    use_tor: bool = False,
    timeout: float = 6.0,
    concurrency: int = 35,
) -> dict[str, Any]:
    """Scan WhatsMyName dataset for a target username."""
    wmn_data = await get_whatsmyname_data()
    all_sites = wmn_data.get("sites", [])

    # Filter valid sites
    sites_to_scan = [s for s in all_sites if s.get("valid", True) is not False]

    # Filter categories if requested
    if categories:
        cats_lower = {c.lower() for c in categories}
        sites_to_scan = [s for s in sites_to_scan if s.get("cat", "").lower() in cats_lower]

    if limit and limit > 0:
        sites_to_scan = sites_to_scan[:limit]

    proxy_url = "socks5://127.0.0.1:9050" if use_tor else None
    semaphore = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        proxy=proxy_url,
        verify=False,
    ) as client:
        tasks = [
            _check_site(client, site, username, semaphore)
            for site in sites_to_scan
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    claimed: list[dict[str, Any]] = []
    available: list[dict[str, Any]] = []

    for r in results:
        if isinstance(r, dict) and r.get("status"):
            if r["status"] == "CLAIMED":
                claimed.append(r)
            else:
                available.append(r)

    claimed.sort(key=lambda x: x["platform"].lower())

    return {
        "username": username,
        "total_sites_scanned": len(sites_to_scan),
        "total_claimed": len(claimed),
        "total_available": len(available),
        "claimed_accounts": claimed,
        "available_accounts": available,
        "categories_available": wmn_data.get("categories", []),
    }
