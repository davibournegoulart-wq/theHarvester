import httpx
import json
import logging
import random
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class FBItem(BaseModel):
    item_id: str
    price: Optional[str]
    status: Optional[str]
    is_live: Optional[bool]
    name: Optional[str]
    picture: Optional[str]
    delivery: Optional[str]
    location: Optional[str]
    category_id: Optional[str]

class FBGroup(BaseModel):
    id: str
    name: str

class FBSellerProfile(BaseModel):
    seller_id: str
    seller_name: Optional[str]
    total_items: int
    rating: Optional[Dict[str, Any]]
    locations: List[str]
    deliveries: List[str]
    items: List[FBItem]
    groups: List[FBGroup]

# Chrome user agents
UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
]

async def scrape_marketplace_seller(seller_id: str) -> FBSellerProfile:
    headers = {
        'User-Agent': random.choice(UA_LIST),
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-FB-Friendly-Name': 'MarketplaceSellerProfileDialogQuery',
        'Origin': 'https://www.facebook.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Site': 'same-origin'
    }
    
    payload = {
        'variables': json.dumps({
            "canViewCustomizedProfile": True,
            "count": 20, 
            "isCOBMOB": False,
            "scale": 1,
            "sellerId": seller_id
        }),
        'doc_id': '4872548596176106',
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post('https://www.facebook.com/api/graphql/', headers=headers, data=payload)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"Failed to fetch FB marketplace data: {e}")
            raise Exception(f"Failed to connect to Facebook or parse response: {e}")

    user_data = data.get("data", {}).get("user")
    if not user_data:
        raise Exception("User doesn't exist or Facebook blocked the request")

    inv = user_data.get("marketplace_commerce_inventory", {})
    count = inv.get("count") or 0
    
    profile = user_data.get("marketplace_user_profile", {})
    fetched_seller_id = profile.get("id", seller_id)
    name = user_data.get("name")
    rating = user_data.get("marketplace_ratings_stats_by_role")

    items = []
    groups_dict = {}
    locations = set()
    deliveries = set()

    edges = inv.get("edges", [])
    for edge in edges:
        node = edge.get("node", {})
        
        item_id = str(node.get("id", ""))
        if not item_id: continue
        
        listing_price = node.get("listing_price", {})
        price = listing_price.get("formatted_amount") if listing_price else None
        
        photo = node.get("primary_listing_photo", {})
        img = photo.get("image", {})
        picture = img.get("uri") if img else None
        
        delivery_types = node.get("delivery_types", [])
        delivery = delivery_types[0] if delivery_types else None
        if delivery: deliveries.add(delivery)
        
        location_node = node.get("location", {}).get("reverse_geocode", {}).get("city_page", {})
        loc = location_node.get("display_name") if location_node else None
        if loc: locations.add(loc)
        
        items.append(FBItem(
            item_id=item_id,
            price=price,
            status=str(node.get("is_pending", False)),
            is_live=node.get("is_live", False),
            name=node.get("marketplace_listing_title"),
            picture=picture,
            delivery=delivery,
            location=loc,
            category_id=node.get("marketplace_listing_category_id")
        ))
        
        origin_group = node.get("origin_group")
        if origin_group:
            gid = origin_group.get("id")
            gname = origin_group.get("name")
            if gid and gname:
                groups_dict[gid] = gname

    groups = [FBGroup(id=gid, name=gname) for gid, gname in groups_dict.items()]

    return FBSellerProfile(
        seller_id=fetched_seller_id,
        seller_name=name,
        total_items=count,
        rating=rating,
        locations=list(locations),
        deliveries=list(deliveries),
        items=items,
        groups=groups
    )
