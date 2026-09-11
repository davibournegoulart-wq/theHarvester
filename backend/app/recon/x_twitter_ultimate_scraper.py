"""X (formerly Twitter) Ultimate Recon & Forensic Scraper Engine.

Performs deep, non-API OSINT reconnaissance on X/Twitter profiles and tweets:
- Profile Dossier: Display Name, @handle, Rest ID, Bio, Joined Date, Followers,
  Following, Tweets count, High-Res Avatar (400x400 / original), and Banner.
- Timeline Ingestion: Up to 100 recent tweets with text, publication timestamps,
  engagement metrics (likes, retweets, replies), photo/media previews, and external links.
- Single Tweet Deep-Dive: Tweet text, author, engagement, media, and entity breakdown.
- Automated Bot & Inauthentic Account Analysis: Heuristic inspection inspired by
  Bot Sentinel (account velocity, followers ratio, entropy of handle, default avatar).
- Forensic Entity Extraction: Multi-chain crypto wallets (BTC, ETH, TRX, SOL),
  communication contacts (emails, phones), user mentions, hashtags, and onion/external URLs.
- OSINT Pivots Matrix: Target-linked queries for Foller.me, Twitonomy, Bot Sentinel,
  Wayback Tweets, BirdHunt, Nitter, Social Blade, and Twitter Advanced Search.
"""

import re
import html
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

# Forensic Regex Patterns
BTC_REGEX = re.compile(r"\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,62})\b")
ETH_REGEX = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
TRON_REGEX = re.compile(r"\bT[A-Za-z1-9]{33}\b")
SOL_REGEX = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}")
ONION_REGEX = re.compile(r"https?://[a-zA-Z0-9]{16,56}\.onion\b(?:/[^\s]*)?")
URL_REGEX = re.compile(r"https?://[^\s\"'<>]+")

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "\"macOS\"",
}

FX_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; NetScraperBot/2.0; +https://netscraper.internal/osint)",
    "Accept": "application/json",
}


def clean_x_target(target: str) -> Tuple[str, str]:
    """Resolves target into ('user', username) or ('tweet', tweet_id)."""
    clean = target.strip()

    # Tweet URL matcher: https://x.com/username/status/123456789 or twitter.com/...
    m_tweet = re.search(r"(?:twitter\.com|x\.com)/[^/]+/status/(\d+)", clean)
    if m_tweet:
        return "tweet", m_tweet.group(1)

    # Pure numeric tweet ID
    if re.match(r"^\d{15,22}$", clean):
        return "tweet", clean

    # Profile URL: https://x.com/username or twitter.com/username
    m_profile = re.search(r"(?:twitter\.com|x\.com)/([a-zA-Z0-9_]{1,30})", clean)
    if m_profile:
        return "user", m_profile.group(1).lower()

    # Raw handle e.g. @elonmusk or elonmusk
    return "user", clean.lstrip("@").lower()


