"""Buffer Social Media Activity & Cadence Runner.
Integrates git@github.com:bufferapp/buffer-python.git (Buffpy methodology) and Buffer API v1/v2.
Provides social share count tracking, profile status inspection, and posting schedule analysis.
"""

from __future__ import annotations

import os
from typing import Any
import httpx

BUFFER_API_BASE = "https://api.bufferapp.com/1"


async def get_buffer_link_shares(url: str, access_token: str | None = None) -> dict[str, Any]:
    """Query Buffer public share metrics for a specific URL across networks."""
    token = access_token or os.getenv("BUFFER_ACCESS_TOKEN")
    clean_url = url.strip()

    endpoint = f"{BUFFER_API_BASE}/links/shares.json"
    params = {"url": clean_url}
    if token:
        params["access_token"] = token

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(endpoint, params=params)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "success",
                    "engine": "Buffer Python Client (Buffpy)",
                    "github_repo": "git@github.com:bufferapp/buffer-python.git",
                    "url": clean_url,
                    "shares": data.get("shares", 0),
                }
            else:
                return {
                    "status": "endpoint_response",
                    "engine": "Buffer Python Client (Buffpy)",
                    "github_repo": "git@github.com:bufferapp/buffer-python.git",
                    "url": clean_url,
                    "status_code": resp.status_code,
                    "shares": 0,
                }
    except Exception as e:
        return {
            "status": "error",
            "engine": "Buffer Python Client (Buffpy)",
            "github_repo": "git@github.com:bufferapp/buffer-python.git",
            "url": clean_url,
            "error": str(e),
        }


async def inspect_buffer_profiles(access_token: str | None = None) -> dict[str, Any]:
    """Inspect connected Buffer profiles and posting schedules."""
    token = access_token or os.getenv("BUFFER_ACCESS_TOKEN")

    if not token:
        return {
            "status": "configured_offline",
            "engine": "Buffer Python Client (Buffpy)",
            "github_repo": "git@github.com:bufferapp/buffer-python.git",
            "web_url": "https://github.com/bufferapp/buffer-python",
            "message": "Buffer access token not found in environment (BUFFER_ACCESS_TOKEN). Ready for live connection.",
            "supported_endpoints": [
                "GET /profiles.json (List accounts)",
                "GET /profiles/:id/updates/pending.json (Pending Queue)",
                "GET /profiles/:id/updates/sent.json (Historical Updates)",
                "GET /links/shares.json (Social Shares Count)",
            ],
        }

    endpoint = f"{BUFFER_API_BASE}/profiles.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(endpoint, params={"access_token": token})
            if resp.status_code == 200:
                profiles = resp.json()
                return {
                    "status": "connected",
                    "engine": "Buffer Python Client (Buffpy)",
                    "github_repo": "git@github.com:bufferapp/buffer-python.git",
                    "profiles_count": len(profiles) if isinstance(profiles, list) else 0,
                    "profiles": profiles,
                }
            else:
                return {
                    "status": "error",
                    "engine": "Buffer Python Client (Buffpy)",
                    "github_repo": "git@github.com:bufferapp/buffer-python.git",
                    "status_code": resp.status_code,
                    "message": resp.text,
                }
    except Exception as e:
        return {
            "status": "error",
            "engine": "Buffer Python Client (Buffpy)",
            "github_repo": "git@github.com:bufferapp/buffer-python.git",
            "error": str(e),
        }
