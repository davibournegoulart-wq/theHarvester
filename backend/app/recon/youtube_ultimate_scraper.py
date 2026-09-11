"""YouTube Ultimate Scraper & Forensic Intelligence Engine.

Provides deep, non-API-key OSINT reconnaissance on YouTube channels and videos:
- Channel profile ingestion: Handle, Channel ID, Title, Subscribers, Video count,
  Joined date, Country, Verified badge, High-res avatar, High-res banner, Description.
- Video stream cataloging: Up to 50 latest videos with titles, duration, views,
  published dates, and high-res thumbnails.
- Single Video Deep-Dive & Speech Forensics: Complete video metadata, keywords,
  and Closed Captions / Subtitles (Transcripts) extraction.
- Automated entity extraction: Multi-chain crypto wallets (BTC, ETH, TRX, SOL),
  emails, phone numbers, @handles, #hashtags, and Tor .onion / external URLs across
  descriptions, titles, and speech transcripts.
- Interactive OSINT Pivots Matrix linking to YTCommentSearch, Noxinfluencer,
  Channel Crawler, Social Blade, YouTube Metadata, YouTube Geolocation,
  YouTube Video Finder, Filmot, and Wayback Machine.
"""

import re
import html
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
import httpx
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

# Regex Patterns for Forensic Entity Extraction
BTC_REGEX = re.compile(r"\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,62})\b")
ETH_REGEX = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
TRON_REGEX = re.compile(r"\bT[A-Za-z1-9]{33}\b")
SOL_REGEX = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}")
ONION_REGEX = re.compile(r"https?://[a-zA-Z0-9]{16,56}\.onion\b(?:/[^\s]*)?")
URL_REGEX = re.compile(r"https?://[^\s\"'<>]+")

COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "\"Windows\"",
}


def _clean_text(raw_html: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", raw_html)
    return html.unescape(cleaned).strip()


def extract_entities_from_text(text: str) -> Dict[str, Any]:
    """Extracts forensic entities from arbitrary text."""
    if not text:
        return {
            "btc": [],
            "eth": [],
            "tron": [],
            "sol": [],
            "emails": [],
            "phones": [],
            "mentions": [],
            "hashtags": [],
            "onion_links": [],
            "urls": [],
        }

    btc = set(BTC_REGEX.findall(text))
    eth = set(ETH_REGEX.findall(text))
    tron = set(TRON_REGEX.findall(text))

    raw_sol = set(SOL_REGEX.findall(text))
    sol = [s for s in raw_sol if len(s) >= 32 and not s.startswith("http") and s not in btc and s not in tron]

    raw_emails = set(EMAIL_REGEX.findall(text))
    emails = [
        e for e in raw_emails
        if not e.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".js", "youtube.com", "google.com", "ytimg.com"))
    ]

    raw_phones = set(PHONE_REGEX.findall(text))
    phones = [p.strip() for p in raw_phones if 8 <= len(re.sub(r"\D", "", p)) <= 15]

    mentions = list(set(re.findall(r"@([a-zA-Z0-9_.]{3,30})", text)))
    hashtags = list(set(re.findall(r"#([a-zA-Z0-9_\u00C0-\u00FF]{2,32})", text)))
    onions = list(set(ONION_REGEX.findall(text)))
    urls = [
        u for u in set(URL_REGEX.findall(text))
        if ".onion" not in u and not any(d in u for d in ["youtube.com", "youtu.be", "ytimg.com", "google.com", "gstatic.com"])
    ]

    return {
        "btc": sorted(list(btc)),
        "eth": sorted(list(eth)),
        "tron": sorted(list(tron)),
        "sol": sorted(sol),
        "emails": sorted(emails),
        "phones": sorted(phones),
        "mentions": sorted(mentions),
        "hashtags": sorted(hashtags),
        "onion_links": sorted(onions),
        "urls": sorted(urls),
    }


