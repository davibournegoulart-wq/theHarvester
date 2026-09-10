"""Scraper that crawls all 189 country guides from OSINT-for-countries,
extracting only the terminal end-links, category sections, descriptions, and direct URLs.
Saves the enriched database to app/data/countries_osint.json.
"""

from __future__ import annotations
import asyncio
import json
import os
import re
import httpx

README_PATH = "/Users/rollframe/.gemini/antigravity/brain/1fb205e8-453d-4164-b631-588f6843d6ea/scratch/OSINT-for-countries-github/profile/README.md"
OUTPUT_PATH = "/Users/rollframe/Documents/Net_Scraper/app/backend/app/data/countries_osint.json"

def get_country_repo_list():
    with open(README_PATH, "r", encoding="utf-8") as f:
        text = f.read()

    matches = re.findall(r"\[(.*?)\]\((https://github\.com/OSINT-for-countries/([^\)\/]+))\)", text)
    countries = []
    seen = set()
    for name, full_url, repo_name in matches:
        clean_country = name.replace(" OSINT", "").strip()
        if clean_country in seen:
            continue
        seen.add(clean_country)
        raw_url = f"https://raw.githubusercontent.com/OSINT-for-countries/{repo_name}/main/README.md"
        countries.append({
            "country": clean_country,
            "repo_name": repo_name,
            "raw_url": raw_url,
        })
    return countries

async def fetch_country_resources(client: httpx.AsyncClient, country_info: dict, semaphore: asyncio.Semaphore):
    country = country_info["country"]
    raw_url = country_info["raw_url"]
    
    async with semaphore:
        try:
            resp = await client.get(raw_url, timeout=15.0)
            if resp.status_code != 200:
                fallback_url = raw_url.replace("/main/", "/master/")
                resp = await client.get(fallback_url, timeout=15.0)
                if resp.status_code != 200:
                    return country, []

            lines = resp.text.split("\n")
            current_category = "General"
            resources = []
            seen_urls = set()

            for line in lines:
                line_str = line.strip()
                if line_str.startswith("## ") or line_str.startswith("### "):
                    cat_candidate = line_str.lstrip("#").strip()
                    if "table of contents" not in cat_candidate.lower():
                        current_category = cat_candidate

                found_links = re.findall(r"\[([^\]]+)\]\((https?://[^\)]+)\)", line)
                for label, href in found_links:
                    href = href.strip()
                    label = label.strip()

                    if "github.com/OSINT-for-countries" in href or "proton.me" in href or href.startswith("#"):
                        continue
                    if href in seen_urls:
                        continue
                    seen_urls.add(href)

                    resources.append({
                        "name": label,
                        "url": href,
                        "category": current_category,
                        "description": f"[{current_category}] {label} — {country} Open Source Registry / Portal",
                    })

            return country, resources
        except Exception:
            return country, []

async def main():
    semaphore = asyncio.Semaphore(15)
    countries = get_country_repo_list()
    print(f"Total countries found in profile: {len(countries)}")

    existing_data = {}
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            pass

    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        tasks = [fetch_country_resources(client, c, semaphore) for c in countries]
        results = await asyncio.gather(*tasks)

    new_links_count = 0
    for country, resources in results:
        if resources:
            if country in existing_data and len(existing_data[country]) > 0:
                existing_urls = {item["url"] for item in existing_data[country] if "url" in item}
                for r in resources:
                    if r["url"] not in existing_urls:
                        existing_data[country].append(r)
                        existing_urls.add(r["url"])
                        new_links_count += 1
            else:
                existing_data[country] = resources
                new_links_count += len(resources)

    sorted_data = dict(sorted(existing_data.items()))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted_data, f, indent=2, ensure_ascii=False)

    total_links = sum(len(v) for v in sorted_data.values())
    print(f"SUCCESS: Total countries: {len(sorted_data)}, Added {new_links_count} new links, Total end links: {total_links}")

if __name__ == "__main__":
    asyncio.run(main())
