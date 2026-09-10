"""Dives deeper into all GitHub repository links listed in countries_osint.json.
Fetches their raw markdown files, parses out only the terminal end-links,
and replaces or augments the intermediate GitHub links with the actual target resources.
"""

from __future__ import annotations
import asyncio
import json
import os
import re
import httpx

DATA_PATH = "/Users/rollframe/Documents/Net_Scraper/app/backend/app/data/countries_osint.json"

def convert_github_to_raw(url: str) -> list[str]:
    """Converts a github.com URL into candidate raw.githubusercontent.com URLs."""
    url = url.split("#")[0].split("?")[0].rstrip("/")
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)(?:/(?:blob|tree)/([^/]+)/(.+))?", url)
    if not m:
        return []
    owner, repo, branch, path = m.groups()
    repo = repo.removesuffix(".git")
    
    if path:
        # Direct file in specific branch
        return [
            f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}",
        ]
    else:
        # Try main and master README.md
        return [
            f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md",
            f"https://raw.githubusercontent.com/{owner}/{repo}/master/README.md",
            f"https://raw.githubusercontent.com/{owner}/{repo}/main/readme.md",
            f"https://raw.githubusercontent.com/{owner}/{repo}/master/readme.md",
        ]

async def fetch_github_markdown_links(client: httpx.AsyncClient, repo_url: str, semaphore: asyncio.Semaphore) -> list[dict]:
    raw_candidates = convert_github_to_raw(repo_url)
    if not raw_candidates:
        return []

    async with semaphore:
        content = None
        for raw_url in raw_candidates:
            try:
                resp = await client.get(raw_url, timeout=12.0)
                if resp.status_code == 200 and len(resp.text) > 50:
                    content = resp.text
                    break
            except Exception:
                continue

        if not content:
            return []

        # Parse markdown links
        terminal_links = []
        seen = set()
        current_section = "Curated Resources"

        for line in content.split("\n"):
            line_str = line.strip()
            if line_str.startswith("## ") or line_str.startswith("### "):
                current_section = line_str.lstrip("#").strip()

            for label, href in re.findall(r"\[([^\]]+)\]\((https?://[^\)]+)\)", line):
                href = href.strip()
                label = label.strip()

                # Filter out shields, image badges, github anchors, gitbook self-links, and intermediate meta repos
                if any(bad in href.lower() for bad in [
                    "shields.io", "badge", "license", "patreon.com", "buymeacoffee.com",
                    "twitter.com/share", "facebook.com/sharer", "linkedin.com/share",
                    "github.com/paulpogoda", "github.com/osintbrazuca", "github.com/asharbinkhalil",
                    "github.com/dfw1n", "github.com/seotausif", "github.com/ts4rin4", "github.com/linayorda",
                    "github.com/ladislau32562", "github.com/s3v3n11s", "github.com/behackerpro",
                    "github.com/bugs-b0unt3r", "github.com/ringmast4r", "github.com/anadema",
                    "github.com/provereno-media", "github.com/ranlo", "github.com/coordinate-cat",
                    "github.com/wvanderp", "github.com/9wind", "github.com/ohshint", "github.com/swanleesec",
                    "github.com/tr3sp4ss3rexe", "github.com/wasdee"
                ]):
                    continue

                if href in seen or href.startswith("#"):
                    continue
                seen.add(href)

                terminal_links.append({
                    "name": label if len(label) > 1 else href,
                    "url": href,
                    "description": f"[{current_section}] {label}",
                })

        return terminal_links

async def main():
    if not os.path.exists(DATA_PATH):
        print("Data path not found")
        return

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Find all items that point to github.com
    github_items = []
    for country, items in data.items():
        for it in items:
            if "github.com" in it.get("url", ""):
                github_items.append((country, it.get("name"), it.get("url")))

    print(f"Discovered {len(github_items)} GitHub directory links to deep-dive...")

    semaphore = asyncio.Semaphore(15)
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        tasks = [
            (country, name, url, fetch_github_markdown_links(client, url, semaphore))
            for country, name, url in github_items
        ]
        results = await asyncio.gather(*[t[3] for t in tasks])

    total_added = 0
    total_replaced = 0

    for idx, (country, name, original_url, _) in enumerate(tasks):
        extracted = results[idx]
        if not extracted:
            continue

        existing_urls = {it["url"] for it in data[country] if "url" in it}
        # Remove the intermediate github repo entry
        data[country] = [it for it in data[country] if it.get("url") != original_url]
        total_replaced += 1

        for r in extracted:
            if r["url"] not in existing_urls:
                data[country].append(r)
                existing_urls.add(r["url"])
                total_added += 1

        print(f"[{country}] Replaced intermediate '{name}' with {len(extracted)} direct end-links.")

    # Save enriched dataset
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nFINISHED: Replaced {total_replaced} intermediate GitHub repos with {total_added} direct terminal end-links!")

if __name__ == "__main__":
    asyncio.run(main())