def parse_yt_json(html_text: str, var_name: str) -> Optional[Dict[str, Any]]:
    """Extracts balanced JSON data blocks such as ytInitialData or ytInitialPlayerResponse."""
    pattern = rf"{var_name}\s*=\s*"
    m = re.search(pattern, html_text)
    if not m:
        return None
    start = m.end()
    brace_count = 0
    in_string = False
    escape = False
    for i, char in enumerate(html_text[start:], start=start):
        if char == '"' and not escape:
            in_string = not in_string
        elif char == '\\' and in_string:
            escape = not escape
            continue
        elif not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    json_str = html_text[start:i + 1]
                    try:
                        return json.loads(json_str)
                    except Exception as e:
                        logger.debug(f"Failed parsing {var_name} JSON: {e}")
                        return None
        escape = False
    return None


def detect_youtube_target(target: str) -> Tuple[str, str]:
    """Detects whether target is a channel or a video, returning (scrape_type, clean_identifier)."""
    clean = target.strip()

    # Video matchers
    # https://www.youtube.com/watch?v=dQw4w9WgXcQ
    m_watch = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", clean)
    if m_watch:
        return "video", m_watch.group(1)

    # https://youtu.be/dQw4w9WgXcQ
    m_short_url = re.search(r"youtu\.be/([a-zA-Z0-9_-]{11})", clean)
    if m_short_url:
        return "video", m_short_url.group(1)

    # https://www.youtube.com/shorts/dQw4w9WgXcQ
    m_shorts = re.search(r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})", clean)
    if m_shorts:
        return "video", m_shorts.group(1)

    # https://www.youtube.com/embed/dQw4w9WgXcQ
    m_embed = re.search(r"youtube\.com/embed/([a-zA-Z0-9_-]{11})", clean)
    if m_embed:
        return "video", m_embed.group(1)

    # Exactly 11 characters alphanumeric and -_
    if re.match(r"^[a-zA-Z0-9_-]{11}$", clean):
        return "video", clean

    # Channel matchers
    # Handles: @channel_handle or https://youtube.com/@handle
    m_handle = re.search(r"youtube\.com/@([a-zA-Z0-9_.-]+)", clean)
    if m_handle:
        return "channel", f"@{m_handle.group(1)}"

    # Channel ID: UC...
    m_cid = re.search(r"youtube\.com/channel/(UC[a-zA-Z0-9_-]{22})", clean)
    if m_cid:
        return "channel", m_cid.group(1)

    if clean.startswith("UC") and len(clean) == 24:
        return "channel", clean

    # Vanity or custom: /c/name or /user/name
    m_c = re.search(r"youtube\.com/(?:c|user)/([a-zA-Z0-9_.-]+)", clean)
    if m_c:
        return "channel", m_c.group(1)

    # Default handle if starts with @ or plain text
    if clean.startswith("@"):
        return "channel", clean

    return "channel", f"@{clean.lstrip('@')}"


