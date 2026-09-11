from __future__ import annotations
"""TikTok Profile & Video OSINT Scraper.
Extracts user profile details, persistent numeric User ID, creation dates via Snowflake decoding,
follower metrics, avatar, and video timestamp analysis.
Uses BeautifulSoup and lightweight header spoofing without requiring third-party API keys or login credentials.
"""

import datetime
import re
import httpx
from bs4 import BeautifulSoup

_SNOWFLAKE_EPOCH_THRESHOLD = 1420070400  # 2015-01-01 (TikTok launch era)

def decode_snowflake_timestamp(snowflake_id: str | int | None) -> str | None:
    """Decodes creation UTC timestamp from TikTok 64-bit snowflake ID (id >> 32)."""
    if not snowflake_id:
        return None
    try:
        val = int(str(snowflake_id).strip())
        if val <= 0:
            return None
        epoch_sec = val >> 32
        # Sanity check: between 2015 and 2040
        if 1420070400 <= epoch_sec <= 2208988800:
            dt = datetime.datetime.fromtimestamp(epoch_sec, tz=datetime.timezone.utc)
            return dt.isoformat()
    except Exception:
        pass
    return None

def parse_count(val_str: str | None) -> str:
    """Cleans count strings like 162.8m or 95.7k."""
    if not val_str:
        return "0"
    return val_str.strip()

async def scrape_tiktok_profile(username_or_url: str) -> dict:
    """Scrapes public TikTok profile metadata using BeautifulSoup and OpenGraph/App-Link tags."""
    # Normalize username
    target = username_or_url.strip()
    if "@" in target:
        target = target.split("@")[-1]
    if "/" in target:
        target = target.split("/")[0]
    target = target.split("?")[0]

    url = f"https://www.tiktok.com/@{target}"
    headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=12.0) as client:
        resp = await client.get(url)

    if resp.status_code != 200:
        return {
            "found": False,
            "username": target,
            "url": url,
            "status_code": resp.status_code,
            "error": f"TikTok returned HTTP {resp.status_code}",
        }

    soup = BeautifulSoup(resp.text, "html.parser")

    # Check for title
    title_el = soup.find("title")
    title = title_el.text.strip() if title_el else ""

    # Check if page is generic not-found
    if "Visit TikTok to discover profiles" in title or "Watch, follow, and discover" in title:
        return {
            "found": False,
            "username": target,
            "url": url,
            "error": "Account not found or suspended",
        }

    # Extract App-Link User ID
    user_id = None
    al_ios = soup.find("meta", property="al:ios:url") or soup.find("meta", property="al:android:url")
    if al_ios and al_ios.get("content"):
        m = re.search(r"/profile/(\d+)", al_ios.get("content"))
        if m:
            user_id = m.group(1)

    # Fallback to regex on response body
    if not user_id:
        m_body = re.search(r'"id":"(\d+)","shortId"', resp.text)
        if m_body:
            user_id = m_body.group(1)

    # Decode account creation date
    created_at = decode_snowflake_timestamp(user_id) if user_id else None

    # Description for followers/following/likes
    desc_meta = soup.find("meta", property="og:description") or soup.find("meta", {"name": "description"})
    desc_text = desc_meta.get("content", "").strip() if desc_meta else ""

    followers = None
    following = None
    likes = None

    # Format: "@username 162.8m Followers, 81 Following, 2670.2m Likes - Watch awesome short videos..."
    stats_match = re.search(r"([\d\.]+[kmb]?)\s+Followers,\s+([\d\.]+[kmb]?)\s+Following,\s+([\d\.]+[kmb]?)\s+Likes", desc_text, re.IGNORECASE)
    if stats_match:
        followers = stats_match.group(1)
        following = stats_match.group(2)
        likes = stats_match.group(3)

    # Nickname / Title
    name_match = re.match(r"^([^\|]+)\s+on\s+TikTok", title)
    display_name = name_match.group(1).strip() if name_match else target

    # Avatar
    avatar_meta = soup.find("meta", property="og:image") or soup.find("meta", property="twitter:image")
    avatar_url = avatar_meta.get("content") if avatar_meta else None

    # SecUid extraction if present
    sec_uid = None
    sec_match = re.search(r'"secUid":"([A-Za-z0-9_-]+)"', resp.text)
    # Entity extraction from description
    from app.recon.telegram_ultimate_scraper import extract_entities_from_text
    entities = extract_entities_from_text(desc_text)

    return {
        "found": bool(user_id or followers),
        "platform": "tiktok",
        "username": target,
        "display_name": display_name,
        "user_id": user_id,
        "sec_uid": sec_uid,
        "created_at_utc": created_at,
        "followers": followers,
        "following": following,
        "likes": likes,
        "avatar_url": avatar_url,
        "url": url,
        "raw_description": desc_text,
        "entities": entities,
    }

async def scrape_tiktok_video(video_url_or_id: str) -> dict:
    """Extracts metadata and precise upload timestamp from a TikTok video URL or ID."""
    target = video_url_or_id.strip()
    video_id = None

    # Extract digits
    m = re.search(r"/video/(\d+)", target) or re.search(r"^(\d+)$", target)
    if m:
        video_id = m.group(1)

    if not video_id:
        return {"error": "Invalid TikTok video URL or ID. Format expected: https://www.tiktok.com/@user/video/1234567890"}

    # Snowflake decoded creation date
    created_at_utc = decode_snowflake_timestamp(video_id)

    headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    }
    url = f"https://www.tiktok.com/embed/v2/{video_id}"
    
    title = None

    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                title_el = soup.find("title")
                title = title_el.text.strip() if title_el else None
    except Exception:
        pass

    return {
        "video_id": video_id,
        "created_at_utc": created_at_utc,
        "title": title,
        "url": f"https://www.tiktok.com/video/{video_id}",
    }


async def scrape_tiktok_ultimate(username_or_url: str, use_tor: bool = False) -> dict:
    """Performs deep OSINT reconnaissance on a TikTok target."""
    profile = await scrape_tiktok_profile(username_or_url)
    if not profile.get("found"):
        return profile

    entities = profile.get("entities", {})
    return {
        "profile": profile,
        "aggregated_intel": {
            "crypto_wallets": sorted(list(set(entities.get("btc", []) + entities.get("eth", []) + entities.get("tron", []) + entities.get("sol", [])))),
            "emails": sorted(list(set(entities.get("emails", [])))),
            "phones": sorted(list(set(entities.get("phones", [])))),
            "mentions": sorted(list(set(entities.get("mentions", [])))),
            "hashtags": sorted(list(set(entities.get("hashtags", [])))),
            "onion_links": sorted(list(set(entities.get("onion_links", [])))),
            "urls": sorted(list(set(entities.get("urls", [])))),
        }
    }

