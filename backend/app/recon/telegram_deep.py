"""Telegram Deep Reconnaissance Engine.
Natively scrapes and aggregates data across Telegram sources:
1. Native Telegram Public Feed (t.me/s/{username} & t.me/{username})
2. TGStat Public Analytics (channel rankings, titles, verified state)
3. Lyzem Global Search (index of related public channels and messages)
"""

import html
import re
from dataclasses import dataclass, field
import httpx

from app.config import settings

@dataclass
class TelegramPost:
    text: str
    date: str | None = None

@dataclass
class TelegramChannelProfile:
    username: str
    title: str | None
    description: str | None
    avatar_url: str | None
    subscribers: str | None
    is_verified: bool = False
    is_channel_or_group: bool = False
    recent_posts: list[TelegramPost] = field(default_factory=list)
    tgstat_info: dict = field(default_factory=dict)
    lyzem_results: list[dict] = field(default_factory=list)
    tme_url: str = ""
    discovered_by: str = "recon.telegram_deep"

_TAG_RE = re.compile(r"<[^>]+>")

def _clean_html(raw_html: str) -> str:
    cleaned = _TAG_RE.sub("", raw_html)
    return html.unescape(cleaned).strip()

async def scrape_telegram_target(username: str) -> TelegramChannelProfile:
    clean_user = username.lstrip("@").strip()
    profile = TelegramChannelProfile(
        username=clean_user,
        title=None,
        description=None,
        avatar_url=None,
        subscribers=None,
        tme_url=f"https://t.me/{clean_user}",
    )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=settings.request_timeout_seconds) as client:
        # 1. Native Telegram Feed (t.me/s/{username})
        try:
            feed_resp = await client.get(f"https://t.me/s/{clean_user}")
            if feed_resp.status_code == 200:
                html_text = feed_resp.text
                
                title_m = re.search(r'<meta property="og:title" content="([^"]+)"', html_text)
                if title_m:
                    profile.title = html.unescape(title_m.group(1))

                desc_m = re.search(r'<meta property="og:description" content="([^"]+)"', html_text)
                if desc_m:
                    profile.description = html.unescape(desc_m.group(1))

                img_m = re.search(r'<meta property="og:image" content="([^"]+)"', html_text)
                if img_m and "telegram.org/img/t_logo" not in img_m.group(1):
                    profile.avatar_url = img_m.group(1)

                subs_m = re.search(r'<div class="tgme_page_extra">([^<]+)</div>', html_text)
                if subs_m:
                    profile.subscribers = subs_m.group(1).strip()
                    profile.is_channel_or_group = True

                if 'class="verified-icon"' in html_text or 'i-verified' in html_text:
                    profile.is_verified = True

                post_matches = re.findall(r'<div class="tgme_widget_message_text[^>]*>(.*?)</div>', html_text, re.DOTALL)
                for raw_msg in post_matches[-6:]:
                    cleaned_post = _clean_html(raw_msg)
                    if cleaned_post:
                        profile.recent_posts.append(TelegramPost(text=cleaned_post[:400]))
        except Exception:
            pass

        # 2. Fallback to basic t.me/{username} if title is still missing
        if not profile.title:
            try:
                base_resp = await client.get(f"https://t.me/{clean_user}")
                if base_resp.status_code == 200:
                    html_text = base_resp.text
                    title_m = re.search(r'<meta property="og:title" content="([^"]+)"', html_text)
                    if title_m:
                        profile.title = html.unescape(title_m.group(1))
                    desc_m = re.search(r'<meta property="og:description" content="([^"]+)"', html_text)
                    if desc_m:
                        profile.description = html.unescape(desc_m.group(1))
                    img_m = re.search(r'<meta property="og:image" content="([^"]+)"', html_text)
                    if img_m and "telegram.org/img/t_logo" not in img_m.group(1):
                        profile.avatar_url = img_m.group(1)
            except Exception:
                pass

        # 3. TGStat In-App Scraping
        try:
            tgstat_url = f"https://tgstat.com/channel/@{clean_user}"
            tgstat_resp = await client.get(tgstat_url)
            if tgstat_resp.status_code == 200:
                t_html = tgstat_resp.text
                h1_m = re.search(r'<h1[^>]*>(.*?)</h1>', t_html, re.DOTALL)
                h1_text = _clean_html(h1_m.group(1)) if h1_m else None
                
                profile.tgstat_info = {
                    "url": tgstat_url,
                    "indexed": True,
                    "title": h1_text,
                    "source": "TGStat Analytics",
                }
            else:
                profile.tgstat_info = {"indexed": False, "url": tgstat_url}
        except Exception:
            profile.tgstat_info = {"indexed": False}

        # 4. Lyzem In-App Global Search
        try:
            lyzem_url = f"https://lyzem.com/search?q={clean_user}"
            lyzem_resp = await client.get(lyzem_url)
            if lyzem_resp.status_code == 200:
                l_html = lyzem_resp.text
                found_links = []
                seen_urls = set()
                
                for m in re.finditer(r'<a[^>]*href="(https?://[^"]*t\.me/[^"]+)"[^>]*>(.*?)</a>', l_html, re.DOTALL):
                    u = m.group(1)
                    title = _clean_html(m.group(2))
                    if u not in seen_urls and title and not any(skip in u for skip in ["lyzem", "bot"]):
                        seen_urls.add(u)
                        found_links.append({"title": title, "url": u})
                        if len(found_links) >= 6:
                            break
                            
                profile.lyzem_results = found_links
        except Exception:
            profile.lyzem_results = []

    return profile
