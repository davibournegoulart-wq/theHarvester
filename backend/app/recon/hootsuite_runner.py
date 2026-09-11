"""Hootsuite REST API Runner.
Integrates git@github.com:ciaranmccormick/hootsweet.git.
Provides social media stream listening, profile inspections, and outbound message analytics.
"""

from __future__ import annotations

import os
from typing import Any
from starlette.concurrency import run_in_threadpool

try:
    from hootsweet import HootSweet
    HOOTSWEET_AVAILABLE = True
except ImportError:
    HOOTSWEET_AVAILABLE = False


def _execute_hootsuite_sync(
    client_id: str | None = None,
    client_secret: str | None = None,
    token: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Inspect Hootsuite connection using HootSweet."""
    cid = client_id or os.getenv("HOOTSUITE_CLIENT_ID")
    sec = client_secret or os.getenv("HOOTSUITE_CLIENT_SECRET")

    if not HOOTSWEET_AVAILABLE:
        return {
            "status": "error",
            "message": "hootsweet library not installed. Install via pip install hootsweet",
            "github_repo": "git@github.com:ciaranmccormick/hootsweet.git",
        }

    if not (cid and sec):
        return {
            "status": "configured_offline",
            "engine": "HootSweet (Hootsuite Python SDK)",
            "github_repo": "git@github.com:ciaranmccormick/hootsweet.git",
            "web_url": "https://github.com/ciaranmccormick/hootsweet",
            "message": "Hootsuite OAuth credentials not found in environment (HOOTSUITE_CLIENT_ID / HOOTSUITE_CLIENT_SECRET). Ready for live connection.",
            "capabilities": [
                "get_me (User Account)",
                "get_social_profiles (All Connected Profiles)",
                "get_outbound_messages (Post Stream History)",
                "schedule_message (Post Dispatch)",
            ],
        }

    try:
        hs = HootSweet(client_id=cid, client_secret=sec, token=token)
        profiles = hs.get_social_profiles()
        return {
            "status": "connected",
            "engine": "HootSweet",
            "github_repo": "git@github.com:ciaranmccormick/hootsweet.git",
            "profiles_count": len(profiles) if isinstance(profiles, list) else 0,
            "profiles": profiles,
        }
    except Exception as e:
        return {
            "status": "error",
            "engine": "HootSweet",
            "github_repo": "git@github.com:ciaranmccormick/hootsweet.git",
            "error": str(e),
        }


async def run_hootsuite_inspection(
    client_id: str | None = None,
    client_secret: str | None = None,
) -> dict[str, Any]:
    """Asynchronous wrapper for Hootsuite runner."""
    return await run_in_threadpool(
        _execute_hootsuite_sync,
        client_id=client_id,
        client_secret=client_secret,
    )
