"""VKontakte (VK) Ultimate Harvester & Forensic Intelligence Engine.

Performs deep OSINT reconnaissance on VKontakte (vk.com) user profiles,
communities/groups, public wall posts, media attachments, and repost networks.
Features:
- Screen name / vanity URL resolution via VK prefetch cache
- Deep user and community dossier extraction (verified badges, contacts, cities, metrics)
- Multi-page wall posts scraping via VK internal AJAX protocol (al_wall.php)
- Multi-format attachment extraction (photos, videos, external links, docs)
- Repost / copy_history tracking for network syndication analysis
- Automated entity extraction (crypto wallets, emails, phone numbers, @handles, #hashtags, .onion links)
- Tor routing support
"""

import re
import json
import html
import logging
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
    raw_sol = set(SOL_REGEX.findall(text))
    sol = [s for s in raw_sol if len(s) >= 32 and not s.startswith("http") and s not in btc and s not in tron]

    raw_emails = set(EMAIL_REGEX.findall(text))
    emails = [e for e in raw_emails if not e.endswith((".png", ".jpg", ".js", ".gif", "vk.com", "vk.ru", "userapi.com"))]

    raw_phones = set(PHONE_REGEX.findall(text))
    phones = [p.strip() for p in raw_phones if 8 <= len(re.sub(r"\D", "", p)) <= 15]

    mentions = list(set(re.findall(r"@([a-zA-Z0-9_]{3,32})", text)))
    tg_mentions = list(set(re.findall(r"t\.me/([a-zA-Z0-9_]{4,32})", text)))
    for tg in tg_mentions:
        if tg not in mentions:
            mentions.append(f"tg:{tg}")

    hashtags = list(set(re.findall(r"#([a-zA-Z0-9_\u0400-\u04FF\u00C0-\u00FF]{2,32})", text)))
    onions = list(set(ONION_REGEX.findall(text)))
    urls = [u for u in set(URL_REGEX.findall(text)) if ".onion" not in u and not u.startswith("https://vk.com/")]

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


def normalize_vk_target(target: str) -> str:
    """Normalizes input URL or username into a clean screen_name or ID."""
    clean = target.strip().lstrip("@")
    clean = clean.replace("https://", "").replace("http://", "")
    clean = clean.replace("m.vk.com/", "").replace("vk.com/", "").replace("vk.ru/", "")
    clean = clean.split("?")[0].split("#")[0].strip("/")
    return clean


