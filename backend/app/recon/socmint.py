"""
SOCMINT — Social Media Intelligence Module
Adapted from:
  - SnapIntel (Kr0wZ) — https://github.com/Kr0wZ/SnapIntel
  - Snapchat-Checker (OSINT-Trace) — https://github.com/OSINT-Trace/Snapchat-Checker
  - Social-Media-OSINT (The-Osint-Toolbox) — https://github.com/The-Osint-Toolbox/Social-Media-OSINT
  - OSINT-Tools-Library (The-OSINT-Newsletter) — https://github.com/The-OSINT-Newsletter/OSINT-Tools-Library
  - Social-Media-OSINT-Tools-CollectionNow (SENSEiXENUS) — github.com/SENSEiXENUS/Social-Media-OSINT-Tools-CollectionNow
"""

import re
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

SNAP_BASE = "https://www.snapchat.com/add/"
SNAP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# JSON data paths derived from SnapIntel config.json
_SNAP_PATHS = {
    "pageType":             "props.pageProps.pageMetadata.pageType",
    "pageTitle":            "props.pageProps.pageMetadata.pageTitle",
    "username":             "props.pageProps.userProfile.publicProfileInfo.username",
    "displayName":          "props.pageProps.userProfile.userInfo.displayName",
    "bio":                  "props.pageProps.userProfile.publicProfileInfo.bio",
    "subscriberCount":      "props.pageProps.userProfile.publicProfileInfo.subscriberCount",
    "profilePictureUrl":    "props.pageProps.userProfile.publicProfileInfo.profilePictureUrl",
    "snapcodeImageUrl":     "props.pageProps.userProfile.publicProfileInfo.snapcodeImageUrl",
    "squareHeroImageUrl":   "props.pageProps.userProfile.publicProfileInfo.squareHeroImageUrl",
    "websiteUrl":           "props.pageProps.userProfile.publicProfileInfo.websiteUrl",
    "badge":                "props.pageProps.userProfile.publicProfileInfo.badge",
    "hasCuratedHighlights": "props.pageProps.userProfile.publicProfileInfo.hasCuratedHighlights",
    "hasSpotlightHighlights":"props.pageProps.userProfile.publicProfileInfo.hasSpotlightHighlights",
    # Private user fallback
    "private_username":     "props.pageProps.userProfile.userInfo.username",
    "avatarImageUrl":       "props.pageProps.userProfile.userInfo.bitmoji3d.avatarImage.url",
    "private_snapcodeUrl":  "props.pageProps.userProfile.userInfo.snapcodeImageUrl",
    # Content counts
    "story":                "props.pageProps.story.snapList",
    "curatedHighlights":    "props.pageProps.curatedHighlights",
    "spotlightHighlights":  "props.pageProps.spotlightHighlights",
    "lenses":               "props.pageProps.lenses",
}

# Simple in-memory cache
_cache: Dict[str, Any] = {}

def _cached(key: str, ttl: int = 300) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and (datetime.now(timezone.utc).timestamp() - entry["ts"]) < ttl:
        return entry["data"]
    return None

def _set_cache(key: str, data: Any):
    _cache[key] = {"ts": datetime.now(timezone.utc).timestamp(), "data": data}


def _resolve_path(data: dict, path: str) -> Any:
    """Traverse a dot-separated path into a nested dict."""
    parts = path.split(".")
    node = data
    for part in parts:
        if not isinstance(node, dict):
            return None
        node = node.get(part)
        if node is None:
            return None
    return node


def _extract_next_json(html: str) -> Optional[dict]:
    """
    Extract the __NEXT_DATA__ JSON blob embedded by Snapchat's Next.js page.
    SnapIntel technique: parse <script id="__NEXT_DATA__"> tag.
    """
    match = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html, re.DOTALL
    )
    if not match:
        # Fallback: look for application/json script with props
        match = re.search(
            r'<script[^>]+type=["\']application/json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL
        )
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