def extract_entities_from_text(text: str) -> Dict[str, Any]:
    """Forensically parses crypto, contact, and URL identifiers from arbitrary text."""
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
        if not e.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".js", "twitter.com", "x.com", "twimg.com", "t.co"))
    ]

    raw_phones = set(PHONE_REGEX.findall(text))
    phones = [p.strip() for p in raw_phones if 8 <= len(re.sub(r"\D", "", p)) <= 15]

    mentions = list(set(re.findall(r"@([a-zA-Z0-9_]{1,30})", text)))
    hashtags = list(set(re.findall(r"#([a-zA-Z0-9_\u00C0-\u00FF]{2,35})", text)))
    onions = list(set(ONION_REGEX.findall(text)))
    urls = [
        u for u in set(URL_REGEX.findall(text))
        if ".onion" not in u and not any(d in u for d in ["twitter.com", "x.com", "twimg.com", "t.co"])
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


def calculate_bot_score(profile: Dict[str, Any], tweets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Heuristic Bot Sentinel & inauthenticity estimator (0-100 score)."""
    score = 10
    flags = []

    followers = profile.get("followers") or 0
    following = profile.get("following") or 0
    tweets_count = profile.get("tweets_count") or 0
    screen_name = profile.get("screen_name") or ""
    avatar_url = profile.get("avatar_url") or ""

    # Check 1: Numeric digits in handle
    digits_count = sum(c.isdigit() for c in screen_name)
    if digits_count >= 5:
        score += 25
        flags.append(f"High numeric suffix ({digits_count} digits) typical of auto-generated handles")
    elif digits_count >= 3:
        score += 10
        flags.append("Handle contains multiple trailing digits")

    # Check 2: Follower to Following Ratio
    if following > 500 and followers < 20:
        score += 30
        flags.append(f"Extreme following/follower disparity: following {following}, only {followers} followers")
    elif following > 2000 and followers < 100:
        score += 25
        flags.append(f"High follow-churn pattern: following {following}, {followers} followers")

    # Check 3: Default avatar check
    if "default_profile_images" in avatar_url or not avatar_url:
        score += 20
        flags.append("Default Twitter/X egg placeholder profile avatar")

    # Check 4: Tweet velocity (tweets per day)
    joined_raw = profile.get("joined")
    if joined_raw:
        try:
            # Format: 'Tue Jun 02 20:12:29 +0000 2009'
            dt = datetime.strptime(joined_raw, "%a %b %d %H:%M:%S %z %Y")
            days_active = max(1, (datetime.now(timezone.utc) - dt).days)
            tweets_per_day = tweets_count / days_active
            if tweets_per_day > 100:
                score += 35
                flags.append(f"Abnormal tweeting velocity: ~{tweets_per_day:.1f} tweets/day over {days_active} days")
            elif tweets_per_day > 50:
                score += 20
                flags.append(f"Elevated activity volume: ~{tweets_per_day:.1f} tweets/day")
        except Exception:
            pass

    # Check 5: Duplicate hashtag/link spam in recent scraped tweets
    if tweets:
        url_count = sum(1 for t in tweets if "http" in t.get("text", ""))
        if len(tweets) >= 10 and (url_count / len(tweets)) > 0.8:
            score += 15
            flags.append("Heavy link-broadcasting behavior (>80% of recent tweets contain external links)")

    score = min(100, max(5, score))

    if score >= 75:
        classification = "Alarming / Bot-like"
        color = "#ef4444"
    elif score >= 50:
        classification = "Suspicious"
        color = "#f97316"
    elif score >= 30:
        classification = "Satisfactory / Moderate"
        color = "#eab308"
    else:
        classification = "Normal / Authentic"
        color = "#22c55e"

    return {
        "score": score,
        "classification": classification,
        "color": color,
        "flags": flags,
    }


def generate_x_osint_pivots(username: str, tweet_id: Optional[str] = None) -> List[Dict[str, str]]:
    """Generates direct intelligence pivot links for X / Twitter."""
    pivots = []
    clean_u = username.lstrip("@")

    # 1. Foller.me Account Topic & Activity Analytics
    pivots.append({
        "name": "Foller.me",
        "url": f"https://foller.me/{clean_u}",
        "category": "Topic & Behavior Analytics",
        "description": "Exhaustive breakdown of account topics, top mentions, active hours, hashtag clouds, and usage habits.",
    })

    # 2. Twitonomy
    pivots.append({
        "name": "Twitonomy",
        "url": f"https://www.twitonomy.com/profile.php?sn={clean_u}",
        "category": "Deep Profile Analytics",
        "description": "Visual analytics on tweets, retweets, replies, mentions, hashtags, platforms, and follower engagement graphs.",
    })

    # 3. Bot Sentinel
    pivots.append({
        "name": "Bot Sentinel",
        "url": f"https://botsentinel.com/profile/{clean_u}",
        "category": "Bot & Inauthenticity Detection",
        "description": "Machine-learning assessment of automated accounts, disruptive troll behavior, and coordinated bot activity.",
    })

    # 4. Wayback Tweets & Archive
    wb_url = f"https://waybacktweets.streamlit.app/?username={clean_u}"
    pivots.append({
        "name": "Wayback Tweets",
        "url": wb_url,
        "category": "Deleted Tweet Recovery",
        "description": "Historical timeline search across the Wayback Machine to recover deleted, unindexed, or altered tweets.",
    })

    # 5. Wayback Machine Direct Snapshot
    pivots.append({
        "name": "Wayback Machine (Archive.org)",
        "url": f"https://web.archive.org/web/*/twitter.com/{clean_u}*",
        "category": "Historical Profile Archival",
        "description": "Complete historical snapshots of this Twitter profile, prior bios, past profile avatars, and removed content.",
    })

    # 6. BirdHunt
    pivots.append({
        "name": "BirdHunt",
        "url": "https://birdhunt.huntintel.io/",
        "category": "Geospatial & Historical",
        "description": "Search geotagged tweets around specific coordinate coordinates, radiuses, and chronological intervals.",
    })

    # 7. Nitter Alternative Gateway
    pivots.append({
        "name": "Nitter Instance",
        "url": f"https://nitter.net/{clean_u}",
        "category": "Privacy Frontend & RSS",
        "description": "Clean, privacy-preserving frontend for scraping tweets, media attachments, and RSS feeds without login walls.",
    })

    # 8. Social Blade Twitter
    pivots.append({
        "name": "Social Blade",
        "url": f"https://socialblade.com/twitter/user/{clean_u}",
        "category": "Growth Tracking & Metrics",
        "description": "Historical daily follower fluctuations, growth audit curves, grade ratings, and engagement ranking.",
    })

    # 9. Twitter / X Advanced Live Search
    query_search = f"from%3A{clean_u}&f=live" if not tweet_id else f"to%3A{clean_u}&f=live"
    pivots.append({
        "name": "X Advanced Live Search",
        "url": f"https://twitter.com/search?q={query_search}",
        "category": "Live Stream & Replies",
        "description": "Query live reverse chronological tweets, mentions, or replies directly on the native platform.",
    })

    return pivots


async def scrape_x_tweet_details(tweet_id_or_url: str, use_tor: bool = False) -> Dict[str, Any]:
    """Fetches single tweet intelligence via high-performance syndication APIs."""
    _, tweet_id = clean_x_target(tweet_id_or_url)

    transport = None
    if use_tor and settings.TOR_SOCKS_PROXY:
        transport = httpx.AsyncHTTPTransport(proxy=settings.TOR_SOCKS_PROXY)

    tweet_data = {}
    async with httpx.AsyncClient(headers=FX_HEADERS, timeout=15.0, transport=transport, follow_redirects=True) as client:
        try:
            r = await client.get(f"https://api.fxtwitter.com/status/{tweet_id}")
            if r.status_code == 200:
                tweet_data = r.json().get("tweet", {})
        except Exception as e:
            logger.warning(f"FxTwitter single tweet fetch error for {tweet_id}: {e}")

    author = tweet_data.get("author", {})
    text = tweet_data.get("text") or ""
    created_at = tweet_data.get("created_at") or ""
    likes = tweet_data.get("likes") or 0
    retweets = tweet_data.get("retweets") or 0
    replies = tweet_data.get("replies") or 0

    # Photos and Media
    media_items = []
    media_obj = tweet_data.get("media", {})
    if isinstance(media_obj, dict):
        for photo in media_obj.get("photos", []):
            if isinstance(photo, dict) and photo.get("url"):
                media_items.append(photo["url"])
            elif isinstance(photo, str):
                media_items.append(photo)
        for video in media_obj.get("videos", []):
            if isinstance(video, dict) and video.get("thumbnail_url"):
                media_items.append(video["thumbnail_url"])

    entities = extract_entities_from_text(f"{text} {author.get('description', '')}")

    return {
        "tweet_id": tweet_id,
        "url": f"https://x.com/{author.get('screen_name', 'i')}/status/{tweet_id}",
        "text": text,
        "created_at": created_at,
        "likes": likes,
        "retweets": retweets,
        "replies": replies,
        "media_urls": media_items,
        "author": {
            "name": author.get("name") or "",
            "screen_name": author.get("screen_name") or "",
            "avatar_url": author.get("avatar_url") or "",
            "banner_url": author.get("banner_url") or "",
            "url": f"https://x.com/{author.get('screen_name')}" if author.get("screen_name") else "",
        },
        "entities": entities,
        "osint_pivots": generate_x_osint_pivots(author.get("screen_name") or "i", tweet_id=tweet_id),
    }


async def scrape_x_profile_ultimate(
    username_or_url: str,
    limit: int = 50,
    use_tor: bool = False,
) -> Dict[str, Any]:
    """Scrapes comprehensive X/Twitter profile dossier, timeline tweets, bot score, and entities."""
    target_type, identifier = clean_x_target(username_or_url)

    # Route to single tweet if a status URL was passed
    if target_type == "tweet":
        single_tweet = await scrape_x_tweet_details(identifier, use_tor=use_tor)
        author = single_tweet["author"]
        return {
            "scrape_type": "tweet",
            "target": username_or_url,
            "single_tweet": single_tweet,
            "profile": {
                "name": author.get("name"),
                "screen_name": author.get("screen_name"),
                "avatar_url": author.get("avatar_url"),
                "banner_url": author.get("banner_url"),
                "url": author.get("url"),
            },
            "tweets": [{
                "id": single_tweet["tweet_id"],
                "text": single_tweet["text"],
                "created_at": single_tweet["created_at"],
                "likes": single_tweet["likes"],
                "retweets": single_tweet["retweets"],
                "replies": single_tweet["replies"],
                "media_urls": single_tweet["media_urls"],
                "url": single_tweet["url"],
            }],
            "total_scraped": 1,
            "bot_analysis": {
                "score": 10,
                "classification": "Single Tweet Mode",
                "color": "#3b82f6",
                "flags": ["Analysis applied to single isolated tweet."],
            },
            "aggregated_intel": single_tweet["entities"],
            "osint_pivots": single_tweet["osint_pivots"],
        }

    username = identifier.lstrip("@").lower()

    transport = None
    if use_tor and settings.TOR_SOCKS_PROXY:
        transport = httpx.AsyncHTTPTransport(proxy=settings.TOR_SOCKS_PROXY)

    user_info: Dict[str, Any] = {}
    tweets_list: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=20.0, transport=transport, follow_redirects=True) as client:
        # 1. Fetch user profile from FxTwitter API
        try:
            r_u = await client.get(f"https://api.fxtwitter.com/{username}", headers=FX_HEADERS)
            if r_u.status_code == 200:
                user_info = r_u.json().get("user", {})
        except Exception as e:
            logger.info(f"Could not retrieve user info from FxTwitter for {username}: {e}")

        # 2. Fetch timeline tweets from Twitter Syndication CDN
        try:
            synd_url = f"https://syndication.twitter.com/srv/timeline-profile/screen-name/{username}"
            r_t = await client.get(synd_url)
            if r_t.status_code == 200:
                soup = BeautifulSoup(r_t.text, "html.parser")
                tag = soup.find("script", id="__NEXT_DATA__")
                if tag and tag.string:
                    data = json.loads(tag.string)
                    timeline = data.get("props", {}).get("pageProps", {}).get("timeline", {})
                    entries = timeline.get("entries", [])

                    for e in entries:
                        t = e.get("content", {}).get("tweet", {})
                        if t:
                            # If user_info wasn't populated by FxTwitter, populate from syndication tweet author
                            if not user_info and t.get("user"):
                                u = t["user"]
                                user_info = {
                                    "name": u.get("name"),
                                    "screen_name": u.get("screen_name"),
                                    "description": u.get("description"),
                                    "followers": u.get("followers_count"),
                                    "following": u.get("friends_count"),
                                    "avatar_url": u.get("profile_image_url_https"),
                                    "banner_url": u.get("profile_banner_url"),
                                    "tweets": u.get("statuses_count"),
                                    "joined": u.get("created_at"),
                                }

                            # Photos and media details
                            media_urls = []
                            for m in t.get("mediaDetails", []):
                                if m.get("media_url_https"):
                                    media_urls.append(m["media_url_https"])

                            t_id = t.get("id_str") or ""
                            tweets_list.append({
                                "id": t_id,
                                "text": t.get("text") or "",
                                "created_at": t.get("created_at") or "",
                                "likes": t.get("favorite_count") or 0,
                                "retweets": t.get("retweet_count") or 0,
                                "replies": t.get("reply_count") or 0,
                                "media_urls": media_urls,
                                "url": f"https://x.com/{username}/status/{t_id}",
                            })

                            if len(tweets_list) >= limit:
                                break
        except Exception as e:
            logger.warning(f"Error scraping Twitter syndication for {username}: {e}")

    # High-resolution avatar processing (upgrade normal -> 400x400)
    raw_avatar = user_info.get("avatar_url") or ""
    highres_avatar = re.sub(r"_normal(\.[a-zA-Z]+)$", r"_400x400\1", raw_avatar) if raw_avatar else ""
    raw_banner = user_info.get("banner_url") or ""

    profile_dossier = {
        "screen_name": user_info.get("screen_name") or username,
        "name": user_info.get("name") or username,
        "bio": user_info.get("description") or "",
        "followers": user_info.get("followers") or 0,
        "following": user_info.get("following") or 0,
        "joined": user_info.get("joined") or "",
        "tweets_count": user_info.get("tweets") or len(tweets_list),
        "avatar_url": highres_avatar or raw_avatar,
        "raw_avatar_url": raw_avatar,
        "banner_url": raw_banner,
        "url": f"https://x.com/{username}",
    }

    # Bot Sentinel Heuristic Analysis
    bot_analysis = calculate_bot_score(profile_dossier, tweets_list)

    # Forensic Entity Extraction across bio and all retrieved tweets
    all_texts = [profile_dossier["name"], profile_dossier["bio"]] + [t["text"] for t in tweets_list]
    aggregated_intel = extract_entities_from_text("\n".join(all_texts))

    osint_pivots = generate_x_osint_pivots(username)

    return {
        "scrape_type": "profile",
        "target": username_or_url,
        "profile": profile_dossier,
        "tweets": tweets_list,
        "total_scraped": len(tweets_list),
        "bot_analysis": bot_analysis,
        "aggregated_intel": aggregated_intel,
        "stats": {
            "followers": profile_dossier["followers"],
            "following": profile_dossier["following"],
            "tweets_count": profile_dossier["tweets_count"],
            "timeline_scraped": len(tweets_list),
            "media_tweets_count": sum(1 for t in tweets_list if len(t.get("media_urls", [])) > 0),
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