async def harvest_vk_ultimate(
    target: str,
    limit: int = 50,
    filter_type: str = "all",
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Deep forensic harvest of VK profile, communities, wall posts and attachments."""
    clean_target = normalize_vk_target(target)
    if not clean_target:
        return {"error": "Invalid VK target provided"}

    proxies = (
        {"http://": settings.tor_proxy_url, "https://": settings.tor_proxy_url}
        if use_tor and settings.tor_proxy_url
        else None
    )

    desktop_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
    }

    url = f"https://vk.com/{clean_target}"
    owner_id: Optional[int] = None
    target_type = "user"
    profile_data: Dict[str, Any] = {}

    if clean_target.startswith("id") and clean_target[2:].isdigit():
        owner_id = int(clean_target[2:])
        target_type = "user"
    elif clean_target.startswith(("club", "public")) and re.match(r"^(club|public)\d+$", clean_target):
        m_num = re.search(r"\d+", clean_target)
        if m_num:
            owner_id = -int(m_num.group(0))
            target_type = "group"
    elif clean_target.lstrip("-").isdigit():
        owner_id = int(clean_target)
        target_type = "group" if owner_id < 0 else "user"

    async with httpx.AsyncClient(headers=desktop_headers, proxies=proxies, follow_redirects=True, timeout=12.0) as client:
        try:
            r = await client.get(url)
            page_html = r.text
        except Exception as e:
            logger.warning(f"Error requesting {url}: {e}")
            page_html = ""

    if page_html:
        target_str = '"apiPrefetchCache":'
        idx = page_html.find(target_str)
        if idx != -1:
            try:
                decoder = json.JSONDecoder()
                prefetch_array, _ = decoder.raw_decode(page_html, idx + len(target_str))
                for item in prefetch_array:
                    method = item.get("method")
                    resp = item.get("response")

                    if method == "utils.resolveScreenName" and isinstance(resp, dict):
                        obj_id = resp.get("object_id")
                        rtype = resp.get("type", "user")
                        if obj_id:
                            target_type = rtype
                            owner_id = -int(obj_id) if rtype in ("group", "page") else int(obj_id)

                    elif method == "users.get" and isinstance(resp, list) and resp:
                        user_info = resp[0]
                        if not owner_id and user_info.get("id"):
                            owner_id = user_info["id"]
                            target_type = "user"
                        profile_data["user"] = user_info

                    elif method == "groups.getById" and isinstance(resp, dict):
                        groups_list = resp.get("groups", [])
                        if groups_list:
                            grp = groups_list[0]
                            if not owner_id and grp.get("id"):
                                owner_id = -int(grp["id"])
                                target_type = "group"
                            profile_data["group"] = grp

            except Exception as e:
                logger.warning(f"Error parsing apiPrefetchCache: {e}")

    if owner_id is None and page_html:
        m_oid = re.search(r'\"(?:loc_user_id|owner_id)\":\s*(-?\d+)', page_html)
        if m_oid:
            val = int(m_oid.group(1))
            if val != 0:
                owner_id = val
                target_type = "group" if owner_id < 0 else "user"

    profile_dossier: Dict[str, Any] = {
        "target": clean_target,
        "owner_id": owner_id,
        "type": target_type,
        "url": f"https://vk.com/{clean_target}",
        "name": None,
        "screen_name": clean_target,
        "verified": False,
        "description": None,
        "status": None,
        "followers_or_members": 0,
        "city": None,
        "country": None,
        "bdate": None,
        "avatar_url": None,
        "cover_url": None,
        "contacts": [],
        "site": None,
        "profile_entities": {
            "btc": [], "eth": [], "tron": [], "sol": [],
            "emails": [], "phones": [], "mentions": [], "hashtags": [], "onion_links": [], "urls": []
        }
    }

    if "user" in profile_data:
        u = profile_data["user"]
        fn = u.get("first_name", "")
        ln = u.get("last_name", "")
        profile_dossier["name"] = f"{fn} {ln}".strip() or clean_target
        profile_dossier["verified"] = bool(u.get("verified") or u.get("is_tinkoff_verified") or u.get("is_sber_verified") or u.get("is_esia_verified"))
        profile_dossier["status"] = u.get("status") or u.get("activity")
        profile_dossier["description"] = u.get("about") or u.get("status")
        profile_dossier["followers_or_members"] = u.get("followers_count", 0)
        profile_dossier["city"] = u.get("city", {}).get("title") if isinstance(u.get("city"), dict) else None
        profile_dossier["country"] = u.get("country", {}).get("title") if isinstance(u.get("country"), dict) else None
        profile_dossier["bdate"] = u.get("bdate")
        profile_dossier["avatar_url"] = u.get("photo_200") or u.get("photo_max") or u.get("photo_400_orig")
        profile_dossier["site"] = u.get("site")
        
        if u.get("mobile_phone"):
            profile_dossier["contacts"].append({"type": "mobile_phone", "value": u.get("mobile_phone")})
        if u.get("home_phone"):
            profile_dossier["contacts"].append({"type": "home_phone", "value": u.get("home_phone")})
        if u.get("instagram"):
            profile_dossier["contacts"].append({"type": "instagram", "value": u.get("instagram")})
        if u.get("twitter"):
            profile_dossier["contacts"].append({"type": "twitter", "value": u.get("twitter")})

    elif "group" in profile_data:
        g = profile_data["group"]
        profile_dossier["name"] = g.get("name") or clean_target
        profile_dossier["verified"] = bool(g.get("verified"))
        profile_dossier["description"] = g.get("description")
        profile_dossier["status"] = g.get("status")
        profile_dossier["followers_or_members"] = g.get("members_count", 0)
        profile_dossier["site"] = g.get("site")
        profile_dossier["avatar_url"] = g.get("photo_200") or g.get("photo_max")
        if g.get("cover", {}).get("enabled"):
            images = g.get("cover", {}).get("images", [])
            if images:
                profile_dossier["cover_url"] = images[-1].get("url")
        for c in g.get("contacts", []):
            desc = c.get("desc", "Contact")
            phone = c.get("phone")
            email = c.get("email")
            user_id = c.get("user_id")
            val = f"{desc}: {phone or email or f'id{user_id}'}"
            profile_dossier["contacts"].append({"type": "group_contact", "value": val})

    profile_text = f"{profile_dossier.get('name', '')} {profile_dossier.get('description', '')} {profile_dossier.get('status', '')} {profile_dossier.get('site', '')}"
    for ct in profile_dossier["contacts"]:
        profile_text += f" {ct.get('value', '')}"
    profile_dossier["profile_entities"] = extract_entities_from_text(profile_text)

    if owner_id is None:
        return {
            "target": clean_target,
            "profile": profile_dossier,
            "messages": [],
            "total_scraped": 0,
            "aggregated_intel": {
                "crypto_wallets": [],
                "emails": [],
                "phones": [],
                "mentions": [],
                "hashtags": [],
                "onion_links": [],
                "urls": [],
            },
            "stats": {
                "total_posts": 0,
                "posts_with_media": 0,
                "reposts_count": 0,
            },
            "warning": "Could not determine numeric owner_id for wall pagination."
        }

    posts_list: List[Dict[str, Any]] = []
    current_offset = 0
    batch_size = 10
    max_to_fetch = min(limit, 100)

    ajax_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": f"https://vk.com/{clean_target}",
    }

    async with httpx.AsyncClient(headers=ajax_headers, proxies=proxies, timeout=12.0) as client:
        while len(posts_list) < max_to_fetch:
            payload_data = {
                "act": "get_wall",
                "owner_id": str(owner_id),
                "offset": str(current_offset),
                "type": filter_type if filter_type in ("all", "own", "others") else "all",
                "al": "1",
            }
            try:
                resp = await client.post("https://vk.com/al_wall.php", data=payload_data)
                if resp.status_code != 200:
                    break

                content_str = resp.content.decode("windows-1251", errors="replace")
                try:
                    res_json = json.loads(content_str)
                except Exception:
                    break

                payload = res_json.get("payload", [])
                if not isinstance(payload, list) or len(payload) < 2:
                    break

                wall_chunk = payload[1]
                if not isinstance(wall_chunk, list) or not wall_chunk:
                    break

                wall_html = wall_chunk[0]
                soup = BeautifulSoup(wall_html, "html.parser")
                divs = soup.find_all(attrs={"data-exec": True})

                if not divs:
                    break

                batch_posts_count = 0
                for div in divs:
                    if len(posts_list) >= max_to_fetch:
                        break

                    raw_exec = div["data-exec"]
                    try:
                        exec_data = json.loads(raw_exec)
                        item = exec_data.get("PostContentContainer/init", {}).get("item")
                        if not item or not isinstance(item, dict):
                            continue

                        pid = item.get("id")
                        p_oid = item.get("owner_id", owner_id)
                        post_url = f"https://vk.com/wall{p_oid}_{pid}"
                        
                        raw_date = item.get("date", 0)
                        dt_iso = (
                            datetime.fromtimestamp(raw_date, tz=timezone.utc).isoformat()
                            if raw_date
                            else None
                        )

                        raw_text = item.get("text", "")
                        clean_post_text = _clean_text(raw_text)

                        views_count = item.get("views", {}).get("count", 0) if isinstance(item.get("views"), dict) else 0
                        likes_count = item.get("likes", {}).get("count", 0) if isinstance(item.get("likes"), dict) else 0
                        reposts_count = item.get("reposts", {}).get("count", 0) if isinstance(item.get("reposts"), dict) else 0
                        comments_count = item.get("comments", {}).get("count", 0) if isinstance(item.get("comments"), dict) else 0
                        reactions_items = item.get("reactions", {}).get("items", [])

                        attachments_info: List[Dict[str, Any]] = []
                        raw_attachments = item.get("attachments", [])
                        for att in raw_attachments:
                            atype = att.get("type")
                            if atype == "photo" and "photo" in att:
                                ph = att["photo"]
                                sizes = ph.get("sizes", [])
                                best_url = sizes[-1].get("url") if sizes else None
                                attachments_info.append({
                                    "type": "photo",
                                    "url": best_url,
                                    "text": ph.get("text", ""),
                                    "date": ph.get("date"),
                                })
                            elif atype == "video" and "video" in att:
                                vd = att["video"]
                                images = vd.get("image", [])
                                thumb = images[-1].get("url") if images else None
                                v_oid = vd.get("owner_id", p_oid)
                                v_id = vd.get("id")
                                attachments_info.append({
                                    "type": "video",
                                    "video_id": f"{v_oid}_{v_id}",
                                    "video_url": f"https://vk.com/video{v_oid}_{v_id}",
                                    "title": vd.get("title"),
                                    "description": vd.get("description"),
                                    "duration": vd.get("duration"),
                                    "thumbnail_url": thumb,
                                })
                            elif atype == "link" and "link" in att:
                                lk = att["link"]
                                attachments_info.append({
                                    "type": "link",
                                    "url": lk.get("url"),
                                    "title": lk.get("title"),
                                    "description": lk.get("description"),
                                })
                            elif atype == "doc" and "doc" in att:
                                dc = att["doc"]
                                attachments_info.append({
                                    "type": "doc",
                                    "title": dc.get("title"),
                                    "ext": dc.get("ext"),
                                    "url": dc.get("url"),
                                    "size": dc.get("size"),
                                })

                        copy_history = item.get("copy_history")
                        is_repost = bool(copy_history and isinstance(copy_history, list))
                        repost_origin = None
                        if is_repost and copy_history:
                            orig = copy_history[0]
                            orig_oid = orig.get("owner_id")
                            orig_id = orig.get("id")
                            orig_text = _clean_text(orig.get("text", ""))
                            repost_origin = {
                                "owner_id": orig_oid,
                                "post_id": orig_id,
                                "url": f"https://vk.com/wall{orig_oid}_{orig_id}",
                                "text": orig_text,
                            }
                            clean_post_text = f"{clean_post_text}\n[Repost]: {orig_text}".strip()

                        entities = extract_entities_from_text(clean_post_text)

                        posts_list.append({
                            "post_id": f"{p_oid}_{pid}",
                            "post_url": post_url,
                            "date_utc": dt_iso,
                            "text": clean_post_text,
                            "views": views_count,
                            "likes": likes_count,
                            "reposts": reposts_count,
                            "comments": comments_count,
                            "reactions_count": len(reactions_items),
                            "attachments": attachments_info,
                            "is_repost": is_repost,
                            "repost_origin": repost_origin,
                            "entities": entities,
                        })
                        batch_posts_count += 1

                    except Exception as e:
                        logger.warning(f"Error parsing post div: {e}")

                if batch_posts_count == 0:
                    break

                current_offset += batch_size

            except Exception as e:
                logger.warning(f"Error requesting al_wall offset {current_offset}: {e}")
                break

    crypto_set = set()
    email_set = set()
    phone_set = set()
    mention_set = set()
    hashtag_set = set()
    onion_set = set()
    url_set = set()

    for k, val_list in profile_dossier["profile_entities"].items():
        if k == "emails":
            email_set.update(val_list)
        elif k == "phones":
            phone_set.update(val_list)
        elif k == "mentions":
            mention_set.update(val_list)
        elif k == "hashtags":
            hashtag_set.update(val_list)
        elif k == "onion_links":
            onion_set.update(val_list)
        elif k == "urls":
            url_set.update(val_list)
        elif k in ("btc", "eth", "tron", "sol"):
            crypto_set.update(val_list)

    media_count = 0
    reposts_total = 0

    for p in posts_list:
        if p["attachments"]:
            media_count += 1
        if p["is_repost"]:
            reposts_total += 1

        ent = p["entities"]
        for c in ent.get("btc", []) + ent.get("eth", []) + ent.get("tron", []) + ent.get("sol", []):
            crypto_set.add(c)
        email_set.update(ent.get("emails", []))
        phone_set.update(ent.get("phones", []))
        mention_set.update(ent.get("mentions", []))
        hashtag_set.update(ent.get("hashtags", []))
        onion_set.update(ent.get("onion_links", []))
        url_set.update(ent.get("urls", []))

    return {
        "target": clean_target,
        "profile": profile_dossier,
        "messages": posts_list,
        "total_scraped": len(posts_list),
        "aggregated_intel": {
            "crypto_wallets": sorted(list(crypto_set)),
            "emails": sorted(list(email_set)),
            "phones": sorted(list(phone_set)),
            "mentions": sorted(list(mention_set)),
            "hashtags": sorted(list(hashtag_set)),
            "onion_links": sorted(list(onion_set)),
            "urls": sorted(list(url_set)),
        },
        "stats": {
            "total_posts": len(posts_list),
            "posts_with_media": media_count,
            "reposts_count": reposts_total,
            "newest_post_date": posts_list[0]["date_utc"] if posts_list else None,
            "oldest_post_date": posts_list[-1]["date_utc"] if posts_list else None,
        }
    }
