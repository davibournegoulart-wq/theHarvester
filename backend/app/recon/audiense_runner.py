"""Audiense (SocialBro) Audience Intelligence Runner.
Integrates git@github.com:SocialBro/socialbro-api-python.git and Audiense Insights API.
Provides community tribe segmentation, Twitter/X audience profiling, and affinity analysis.
"""

from __future__ import annotations

import os
from typing import Any
import httpx

AUDIENSE_API_BASE = "https://api.audiense.com/v1"


async def inspect_audiense_account(api_key: str | None = None, api_secret: str | None = None) -> dict[str, Any]:
    """Inspect Audiense account and community intelligence connection."""
    key = api_key or os.getenv("AUDIENSE_API_KEY")
    secret = api_secret or os.getenv("AUDIENSE_API_SECRET")

    if not (key and secret):
        return {
            "status": "configured_offline",
            "engine": "Audiense (SocialBro) Python Client",
            "github_repo": "git@github.com:SocialBro/socialbro-api-python.git",
            "web_url": "https://github.com/SocialBro/socialbro-api-python",
            "message": "Audiense API credentials not found in environment (AUDIENSE_API_KEY / AUDIENSE_API_SECRET). Ready for live connection.",
            "intelligence_capabilities": [
                "Audience tribe clustering (Demographics, bio terms, socio-cultural traits)",
                "Affinity indexing (Brand and media affinities vs baseline)",
                "Influencer & amplifier identification",
                "Twitter/X follower social graph analysis",
            ],
        }

    endpoint = f"{AUDIENSE_API_BASE}/account/details"
    try:
        async with httpx.AsyncClient(timeout=10.0, auth=(key, secret)) as client:
            resp = await client.get(endpoint)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "connected",
                    "engine": "Audiense (SocialBro) Python Client",
                    "github_repo": "git@github.com:SocialBro/socialbro-api-python.git",
                    "account": data,
                }
            else:
                return {
                    "status": "error",
                    "engine": "Audiense (SocialBro) Python Client",
                    "github_repo": "git@github.com:SocialBro/socialbro-api-python.git",
                    "status_code": resp.status_code,
                    "message": resp.text,
                }
    except Exception as e:
        return {
            "status": "error",
            "engine": "Audiense (SocialBro) Python Client",
            "github_repo": "git@github.com:SocialBro/socialbro-api-python.git",
            "error": str(e),
        }
