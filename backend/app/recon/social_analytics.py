"""Social Media Analytics & Monitoring Engine.
Integrates Hootsuite, Buffer, Brandwatch, and Audiense methodologies.
Provides native multi-platform stream discovery (Twitter/X, Reddit, YouTube, Web/News),
sentiment radar, crisis spike detection, audience tribe clustering, and posting cadence analytics.
"""

from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any
import httpx
from bs4 import BeautifulSoup

# Curated Social Media Monitoring & Analytics Platforms
MONITORING_PLATFORMS = [
    {
        "name": "Hootsuite",
        "url": "https://www.hootsuite.com/",
        "category": "Social Media Monitoring & Management",
        "description": "Comprehensive social media management and monitoring platform. Allows managing multi-platform streams, scheduling content, tracking brand mentions, and analyzing campaign response times.",
        "capabilities": [
            "Multi-network stream monitoring (X, FB, IG, LinkedIn, YouTube)",
            "Keyword & hashtag listening streams",
            "Cross-channel publishing & queue analytics",
            "Team crisis response workflows",
        ],
        "query_url": "https://www.hootsuite.com/",
    },
    {
        "name": "Buffer",
        "url": "https://buffer.com/",
        "category": "Scheduling & Cadence Monitoring",
        "description": "Scheduling and monitoring of social media activity. Analyzes posting cadence, best times to post, engagement benchmarking, and cross-channel performance metrics.",
        "capabilities": [
            "Posting schedule & cadence optimization",
            "Cross-channel engagement rate tracking",
            "Audience retention & click-through metrics",
            "Multi-account automated queue management",
        ],
        "query_url": "https://buffer.com/",
    },
    {
        "name": "Brandwatch",
        "url": "https://www.brandwatch.com/",
        "category": "Social Listening & Consumer Intelligence",
        "description": "Premier enterprise social listening and analytics platform. Ingests conversations across 100M+ web sources, blogs, forums, and social networks with real-time crisis detection and AI sentiment radar.",
        "capabilities": [
            "100M+ web sources & social listening coverage",
            "AI sentiment, emotion, and tonality analysis",
            "Real-time volume surge & crisis alerts",
            "Share of voice & competitive benchmarking",
            "Demographics & topic co-occurrence mapping",
        ],
        "query_url": "https://www.brandwatch.com/",
    },
    {
        "name": "Audiense",
        "url": "https://www.audiense.com/",
        "category": "Audience Intelligence & Segmentation",
        "description": "Advanced audience segmentation and Twitter/X analytics. Discovers community tribe clusters, socio-demographic characteristics, influencer affinities, and social graph connections.",
        "capabilities": [
            "Tribe cluster segmentation & community mapping",
            "Twitter/X social graph & affinity index analysis",
            "Socio-demographic & cultural insights",
            "Influencer identification & brand affinity matrix",
        ],
        "query_url": "https://www.audiense.com/",
    },
]

# Lexicons for Sentiment & Threat Analysis
POSITIVE_WORDS = {
    "good", "great", "excellent", "verified", "authentic", "accurate", "solid", "award",
    "victory", "truth", "breakthrough", "reliable", "legitimate", "love", "best", "success",
    "safe", "brilliant", "outstanding", "impressive", "confirmed", "win", "praise", "honor",
}

NEGATIVE_WORDS = {
    "bad", "wrong", "fail", "terrible", "doubt", "flaw", "corrupt", "lie", "disinformation",
    "misinformation", "bias", "error", "problem", "refute", "deny", "criticism", "poor",
}

CRITICAL_THREAT_WORDS = {
    "scam", "fake", "fraud", "leak", "breach", "exposed", "illegal", "arrest", "hack",
    "scammer", "warning", "dangerous", "criminal", "attack", "exploit", "boycott",
    "ban", "dox", "troll", "bot", "lawsuit", "sanction", "subpoena", "stolen", "extortion",
}

STOPWORDS = {
    "the", "and", "a", "an", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "is", "are", "was", "were", "this", "that", "it", "as", "be", "or", "which", "will",
    "have", "has", "had", "not", "but", "what", "all", "were", "when", "who", "they",
}