async def snap_profile(username: str) -> Dict[str, Any]:
    """
    Fetch public Snapchat profile intel for a username.
    Uses the same technique as SnapIntel (Kr0wZ): GET snapchat.com/add/{username}
    and parse __NEXT_DATA__ JSON embedded in the page.
    """
    username = username.strip().lower()
    cache_key = f"snap_profile_{username}"
    cached = _cached(cache_key, 180)
    if cached:
        return cached

    url = SNAP_BASE + username
    try:
        async with httpx.AsyncClient(headers=SNAP_HEADERS, timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(url)

        if resp.status_code == 404:
            result = {
                "found": False,
                "username": username,
                "error": "Account not found or deleted",
                "profile_url": url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            _set_cache(cache_key, result)
            return result

        if resp.status_code != 200:
            return {
                "found": False,
                "username": username,
                "error": f"Snapchat returned HTTP {resp.status_code}",
                "profile_url": url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        html = resp.text

        # Detect 404 / user not found page
        if "Sorry, this page isn" in html or "pageNotFound" in html.lower():
            result = {
                "found": False,
                "username": username,
                "error": "Account not found",
                "profile_url": url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            _set_cache(cache_key, result)
            return result

        next_data = _extract_next_json(html)
        if not next_data:
            return {
                "found": True,
                "username": username,
                "error": "Could not parse page JSON — Snapchat may have changed their structure",
                "profile_url": url,
                "raw_size": len(html),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Determine if public or private
        page_type = _resolve_path(next_data, _SNAP_PATHS["pageType"])
        is_private = page_type not in ("publicProfile", "creator") if page_type else True

        # Resolve fields
        if is_private:
            resolved_username = _resolve_path(next_data, _SNAP_PATHS["private_username"]) or username
            avatar_url = _resolve_path(next_data, _SNAP_PATHS["avatarImageUrl"])
            snapcode_url = _resolve_path(next_data, _SNAP_PATHS["private_snapcodeUrl"])
            result = {
                "found": True,
                "is_private": True,
                "username": resolved_username,
                "display_name": _resolve_path(next_data, _SNAP_PATHS["displayName"]),
                "profile_url": url,
                "profile_picture_url": avatar_url,
                "snapcode_url": snapcode_url,
                "badge": None,
                "bio": None,
                "subscriber_count": None,
                "website_url": None,
                "has_stories": False,
                "has_curated_highlights": False,
                "has_spotlight": False,
                "stories_count": 0,
                "highlights_count": 0,
                "spotlights_count": 0,
                "lenses_count": 0,
                "note": "Account is private — limited public data available",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        else:
            stories = _resolve_path(next_data, _SNAP_PATHS["story"]) or []
            curated = _resolve_path(next_data, _SNAP_PATHS["curatedHighlights"]) or []
            spotlights = _resolve_path(next_data, _SNAP_PATHS["spotlightHighlights"]) or []
            lenses = _resolve_path(next_data, _SNAP_PATHS["lenses"]) or []

            result = {
                "found": True,
                "is_private": False,
                "username": _resolve_path(next_data, _SNAP_PATHS["username"]) or username,
                "display_name": _resolve_path(next_data, _SNAP_PATHS["displayName"]),
                "page_type": page_type,
                "badge": _resolve_path(next_data, _SNAP_PATHS["badge"]),
                "bio": _resolve_path(next_data, _SNAP_PATHS["bio"]),
                "subscriber_count": _resolve_path(next_data, _SNAP_PATHS["subscriberCount"]),
                "profile_url": url,
                "profile_picture_url": _resolve_path(next_data, _SNAP_PATHS["profilePictureUrl"]),
                "snapcode_url": _resolve_path(next_data, _SNAP_PATHS["snapcodeImageUrl"]),
                "hero_image_url": _resolve_path(next_data, _SNAP_PATHS["squareHeroImageUrl"]),
                "website_url": _resolve_path(next_data, _SNAP_PATHS["websiteUrl"]),
                "has_stories": len(stories) > 0,
                "has_curated_highlights": bool(_resolve_path(next_data, _SNAP_PATHS["hasCuratedHighlights"])),
                "has_spotlight": bool(_resolve_path(next_data, _SNAP_PATHS["hasSpotlightHighlights"])),
                "stories_count": len(stories),
                "highlights_count": len(curated),
                "spotlights_count": len(spotlights),
                "lenses_count": len(lenses),
                "stories_preview": [
                    {
                        "index": s.get("snapIndex"),
                        "type": "video" if s.get("snapMediaType", 0) == 1 else "image",
                        "url": (s.get("snapUrls") or {}).get("mediaUrl"),
                        "timestamp": s.get("timestampInSec", {}).get("value"),
                    }
                    for s in (stories[:5] if stories else [])
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        _set_cache(cache_key, result)
        return result

    except httpx.TimeoutException:
        return {
            "found": False,
            "username": username,
            "error": "Request timed out — Snapchat may be rate-limiting",
            "profile_url": url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"[SOCMINT] snap_profile error for {username}: {e}")
        return {
            "found": False,
            "username": username,
            "error": str(e),
            "profile_url": url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def get_socmint_tool_directory() -> Dict[str, Any]:
    """
    Returns a curated SOCMINT tool directory compiled from:
    - Social-Media-OSINT (The-Osint-Toolbox)
    - Social-Media-OSINT-Tools-CollectionNow (SENSEiXENUS)
    - OSINT-Tools-Library (The-OSINT-Newsletter)
    """
    tools = {
        "snapchat": [
            {"name": "Snap Map", "url": "https://map.snapchat.com", "desc": "Real-time public story geolocation heatmap", "type": "live_map", "free": True},
            {"name": "SnapIntel", "url": "https://github.com/Kr0wZ/SnapIntel", "desc": "Stories, highlights, spotlights, bitmoji & lenses intel (CLI)", "type": "cli_tool", "free": True},
            {"name": "Snapchat Checker API", "url": "https://osinttrace.com", "desc": "Enterprise API: verify accounts, extract Bitmoji, subscriber count, Snapcode (paid)", "type": "api", "free": False},
            {"name": "Snapchat Profile URL", "url": "https://www.snapchat.com/add/{username}", "desc": "Direct public profile page — use username to access", "type": "direct_link", "free": True},
            {"name": "GhostCodes", "url": "https://www.ghostcodes.com", "desc": "Snapchat user discovery by category/location", "type": "directory", "free": True},
        ],
        "instagram": [
            {"name": "Dumpor", "url": "https://dumpor.com", "desc": "Anonymous Instagram profile, story & post viewer", "type": "viewer", "free": True},
            {"name": "Inflact Profile Viewer", "url": "https://inflact.com/profiles/instagram/viewer/", "desc": "Anonymous Instagram profile viewer without login", "type": "viewer", "free": True},
            {"name": "ExportGram", "url": "https://exportgram.com", "desc": "Export Instagram followers/following lists", "type": "export", "free": True},
            {"name": "Instaloader", "url": "https://github.com/instaloader/instaloader", "desc": "CLI: download pics, videos, captions & metadata", "type": "cli_tool", "free": True},
            {"name": "Story Saver", "url": "https://storiesig.info", "desc": "View and download Instagram stories anonymously", "type": "viewer", "free": True},
            {"name": "Instagram Map", "url": "https://www.picuki.com/map", "desc": "Geographic map of geotagged Instagram posts", "type": "live_map", "free": True},
            {"name": "Snapinsta", "url": "https://snapinsta.app", "desc": "Download Photos, Videos, Reels & IGTV from public accounts", "type": "downloader", "free": True},
            {"name": "IMGinn", "url": "https://imginn.io", "desc": "View & download all Instagram content without account", "type": "viewer", "free": True},
        ],
        "twitter_x": [
            {"name": "Nitter", "url": "https://nitter.net", "desc": "Privacy-respecting Twitter/X frontend without tracking", "type": "viewer", "free": True},
            {"name": "TweeterID", "url": "https://tweeterid.com", "desc": "Convert Twitter username ↔ numeric user ID", "type": "id_lookup", "free": True},
            {"name": "Sotwe", "url": "https://www.sotwe.com", "desc": "Anonymous Twitter/X profile and tweet viewer", "type": "viewer", "free": True},
            {"name": "BirdHunt", "url": "https://birdhunt.co", "desc": "Twitter/X user and tweet geolocation search", "type": "geo_search", "free": True},
            {"name": "Twitter Viewer", "url": "https://twitterviewer.com", "desc": "View tweets, profiles & media without logging in", "type": "viewer", "free": True},
            {"name": "Who Posted What", "url": "https://whopostedwhat.com", "desc": "Facebook/Twitter keyword search by date for investigators", "type": "search", "free": True},
            {"name": "Hashatit", "url": "https://www.hashatit.com", "desc": "Multi-platform hashtag search engine", "type": "search", "free": True},
        ],
        "facebook": [
            {"name": "Facebook Recover Lookup", "url": "https://www.facebook.com/login/identify?ctx=recover", "desc": "Check if email/phone is linked to any FB account", "type": "enumeration", "free": True},
            {"name": "Lookup-id.com", "url": "https://lookup-id.com", "desc": "Find Facebook numeric profile/group ID from URL", "type": "id_lookup", "free": True},
            {"name": "SOWsearch", "url": "https://www.sowsearch.info", "desc": "Advanced Facebook search with filter interface", "type": "search", "free": True},
            {"name": "Facebook Matrix", "url": "https://plessas.net/facebookmatrix", "desc": "Boolean search formulas for Facebook OSINT", "type": "dork_engine", "free": True},
            {"name": "Export Comments", "url": "https://exportcomments.com", "desc": "Export all post comments to Excel from any social platform", "type": "export", "free": True},
            {"name": "AnalyzeID", "url": "https://analyzeid.com", "desc": "Find sites sharing same Facebook App ID (same owner)", "type": "correlation", "free": True},
            {"name": "Social Searcher", "url": "https://www.social-searcher.com", "desc": "Monitor all public social mentions across networks", "type": "monitoring", "free": True},
        ],
        "linkedin": [
            {"name": "RecruitIn", "url": "https://recruitin.net", "desc": "Build Google boolean strings to search LinkedIn profiles", "type": "dork_engine", "free": True},
            {"name": "RocketReach", "url": "https://rocketreach.co", "desc": "Search & lookup contact info across 700M+ professionals", "type": "people_search", "free": False},
            {"name": "LinkedIn Boolean Search", "url": "https://linkedprospect.com/linkedin-boolean-search-tool/", "desc": "Targeted boolean search builder for LinkedIn", "type": "dork_engine", "free": True},
            {"name": "Phantom Buster", "url": "https://phantombuster.com", "desc": "LinkedIn data extraction automation suite", "type": "scraper", "free": False},
        ],
        "reddit": [
            {"name": "Pushshift Reddit", "url": "https://www.reddit.com/r/pushshift/", "desc": "Historical Reddit post/comment archive search", "type": "archive", "free": True},
            {"name": "Reddit User Analyzer", "url": "https://www.reddit-user-analyser.netlify.app", "desc": "Visualize Reddit user activity, top subs & posting patterns", "type": "analytics", "free": True},
            {"name": "Karma Decay", "url": "http://karmadecay.com", "desc": "Reverse image search within Reddit posts", "type": "image_search", "free": True},
        ],
        "telegram": [
            {"name": "Lyzem", "url": "https://lyzem.com", "desc": "Telegram channel & message search engine", "type": "search", "free": True},
            {"name": "TGStat", "url": "https://tgstat.com", "desc": "Analytics and statistics for Telegram channels", "type": "analytics", "free": True},
            {"name": "Telemetr.io", "url": "https://telemetr.io", "desc": "Telegram channel monitoring and subscriber tracking", "type": "monitoring", "free": False},
            {"name": "IntelX Telegram Search", "url": "https://intelx.io/?s=telegram", "desc": "Intelligence X search for Telegram content", "type": "search", "free": False},
        ],
        "multi_platform": [
            {"name": "Sherlock", "url": "https://github.com/sherlock-project/sherlock", "desc": "Hunt usernames across 400+ social networks", "type": "cli_tool", "free": True},
            {"name": "Maigret", "url": "https://github.com/soxoj/maigret", "desc": "Collect accounts by username from thousands of sites", "type": "cli_tool", "free": True},
            {"name": "Social Analyzer", "url": "https://github.com/qeeqbox/social-analyzer", "desc": "Find & verify social media profiles across platforms", "type": "framework", "free": True},
            {"name": "WhatsMyName", "url": "https://whatsmyname.app", "desc": "Username enumeration across 600+ sites", "type": "enumeration", "free": True},
            {"name": "Namechk", "url": "https://namechk.com", "desc": "Check username availability across all social networks", "type": "enumeration", "free": True},
            {"name": "OSINT Industries", "url": "https://osint.industries", "desc": "Email/phone pivot — finds linked social accounts", "type": "pivot", "free": False},
            {"name": "Pipl", "url": "https://pipl.com", "desc": "Deep people search across social & public records", "type": "people_search", "free": False},
            {"name": "Social Searcher", "url": "https://www.social-searcher.com", "desc": "Real-time social monitoring across 12+ networks", "type": "monitoring", "free": True},
            {"name": "SpiderFoot HX", "url": "https://www.spiderfoot.net", "desc": "OSINT automation — social media, domains, emails, IPs", "type": "framework", "free": False},
        ],
        "youtube": [
            {"name": "YouTube Comment Finder", "url": "https://ytcomment.kmcat.xyz", "desc": "Search comments across YouTube channels/videos", "type": "search", "free": True},
            {"name": "YT Metadata", "url": "https://mattw.io/youtube-metadata/", "desc": "Extract full metadata from any YouTube video or channel", "type": "metadata", "free": True},
            {"name": "Amnesty YouTube DataViewer", "url": "https://citizenevidence.amnestyusa.org", "desc": "Extract & verify YouTube video upload metadata + thumbnails", "type": "verification", "free": True},
        ],
    }

    return {
        "tools": tools,
        "total": sum(len(v) for v in tools.values()),
        "categories": list(tools.keys()),
        "sources": [
            "Kr0wZ/SnapIntel",
            "OSINT-Trace/Snapchat-Checker",
            "The-Osint-Toolbox/Social-Media-OSINT",
            "SENSEiXENUS/Social-Media-OSINT-Tools-CollectionNow",
            "The-OSINT-Newsletter/OSINT-Tools-Library",
            "SudoSuu/SnapchatUsernameChecker",
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
