"""Instaloader Intelligence & Media Extraction Engine.

Adapted from Alexander Graf (instaloader/instaloader).
Extracts profile metadata, posts, reels, stories, highlights, and comments.
Seamlessly falls back to crawler bypass and mirror proxies if Instagram blocks anonymous requests.
"""

import os
import re
import html
import asyncio
import logging
import tempfile
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup
import instaloader

from app.config import settings
from app.checkers.social_id_pivot import extract_instagram_id

logger = logging.getLogger(__name__)


def get_instaloader_instance(
    username_auth: Optional[str] = None,
    password_auth: Optional[str] = None,
    session_file: Optional[str] = None,
    use_tor: bool = False,
) -> instaloader.Instaloader:
    """Configures an Instaloader instance with optional credentials and proxy."""
    L = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
    )

    if use_tor and settings.tor_proxy_url:
        L.context._session.proxies = {
            "http": settings.tor_proxy_url,
            "https": settings.tor_proxy_url,
        }

    if session_file and os.path.exists(session_file):
        try:
            L.load_session_from_file(username_auth or "default", filename=session_file)
        except Exception as e:
            logger.warning(f"Failed loading Instaloader session: {e}")
    elif username_auth and password_auth:
        try:
            L.login(username_auth, password_auth)
        except Exception as e:
            logger.warning(f"Failed Instaloader login for {username_auth}: {e}")

    return L


