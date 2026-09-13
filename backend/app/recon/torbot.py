"""TorBot: Open Source Intelligence Tool for the Dark Web.
Ported and adapted from DedSecInside/TorBot.

Features:
1. Live Onion reachability and latency checker over Tor SOCKS5
2. Forensic Dark Web intel extractor:
   - Page title, server banner, SHA-256 content hash
   - Email harvester (clearnet and .onion emails)
   - Cryptocurrency wallet extraction (Bitcoin, Monero, Ethereum)
   - Exposed git repository (.git/config), svn, htaccess, and robots.txt
3. Onion Link Tree Crawler:
   - Recursively maps discovered .onion links
   - Builds hierarchical node/edge relationship graph
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("app.recon.torbot")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0"

# Tor SOCKS proxy configurations
TOR_PROXY_URL = os.getenv("NETSCRAPER_TOR_PROXY_URL", "socks5://tor:9050")
TOR_LOCAL_PROXY = "socks5://127.0.0.1:9050"


def _get_tor_proxy_for_url(url: str) -> Optional[str]:
    """Returns the Tor SOCKS proxy if url is .onion or if Tor proxy is available."""
    parsed = urlparse(url)
    is_onion = parsed.netloc.endswith(".onion")
    
    # Try environment variable first, then local default
    proxies = [TOR_PROXY_URL, TOR_LOCAL_PROXY]
    for p in proxies:
        if p:
            return p
    return None if not is_onion else TOR_PROXY_URL


def _get_client(url: str, timeout: float = 20.0) -> httpx.AsyncClient:
    """Creates an httpx client, configuring SOCKS5 proxy for .onion or privacy routing."""
    parsed = urlparse(url)
    is_onion = parsed.netloc.endswith(".onion")
    proxy = _get_tor_proxy_for_url(url)

    transport = None
    if proxy and (is_onion or os.getenv("TORBOT_FORCE_TOR")):
        try:
            return httpx.AsyncClient(
                proxy=proxy,
                timeout=timeout,
                headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
                follow_redirects=True,
                verify=False,
            )
        except Exception as e:
            logger.warning(f"Error configuring Tor proxy {proxy}: {e}")

    # Clearnet fallback client
    return httpx.AsyncClient(
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        follow_redirects=True,
        verify=False,
    )


# ---------------------------------------------------------------------------
# Regex extractors (Emails, Crypto, Onions)
# ---------------------------------------------------------------------------

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", re.IGNORECASE)
ONION_EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.onion", re.IGNORECASE)

BTC_LEGACY_REGEX = re.compile(r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b")
BTC_BECH32_REGEX = re.compile(r"\bbc1[a-z0-9]{38,59}\b", re.IGNORECASE)
XMR_REGEX = re.compile(r"\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b")
ETH_REGEX = re.compile(r"\b0x[a-fA-F0-9]{40}\b")

ONION_LINK_REGEX = re.compile(r"(?:https?://)?(?:www\.)?([a-z2-7]{16,56}\.onion(?::\d+)?(?:/[^\s\"'<>]*)?)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# 1. Live Onion Reachability & Status Checker
# ---------------------------------------------------------------------------

async def check_onion_status(url: str, timeout: float = 15.0) -> Dict[str, Any]:
    """Tests if a dark web .onion service is actively responding over Tor."""
    clean_url = url.strip()
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = "http://" + clean_url

    start_time = time.time()
    try:
        async with _get_client(clean_url, timeout=timeout) as client:
            resp = await client.get(clean_url)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)

            soup = BeautifulSoup(resp.text[:50000], "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else urlparse(clean_url).netloc

            server_banner = resp.headers.get("Server") or resp.headers.get("server") or "Hidden / Masked"

            return {
                "url": clean_url,
                "online": resp.status_code < 500,
                "status_code": resp.status_code,
                "latency_ms": elapsed_ms,
                "server": server_banner,
                "title": title[:200],
                "content_length": len(resp.content),
                "is_onion": clean_url.endswith(".onion") or ".onion/" in clean_url,
                "checked_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            }
    except Exception as e:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "url": clean_url,
            "online": False,
            "status_code": 0,
            "latency_ms": elapsed_ms,
            "server": "Unavailable",
            "title": "Connection Failed",
            "content_length": 0,
            "error": str(e),
            "is_onion": ".onion" in clean_url,
            "checked_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        }


# ---------------------------------------------------------------------------
# 2. Forensic Dark Web Intel Extractor
# ---------------------------------------------------------------------------

async def extract_onion_intel(url: str, timeout: float = 20.0) -> Dict[str, Any]:
    """Performs deep forensic extraction on an onion site (Emails, Crypto, Git leaks, Links)."""
    clean_url = url.strip()
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = "http://" + clean_url

    start_time = time.time()
    result: Dict[str, Any] = {
        "url": clean_url,
        "online": False,
        "status_code": 0,
        "title": "N/A",
        "description": "N/A",
        "server": "N/A",
        "content_hash_sha256": None,
        "text_preview": "",
        "emails": [],
        "crypto_wallets": {
            "bitcoin": [],
            "monero": [],
            "ethereum": [],
        },
        "discovered_onions": [],
        "external_links": [],
        "security_audits": {
            "exposed_git": False,
            "exposed_svn": False,
            "exposed_htaccess": False,
            "robots_txt_found": False,
            "robots_txt_rules": [],
        },
        "response_time_ms": 0,
    }

    try:
        async with _get_client(clean_url, timeout=timeout) as client:
            resp = await client.get(clean_url)
            result["online"] = True
            result["status_code"] = resp.status_code
            result["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
            result["server"] = resp.headers.get("Server") or "Masked"

            html_text = resp.text
            result["content_hash_sha256"] = hashlib.sha256(resp.content).hexdigest()

            soup = BeautifulSoup(html_text, "html.parser")
            if soup.title and soup.title.string:
                result["title"] = soup.title.string.strip()[:250]
            else:
                result["title"] = urlparse(clean_url).netloc

            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc and meta_desc.get("content"):
                result["description"] = meta_desc["content"].strip()[:400]

            # Extract visible text snippet
            visible_text = " ".join([p.get_text() for p in soup.find_all(["p", "h1", "h2", "h3", "li", "span", "div"])])
            clean_text = " ".join(visible_text.split())
            result["text_preview"] = clean_text[:600]

            # Harvest emails
            found_emails = set(EMAIL_REGEX.findall(html_text) + ONION_EMAIL_REGEX.findall(html_text))
            # Clean common false positives
            clean_emails = [e for e in found_emails if not e.endswith((".png", ".jpg", ".gif", ".css", ".js"))]
            result["emails"] = sorted(clean_emails)

            # Harvest Crypto Wallets
            btc_wallets = set(BTC_LEGACY_REGEX.findall(html_text) + BTC_BECH32_REGEX.findall(html_text))
            xmr_wallets = set(XMR_REGEX.findall(html_text))
            eth_wallets = set(ETH_REGEX.findall(html_text))

            result["crypto_wallets"]["bitcoin"] = sorted(btc_wallets)
            result["crypto_wallets"]["monero"] = sorted(xmr_wallets)
            result["crypto_wallets"]["ethereum"] = sorted(eth_wallets)

            # Extract Hyperlinks & Discovered Onions
            discovered_onions: Set[str] = set()
            external_links: Set[str] = set()

            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    continue

                full_url = urljoin(clean_url, href)
                parsed = urlparse(full_url)
                
                if ".onion" in parsed.netloc:
                    onion_clean = f"{parsed.scheme}://{parsed.netloc}"
                    discovered_onions.add(onion_clean)
                elif parsed.scheme in ("http", "https"):
                    external_links.add(full_url)

            # Also regex search for any onion addresses in page text
            for onion_match in ONION_LINK_REGEX.findall(html_text):
                o_str = onion_match.split("/")[0]
                if not o_str.startswith("http"):
                    o_str = "http://" + o_str
                discovered_onions.add(o_str)

            # Remove current target from discovered onions list
            current_domain = urlparse(clean_url).netloc
            discovered_onions.discard(f"http://{current_domain}")
            discovered_onions.discard(f"https://{current_domain}")

            result["discovered_onions"] = sorted(discovered_onions)[:50]
            result["external_links"] = sorted(external_links)[:30]

            # Fast passive security audits (Robots.txt, .git, .htaccess)
            base_origin = f"{urlparse(clean_url).scheme}://{urlparse(clean_url).netloc}"
            try:
                r_robots = await client.get(f"{base_origin}/robots.txt", timeout=6.0)
                if r_robots.status_code == 200 and "Disallow" in r_robots.text:
                    result["security_audits"]["robots_txt_found"] = True
                    rules = [line.strip() for line in r_robots.text.splitlines() if line.strip().startswith(("Allow:", "Disallow:"))]
                    result["security_audits"]["robots_txt_rules"] = rules[:15]
            except Exception:
                pass

            try:
                r_git = await client.get(f"{base_origin}/.git/config", timeout=6.0)
                if r_git.status_code == 200 and "[core]" in r_git.text:
                    result["security_audits"]["exposed_git"] = True
            except Exception:
                pass

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error extracting onion intel from {url}: {e}")

    return result


# ---------------------------------------------------------------------------
# 3. Onion Link Tree Crawler
# ---------------------------------------------------------------------------

async def crawl_onion_link_tree(
    seed_url: str,
    depth: int = 1,
    max_pages: int = 12,
    timeout: float = 15.0,
) -> Dict[str, Any]:
    """Crawls links beginning from seed_url and constructs a hierarchical relationship tree."""
    clean_seed = seed_url.strip()
    if not clean_seed.startswith("http://") and not clean_seed.startswith("https://"):
        clean_seed = "http://" + clean_seed

    visited: Set[str] = set()
    queue: List[tuple[str, int, Optional[str]]] = [(clean_seed, 0, None)]  # (url, current_depth, parent_url)
    
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, str]] = []

    async with _get_client(clean_seed, timeout=timeout) as client:
        while queue and len(visited) < max_pages:
            current_url, cur_depth, parent_url = queue.pop(0)

            normalized_url = current_url.rstrip("/")
            if normalized_url in visited:
                if parent_url and parent_url != normalized_url:
                    edges.append({"source": parent_url, "target": normalized_url})
                continue

            visited.add(normalized_url)

            try:
                resp = await client.get(current_url)
                soup = BeautifulSoup(resp.text[:60000], "html.parser")
                title = soup.title.string.strip() if soup.title and soup.title.string else urlparse(current_url).netloc

                # Extract emails and bitcoins for node summary
                emails = EMAIL_REGEX.findall(resp.text)
                bitcoins = BTC_LEGACY_REGEX.findall(resp.text)

                nodes.append({
                    "id": normalized_url,
                    "url": current_url,
                    "title": title[:100],
                    "status_code": resp.status_code,
                    "depth": cur_depth,
                    "emails_count": len(set(emails)),
                    "btc_count": len(set(bitcoins)),
                    "is_seed": cur_depth == 0,
                    "domain": urlparse(current_url).netloc,
                })

                if parent_url:
                    edges.append({"source": parent_url, "target": normalized_url})

                # If depth allows, discover next links
                if cur_depth < depth:
                    page_links: Set[str] = set()
                    for a in soup.find_all("a", href=True):
                        href = a["href"].strip()
                        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                            continue
                        
                        full = urljoin(current_url, href)
                        parsed = urlparse(full)
                        # Restrict to http/https
                        if parsed.scheme in ("http", "https"):
                            page_links.add(full.rstrip("/"))

                    for pl in sorted(page_links):
                        if pl not in visited and len(queue) + len(visited) < max_pages * 2:
                            queue.append((pl, cur_depth + 1, normalized_url))

            except Exception as e:
                logger.debug(f"TorBot crawl node {current_url} failed: {e}")
                nodes.append({
                    "id": normalized_url,
                    "url": current_url,
                    "title": "Failed to Connect",
                    "status_code": 0,
                    "depth": cur_depth,
                    "emails_count": 0,
                    "btc_count": 0,
                    "is_seed": cur_depth == 0,
                    "domain": urlparse(current_url).netloc,
                    "error": str(e),
                })
                if parent_url:
                    edges.append({"source": parent_url, "target": normalized_url})

    return {
        "seed_url": clean_seed,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "nodes": nodes,
        "edges": edges,
        "max_depth_crawled": depth,
    }
