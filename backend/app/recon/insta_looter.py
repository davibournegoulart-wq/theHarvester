"""InstaLooter Recon & Media Scraping Engine.

Adapted from:
- althonos/InstaLooter (Python CLI & batch media downloader without API keys)
- stask/insta-looter (Clojure library for profile, post, and search looting)
- bakercp/ofxInstaLooter (Interactive investigator UI & media looting queues)

Provides:
1. Profile Intelligence & Metadata Looting (permanent numeric profile_id, followers, following, posts, bio, avatar, verified)
2. Post / Reel Media Looting (shortcode, caption, direct media CDN link, video/image type, likes, comments)
3. Anonymous Web Mirror generation (Picuki, Imginn, Dumpor, StoriesIG) to view restricted/login-gated stories
4. CLI Subprocess Executor (running `instalooter` with dump-json or media download)
5. Direct Attachment to Active Case Databank
"""

import asyncio
import os
import re
import tempfile
import uuid
from dataclasses import asdict, dataclass, field
from html import unescape
from typing import Any, Optional

import httpx

from app.checkers.social_id_pivot import extract_instagram_id
from app.config import settings

CRAWLER_HEADERS = {
    "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


@dataclass
class InstaProfileLoot:
    username: str
    profile_id: Optional[str] = None
    full_name: str = ""
    biography: str = ""
    followers_count: str = "0"
    following_count: str = "0"
    posts_count: str = "0"
    profile_pic_url: Optional[str] = None
    profile_url: str = ""
    is_verified: bool = False
    is_private: bool = False
    mirrors: dict[str, str] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class InstaPostLoot:
    shortcode: str
    post_url: str
    owner_username: Optional[str] = None
    caption: str = ""
    media_url: Optional[str] = None
    media_type: str = "image"  # image, video, carousel
    likes_count: Optional[str] = None
    comments_count: Optional[str] = None
    taken_at: Optional[str] = None
    mirrors: dict[str, str] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class InstaCliLootResult:
    target: str
    target_type: str
    files_looted: list[dict[str, Any]] = field(default_factory=list)
    raw_output: str = ""
    success: bool = True
    error: Optional[str] = None


async def loot_profile(username: str, use_tor: bool = False) -> InstaProfileLoot:
    """Loots Instagram profile metadata, permanent numeric ID, bio, follower metrics, and avatar."""
    clean_user = username.strip().lstrip("@").lower()
    if not clean_user:
        return InstaProfileLoot(username="", error="Username cannot be empty")

    profile_url = f"https://www.instagram.com/{clean_user}/"
    mirrors = {
        "Imginn": f"https://imginn.com/{clean_user}/",
        "Picuki": f"https://www.picuki.com/profile/{clean_user}",
        "Dumpor": f"https://dumpor.io/v/{clean_user}",
        "StoriesIG": f"https://storiesig.info/en/{clean_user}/",
    }

    # 1. Fetch permanent numeric user ID via social_id_pivot
    profile_id: Optional[str] = None
    try:
        id_res = await extract_instagram_id(clean_user)
        profile_id = id_res.user_id
    except Exception:
        profile_id = None

    # 2. Fetch page using crawler UA
    proxy = settings.tor_proxy_url if use_tor else None
    html = ""
    try:
        async with httpx.AsyncClient(headers=CRAWLER_HEADERS, proxy=proxy, follow_redirects=True) as client:
            r = await client.get(profile_url, timeout=12.0)
            if r.status_code == 200:
                html = r.text
            elif r.status_code == 404:
                return InstaProfileLoot(
                    username=clean_user,
                    profile_id=profile_id,
                    profile_url=profile_url,
                    mirrors=mirrors,
                    error="Target profile not found (HTTP 404)",
                )
    except Exception as e:
        if not profile_id:
            return InstaProfileLoot(
                username=clean_user,
                profile_url=profile_url,
                mirrors=mirrors,
                error=f"Error connecting to Instagram: {e}",
            )

    # 3. Parse Metadata
    full_name = clean_user
    bio = ""
    followers_str = "0"
    following_str = "0"
    posts_str = "0"
    profile_pic = None
    is_verified = False

    if html:
        clean_html = unescape(html)

        # Title: e.g. "NASA (@nasa) • Instagram photos and videos"
        title_m = re.search(r'<meta property="og:title" content="([^"]+)"', html)
        if title_m:
            title_text = unescape(title_m.group(1))
            name_m = re.search(r"^(.*?)\s*(?:\(@[a-zA-Z0-9._-]+\)|•)", title_text)
            if name_m and name_m.group(1).strip():
                full_name = name_m.group(1).strip()

        # Description: "104M Followers, 95 Following, 4,917 Posts..."
        desc_m = re.search(r'<meta property="og:description" content="([^"]+)"', html)
        if desc_m:
            desc_text = unescape(desc_m.group(1))
            f_m = re.search(r"([\d.,KMkm]+)\s+Followers", desc_text)
            if f_m:
                followers_str = f_m.group(1)
            fg_m = re.search(r"([\d.,KMkm]+)\s+Following", desc_text)
            if fg_m:
                following_str = fg_m.group(1)
            p_m = re.search(r"([\d.,KMkm]+)\s+Posts", desc_text)
            if p_m:
                posts_str = p_m.group(1)

        # Bio extraction
        bio_m = re.search(r'on Instagram:\s*(?:&quot;|["“])([^"”&]+)(?:&quot;|["”])', html)
        if bio_m:
            bio = unescape(bio_m.group(1)).strip()
        else:
            bio_m2 = re.search(r'on Instagram:\s*"([^"]+)"', clean_html)
            if bio_m2:
                bio = bio_m2.group(1).strip()

        # Profile Picture
        pic_m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if pic_m:
            profile_pic = unescape(pic_m.group(1))

        # Verified or private
        if "verified" in html.lower() or "verified_badge" in html.lower():
            is_verified = True

    return InstaProfileLoot(
        username=clean_user,
        profile_id=profile_id,
        full_name=full_name,
        biography=bio,
        followers_count=followers_str,
        following_count=following_str,
        posts_count=posts_str,
        profile_pic_url=profile_pic,
        profile_url=profile_url,
        is_verified=is_verified,
        mirrors=mirrors,
    )


async def loot_post(post_ref: str, use_tor: bool = False) -> InstaPostLoot:
    """Loots Instagram post or reel media, caption, owner, and download link."""
    raw = post_ref.strip()
    if not raw:
        return InstaPostLoot(shortcode="", post_url="", error="Post code or URL cannot be empty")

    # Extract shortcode from URL or raw code
    shortcode = raw
    code_match = re.search(r"instagram\.com/(?:p|reel)/([A-Za-z0-9_-]+)", raw)
    if code_match:
        shortcode = code_match.group(1)
    else:
        clean_code = re.sub(r"[^A-Za-z0-9_-]", "", raw)
        if clean_code:
            shortcode = clean_code

    post_url = f"https://www.instagram.com/p/{shortcode}/"
    mirrors = {
        "Picuki": f"https://www.picuki.com/media/{shortcode}",
        "Imginn": f"https://imginn.com/p/{shortcode}/",
    }

    proxy = settings.tor_proxy_url if use_tor else None
    caption = ""
    media_url = None
    media_type = "image"
    owner_username = None
    likes_count = None
    comments_count = None

    try:
        async with httpx.AsyncClient(headers=CRAWLER_HEADERS, proxy=proxy, follow_redirects=True) as client:
            r = await client.get(post_url, timeout=12.0)
            if r.status_code == 404:
                return InstaPostLoot(
                    shortcode=shortcode,
                    post_url=post_url,
                    mirrors=mirrors,
                    error="Post not found or deleted (HTTP 404)",
                )

            html = r.text
            clean_html = unescape(html)

            # Check video vs image
            video_m = re.search(r'<meta property="og:video(?::secure_url)?" content="([^"]+)"', html)
            if video_m:
                media_url = unescape(video_m.group(1))
                media_type = "video"
            else:
                img_m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
                if img_m:
                    media_url = unescape(img_m.group(1))
                    media_type = "image"

            # Caption from meta description or og:title
            cap_m = re.search(r'on Instagram:\s*(?:&quot;|["“])([^"”&]+)(?:&quot;|["”])', html)
            if cap_m:
                caption = unescape(cap_m.group(1)).strip()
            else:
                desc_m = re.search(r'<meta property="og:description" content="([^"]+)"', html)
                if desc_m:
                    caption = unescape(desc_m.group(1)).strip()

            # Likes & comments
            likes_m = re.search(r"([\d.,KMkm]+)\s+likes", clean_html)
            if likes_m:
                likes_count = likes_m.group(1)
            comms_m = re.search(r"([\d.,KMkm]+)\s+comments", clean_html)
            if comms_m:
                comments_count = comms_m.group(1)

            # Owner username from title
            title_m = re.search(r'<meta property="og:title" content="([^"]+)"', html)
            if title_m:
                author_m = re.search(r"@([A-Za-z0-9._-]+)", title_m.group(1))
                if author_m:
                    owner_username = author_m.group(1)

    except Exception as e:
        return InstaPostLoot(
            shortcode=shortcode,
            post_url=post_url,
            mirrors=mirrors,
            error=f"Failed fetching post: {e}",
        )

    return InstaPostLoot(
        shortcode=shortcode,
        post_url=post_url,
        owner_username=owner_username,
        caption=caption,
        media_url=media_url,
        media_type=media_type,
        likes_count=likes_count,
        comments_count=comments_count,
        mirrors=mirrors,
    )


async def run_instalooter_cli(
    target: str,
    target_type: str = "user",  # "user", "post", "hashtag"
    count: int = 5,
    get_videos: bool = False,
    dump_only: bool = True,
    username_auth: Optional[str] = None,
    password_auth: Optional[str] = None,
) -> InstaCliLootResult:
    """Executes the official InstaLooter CLI inside an isolated sandbox directory."""
    clean_target = target.strip().lstrip("@")
    if not clean_target:
        return InstaCliLootResult(target=target, target_type=target_type, success=False, error="Target cannot be empty")

    with tempfile.TemporaryDirectory(prefix="instalooter_") as tmpdir:
        cmd = ["instalooter", target_type, clean_target, tmpdir, "-n", str(count)]

        if dump_only:
            cmd.append("-D")
        else:
            cmd.append("-d")

        if get_videos:
            cmd.append("-v")

        if username_auth and password_auth:
            cmd.extend(["-u", username_auth, "-p", password_auth])

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
            raw_out = stdout.decode("utf-8", errors="ignore") + "\n" + stderr.decode("utf-8", errors="ignore")

            files_looted = []
            if os.path.exists(tmpdir):
                for fname in os.listdir(tmpdir):
                    fpath = os.path.join(tmpdir, fname)
                    if os.path.isfile(fpath):
                        size = os.path.getsize(fpath)
                        files_looted.append({
                            "filename": fname,
                            "size_bytes": size,
                            "extension": os.path.splitext(fname)[1],
                        })

            return InstaCliLootResult(
                target=clean_target,
                target_type=target_type,
                files_looted=files_looted,
                raw_output=raw_out.strip(),
                success=(proc.returncode == 0 or len(files_looted) > 0),
            )
        except asyncio.TimeoutError:
            return InstaCliLootResult(
                target=clean_target,
                target_type=target_type,
                success=False,
                error="InstaLooter process timed out after 30 seconds",
            )
        except Exception as e:
            return InstaCliLootResult(
                target=clean_target,
                target_type=target_type,
                success=False,
                error=str(e),
            )
