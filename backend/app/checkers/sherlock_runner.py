"""Sherlock Official Project Engine Integration.
Integrates git@github.com:sherlock-project/sherlock.git into Net Scraper.
Provides full 430+ site OSINT username enumeration with Tor proxy routing support,
exact status resolution (Claimed / Available / Unknown / Illegal),
and direct seamless integration with the Case Databank.
"""

from __future__ import annotations

import asyncio
from typing import Any
from starlette.concurrency import run_in_threadpool

from sherlock_project.sherlock import sherlock
from sherlock_project.sites import SitesInformation
from sherlock_project.notify import QueryNotify
from sherlock_project.result import QueryStatus


class SilentSherlockNotify(QueryNotify):
    """Silent notify implementation to suppress terminal printing in production API."""
    def __init__(self):
        pass
    def start(self, message=None):
        pass
    def update(self, result):
        pass
    def finish(self, message=None):
        pass


_cached_sites: dict[str, dict[str, Any]] | None = None


def get_sherlock_sites_data() -> dict[str, dict[str, Any]]:
    """Load and cache Sherlock's 430+ official site definitions."""
    global _cached_sites
    if _cached_sites is None:
        sites_info = SitesInformation()
        _cached_sites = {name: site.information for name, site in sites_info.sites.items()}
    return _cached_sites


def _execute_sherlock_sync(
    username: str,
    site_names: list[str] | None = None,
    use_tor: bool = False,
    timeout: int = 15,
) -> dict[str, Any]:
    """Synchronous worker that runs Sherlock's multi-threaded futures engine."""
    all_sites = get_sherlock_sites_data()
    
    if site_names:
        site_data = {k: v for k, v in all_sites.items() if k in site_names}
    else:
        site_data = all_sites

    proxy_url = "socks5://127.0.0.1:9050" if use_tor else None

    results = sherlock(
        username=username,
        site_data=site_data,
        query_notify=SilentSherlockNotify(),
        tor=use_tor,
        proxy=proxy_url,
        timeout=timeout,
    )

    claimed: list[dict[str, Any]] = []
    available: list[dict[str, Any]] = []
    unknown: list[dict[str, Any]] = []

    for platform_name, site_result in results.items():
        status_obj = site_result.get("status")
        url_user = site_result.get("url_user", "")
        url_main = site_result.get("url_main", "")
        response_time = site_result.get("query_time")

        status_str = status_obj.status.name if hasattr(status_obj.status, "name") else str(status_obj.status)

        entry = {
            "platform": platform_name,
            "url": url_user or url_main,
            "url_main": url_main,
            "status": status_str,
            "response_time_ms": round(response_time * 1000) if response_time else None,
            "discovered_by": "sherlock-project.sherlock",
        }

        if status_str == "CLAIMED" or status_obj.status == QueryStatus.CLAIMED:
            claimed.append(entry)
        elif status_str == "AVAILABLE" or status_obj.status == QueryStatus.AVAILABLE:
            available.append(entry)
        else:
            unknown.append(entry)

    # Sort alphabetically by platform
    claimed.sort(key=lambda x: x["platform"].lower())

    return {
        "username": username,
        "total_sites_scanned": len(site_data),
        "total_claimed": len(claimed),
        "total_available": len(available),
        "total_unknown": len(unknown),
        "claimed_accounts": claimed,
        "available_accounts": available,
        "unknown_accounts": unknown,
    }


async def run_sherlock_scan(
    username: str,
    site_names: list[str] | None = None,
    use_tor: bool = False,
    timeout: int = 15,
) -> dict[str, Any]:
    """Asynchronous wrapper for running Sherlock inside FastAPI."""
    return await run_in_threadpool(
        _execute_sherlock_sync,
        username=username,
        site_names=site_names,
        use_tor=use_tor,
        timeout=timeout,
    )
