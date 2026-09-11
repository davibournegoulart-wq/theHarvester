"""Osintgram Engine — Instagram Comprehensive Reconnaissance & Shell Suite.

Adapted from Datalux (Datalux/Osintgram).
Collects target info, AI accessibility descriptions (photodes), hashtag frequency,
email/phone contact harvesting (fwersemail/fwersnumber), tagged accounts,
geolocated addresses (addrs), and mirror viewer pivots.
"""

import re
import html
import logging
from collections import Counter
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup
from app.config import settings
from app.checkers.social_id_pivot import extract_instagram_id

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}")


async def run_osintgram_recon(
    username: str,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Runs a full Osintgram reconnaissance scan against an Instagram username."""
    clean_user = username.strip().lstrip("@").lower()
    if "/" in clean_user:
        m = re.search(r"instagram\.com/([^/?#]+)", clean_user)
        if m:
            clean_user = m.group(1).lower()

    proxies = (
        {"http://": settings.tor_proxy_url, "https://": settings.tor_proxy_url}
        if use_tor and settings.tor_proxy_url
        else None
    )

    # 1. Permanent Numeric ID
    numeric_id_info = await extract_instagram_id(clean_user)
    numeric_id = getattr(numeric_id_info, "user_id", None)

    # 2. Fetch public profile via crawler User-Agent
    crawler_headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    profile_data: Dict[str, Any] = {
        "username": clean_user,
        "numeric_id": numeric_id,
        "full_name": "",
        "biography": "",
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "is_verified": False,
        "is_private": False,
        "external_url": None,
        "profile_pic_url": None,
        "category_name": None,
    }

    raw_html = ""
    try:
        async with httpx.AsyncClient(proxies=proxies, timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(f"https://www.instagram.com/{clean_user}/", headers=crawler_headers)
            if resp.status_code == 200:
                raw_html = resp.text
                soup = BeautifulSoup(raw_html, "html.parser")

                og_desc = soup.find("meta", property="og:description")
                if og_desc and og_desc.get("content"):
                    content = og_desc["content"]
                    # Format: "10K Followers, 500 Following, 120 Posts - See Instagram photos and videos from Name (@user)"
                    m_f = re.search(r"([0-9.,KkMmBb]+)\s+Followers", content)
                    m_ing = re.search(r"([0-9.,KkMmBb]+)\s+Following", content)
                    m_p = re.search(r"([0-9.,KkMmBb]+)\s+Posts", content)
                    if m_f:
                        profile_data["followers_count_str"] = m_f.group(1)
                    if m_ing:
                        profile_data["following_count_str"] = m_ing.group(1)
                    if m_p:
                        profile_data["posts_count_str"] = m_p.group(1)

                og_title = soup.find("meta", property="og:title")
                if og_title and og_title.get("content"):
                    # Format: "Full Name (@username) • Instagram photos and videos"
                    t_text = og_title["content"]
                    m_title = re.match(r"^(.*?)\s*\(@", t_text)
                    if m_title:
                        profile_data["full_name"] = m_title.group(1).strip()

                og_img = soup.find("meta", property="og:image")
                if og_img and og_img.get("content"):
                    profile_data["profile_pic_url"] = og_img["content"]

                # Extract bio from meta or title tags
                desc_meta = soup.find("meta", attrs={"name": "description"})
                if desc_meta and desc_meta.get("content"):
                    bio_content = desc_meta["content"]
                    bio_clean = re.sub(r"^[0-9.,KkMmBb]+\s+Followers.*?-", "", bio_content)
                    bio_clean = re.sub(r"See Instagram photos and videos from.*$", "", bio_clean).strip()
                    if bio_clean and not bio_clean.startswith('"'):
                        profile_data["biography"] = html.unescape(bio_clean)
    except Exception as e:
        logger.warning(f"Error fetching Instagram HTML for {clean_user}: {e}")

    # 3. Osintgram Commands Extraction
    all_text = f"{profile_data['full_name']} {profile_data['biography']} {raw_html}"

    # - fwersemail / fwersnumber (Emails and Phone numbers)
    raw_emails = set(EMAIL_REGEX.findall(all_text))
    # Exclude Instagram system emails
    clean_emails = [e for e in raw_emails if not e.endswith((".png", ".jpg", ".js", "instagram.com", "facebook.com", "fb.com"))]

    raw_phones = PHONE_REGEX.findall(f"{profile_data['biography']} {profile_data['full_name']}")
    clean_phones = [p.strip() for p in set(raw_phones) if len(re.sub(r"\D", "", p)) >= 8]

    # - captions & hashtags (Hashtags cloud)
    hashtags = re.findall(r"#([a-zA-Z0-9_\u00C0-\u00FF]+)", all_text)
    hashtag_counts = [
        {"tag": f"#{tag}", "count": count}
        for tag, count in Counter(hashtags).most_common(25)
        if not tag.lower() in ["instagram", "insta", "instagood", "photooftheday"]
    ]

    # - tagged accounts (Mentions)
    mentions = re.findall(r"@([a-zA-Z0-9._]{3,30})", profile_data["biography"])
    tagged_accounts = [
        {"username": m, "url": f"https://www.instagram.com/{m}/"}
        for m in set(mentions)
        if m.lower() != clean_user
    ]

    # - photodes (AI accessibility descriptions)
    # Instagram injects alt attributes: "Image may contain: person, outdoors, sky"
    alt_descriptions = re.findall(r'alt="([^"]*?(?:Image may contain|May be an image of|Photo by)[^"]*?)"', raw_html, re.IGNORECASE)
    cleaned_photodes = list(set([html.unescape(d) for d in alt_descriptions]))

    # - addrs (Geotagged locations in text/meta)
    locations = []
    location_matches = re.findall(r'"location":\{"name":"([^"]+)"', raw_html)
    for loc in set(location_matches):
        locations.append({"name": loc, "type": "tagged_location"})

    # 4. Anonymous Mirrors
    mirrors = {
        "picuki": f"https://www.picuki.com/profile/{clean_user}",
        "imginn": f"https://imginn.com/{clean_user}/",
        "dumpor": f"https://dumpor.io/v/{clean_user}",
        "storiesig": f"https://storiesig.info/en/{clean_user}/",
        "gramhir": f"https://gramhir.com/profile/{clean_user}",
        "greatfon": f"https://greatfon.com/v/{clean_user}",
    }

    return {
        "target": clean_user,
        "profile": profile_data,
        "osintgram_modules": {
            "info": {
                "username": clean_user,
                "numeric_id": numeric_id,
                "full_name": profile_data["full_name"],
                "biography": profile_data["biography"],
                "followers": profile_data.get("followers_count_str", "Private/Restricted"),
                "following": profile_data.get("following_count_str", "Private/Restricted"),
                "posts": profile_data.get("posts_count_str", "Private/Restricted"),
                "profile_pic": profile_data["profile_pic_url"],
            },
            "fwersemail": clean_emails,
            "fwersnumber": clean_phones,
            "hashtags": hashtag_counts,
            "tagged": tagged_accounts,
            "photodes": cleaned_photodes,
            "addrs": locations,
            "mirrors": mirrors,
        },
    }