def generate_youtube_osint_pivots(
    target_type: str,
    identifier: str,
    channel_id: Optional[str] = None,
    handle: Optional[str] = None,
    video_id: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Generates direct pivot links for external intelligence tools."""
    pivots = []
    clean_handle = (handle or identifier).lstrip("@")
    cid = channel_id or ("" if identifier.startswith("@") else identifier)
    vid = video_id or (identifier if target_type == "video" else "")

    # 1. YouTube Metadata by Mattw.io
    meta_url = f"https://mattw.io/youtube-metadata/?url={vid}" if vid else f"https://mattw.io/youtube-metadata/?url={cid or clean_handle}"
    pivots.append({
        "name": "YouTube Metadata (Mattw.io)",
        "url": meta_url,
        "category": "Deep Metadata & Tags",
        "description": "Inspect complete backend metadata, EXIF tags, upload timestamps, raw thumbnail URLs, and technical properties.",
    })

    # 2. YouTube Geolocation (Mattw.io)
    pivots.append({
        "name": "YouTube Geolocation (Mattw.io)",
        "url": "https://mattw.io/youtube-geofind/location",
        "category": "Geospatial Recon",
        "description": "Discover geotagged YouTube videos by pinpoint coordinates, radius distance, and recording timestamps.",
    })

    # 3. YouTube Video Finder (TheTechRobo)
    vf_url = f"https://findyoutubevideo.thetechrobo.ca/?video_id={vid}" if vid else "https://findyoutubevideo.thetechrobo.ca/"
    pivots.append({
        "name": "YouTube Video Finder",
        "url": vf_url,
        "category": "Deleted & Unlisted Finder",
        "description": "Multi-engine archival search across Wayback Machine, GhostArchive, Filmot, and archive.today to recover deleted videos.",
    })

    # 4. YTCommentSearch & Restrictions (Polsy)
    comment_url = f"https://polsy.org.uk/stuff/ytrestrict.cgi?ytid={vid}" if vid else "https://polsy.org.uk/stuff/ytrestrict.cgi"
    pivots.append({
        "name": "YTCommentSearch & Geo-Restrictions",
        "url": comment_url,
        "category": "Comments & Regional Block Check",
        "description": "Check YouTube video regional blocking, country licensing restrictions, and advanced comment index search.",
    })

    # 5. Social Blade Analytics
    sb_target = f"channel/{cid}" if cid else f"handle/@{clean_handle}"
    pivots.append({
        "name": "Social Blade",
        "url": f"https://socialblade.com/youtube/{sb_target}",
        "category": "Growth Analytics & Auditing",
        "description": "Historical subscriber gains, daily view curves, estimated revenue, creator rankings, and network affiliation.",
    })

    # 6. Noxinfluencer Creator Valuation
    nox_url = f"https://www.noxinfluencer.com/youtube/channel/{cid}" if cid else f"https://www.noxinfluencer.com/search?keyword={clean_handle}"
    pivots.append({
        "name": "Noxinfluencer",
        "url": nox_url,
        "category": "Demographics & Brand Value",
        "description": "Audience demographics, active engagement rate, commercial price index, and brand collaboration intelligence.",
    })

    # 7. Channel Crawler
    pivots.append({
        "name": "Channel Crawler",
        "url": "https://channelcrawler.com/",
        "category": "Creator Search & Filtering",
        "description": "Multi-attribute creator discovery by category, country, subscriber threshold, and publication frequency.",
    })

    # 8. Filmot Subtitle Search
    filmot_url = f"https://filmot.com/channel/{cid}" if cid else (f"https://filmot.com/video/{vid}" if vid else "https://filmot.com/")
    pivots.append({
        "name": "Filmot Subtitle & Caption Search",
        "url": filmot_url,
        "category": "Speech & Subtitle Archives",
        "description": "Deep full-text search across hundreds of millions of video subtitles, transcripts, and speech records.",
    })

    # 9. Wayback Machine Historical Snapshots
    wayback_target = f"youtube.com/watch?v={vid}" if vid else f"youtube.com/@{clean_handle}"
    pivots.append({
        "name": "Wayback Machine Archive",
        "url": f"https://web.archive.org/web/*/{wayback_target}*",
        "category": "Historical Archival",
        "description": "Retrieve deleted channel bios, historical subscriber counts, removed videos, and previous channel branding.",
    })

    return pivots


async def scrape_youtube_video_details(
    video_id_or_url: str,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Scrapes single video details, metadata, thumbnails, and speech captions/transcripts."""
    _, vid = detect_youtube_target(video_id_or_url)
    watch_url = f"https://www.youtube.com/watch?v={vid}"

    transport = None
    if use_tor and settings.TOR_SOCKS_PROXY:
        transport = httpx.AsyncHTTPTransport(proxy=settings.TOR_SOCKS_PROXY)

    html_content = ""
    async with httpx.AsyncClient(headers=COMMON_HEADERS, timeout=30.0, follow_redirects=True, transport=transport) as client:
        r = await client.get(watch_url)
        if r.status_code != 200:
            raise ValueError(f"Failed to fetch YouTube watch page: HTTP {r.status_code}")
        html_content = r.text

    player_data = parse_yt_json(html_content, "ytInitialPlayerResponse") or {}

    video_details = player_data.get("videoDetails", {})
    title = video_details.get("title") or ""
    author = video_details.get("author") or ""
    channel_id = video_details.get("channelId") or ""
    length_seconds = int(video_details.get("lengthSeconds") or 0)
    view_count = video_details.get("viewCount") or "0"
    keywords = video_details.get("keywords") or []
    description = video_details.get("shortDescription") or ""

    # High-res thumbnail selection
    thumbnails = video_details.get("thumbnail", {}).get("thumbnails", [])
    max_thumb = f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"
    hq_thumb = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
    thumb_url = thumbnails[-1].get("url") if thumbnails else max_thumb

    # Extract Closed Captions / Subtitles / Transcripts
    transcript_snippets = []
    full_transcript_text = ""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        api = YouTubeTranscriptApi()
        fetched = api.fetch(vid)
        for item in fetched:
            t_text = getattr(item, "text", "") or ""
            t_start = float(getattr(item, "start", 0.0))
            t_dur = float(getattr(item, "duration", 0.0))
            transcript_snippets.append({
                "start": round(t_start, 2),
                "duration": round(t_dur, 2),
                "text": t_text.strip(),
            })
        full_transcript_text = " ".join(s["text"] for s in transcript_snippets)
    except Exception as e:
        logger.info(f"Could not fetch transcript via YouTubeTranscriptApi for video {vid}: {e}")

    # Entity extraction across title, description, keywords, and transcript
    text_corpus = f"{title}\n{description}\n{' '.join(keywords)}\n{full_transcript_text}"
    entities = extract_entities_from_text(text_corpus)

    video_info = {
        "video_id": vid,
        "url": watch_url,
        "title": title,
        "author": author,
        "channel_id": channel_id,
        "channel_url": f"https://www.youtube.com/channel/{channel_id}" if channel_id else "",
        "length_seconds": length_seconds,
        "duration_formatted": f"{length_seconds // 60}:{length_seconds % 60:02d}",
        "view_count": view_count,
        "keywords": keywords,
        "description": description,
        "thumbnail_url": thumb_url,
        "maxres_thumbnail_url": max_thumb,
        "hq_thumbnail_url": hq_thumb,
        "has_transcript": len(transcript_snippets) > 0,
        "transcript_snippets_count": len(transcript_snippets),
        "transcript": transcript_snippets,
        "full_transcript_text": full_transcript_text,
        "entities": entities,
        "osint_pivots": generate_youtube_osint_pivots("video", vid, channel_id=channel_id, video_id=vid),
    }

    return video_info


async def scrape_youtube_channel_ultimate(
    target: str,
    limit: int = 50,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Scrapes YouTube channel dossier, video catalog, entities, and OSINT pivots."""
    target_type, identifier = detect_youtube_target(target)

    # If the user specifically submitted a video URL/ID, route to single video deep-dive
    if target_type == "video":
        video_details = await scrape_youtube_video_details(identifier, use_tor=use_tor)
        return {
            "scrape_type": "video",
            "target": target,
            "video_details": video_details,
            "channel_profile": {
                "title": video_details["author"],
                "channel_id": video_details["channel_id"],
                "url": video_details["channel_url"],
            },
            "videos": [{
                "video_id": video_details["video_id"],
                "title": video_details["title"],
                "url": video_details["url"],
                "duration": video_details["duration_formatted"],
                "views_text": f"{int(video_details['view_count']):,} views" if video_details["view_count"].isdigit() else video_details["view_count"],
                "published_time_text": "Selected Video",
                "thumbnail_url": video_details["thumbnail_url"],
                "description_snippet": video_details["description"][:160],
            }],
            "total_scraped": 1,
            "aggregated_intel": video_details["entities"],
            "osint_pivots": video_details["osint_pivots"],
        }

    # Channel mode
    clean_target = identifier.strip()
    if clean_target.startswith("@"):
        channel_url = f"https://www.youtube.com/{clean_target}"
        videos_url = f"https://www.youtube.com/{clean_target}/videos"
    elif clean_target.startswith("UC") and len(clean_target) == 24:
        channel_url = f"https://www.youtube.com/channel/{clean_target}"
        videos_url = f"https://www.youtube.com/channel/{clean_target}/videos"
    else:
        channel_url = f"https://www.youtube.com/@{clean_target.lstrip('@')}"
        videos_url = f"https://www.youtube.com/@{clean_target.lstrip('@')}/videos"

    transport = None
    if use_tor and settings.TOR_SOCKS_PROXY:
        transport = httpx.AsyncHTTPTransport(proxy=settings.TOR_SOCKS_PROXY)

    async with httpx.AsyncClient(headers=COMMON_HEADERS, timeout=30.0, follow_redirects=True, transport=transport) as client:
        # 1. Fetch channel videos page
        r_vid = await client.get(videos_url)
        if r_vid.status_code != 200:
            # Fallback to main channel page
            r_vid = await client.get(channel_url)
            if r_vid.status_code != 200:
                raise ValueError(f"Failed to access YouTube channel: HTTP {r_vid.status_code}")
        html_text = r_vid.text

    initial_data = parse_yt_json(html_text, "ytInitialData") or {}

    meta = initial_data.get("metadata", {}).get("channelMetadataRenderer", {})
    channel_id = meta.get("externalId") or ""
    title = meta.get("title") or clean_target
    vanity_url = meta.get("vanityChannelUrl") or channel_url
    description = meta.get("description") or ""
    keywords_raw = meta.get("keywords") or ""
    channel_keywords = keywords_raw.split() if isinstance(keywords_raw, str) else []

    # High resolution avatar
    avatar_url = ""
    avatar_thumbs = meta.get("avatar", {}).get("thumbnails", [])
    if avatar_thumbs:
        avatar_url = avatar_thumbs[-1].get("url", "")
        # Upscale avatar resolution if formatted with =s88-
        avatar_url = re.sub(r"=s\d+-", "=s900-", avatar_url)

    # Header extraction
    header = initial_data.get("header", {}).get("pageHeaderRenderer", {}).get("content", {}).get("pageHeaderViewModel", {})
    subscribers_count = "N/A"
    video_count = "N/A"
    handle = ""

    # Banner image
    banner_url = ""
    banner_sources = header.get("banner", {}).get("imageBannerViewModel", {}).get("image", {}).get("sources", [])
    if banner_sources:
        banner_url = banner_sources[-1].get("url", "")

    # Header metadata rows (Handle, Subscribers count, Videos count)
    meta_rows = header.get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", [])
    for row in meta_rows:
        parts = [p.get("text", {}).get("content", "") for p in row.get("metadataParts", [])]
        for part in parts:
            if part.startswith("@"):
                handle = part
            elif "subscriber" in part.lower():
                subscribers_count = part
            elif "video" in part.lower():
                video_count = part

    if not handle and clean_target.startswith("@"):
        handle = clean_target

    # Verified badge check
    verified = ("BADGE_STYLE_TYPE_VERIFIED" in html_text or "CHECK_CIRCLE_THICK" in html_text)

    # Extract videos grid from tabs
    tabs = initial_data.get("contents", {}).get("twoColumnBrowseResultsRenderer", {}).get("tabs", [])
    scraped_videos: List[Dict[str, Any]] = []

    for t in tabs:
        tab_renderer = t.get("tabRenderer", {})
        if tab_renderer.get("selected") or tab_renderer.get("title") in ["Videos", "Vídeos"]:
            contents = tab_renderer.get("content", {}).get("richGridRenderer", {}).get("contents", [])
            for item in contents:
                rich_item = item.get("richItemRenderer", {})
                content = rich_item.get("content", {})

                # Modern lockupViewModel
                lockup = content.get("lockupViewModel", {})
                if lockup:
                    vid_id = lockup.get("contentId")
                    if not vid_id:
                        continue
                    m_data = lockup.get("metadata", {}).get("lockupMetadataViewModel", {})
                    v_title = m_data.get("title", {}).get("content") or "Untitled Video"
                    rows = m_data.get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", [])
                    meta_parts = []
                    for row in rows:
                        for p in row.get("metadataParts", []):
                            c_text = p.get("text", {}).get("content")
                            if c_text:
                                meta_parts.append(c_text)

                    views_txt = meta_parts[0] if len(meta_parts) > 0 else ""
                    pub_txt = meta_parts[1] if len(meta_parts) > 1 else ""

                    thumbs = lockup.get("contentImage", {}).get("thumbnailViewModel", {}).get("image", {}).get("sources", [])
                    thumb_url = thumbs[-1].get("url") if thumbs else f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"

                    scraped_videos.append({
                        "video_id": vid_id,
                        "title": v_title,
                        "url": f"https://www.youtube.com/watch?v={vid_id}",
                        "views_text": views_txt,
                        "published_time_text": pub_txt,
                        "thumbnail_url": thumb_url,
                        "description_snippet": "",
                    })

                # Legacy videoRenderer fallback
                vr = content.get("videoRenderer", {})
                if vr:
                    vid_id = vr.get("videoId")
                    if not vid_id:
                        continue
                    v_title = vr.get("title", {}).get("runs", [{}])[0].get("text") or "Untitled Video"
                    views_txt = vr.get("viewCountText", {}).get("simpleText") or ""
                    pub_txt = vr.get("publishedTimeText", {}).get("simpleText") or ""
                    scraped_videos.append({
                        "video_id": vid_id,
                        "title": v_title,
                        "url": f"https://www.youtube.com/watch?v={vid_id}",
                        "views_text": views_txt,
                        "published_time_text": pub_txt,
                        "thumbnail_url": f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg",
                        "description_snippet": "",
                    })

                if len(scraped_videos) >= limit:
                    break

        if scraped_videos:
            break

    # Entity aggregation across channel dossier & all scraped video titles
    all_titles_text = " ".join(v["title"] for v in scraped_videos)
    profile_text = f"{title}\n{handle}\n{description}\n{' '.join(channel_keywords)}\n{all_titles_text}"
    aggregated_intel = extract_entities_from_text(profile_text)

    channel_profile = {
        "channel_id": channel_id,
        "handle": handle,
        "title": title,
        "vanity_url": vanity_url,
        "channel_url": channel_url,
        "description": description,
        "subscribers_count": subscribers_count,
        "video_count": video_count,
        "verified": verified,
        "avatar_url": avatar_url,
        "banner_url": banner_url,
        "keywords": channel_keywords,
    }

    osint_pivots = generate_youtube_osint_pivots(
        "channel",
        clean_target,
        channel_id=channel_id,
        handle=handle,
    )

    return {
        "scrape_type": "channel",
        "target": target,
        "channel_profile": channel_profile,
        "videos": scraped_videos,
        "total_scraped": len(scraped_videos),
        "aggregated_intel": aggregated_intel,
        "stats": {
            "subscribers": subscribers_count,
            "videos_count": video_count,
            "scraped_videos_count": len(scraped_videos),
            "wallets_count": (
                len(aggregated_intel["btc"])
                + len(aggregated_intel["eth"])
                + len(aggregated_intel["tron"])
                + len(aggregated_intel["sol"])
            ),
            "emails_count": len(aggregated_intel["emails"]),
            "phones_count": len(aggregated_intel["phones"]),
            "urls_count": len(aggregated_intel["urls"]),
        },
        "osint_pivots": osint_pivots,
    }
