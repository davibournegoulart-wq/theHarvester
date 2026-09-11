import asyncio
import uuid
import re
import logging
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import httpx
from app.config import settings
from app.ai.extractor import extract_entities_heuristics
from app.alerts.dispatcher import dispatch_alert

logger = logging.getLogger("net_scraper.tor_spider")

ACTIVE_SPIDER_JOBS = {}


class SpiderJob:
    def __init__(self, seeds: list[str], max_depth: int = 1, max_pages: int = 20):
        self.job_id = str(uuid.uuid4())
        self.seeds = [s.strip() for s in seeds if s.strip()]
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.status = "INITIALIZING"
        self.visited = set()
        self.results = []
        self.logs = []
        self.is_cancelled = False
        self.created_at = datetime.now(timezone.utc)
        self.task = None

    def log(self, msg: str):
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        self.logs.append(f"[{ts}] {msg}")
        logger.info(f"[Spider {self.job_id[:8]}] {msg}")


async def crawl_single_onion(url: str, client: httpx.AsyncClient, job: SpiderJob) -> dict | None:
    """Requests a single .onion URL over Tor proxy and extracts forensic artifacts."""
    if not url.startswith("http"):
        url = f"http://{url}"

    job.log(f"Crawling hidden service: {url}")
    try:
        resp = await client.get(url)
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")

        # Page title & server header
        title = (soup.title.string.strip() if soup.title and soup.title.string else "No title")[:120]
        server = resp.headers.get("server", "Unknown")

        # Discover outbound onion links
        discovered_onions = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            onion_match = re.findall(r"\b[a-z2-7]{16,56}\.onion\b", href, re.IGNORECASE)
            for m in onion_match:
                discovered_onions.add(m.lower())

        # Extract technical entities (Crypto, PGP, Emails)
        entities = extract_entities_heuristics(html)

        result_item = {
            "url": url,
            "status_code": resp.status_code,
            "online": True,
            "title": title,
            "server": server,
            "discovered_onions": list(discovered_onions),
            "crypto_addresses": {
                "bitcoin": entities.get("bitcoin_addresses", []),
                "monero": entities.get("monero_addresses", []),
                "ethereum": entities.get("ethereum_addresses", []),
            },
            "emails": entities.get("emails", []),
            "pgp_detected": len(entities.get("pgp_keys", [])) > 0,
            "crawled_at": datetime.now(timezone.utc).isoformat(),
        }

        total_crypto = (
            len(result_item["crypto_addresses"]["bitcoin"])
            + len(result_item["crypto_addresses"]["monero"])
            + len(result_item["crypto_addresses"]["ethereum"])
        )
        job.log(
            f"Parsed {url} — HTTP {resp.status_code}, Title: '{title}', "
            f"Onions found: {len(discovered_onions)}, Crypto wallets: {total_crypto}"
        )
        return result_item

    except Exception as e:
        job.log(f"Failed to reach {url}: {str(e)[:70]}")
        return {
            "url": url,
            "status_code": 0,
            "online": False,
            "title": f"Offline / Error ({str(e)[:40]})",
            "server": "N/A",
            "discovered_onions": [],
            "crypto_addresses": {"bitcoin": [], "monero": [], "ethereum": []},
            "emails": [],
            "pgp_detected": False,
            "crawled_at": datetime.now(timezone.utc).isoformat(),
        }


async def run_spider_crawl(job: SpiderJob):
    """Executes breadth-first crawl over Tor hidden services."""
    job.status = "RUNNING"
    job.log(f"Spider engine initiated via Tor SOCKS5 ({settings.tor_proxy_url})")

    queue = [(seed, 0) for seed in job.seeds]
    proxy = settings.tor_proxy_url

    async with httpx.AsyncClient(proxy=proxy, timeout=25.0, follow_redirects=True) as client:
        while queue and len(job.visited) < job.max_pages and not job.is_cancelled:
            target, depth = queue.pop(0)
            clean_target = re.sub(r"^https?:\/\/", "", target).split("/")[0].lower()

            if clean_target in job.visited:
                continue
            job.visited.add(clean_target)

            item = await crawl_single_onion(target, client, job)
            if item:
                job.results.append(item)

                # If depth allows, enqueue discovered onions
                if depth < job.max_depth:
                    for discovered in item.get("discovered_onions", []):
                        if discovered not in job.visited and len(queue) < 100:
                            queue.append((f"http://{discovered}", depth + 1))

            await asyncio.sleep(1.0)  # Courtesy delay between Tor nodes

    if job.is_cancelled:
        job.status = "CANCELLED"
        job.log("Spider crawl aborted by operator.")
    else:
        job.status = "COMPLETED"
        job.log(f"Spider crawl finished. Total nodes inspected: {len(job.results)}")

        # Dispatch alert if findings discovered
        total_wallets = sum(
            len(r["crypto_addresses"]["bitcoin"]) + len(r["crypto_addresses"]["monero"])
            for r in job.results
        )
        if total_wallets > 0:
            await dispatch_alert(
                event_type="spider_match",
                title=f"Tor Spider Discovered {total_wallets} Crypto Wallets",
                description=f"Automated Tor Spider completed job across {len(job.results)} hidden services and extracted {total_wallets} cryptocurrency addresses.",
                data={"total_nodes": len(job.results), "total_crypto_wallets": total_wallets}
            )


def start_spider(seeds: list[str], max_depth: int = 1, max_pages: int = 20) -> SpiderJob:
    """Initializes and dispatches a background Tor crawl job."""
    job = SpiderJob(seeds=seeds, max_depth=max_depth, max_pages=max_pages)
    ACTIVE_SPIDER_JOBS[job.job_id] = job
    job.task = asyncio.create_task(run_spider_crawl(job))
    return job
