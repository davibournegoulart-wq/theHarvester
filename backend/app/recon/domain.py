"""Recon de domínio/organização a partir de fonte passiva pública.

Reimplementação nativa do padrão theHarvester (ver vault: Tools - Domain and
Org Recon#theHarvester). Fontes:
1. crt.sh (log de certificado transparente, JSON público, sem autenticação)
2. Certspotter (fallback quando crt.sh estiver instável)
3. DNS brute-force (wordlist interna de ~100 subdomínios comuns)

⚠️ Confirmado em teste ao vivo (2026-09-08): crt.sh retorna 502 com
frequência (serviço comunitário gratuito, uma única instância Postgres por
trás, notoriamente instável sob carga). Certspotter adicionado como fallback.
DNS brute-force é a terceira fonte, paralela, usando resolução A-record.

Expandido (2026-09-09): consolidação de técnicas de Subfinder/Sublist3r/dnsrecon.
"""

import asyncio
from dataclasses import dataclass
from functools import partial

import dns.resolver
import httpx

from app.config import settings

CRTSH_URL = "https://crt.sh/"
CERTSPOTTER_URL = "https://api.certspotter.com/v1/issuances"

# Wordlist interna de subdomínios comuns — usado pelo brute-force
_COMMON_SUBDOMAINS = [
    "www", "mail", "ftp", "smtp", "pop", "pop3", "imap", "webmail",
    "mx", "mx1", "mx2", "ns", "ns1", "ns2", "ns3",
    "dev", "staging", "stage", "test", "beta", "demo", "qa",
    "api", "api2", "app", "portal", "admin", "panel", "dashboard",
    "vpn", "remote", "owa", "autodiscover", "exchange",
    "docs", "doc", "wiki", "help", "support", "kb",
    "git", "gitlab", "github", "jenkins", "ci", "cd", "deploy",
    "jira", "confluence", "slack",
    "grafana", "monitoring", "prometheus", "kibana", "elastic",
    "redis", "db", "database", "mysql", "postgres", "mongo",
    "cache", "queue", "mq",
    "s3", "storage", "assets", "static", "media", "upload", "cdn",
    "img", "images", "video", "files",
    "blog", "shop", "store", "pay", "billing", "checkout",
    "crm", "erp", "hr", "intranet", "internal",
    "auth", "sso", "login", "id", "accounts", "oauth",
    "m", "mobile", "wap",
    "status", "health", "info",
    "news", "forum", "community",
    "www2", "web", "old", "new", "v2",
    "sandbox", "preview", "uat", "preprod",
    "smtp2", "relay", "gateway", "proxy",
    "backup", "bak", "archive",
    "data", "analytics", "reports", "bi",
    "chat", "meet", "calendar", "drive",
    "origin", "edge", "lb", "load",
]


@dataclass
class SubdomainResult:
    subdomain: str
    discovered_by: str = "recon.domain.crtsh"


# ---------------------------------------------------------------------------
# Fonte 1: crt.sh (certificado transparente)
# ---------------------------------------------------------------------------

async def _find_subdomains_crtsh(domain: str) -> list[SubdomainResult]:
    """Consulta o crt.sh (log público de certificado transparente)."""
    params = {"q": f"%.{domain}", "output": "json"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(CRTSH_URL, params=params, timeout=settings.request_timeout_seconds)
            response.raise_for_status()
        except httpx.HTTPError:
            return []

    seen: set[str] = set()
    results: list[SubdomainResult] = []
    for entry in response.json():
        for name in entry.get("name_value", "").split("\n"):
            name = name.strip().lower()
            if name and name not in seen and name.endswith(domain):
                seen.add(name)
                results.append(SubdomainResult(subdomain=name, discovered_by="recon.domain.crtsh"))

    return results


# ---------------------------------------------------------------------------
# Fonte 2: Certspotter (fallback de CT)
# ---------------------------------------------------------------------------

async def _find_subdomains_certspotter(domain: str) -> list[SubdomainResult]:
    """Certspotter API — fallback quando crt.sh estiver instável."""
    params = {"domain": domain, "include_subdomains": "true", "expand": "dns_names"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(CERTSPOTTER_URL, params=params, timeout=settings.request_timeout_seconds)
            response.raise_for_status()
        except httpx.HTTPError:
            return []

    seen: set[str] = set()
    results: list[SubdomainResult] = []
    for issuance in response.json():
        for name in issuance.get("dns_names", []):
            name = name.strip().lower()
            if name and name not in seen and name.endswith(domain):
                seen.add(name)
                results.append(SubdomainResult(subdomain=name, discovered_by="recon.domain.certspotter"))

    return results


# ---------------------------------------------------------------------------
# Fonte 3: DNS brute-force (wordlist interna)
# ---------------------------------------------------------------------------

def _resolve_subdomain(fqdn: str) -> str | None:
    """Resolve síncrono — rodado via executor pra não bloquear o event loop."""
    try:
        dns.resolver.resolve(fqdn, "A")
        return fqdn
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers,
            dns.exception.DNSException, dns.resolver.LifetimeTimeout):
        return None


async def _find_subdomains_dns_bruteforce(domain: str) -> list[SubdomainResult]:
    """Brute-force de subdomínios via resolução DNS A-record."""
    semaphore = asyncio.Semaphore(settings.max_concurrent_checks)
    loop = asyncio.get_event_loop()

    async def check_one(prefix: str) -> SubdomainResult | None:
        fqdn = f"{prefix}.{domain}"
        async with semaphore:
            resolved = await loop.run_in_executor(None, partial(_resolve_subdomain, fqdn))
        if resolved:
            return SubdomainResult(subdomain=resolved, discovered_by="recon.domain.dns_bruteforce")
        return None

    tasks = [check_one(prefix) for prefix in _COMMON_SUBDOMAINS]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]


# ---------------------------------------------------------------------------
# Orquestrador: combina as 3 fontes e deduplicada
# ---------------------------------------------------------------------------

async def find_subdomains(domain: str) -> list[SubdomainResult]:
    """Busca subdomínios combinando crt.sh, Certspotter e DNS brute-force.
    Resultados deduplicados por nome de subdomínio."""
    crtsh_results, certspotter_results, dns_results = await asyncio.gather(
        _find_subdomains_crtsh(domain),
        _find_subdomains_certspotter(domain),
        _find_subdomains_dns_bruteforce(domain),
    )

    seen: set[str] = set()
    combined: list[SubdomainResult] = []
    # crt.sh tem prioridade, depois certspotter, depois brute-force
    for result in crtsh_results + certspotter_results + dns_results:
        if result.subdomain not in seen:
            seen.add(result.subdomain)
            combined.append(result)

    return combined