async def instaloader_fetch_profile(
    target_username: str,
    username_auth: Optional[str] = None,
    password_auth: Optional[str] = None,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Fetches full Instagram profile intel using Instaloader with crawler fallback."""
    clean_user = target_username.strip().lstrip("@").lower()
    if "/" in clean_user:
        m = re.search(r"instagram\.com/([^/?#]+)", clean_user)
        if m:
            clean_user = m.group(1).lower()

    # Step 1: Extract permanent numeric ID
    id_res = await extract_instagram_id(clean_user)
    numeric_id = getattr(id_res, "user_id", None)

    # Step 2: Try native Instaloader
    try:
        def _sync_fetch():
            L = get_instaloader_instance(username_auth, password_auth, use_tor=use_tor)
            profile = instaloader.Profile.from_username(L.context, clean_user)
            return {
                "username": profile.username,
                "numeric_id": str(profile.userid),
                "full_name": profile.full_name,
                "biography": profile.biography,
                "external_url": profile.external_url,
                "followers": profile.followers,
                "following": profile.followees,
                "posts_count": profile.mediacount,
                "is_verified": profile.is_verified,
                "is_private": profile.is_private,
                "is_business": profile.is_business_account,
                "category": profile.business_category_name,
                "profile_pic_url": profile.profile_pic_url,
                "source": "instaloader_native",
            }

        result = await asyncio.to_thread(_sync_fetch)
        result["numeric_id"] = numeric_id or result.get("numeric_id")
        result["mirrors"] = {
            "picuki": f"https://www.picuki.com/profile/{clean_user}",
            "imginn": f"https://imginn.com/{clean_user}/",
            "dumpor": f"https://dumpor.io/v/{clean_user}",
            "storiesig": f"https://storiesig.info/en/{clean_user}/",
        }
        return result
    except Exception as e:
        logger.info(f"Native Instaloader profile fetch failed ({e}); switching to crawler fallback.")

    # Step 3: Crawler Fallback (bypasses login wall without tokens)
    proxies = (
        {"http://": settings.tor_proxy_url, "https://": settings.tor_proxy_url}
        if use_tor and settings.tor_proxy_url
        else None
    )
    headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    fallback_data = {
        "username": clean_user,
        "numeric_id": numeric_id,
        "full_name": clean_user,
        "biography": "",
        "external_url": None,
        "followers": None,
        "following": None,
        "posts_count": None,
        "is_verified": False,
        "is_private": False,
        "is_business": False,
        "category": None,
        "profile_pic_url": None,
        "source": "crawler_fallback",
        "mirrors": {
            "picuki": f"https://www.picuki.com/profile/{clean_user}",
            "imginn": f"https://imginn.com/{clean_user}/",
            "dumpor": f"https://dumpor.io/v/{clean_user}",
            "storiesig": f"https://storiesig.info/en/{clean_user}/",
        },
    }

    try:
        async with httpx.AsyncClient(proxies=proxies, timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(f"https://www.instagram.com/{clean_user}/", headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                og_desc = soup.find("meta", property="og:description")
                if og_desc and og_desc.get("content"):
                    desc = og_desc["content"]
                    m_f = re.search(r"([0-9.,KkMmBb]+)\s+Followers", desc)
                    m_ing = re.search(r"([0-9.,KkMmBb]+)\s+Following", desc)
                    m_p = re.search(r"([0-9.,KkMmBb]+)\s+Posts", desc)
                    if m_f:
                        fallback_data["followers"] = m_f.group(1)
                    if m_ing:
                        fallback_data["following"] = m_ing.group(1)
                    if m_p:
                        fallback_data["posts_count"] = m_p.group(1)

                og_title = soup.find("meta", property="og:title")
                if og_title and og_title.get("content"):
                    t = og_title["content"]
                    m_name = re.match(r"^(.*?)\s*\(@", t)
                    if m_name:
                        fallback_data["full_name"] = m_name.group(1).strip()

                og_img = soup.find("meta", property="og:image")
                if og_img and og_img.get("content"):
                    fallback_data["profile_pic_url"] = og_img["content"]

                desc_tag = soup.find("meta", attrs={"name": "description"})
                if desc_tag and desc_tag.get("content"):
                    bio_txt = re.sub(r"^[0-9.,KkMmBb]+\s+Followers.*?-", "", desc_tag["content"])
                    bio_txt = re.sub(r"See Instagram photos and videos from.*$", "", bio_txt).strip()
                    fallback_data["biography"] = html.unescape(bio_txt)
    except Exception as err:
        logger.warning(f"Instaloader crawler fallback error: {err}")

    return fallback_data


async def instaloader_fetch_post(
    shortcode_or_url: str,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Fetches details of a specific Instagram post/reel via Instaloader."""
    clean_val = shortcode_or_url.strip()
    match = re.search(r"/(?:p|reel|tv)/([A-Za-z0-9_-]+)", clean_val)
    shortcode = match.group(1) if match else clean_val

    # Try native Instaloader
    try:
        def _sync_post():
            L = get_instaloader_instance(use_tor=use_tor)
            post = instaloader.Post.from_shortcode(L.context, shortcode)
            return {
                "shortcode": post.shortcode,
                "author": post.owner_username,
                "date_utc": post.date_utc.isoformat() if post.date_utc else None,
                "caption": post.caption or "",
                "likes": post.likes,
                "comments": post.comments,
                "is_video": post.is_video,
                "video_url": post.video_url if post.is_video else None,
                "display_url": post.url,
                "location": post.location.name if post.location else None,
                "tagged_users": post.tagged_users,
                "source": "instaloader_native",
            }

        res = await asyncio.to_thread(_sync_post)
        res["mirrors"] = {
            "picuki": f"https://www.picuki.com/media/{shortcode}",
            "imginn": f"https://imginn.com/p/{shortcode}/",
        }
        return res
    except Exception as e:
        logger.info(f"Instaloader native post fetch failed ({e}); returning shortcode wrapper.")

    return {
        "shortcode": shortcode,
        "author": "Unknown",
        "date_utc": None,
        "caption": f"Instagram Post shortcode {shortcode}",
        "likes": None,
        "comments": None,
        "is_video": False,
        "video_url": None,
        "display_url": None,
        "source": "manual_wrapper",
        "mirrors": {
            "picuki": f"https://www.picuki.com/media/{shortcode}",
            "imginn": f"https://imginn.com/p/{shortcode}/",
        },
    }
