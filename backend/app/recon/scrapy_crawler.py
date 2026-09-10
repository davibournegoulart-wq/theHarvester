"""Scrapy Integration Module for Net Scraper OSINT.
Uses Scrapy's Spider, CrawlerProcess, and Item pipelines to perform multi-page,
deep spidering across targets, extracting metadata, linked subpages, documents, and entity artifacts.
Supports proxy routing (including Tor socks5/http proxy) and custom extraction rules.
"""

from __future__ import annotations
import multiprocessing
import os
import re
import tempfile
import json
from urllib.parse import urlparse

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PHONE_RE = re.compile(r'(\+?\d{1,4}?[-.\s]?\(?\d{1,4}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})')
BTC_RE = re.compile(r'\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})\b')
ETH_RE = re.compile(r'\b(0x[a-fA-F0-9]{40})\b')
DOC_EXTS = ('.pdf', '.docx', '.xlsx', '.doc', '.xls', '.csv', '.zip', '.tar.gz', '.sql', '.dump')

def _run_spider_process(start_url: str, max_depth: int, max_pages: int, use_tor: bool, proxy_url: str | None, output_file: str):
    """Worker function executed in an isolated process to run Twisted/Scrapy cleanly."""
    import scrapy
    from scrapy.crawler import CrawlerProcess
    from scrapy.linkextractors import LinkExtractor

    parsed_domain = urlparse(start_url).netloc

    class OsintSpider(scrapy.Spider):
        name = "osint_deep_crawler"
        allowed_domains = [parsed_domain]
        start_urls = [start_url]

        custom_settings = {
            "LOG_LEVEL": "WARNING",
            "USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "ROBOTSTXT_OBEY": False,
            "CLOSESPIDER_PAGECOUNT": max_pages,
            "DEPTH_LIMIT": max_depth,
            "CONCURRENT_REQUESTS": 4,
            "DOWNLOAD_TIMEOUT": 15,
            "RETRY_TIMES": 1,
            "FEEDS": {
                output_file: {
                    "format": "json",
                    "encoding": "utf8",
                    "overwrite": True,
                }
            }
        }

        if use_tor and proxy_url:
            custom_settings["DOWNLOADER_MIDDLEWARES"] = {
                "scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware": 110,
            }

        def start_requests(self):
            for url in self.start_urls:
                meta = {}
                if use_tor and proxy_url:
                    meta["proxy"] = proxy_url
                yield scrapy.Request(url, callback=self.parse, meta=meta)

        def parse(self, response):
            if not hasattr(response, "text"):
                return

            text = response.text
            # Extract basic intelligence
            emails = list(set(EMAIL_RE.findall(text)))
            btc = list(set(BTC_RE.findall(text)))
            eth = list(set(ETH_RE.findall(text)))

            # Extract phone numbers
            raw_phones = PHONE_RE.findall(text)
            phones = list(set([p.strip() for p in raw_phones if 8 <= len(p.strip()) <= 20]))

            # Discovered links & files
            links = []
            files = []
            le = LinkExtractor()
            for link in le.extract_links(response):
                href = link.url
                if any(href.lower().endswith(ext) for ext in DOC_EXTS):
                    files.append({"url": href, "text": link.text.strip()})
                else:
                    links.append(href)

            page_title = response.css("title::text").get()

            yield {
                "url": response.url,
                "status": response.status,
                "title": page_title.strip() if page_title else None,
                "emails": emails,
                "phones": phones[:20],
                "btc_wallets": btc,
                "eth_wallets": eth,
                "documents": files,
                "outbound_links_count": len(links),
            }

            # Follow internal links up to max_pages / depth
            for link_url in links[:15]:
                meta = {}
                if use_tor and proxy_url:
                    meta["proxy"] = proxy_url
                yield response.follow(link_url, callback=self.parse, meta=meta)

    process = CrawlerProcess()
    process.crawl(OsintSpider)
    process.start()

async def run_scrapy_crawl(
    url: str,
    max_depth: int = 2,
    max_pages: int = 15,
    use_tor: bool = False,
) -> dict:
    """Async wrapper that triggers the Scrapy crawler subprocess safely without Twisted reactor conflicts."""
    from app.config import settings

    proxy_url = settings.tor_proxy_url if use_tor else None

    # Temporary file for results
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        output_file = tmp.name

    try:
        p = multiprocessing.Process(
            target=_run_spider_process,
            args=(url, max_depth, max_pages, use_tor, proxy_url, output_file),
        )
        p.start()
        p.join(timeout=45.0)  # Max 45 seconds run
        if p.is_alive():
            p.terminate()
            p.join()

        items = []
        if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
            with open(output_file, "r", encoding="utf-8") as f:
                items = json.load(f)

        # Consolidate harvested intelligence
        all_emails = set()
        all_phones = set()
        all_btc = set()
        all_eth = set()
        all_docs = []

        for item in items:
            for e in item.get("emails", []): all_emails.add(e)
            for p in item.get("phones", []): all_phones.add(p)
            for b in item.get("btc_wallets", []): all_btc.add(b)
            for eth in item.get("eth_wallets", []): all_eth.add(eth)
            for d in item.get("documents", []): all_docs.append(d)

        return {
            "target_url": url,
            "pages_crawled": len(items),
            "summary": {
                "emails_found": sorted(list(all_emails)),
                "phones_found": sorted(list(all_phones)),
                "btc_wallets": sorted(list(all_btc)),
                "eth_wallets": sorted(list(all_eth)),
                "documents_found": all_docs,
            },
            "pages": items,
        }
    finally:
        if os.path.exists(output_file):
            try:
                os.remove(output_file)
            except Exception:
                pass
