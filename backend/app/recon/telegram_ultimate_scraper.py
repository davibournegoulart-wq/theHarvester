"""Telegram Ultimate Scraper & Forensic Intelligence Engine.

Performs deep public channel scraping, pagination, media extraction,
forward origin network mapping, and automated entity extraction:
- Cryptographic wallets (BTC, ETH, TRX, SOL)
- Communication contacts (Emails, Phone numbers)
- Mentions and Cross-Channel Forward Networks
- Onion / Dark Web and External URLs
- 1-click Case Evidence vault attachment
"""

import re
import html
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

# Regex Patterns for Forensic Extraction
BTC_REGEX = re.compile(r"\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,62})\b")
ETH_REGEX = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
TRON_REGEX = re.compile(r"\bT[A-Za-z1-9]{33}\b")
SOL_REGEX = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}")
ONION_REGEX = re.compile(r"https?://[a-zA-Z0-9]{16,56}\.onion\b(?:/[^\s]*)?")
URL_REGEX = re.compile(r"https?://[^\s\"'<>]+")
TAG_REGEX = re.compile(r"<[^>]+>")


def _clean_text(raw_html: str) -> str:
    cleaned = TAG_REGEX.sub("", raw_html)
    return html.unescape(cleaned).strip()


def extract_entities_from_text(text: str) -> Dict[str, Any]:
    """Extracts forensic entities from arbitrary message text."""
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
    # Filter false positive SOL matches
    raw_sol = set(SOL_REGEX.findall(text))
    sol = [s for s in raw_sol if len(s) >= 32 and not s.startswith("http") and s not in btc and s not in tron]

    raw_emails = set(EMAIL_REGEX.findall(text))
    emails = [e for e in raw_emails if not e.endswith((".png", ".jpg", ".js", ".gif", "telegram.org", "t.me"))]

    raw_phones = set(PHONE_REGEX.findall(text))
    phones = [p.strip() for p in raw_phones if len(re.sub(r"\D", "", p)) >= 8 and len(re.sub(r"\D", "", p)) <= 15]

    mentions = list(set(re.findall(r"@([a-zA-Z0-9_]{4,32})", text)))
    hashtags = list(set(re.findall(r"#([a-zA-Z0-9_\u00C0-\u00FF]{2,32})", text)))
    onions = list(set(ONION_REGEX.findall(text)))
    urls = [u for u in set(URL_REGEX.findall(text)) if ".onion" not in u and not u.startswith("https://t.me/")]

    return {
        "btc": list(btc),
        "eth": list(eth),
        "tron": list(tron),
        "sol": sol,
        "emails": emails,
        "phones": phones,
        "mentions": mentions,
        "hashtags": hashtags,
        "onion_links": onions,
        "urls": urls,
    }