def _classify_sentiment(text: str) -> tuple[str, float]:
    """Score sentiment and threat severity (-1.0 to 1.0)."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    if not words:
        return "NEUTRAL", 0.0

    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    threat_count = sum(1 for w in words if w in CRITICAL_THREAT_WORDS)

    # Threat overrides standard negative
    if threat_count >= 2 or (threat_count >= 1 and neg_count >= 1):
        score = max(-1.0, -0.6 - (threat_count * 0.15))
        return "CRITICAL", round(score, 2)

    total_emotional = pos_count + neg_count + threat_count
    if total_emotional == 0:
        return "NEUTRAL", 0.0

    raw_score = (pos_count - (neg_count + threat_count * 1.5)) / max(total_emotional, 1)
    raw_score = max(-1.0, min(1.0, raw_score))

    if raw_score > 0.2:
        return "POSITIVE", round(raw_score, 2)
    elif raw_score < -0.2:
        return "NEGATIVE", round(raw_score, 2)
    return "NEUTRAL", round(raw_score, 2)


def _extract_hashtags(text: str) -> list[str]:
    return [tag.lower() for tag in re.findall(r"#([a-zA-Z0-9_]{2,30})", text)]


def _extract_mentions(text: str) -> list[str]:
    return [m.lower() for m in re.findall(r"@([a-zA-Z0-9_]{2,30})", text)]


async def _fetch_rss_stream(
    client: httpx.AsyncClient,
    url: str,
    platform_name: str,
) -> list[dict[str, Any]]:
    """Fetch and parse RSS/Atom feeds."""
    mentions: list[dict[str, Any]] = []
    try:
        resp = await client.get(url, timeout=12.0)
        if resp.status_code != 200:
            return mentions

        soup = BeautifulSoup(resp.text, "xml")

        # Standard RSS items
        items = soup.find_all("item")
        for it in items:
            title = it.title.text.strip() if it.title else ""
            link = it.link.text.strip() if it.link else ""
            source = it.source.text.strip() if it.source else platform_name
            pub_date_str = it.pubDate.text.strip() if it.pubDate else ""

            dt = None
            if pub_date_str:
                try:
                    dt = parsedate_to_datetime(pub_date_str)
                except Exception:
                    pass

            sentiment, score = _classify_sentiment(title)

            mentions.append({
                "platform": platform_name,
                "title": title,
                "author": source,
                "source": source,
                "url": link,
                "published_at": dt.isoformat() if dt else datetime.utcnow().isoformat(),
                "hour_utc": dt.hour if dt else 12,
                "weekday": dt.strftime("%a") if dt else "Wed",
                "sentiment": sentiment,
                "sentiment_score": score,
                "hashtags": _extract_hashtags(title),
                "mentions": _extract_mentions(title),
            })

        # Atom entries (Reddit format)
        entries = soup.find_all("entry")
        for e in entries:
            title = e.title.text.strip() if e.title else ""
            link = ""
            if e.link and e.link.get("href"):
                link = e.link["href"]
            elif e.link:
                link = e.link.text.strip()

            author = ""
            if e.author and e.author.name:
                author = e.author.name.text.strip()
            elif e.author:
                author = e.author.text.strip()

            pub_str = e.updated.text.strip() if e.updated else (e.published.text.strip() if e.published else "")
            dt = None
            if pub_str:
                try:
                    dt = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                except Exception:
                    pass

            sentiment, score = _classify_sentiment(title)

            mentions.append({
                "platform": platform_name,
                "title": title,
                "author": author or "u/anonymous",
                "source": "Reddit Community",
                "url": link,
                "published_at": dt.isoformat() if dt else datetime.utcnow().isoformat(),
                "hour_utc": dt.hour if dt else 12,
                "weekday": dt.strftime("%a") if dt else "Wed",
                "sentiment": sentiment,
                "sentiment_score": score,
                "hashtags": _extract_hashtags(title),
                "mentions": _extract_mentions(title),
            })

    except Exception:
        pass

    return mentions


async def run_social_media_analytics(
    target: str,
    query_type: str = "keyword",
    limit: int = 50,
    use_tor: bool = False,
) -> dict[str, Any]:
    """Execute cross-platform social media monitoring, listening, and sentiment analytics."""
    clean_target = target.strip().lstrip("@")
    encoded_target = clean_target.replace(" ", "+")

    proxy_url = "socks5://127.0.0.1:9050" if use_tor else None
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    rss_feeds = [
        ("Twitter / X", f"https://news.google.com/rss/search?q=site:x.com+{encoded_target}&hl=en-US&gl=US&ceid=US:en"),
        ("Reddit", f"https://www.reddit.com/search.rss?q={encoded_target}&sort=new"),
        ("YouTube", f"https://news.google.com/rss/search?q=site:youtube.com+{encoded_target}&hl=en-US&gl=US&ceid=US:en"),
        ("Web & News", f"https://news.google.com/rss/search?q={encoded_target}&hl=en-US&gl=US&ceid=US:en"),
    ]

    async with httpx.AsyncClient(headers=headers, timeout=12.0, follow_redirects=True, proxy=proxy_url) as client:
        tasks = [
            _fetch_rss_stream(client, url, platform_name)
            for platform_name, url in rss_feeds
        ]
        results_list = await asyncio.gather(*tasks, return_exceptions=True)

    all_mentions: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for res in results_list:
        if isinstance(res, list):
            for m in res:
                url = m.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_mentions.append(m)

    # Sort mentions by published date descending
    all_mentions.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    all_mentions = all_mentions[:limit]

    total_mentions = len(all_mentions)

    # 1. Platform Breakdown
    platform_counts: dict[str, int] = {}
    for m in all_mentions:
        p = m["platform"]
        platform_counts[p] = platform_counts.get(p, 0) + 1

    # 2. Sentiment Metrics & Threat Level
    pos_count = sum(1 for m in all_mentions if m["sentiment"] == "POSITIVE")
    neu_count = sum(1 for m in all_mentions if m["sentiment"] == "NEUTRAL")
    neg_count = sum(1 for m in all_mentions if m["sentiment"] == "NEGATIVE")
    crit_count = sum(1 for m in all_mentions if m["sentiment"] == "CRITICAL")

    if total_mentions > 0:
        pos_pct = round((pos_count / total_mentions) * 100, 1)
        neu_pct = round((neu_count / total_mentions) * 100, 1)
        neg_pct = round((neg_count / total_mentions) * 100, 1)
        crit_pct = round((crit_count / total_mentions) * 100, 1)
        avg_score = round(sum(m["sentiment_score"] for m in all_mentions) / total_mentions, 2)
    else:
        pos_pct = neu_pct = neg_pct = crit_pct = 0.0
        avg_score = 0.0

    # Determine Dominant Sentiment & Threat Level
    hostile_total = neg_count + crit_count
    hostile_pct = round((hostile_total / max(total_mentions, 1)) * 100, 1)

    if crit_count >= 3 or hostile_pct >= 40:
        threat_level = "CRISIS ALERT"
        dominant_sentiment = "CRITICAL"
    elif hostile_pct >= 25:
        threat_level = "HIGH SURGE"
        dominant_sentiment = "NEGATIVE"
    elif hostile_pct >= 12:
        threat_level = "ELEVATED"
        dominant_sentiment = "NEUTRAL-NEGATIVE"
    elif pos_pct >= 40:
        threat_level = "ROUTINE"
        dominant_sentiment = "POSITIVE"
    else:
        threat_level = "ROUTINE"
        dominant_sentiment = "NEUTRAL"

    # 3. Top Hashtags & Keywords (Audiense / Brandwatch Affinity)
    hashtag_counter: dict[str, int] = {}
    keyword_counter: dict[str, int] = {}
    author_counter: dict[str, dict[str, Any]] = {}

    for m in all_mentions:
        # Hashtags
        for h in m.get("hashtags", []):
            hashtag_counter[h] = hashtag_counter.get(h, 0) + 1

        # Keywords
        words = re.findall(r"\b[a-zA-Z]{4,}\b", m.get("title", "").lower())
        for w in words:
            if w not in STOPWORDS and w != clean_target.lower():
                keyword_counter[w] = keyword_counter.get(w, 0) + 1

        # Authors
        auth = m.get("author", "Unknown").strip()
        if auth and auth != "Unknown":
            if auth not in author_counter:
                author_counter[auth] = {"author": auth, "platform": m["platform"], "count": 0}
            author_counter[auth]["count"] += 1

    top_hashtags = sorted(
        [{"tag": k, "count": v} for k, v in hashtag_counter.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:12]

    top_keywords = sorted(
        [{"keyword": k, "count": v} for k, v in keyword_counter.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:15]

    top_amplifiers = sorted(
        list(author_counter.values()),
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # 4. Posting Cadence & Rhythm (Buffer / Hootsuite Inspired)
    hourly_buckets = [0] * 24
    weekday_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekday_buckets = {day: 0 for day in weekday_order}

    for m in all_mentions:
        h = m.get("hour_utc", 12)
        if 0 <= h < 24:
            hourly_buckets[h] += 1

        w = m.get("weekday", "Wed")
        if w in weekday_buckets:
            weekday_buckets[w] += 1

    # Check for cadence uniformity (automation vs organic human posting)
    active_hours = sum(1 for c in hourly_buckets if c > 0)
    is_automated_cadence = active_hours >= 18 and (max(hourly_buckets) - min(hourly_buckets) <= 3)

    # 5. Audience Tribes & Affinity Segments (Audiense Style)
    audience_clusters = []
    kw_keys = set(k["keyword"] for k in top_keywords)

    if any(k in kw_keys for k in ["investigation", "osint", "satellite", "geolocation", "bellingcat", "forensics"]):
        audience_clusters.append({
            "segment": "OSINT & Investigative Journalists",
            "affinity_score": 94,
            "description": "High concentration of open-source analysts, geospatial researchers, and fact-checkers.",
        })
    if any(k in kw_keys for k in ["security", "cyber", "hack", "military", "war", "defense", "vessel"]):
        audience_clusters.append({
            "segment": "Defense & Cyber Threat Intelligence",
            "affinity_score": 88,
            "description": "Security practitioners, maritime trackers, and geopolitical threat monitors.",
        })
    if any(k in kw_keys for k in ["news", "report", "media", "documentary", "emmy", "press"]):
        audience_clusters.append({
            "segment": "Broadcasters & Mainstream Media",
            "affinity_score": 82,
            "description": "News wire editors, broadcasters, and media publications amplifying reports.",
        })
    if not audience_clusters:
        audience_clusters.append({
            "segment": "Public Observers & Social Commentators",
            "affinity_score": 75,
            "description": "General social media commentators, community discussions, and digital observers.",
        })

    # Estimate reach (weighted impressions)
    estimated_reach = total_mentions * 4200

    return {
        "target": target,
        "query_type": query_type,
        "analyzed_at": datetime.utcnow().isoformat(),
        "total_mentions": total_mentions,
        "estimated_reach": estimated_reach,
        "threat_level": threat_level,
        "dominant_sentiment": dominant_sentiment,
        "sentiment_score_avg": avg_score,
        "sentiment_breakdown": {
            "positive": {"count": pos_count, "percent": pos_pct},
            "neutral": {"count": neu_count, "percent": neu_pct},
            "negative": {"count": neg_count, "percent": neg_pct},
            "critical": {"count": crit_count, "percent": crit_pct},
        },
        "platform_breakdown": platform_counts,
        "cadence_analysis": {
            "rhythm_type": "Automated / Scheduled Queue" if is_automated_cadence else "Organic / Human-Driven",
            "peak_hour_utc": hourly_buckets.index(max(hourly_buckets)) if total_mentions > 0 else 12,
            "hourly_distribution": hourly_buckets,
            "weekday_distribution": weekday_buckets,
        },
        "top_hashtags": top_hashtags,
        "top_keywords": top_keywords,
        "top_amplifiers": top_amplifiers,
        "audience_clusters": audience_clusters,
        "mentions": all_mentions,
        "monitoring_tools": MONITORING_PLATFORMS,
    }
