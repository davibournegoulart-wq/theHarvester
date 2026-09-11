"""Socialscan Engine Runner.
Integrates https://github.com/iojw/socialscan.
Accurate, fast username and email existence checker with 0% false positive design.
"""

from __future__ import annotations

from typing import Any
from starlette.concurrency import run_in_threadpool
from socialscan.util import Platforms, sync_execute_queries

PLATFORM_URL_MAP = {
    "Twitter": "https://twitter.com/{query}",
    "GitHub": "https://github.com/{query}",
    "GitLab": "https://gitlab.com/{query}",
    "Instagram": "https://instagram.com/{query}",
    "Reddit": "https://reddit.com/user/{query}",
    "Tumblr": "https://{query}.tumblr.com",
    "Pinterest": "https://pinterest.com/{query}",
}


def _execute_socialscan_sync(
    query: str,
    platforms_list: list[str] | None = None,
) -> dict[str, Any]:
    """Execute socialscan queries synchronously."""
    available_platform_objs = [
        getattr(Platforms, p)
        for p in ["GITHUB", "GITLAB", "INSTAGRAM", "REDDIT", "TWITTER", "PINTEREST", "TUMBLR"]
        if hasattr(Platforms, p)
    ]

    if platforms_list:
        selected_platforms = [
            p for p in available_platform_objs
            if p.name.upper() in [x.upper() for x in platforms_list]
        ]
    else:
        selected_platforms = available_platform_objs

    results = sync_execute_queries([query], selected_platforms)

    claimed: list[dict[str, Any]] = []
    available: list[dict[str, Any]] = []
    unknown: list[dict[str, Any]] = []

    for r in results:
        plat_name = r.platform.name if hasattr(r.platform, "name") else str(r.platform)
        # Format profile URL
        url_template = PLATFORM_URL_MAP.get(plat_name) or PLATFORM_URL_MAP.get(plat_name.capitalize(), "")
        profile_url = url_template.format(query=query) if url_template else ""

        entry = {
            "platform": plat_name.capitalize(),
            "query": r.query,
            "url": profile_url,
            "available": r.available,
            "valid": r.valid,
            "message": r.message,
            "discovered_by": "socialscan",
        }

        if r.valid:
            if not r.available:
                entry["status"] = "CLAIMED"
                claimed.append(entry)
            else:
                entry["status"] = "AVAILABLE"
                available.append(entry)
        else:
            entry["status"] = "UNKNOWN"
            unknown.append(entry)

    claimed.sort(key=lambda x: x["platform"].lower())

    return {
        "query": query,
        "engine": "socialscan",
        "total_scanned": len(results),
        "total_claimed": len(claimed),
        "total_available": len(available),
        "total_unknown": len(unknown),
        "claimed_accounts": claimed,
        "available_accounts": available,
        "unknown_accounts": unknown,
    }


async def run_socialscan(
    query: str,
    platforms_list: list[str] | None = None,
) -> dict[str, Any]:
    """Asynchronous wrapper for socialscan execution."""
    return await run_in_threadpool(
        _execute_socialscan_sync,
        query=query,
        platforms_list=platforms_list,
    )
