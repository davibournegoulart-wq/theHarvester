"""Maigret OSINT Engine Runner.
Integrates https://github.com/soxoj/maigret (fork of Sherlock).
Supports 5,000+ sites with deep dossier scraping (UIDs, bios, avatars, follower metrics).
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
from typing import Any


async def run_maigret_scan(
    username: str,
    top_sites: int = 50,
    use_tor: bool = False,
    timeout: int = 60,
) -> dict[str, Any]:
    """Execute Maigret CLI asynchronously and parse the structured JSON dossier."""
    temp_dir = tempfile.mkdtemp(prefix="maigret_")
    report_file = os.path.join(temp_dir, f"report_{username}_simple.json")

    cmd = [
        "maigret",
        username,
        "--top-sites",
        str(max(5, min(top_sites, 500))),
        "-J",
        "simple",
        "--no-progressbar",
        "--folderoutput",
        temp_dir,
        "--timeout",
        "10",
    ]

    if use_tor:
        cmd.extend(["--proxy", "socks5://127.0.0.1:9050"])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            stdout = b""
            stderr = b"Maigret execution timed out"

        claimed_accounts: list[dict[str, Any]] = []

        if os.path.exists(report_file):
            try:
                with open(report_file, "r", encoding="utf-8") as f:
                    raw_report = json.load(f)

                for site_name, site_data in raw_report.items():
                    status_info = site_data.get("status", {})
                    ids = status_info.get("ids", {})
                    url_user = site_data.get("url_user") or site_data.get("url") or status_info.get("url")
                    tags = site_data.get("site", {}).get("tags", []) or status_info.get("tags", [])

                    account_entry = {
                        "platform": site_name,
                        "url": url_user,
                        "url_main": site_data.get("url_main"),
                        "status": "CLAIMED",
                        "discovered_by": "maigret",
                        "tags": tags,
                        "fullname": ids.get("fullname"),
                        "bio": ids.get("bio") or ids.get("description"),
                        "avatar_url": ids.get("image"),
                        "banner_url": ids.get("image_bg"),
                        "follower_count": ids.get("follower_count"),
                        "following_count": ids.get("following_count"),
                        "created_at": ids.get("created_at"),
                        "uid": ids.get("uid"),
                        "links": ids.get("links"),
                        "rank": site_data.get("rank"),
                    }
                    claimed_accounts.append(account_entry)
            except Exception:
                pass

        claimed_accounts.sort(key=lambda x: (x.get("rank") or 9999, x["platform"].lower()))

        return {
            "username": username,
            "engine": "maigret",
            "top_sites_requested": top_sites,
            "total_claimed": len(claimed_accounts),
            "claimed_accounts": claimed_accounts,
        }

    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
