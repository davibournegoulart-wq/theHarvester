from fastapi import APIRouter, Query
from typing import List, Optional
import json
import os

router = APIRouter()

# Load the arsenal data once
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "tools.json")

def load_arsenal():
    try:
        with open(DATA_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading arsenal: {e}")
        return []

arsenal_data = load_arsenal()

@router.get("/tools")
def get_arsenal_tools(
    query: Optional[str] = None,
    category: Optional[str] = None
):
    results = arsenal_data
    
    if category:
        results = [t for t in results if t.get("category", "").lower() == category.lower()]
        
    if query:
        q = query.lower()
        results = [
            t for t in results 
            if q in t.get("name", "").lower() 
            or q in t.get("description", "").lower()
            or any(q in tag for tag in t.get("tags", []))
        ]
        
    return {"tools": results, "total": len(results)}

@router.get("/categories")
def get_arsenal_categories():
    categories = set()
    for t in arsenal_data:
        cat = t.get("category")
        if cat:
            categories.add(cat)
    return {"categories": sorted(list(categories))}

COUNTRIES_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "countries_osint.json")

def load_countries():
    try:
        if os.path.exists(COUNTRIES_DATA_PATH):
            with open(COUNTRIES_DATA_PATH, "r") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading countries: {e}")
    return {}

countries_data = load_countries()

@router.get("/countries")
def get_countries(query: Optional[str] = None):
    results = [{"country": k, "count": len(v)} for k, v in countries_data.items()]
    if query:
        q = query.lower()
        results = [r for r in results if q in r["country"].lower()]
    return {"countries": sorted(results, key=lambda x: x["country"])}

@router.get("/countries/{country_name}")
def get_country_details(country_name: str):
    # exact or case insensitive match
    for k, v in countries_data.items():
        if k.lower() == country_name.lower():
            return {"country": k, "resources": v}
    return {"country": country_name, "resources": []}
