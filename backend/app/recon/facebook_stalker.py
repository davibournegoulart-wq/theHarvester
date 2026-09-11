"""Facebook-Stalker Intelligence Engine.

Adapted from Anand Mudgerikar (anandmudgerikar/Facebook-Stalker).
Performs deep target profiling, graph relation extraction, social closeness weighting,
unauthenticated graph bypass links, mbasic mirrors, and social network scoring.
"""

import re
import random
import logging
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

# Facebook-Stalker interaction edge weights
INTERACTION_WEIGHTS = {
    "feed_post_by_contact": 5,      # Contact posted directly on target's wall
    "multiple_comments": 4,         # High-frequency comments across target's posts
    "tagged_in_target_media": 4,    # Contact tagged in target's photo/feed
    "comment_on_target_feed": 3,    # Contact left a comment on target's feed
    "tagged_in_shared_media": 3,    # Contact and target both tagged in the same photo
    "like_on_target_feed": 2,       # Contact liked target's post/photo
    "common_comments_other": 1,     # Contact & target commented on the same third-party post
    "common_likes_other": 1,        # Contact & target liked the same third-party post
    "mutual_friends": 1,            # Mutual friend connection
}


def compute_closeness_tier(total_weight: int) -> Dict[str, str]:
    """Classifies closeness tier according to Facebook-Stalker algorithm."""
    if total_weight >= 15:
        return {"tier": "Inner Circle / Family / Close Associate", "color": "var(--red)", "risk": "High"}
    elif total_weight >= 8:
        return {"tier": "Frequent Interactor / Close Friend", "color": "var(--orange)", "risk": "Medium-High"}
    elif total_weight >= 4:
        return {"tier": "Regular Connection / Associate", "color": "var(--cyan)", "risk": "Medium"}
    else:
        return {"tier": "Casual Contact / Acquaintance", "color": "var(--text-muted)", "risk": "Low"}


async def resolve_facebook_id(target: str, use_tor: bool = False) -> Dict[str, Any]:
    """Attempts to resolve Facebook username/vanity to permanent numeric ID (UID)."""
    target = target.strip().rstrip("/")
    if target.startswith("https://"):
        match = re.search(r"facebook\.com/([^/?#]+)", target)
        if match:
            target = match.group(1)

    # If already numeric
    if target.isdigit():
        return {"uid": target, "username": target, "is_numeric": True}

    proxies = (
        {"http://": settings.tor_proxy_url, "https://": settings.tor_proxy_url}
        if use_tor and settings.tor_proxy_url
        else None
    )

    headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    resolved_uid = None
    name = target
    profile_pic = None

    try:
        async with httpx.AsyncClient(proxies=proxies, timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(f"https://www.facebook.com/{target}", headers=headers)
            html = resp.text

            # Look for entity_id, user_id, or meta tags
            m_uid = (
                re.search(r'"entity_id":"([0-9]+)"', html)
                or re.search(r'"userID":"([0-9]+)"', html)
                or re.search(r'fb://profile/([0-9]+)', html)
                or re.search(r'content="fb://profile/([0-9]+)"', html)
                or re.search(r'"actorID":"([0-9]+)"', html)
            )
            if m_uid:
                resolved_uid = m_uid.group(1)

            soup = BeautifulSoup(html, "html.parser")
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                name = og_title["content"].replace(" | Facebook", "").strip()

            og_image = soup.find("meta", property="og:image")
            if og_image and og_image.get("content"):
                profile_pic = og_image["content"]

    except Exception as e:
        logger.warning(f"Error resolving Facebook UID for {target}: {e}")

    return {
        "uid": resolved_uid or target,
        "username": target,
        "name": name,
        "profile_pic": profile_pic,
        "is_numeric": bool(resolved_uid),
    }


def generate_stalker_graph_dorks(uid_or_username: str) -> Dict[str, Any]:
    """Generates Facebook Graph Search & mobile mbasic URLs for unauthenticated OSINT."""
    uid = uid_or_username
    return {
        "photos_by": f"https://www.facebook.com/search/{uid}/photos-by",
        "photos_of": f"https://www.facebook.com/search/{uid}/photos-of",
        "photos_liked": f"https://www.facebook.com/search/{uid}/photos-liked",
        "photos_commented": f"https://www.facebook.com/search/{uid}/photos-commented",
        "posts_by": f"https://www.facebook.com/search/{uid}/stories-by",
        "videos_by": f"https://www.facebook.com/search/{uid}/videos-by",
        "pages_liked": f"https://www.facebook.com/search/{uid}/pages-liked",
        "places_visited": f"https://www.facebook.com/search/{uid}/places-visited",
        "groups": f"https://www.facebook.com/search/{uid}/groups",
        "friends": f"https://www.facebook.com/{uid}/friends",
        "about_overview": f"https://www.facebook.com/{uid}/about",
        "about_work": f"https://www.facebook.com/{uid}/about_work_and_education",
        "about_places": f"https://www.facebook.com/{uid}/about_places",
        "about_contact": f"https://www.facebook.com/{uid}/about_contact_and_basic_info",
        "about_family": f"https://www.facebook.com/{uid}/about_family_and_relationships",
        "mbasic_profile": f"https://mbasic.facebook.com/{uid}",
        "touch_profile": f"https://touch.facebook.com/{uid}",
    }


def calculate_interaction_matrix(
    target_username: str,
    contacts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Calculates Facebook-Stalker interaction edge weights and closeness rankings for target contacts."""
    ranked_contacts = []
    total_network_weight = 0

    for c in contacts:
        name = c.get("name", "Unknown")
        uid = c.get("userid") or c.get("uid", "")
        username = c.get("username", "")

        # Tally observed signals
        signals = c.get("signals", {})
        wall_posts = signals.get("wall_posts", 0)
        comments = signals.get("comments", 0)
        likes = signals.get("likes", 0)
        tags_media = signals.get("tagged_in_media", 0)
        shared_tags = signals.get("shared_tags", 0)
        mutual_friends = signals.get("mutual_friends", 0)

        weight = (
            (wall_posts * INTERACTION_WEIGHTS["feed_post_by_contact"])
            + (tags_media * INTERACTION_WEIGHTS["tagged_in_target_media"])
            + (comments * INTERACTION_WEIGHTS["comment_on_target_feed"])
            + (shared_tags * INTERACTION_WEIGHTS["tagged_in_shared_media"])
            + (likes * INTERACTION_WEIGHTS["like_on_target_feed"])
            + (1 if mutual_friends > 0 else 0)
        )

        tier_info = compute_closeness_tier(weight)
        total_network_weight += weight

        ranked_contacts.append({
            "name": name,
            "userid": uid,
            "username": username,
            "profile_url": f"https://www.facebook.com/{uid or username}",
            "weight": weight,
            "tier": tier_info["tier"],
            "color": tier_info["color"],
            "risk": tier_info["risk"],
            "signals": {
                "wall_posts": wall_posts,
                "comments": comments,
                "likes": likes,
                "tagged_media": tags_media,
                "shared_tags": shared_tags,
                "mutual_friends": mutual_friends,
            },
        })

    # Sort descending by calculated weight
    ranked_contacts.sort(key=lambda x: x["weight"], reverse=True)

    return {
        "target": target_username,
        "total_contacts": len(ranked_contacts),
        "total_network_weight": total_network_weight,
        "average_weight": round(total_network_weight / len(ranked_contacts), 1) if ranked_contacts else 0,
        "high_priority_associates": [c for c in ranked_contacts if c["weight"] >= 8],
        "contacts": ranked_contacts,
    }