async def scrape_telegram_channel_ultimate(
    target: str,
    limit: int = 50,
    query_filter: Optional[str] = None,
    media_filter: Optional[str] = None,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Scrapes public Telegram channel messages, metadata, media, and forwards."""
    clean_target = target.strip().lstrip("@")
    if "t.me/" in clean_target:
        m = re.search(r"t\.me/(?:s/)?([^/?#]+)", clean_target)
        if m:
            clean_target = m.group(1)

    clean_target = clean_target.rstrip("/")

    proxies = (
        {"http://": settings.tor_proxy_url, "https://": settings.tor_proxy_url}
        if use_tor and settings.tor_proxy_url
        else None
    )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    channel_profile: Dict[str, Any] = {
        "username": clean_target,
        "title": clean_target,
        "description": "",
        "avatar_url": None,
        "subscribers": "Unknown",
        "is_verified": False,
        "is_channel": True,
        "tme_url": f"https://t.me/{clean_target}",
        "profile_entities": {},
    }

    all_messages: List[Dict[str, Any]] = []
    seen_post_ids = set()
    current_before: Optional[str] = None
    pages_fetched = 0
    max_pages = min(15, max(1, (limit // 15) + 2))

    async with httpx.AsyncClient(headers=headers, proxies=proxies, follow_redirects=True, timeout=20.0) as client:
        while len(all_messages) < limit and pages_fetched < max_pages:
            url = f"https://t.me/s/{clean_target}"
            if current_before:
                url = f"https://t.me/s/{clean_target}?before={current_before}"

            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    logger.warning(f"Telegram web request failed with status {resp.status_code} for {url}")
                    break

                html_text = resp.text
                soup = BeautifulSoup(html_text, "html.parser")

                # Parse channel profile metadata on first page
                if pages_fetched == 0:
                    og_title = soup.find("meta", property="og:title")
                    if og_title and og_title.get("content"):
                        channel_profile["title"] = og_title["content"].strip()

                    og_desc = soup.find("meta", property="og:description")
                    if og_desc and og_desc.get("content"):
                        channel_profile["description"] = og_desc["content"].strip()
                        channel_profile["profile_entities"] = extract_entities_from_text(channel_profile["description"])

                    og_img = soup.find("meta", property="og:image")
                    if og_img and og_img.get("content") and "t_logo" not in og_img["content"]:
                        channel_profile["avatar_url"] = og_img["content"]

                    subs_div = soup.find("div", class_="tgme_page_extra")
                    if subs_div:
                        channel_profile["subscribers"] = subs_div.text.strip()

                    if soup.find("i", class_="verified-icon") or 'class="verified-icon"' in html_text:
                        channel_profile["is_verified"] = True

                # Parse all messages on this page
                msg_elements = soup.find_all("div", class_="tgme_widget_message")
                if not msg_elements:
                    break

                page_new_count = 0
                first_msg_numeric_id = None

                for el in reversed(msg_elements):
                    post_id = el.get("data-post")
                    if not post_id or post_id in seen_post_ids:
                        continue

                    seen_post_ids.add(post_id)
                    page_new_count += 1

                    # Extract numeric ID for pagination
                    num_match = re.search(r"/([0-9]+)$", post_id)
                    if num_match:
                        msg_num = int(num_match.group(1))
                        if first_msg_numeric_id is None or msg_num < first_msg_numeric_id:
                            first_msg_numeric_id = msg_num

                    # Date / Time
                    time_tag = el.find("time", class_="time")
                    dt_str = time_tag.get("datetime") if time_tag else None

                    # Text content
                    text_div = el.find("div", class_="tgme_widget_message_text")
                    raw_text = text_div.text.strip() if text_div else ""

                    # Views
                    views_span = el.find("span", class_="tgme_widget_message_views")
                    views = views_span.text.strip() if views_span else "N/A"

                    # Forwards
                    fwd_tag = el.find("a", class_="tgme_widget_message_forwarded_from_name")
                    is_forward = bool(fwd_tag)
                    forward_from_title = fwd_tag.text.strip() if fwd_tag else None
                    forward_from_url = fwd_tag.get("href") if fwd_tag else None

                    # Media extraction
                    media_type = "text"
                    media_url = None
                    photo_a = el.find("a", class_="tgme_widget_message_photo_wrap")
                    video_tag = el.find("video")
                    doc_div = el.find("div", class_="tgme_widget_message_document")

                    if photo_a and photo_a.get("style"):
                        style = photo_a["style"]
                        m_url = re.search(r"background-image:url\('([^']+)'\)", style)
                        if m_url:
                            media_type = "photo"
                            media_url = m_url.group(1)
                    elif video_tag:
                        media_type = "video"
                        media_url = video_tag.get("src")
                    elif doc_div:
                        media_type = "document"

                    if is_forward and media_type == "text":
                        media_type = "forward"

                    # Entities
                    entities = extract_entities_from_text(raw_text)

                    # Filters
                    if query_filter:
                        q_low = query_filter.lower()
                        if (
                            q_low not in raw_text.lower()
                            and q_low not in str(entities).lower()
                            and (not forward_from_title or q_low not in forward_from_title.lower())
                        ):
                            continue

                    if media_filter and media_filter != "all":
                        if media_filter == "photo" and media_type != "photo":
                            continue
                        elif media_filter == "video" and media_type != "video":
                            continue
                        elif media_filter == "document" and media_type != "document":
                            continue
                        elif media_filter == "forward" and not is_forward:
                            continue

                    all_messages.append({
                        "post_id": post_id,
                        "post_url": f"https://t.me/{post_id}",
                        "datetime_utc": dt_str,
                        "text": raw_text,
                        "views": views,
                        "media_type": media_type,
                        "media_url": media_url,
                        "is_forward": is_forward,
                        "forward_from_title": forward_from_title,
                        "forward_from_url": forward_from_url,
                        "entities": entities,
                    })

                    if len(all_messages) >= limit:
                        break

                pages_fetched += 1

                # Update pagination for older messages
                prev_link = soup.find("link", rel="prev")
                if prev_link and prev_link.get("href"):
                    m_b = re.search(r"before=([0-9]+)", prev_link["href"])
                    if m_b:
                        current_before = m_b.group(1)
                    else:
                        break
                elif first_msg_numeric_id and first_msg_numeric_id > 1:
                    current_before = str(first_msg_numeric_id)
                else:
                    break

            except Exception as e:
                logger.error(f"Error scraping Telegram page for {clean_target}: {e}")
                break

    # Sort all messages descending (newest first)
    all_messages.sort(key=lambda x: x.get("datetime_utc") or "", reverse=True)

    # Aggregate forensic intelligence across all scraped messages
    agg_btc = Counter()
    agg_eth = Counter()
    agg_tron = Counter()
    agg_sol = Counter()
    agg_emails = Counter()
    agg_phones = Counter()
    agg_mentions = Counter()
    agg_hashtags = Counter()
    agg_onions = Counter()
    agg_urls = Counter()
    agg_forwards = Counter()
    media_count = 0
    forward_count = 0

    for m in all_messages:
        ents = m.get("entities", {})
        for w in ents.get("btc", []):
            agg_btc[w] += 1
        for w in ents.get("eth", []):
            agg_eth[w] += 1
        for w in ents.get("tron", []):
            agg_tron[w] += 1
        for w in ents.get("sol", []):
            agg_sol[w] += 1
        for em in ents.get("emails", []):
            agg_emails[em] += 1
        for ph in ents.get("phones", []):
            agg_phones[ph] += 1
        for men in ents.get("mentions", []):
            agg_mentions[men] += 1
        for ht in ents.get("hashtags", []):
            agg_hashtags[ht] += 1
        for on in ents.get("onion_links", []):
            agg_onions[on] += 1
        for u in ents.get("urls", []):
            agg_urls[u] += 1

        if m.get("media_type") in ["photo", "video", "document"]:
            media_count += 1
        if m.get("is_forward"):
            forward_count += 1
            f_title = m.get("forward_from_title") or "Unknown Channel"
            agg_forwards[f_title] += 1

    # Format structured findings
    aggregated_intel = {
        "crypto_wallets": [
            {"address": addr, "type": "Bitcoin", "count": count} for addr, count in agg_btc.most_common(25)
        ] + [
            {"address": addr, "type": "Ethereum", "count": count} for addr, count in agg_eth.most_common(25)
        ] + [
            {"address": addr, "type": "Tron", "count": count} for addr, count in agg_tron.most_common(25)
        ] + [
            {"address": addr, "type": "Solana", "count": count} for addr, count in agg_sol.most_common(25)
        ],
        "emails": [{"email": e, "count": c} for e, c in agg_emails.most_common(25)],
        "phones": [{"phone": p, "count": c} for p, c in agg_phones.most_common(25)],
        "mentions": [{"username": u, "count": c} for u, c in agg_mentions.most_common(30)],
        "hashtags": [{"tag": f"#{t}", "count": c} for t, c in agg_hashtags.most_common(30)],
        "forwarded_sources": [{"source": s, "count": c} for s, c in agg_forwards.most_common(20)],
        "onion_links": [{"url": o, "count": c} for o, c in agg_onions.most_common(15)],
        "external_urls": [{"url": u, "count": c} for u, c in agg_urls.most_common(30)],
    }

    dates = [m["datetime_utc"] for m in all_messages if m.get("datetime_utc")]
    newest = dates[0] if dates else None
    oldest = dates[-1] if dates else None

    return {
        "channel_profile": channel_profile,
        "messages": all_messages,
        "total_scraped": len(all_messages),
        "aggregated_intel": aggregated_intel,
        "stats": {
            "total_messages": len(all_messages),
            "media_messages": media_count,
            "forward_messages": forward_count,
            "newest_message_date": newest,
            "oldest_message_date": oldest,
            "wallets_count": len(aggregated_intel["crypto_wallets"]),
            "emails_count": len(aggregated_intel["emails"]),
            "phones_count": len(aggregated_intel["phones"]),
        },
    }
