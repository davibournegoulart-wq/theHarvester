"""Visual Web Inspector & Security Header Auditor (EyeWitness + Gowitness synthesis).
Inspects HTTP/HTTPS endpoints, extracts page titles, security headers, technology stacks,
server banners, and generates structured visual previews for OSINT investigators.
"""

from __future__ import annotations

import re
from typing import Any
import httpx
from bs4 import BeautifulSoup


# Technology signatures (CMS, Web Servers, CDNs, Frameworks)
TECH_SIGNATURES: list[dict[str, Any]] = [
    {"name": "WordPress", "header": "x-powered-by", "pattern": r"wp|wordpress", "html": r"wp-content|wp-includes"},
    {"name": "Cloudflare", "header": "server", "pattern": r"cloudflare", "html": r"__cfduid|cf-ray"},
    {"name": "Nginx", "header": "server", "pattern": r"nginx", "html": r""},
    {"name": "Apache", "header": "server", "pattern": r"apache", "html": r""},
    {"name": "Microsoft IIS", "header": "server", "pattern": r"microsoft-iis", "html": r""},
    {"name": "Next.js / Vercel", "header": "x-powered-by", "pattern": r"next\.js", "html": r"__next|_next/static"},
    {"name": "Laravel / PHP", "header": "x-powered-by", "pattern": r"php", "html": r"laravel_session|XSRF-TOKEN"},
    {"name": "Drupal", "header": "x-generator", "pattern": r"drupal", "html": r"drupal\.js|sites/all/"},
    {"name": "Shopify", "header": "server", "pattern": r"shopify", "html": r"cdn\.shopify\.com"},
    {"name": "Express / Node.js", "header": "x-powered-by", "pattern": r"express", "html": r""},
    {"name": "React", "header": "", "pattern": r"", "html": r"data-reactroot|react-dom"},
    {"name": "Vue.js", "header": "", "pattern": r"", "html": r"data-v-[a-f0-9]+"},
]

# Security Headers to evaluate
SECURITY_HEADERS = [
    {"header": "strict-transport-security", "name": "HSTS (Strict-Transport-Security)", "recommended": True},
    {"header": "content-security-policy", "name": "CSP (Content-Security-Policy)", "recommended": True},
    {"header": "x-frame-options", "name": "X-Frame-Options (Clickjacking Protection)", "recommended": True},
    {"header": "x-content-type-options", "name": "X-Content-Type-Options (MIME Sniffing)", "recommended": True},
    {"header": "referrer-policy", "name": "Referrer-Policy", "recommended": True},
    {"header": "permissions-policy", "name": "Permissions-Policy", "recommended": False},
]


async def audit_web_visual_and_headers(target: str, use_tor: bool = False) -> dict[str, Any]:
    """Probes web target, audits HTTP headers, detects tech stack, and prepares visual inspection data."""
    target_clean = target.strip()
    if not target_clean.startswith("http://") and not target_clean.startswith("https://"):
        target_clean = f"https://{target_clean}"

    proxies = "socks5://127.0.0.1:9050" if use_tor else None
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        async with httpx.AsyncClient(
            proxy=proxies,
            verify=False,
            timeout=10.0,
            follow_redirects=True,
            headers=headers,
        ) as client:
            resp = await client.get(target_clean)
            final_url = str(resp.url)
            status_code = resp.status_code
            resp_headers = dict(resp.headers)
            body_text = resp.text[:100000]

            # 1. Parse HTML title, favicon, and meta tags
            soup = BeautifulSoup(body_text, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else "No HTML Title"
            
            meta_desc = ""
            desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
            if desc_tag and desc_tag.get("content"):
                meta_desc = str(desc_tag["content"]).strip()

            # 2. Audit Security Headers
            security_audit = []
            sec_score = 0
            for sec_def in SECURITY_HEADERS:
                h_val = resp_headers.get(sec_def["header"])
                is_present = bool(h_val)
                if is_present:
                    sec_score += 20
                security_audit.append({
                    "header": sec_def["name"],
                    "status": "PASS" if is_present else "MISSING",
                    "value": h_val or "Not Configured",
                    "is_present": is_present,
                })
            sec_score = min(100, sec_score)

            # 3. Detect Technologies (EyeWitness / Gowitness signature matching)
            detected_tech = []
            for tech in TECH_SIGNATURES:
                h_name = tech["header"]
                matched = False
                if h_name and h_name in resp_headers:
                    if re.search(tech["pattern"], resp_headers[h_name], re.IGNORECASE):
                        matched = True
                if not matched and tech["html"]:
                    if re.search(tech["html"], body_text, re.IGNORECASE):
                        matched = True
                if matched and tech["name"] not in detected_tech:
                    detected_tech.append(tech["name"])

            # 4. Redirection History
            redirect_chain = [str(r.url) for r in resp.history] + [final_url]

            # 5. Extract Text Excerpt for simulated preview
            text_lines = [line.strip() for line in soup.get_text().splitlines() if line.strip()]
            text_preview = " ".join(text_lines[:15])[:300]

            return {
                "target_input": target,
                "final_url": final_url,
                "status_code": status_code,
                "title": title,
                "description": meta_desc,
                "security_score": sec_score,
                "security_headers": security_audit,
                "detected_technologies": detected_tech,
                "server_banner": resp_headers.get("server", "Hidden / Not Disclosed"),
                "content_type": resp_headers.get("content-type", "Unknown"),
                "redirect_chain": redirect_chain,
                "text_preview": text_preview,
                "headers": {k: v for k, v in resp_headers.items() if not k.startswith("set-cookie")},
            }

    except Exception as e:
        return {
            "target_input": target,
            "final_url": target_clean,
            "status_code": 0,
            "title": "Probe Failed",
            "description": f"Unable to establish connection: {str(e)}",
            "security_score": 0,
            "security_headers": [],
            "detected_technologies": [],
            "server_banner": "N/A",
            "content_type": "N/A",
            "redirect_chain": [target_clean],
            "text_preview": "Probe error.",
            "error": str(e),
        }
