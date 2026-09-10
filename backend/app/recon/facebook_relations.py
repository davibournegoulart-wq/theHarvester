import httpx
import json
import logging
import base64
import random
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class FBRelation(BaseModel):
    name: str
    userid: str
    url_profile: str
    picture_profile: str

# Relation types mapped to app_collection IDs
RELATION_TYPES = {
    "friends": "2",
    "followers": "32",
    "following": "33",
    "hometown": "125",
    "current_city": "124",
    "recent": "1",
    "high_school": "54"
}

UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
]

def encode_request(userid: str, relation_type: str) -> str:
    app_collection_id = RELATION_TYPES.get(relation_type, "2")
    b64req = f"app_collection:{userid}:2356318349:{app_collection_id}"
    return base64.b64encode(b64req.encode("utf-8")).decode("utf-8")

async def scrape_facebook_relations(user_id: str, relation_type: str = "friends", max_pages: int = 5) -> List[FBRelation]:
    encoded_str = encode_request(user_id, relation_type)
    
    headers = {
        'User-Agent': random.choice(UA_LIST),
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-FB-Friendly-Name': 'ProfileCometAppCollectionListRendererPaginationQuery',
        'Origin': 'https://www.facebook.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Site': 'same-origin',
    }

    friends = []
    cursor = ""
    pages_fetched = 0

    async with httpx.AsyncClient(timeout=15.0) as client:
        while cursor != "end" and pages_fetched < max_pages:
            payload = {
                'av': '0',
                '__user': '0',
                '__a': '1' if cursor else '0',
                'fb_api_req_friendly_name': 'ProfileCometAppCollectionListRendererPaginationQuery',
                'variables': json.dumps({
                    "count": 24, # Fetch more per page than default 8
                    "cursor": cursor if cursor else None,
                    "scale": 1,
                    "search": None,
                    "id": encoded_str
                }),
                'server_timestamps': 'true',
                'doc_id': '5225908510806517',
            }
            
            try:
                response = await client.post('https://www.facebook.com/api/graphql/', headers=headers, data=payload)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                logger.error(f"Failed to fetch FB relations page {pages_fetched}: {e}")
                break

            if "errors" in data:
                logger.warning(f"GraphQL returned errors: {data['errors']}")
                break
                
            node = data.get("data", {}).get("node", {})
            if not node:
                break
                
            page_items = node.get("pageItems", {})
            edges = page_items.get("edges", [])
            
            if not edges:
                break

            # Parse edges
            for edge in edges:
                edge_node = edge.get("node", {})
                title = edge_node.get("title", {}).get("text", "")
                
                # Handling deeply nested node id
                inner_node = edge_node.get("node", {})
                friend_id = inner_node.get("id", "")
                
                url = edge_node.get("url", "")
                picture = edge_node.get("image", {}).get("uri", "")
                
                if title and friend_id:
                    friends.append(FBRelation(
                        name=title,
                        userid=friend_id,
                        url_profile=url,
                        picture_profile=picture
                    ))

            # Pagination
            last_edge = edges[-1]
            new_cursor = last_edge.get("cursor")
            
            if not new_cursor or new_cursor == cursor:
                cursor = "end"
            else:
                cursor = new_cursor
                
            pages_fetched += 1

    # Remove duplicates if any (GraphQL pagination can sometimes overlap)
    unique_friends = []
    seen = set()
    for f in friends:
        if f.userid not in seen:
            unique_friends.append(f)
            seen.add(f.userid)

    return unique_friends

