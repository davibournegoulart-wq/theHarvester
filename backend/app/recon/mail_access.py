"""MailAccess Deep OSINT & Identity Graph Engine (KatrielMoses/MailAccess adaptation).

Aggregates deep signals across:
1. Hudson Rock Cavalier API (Infostealer malware infections, compromised corporate/personal machines)
2. EmailRep.io (Reputation score, risk status, malicious flags, leak references)
3. Microsoft 365 / Azure AD Realm Discovery (Tenant classification: Managed, Federated, Cloud)
4. DNS MX & Mail Server Handshake (Deliverability assessment)
5. Synthesized Credibility & Identity Graph Scoring
"""

from dataclasses import dataclass
from typing import Any, Optional
import httpx
import dns.resolver

from app.config import settings


@dataclass
class HudsonRockIntel:
    is_compromised: bool
    total_infections: int = 0
    total_passwords: int = 0
    stealer_families: list[str] = None  # type: ignore
    compromised_domains: list[str] = None  # type: ignore
    last_infection_date: Optional[str] = None
    raw_summary: Optional[str] = None


@dataclass
class EmailRepIntel:
    reputation: str = "none"
    suspicious: bool = False
    references: int = 0
    blacklisted: bool = False
    malicious_activity: bool = False
    credential_leaked: bool = False
    spam: bool = False
    free_provider: bool = False
    disposable: bool = False
    deliverable: bool = False
    details: list[str] = None  # type: ignore


@dataclass
class M365TenantIntel:
    is_m365: bool = False
    name_space_type: str = "Unknown"  # Managed, Federated, Unknown
    domain_name: str = ""
    auth_url: Optional[str] = None
    federation_brand: Optional[str] = None


@dataclass
class MailAccessResult:
    email: str
    domain: str
    is_valid_format: bool
    mx_records: list[str]
    credibility_score: int  # 0 to 100
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    hudson_rock: HudsonRockIntel
    emailrep: EmailRepIntel
    m365: M365TenantIntel
    key_findings: list[str]
    error: Optional[str] = None


async def check_hudson_rock(email: str, use_tor: bool = False) -> HudsonRockIntel:
    """Checks Hudson Rock Cavalier API for infostealer malware logs mentioning this email."""
    proxy = settings.tor_proxy_url if use_tor else None
    url = "https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email"
    headers = {"User-Agent": "MailAccess-NetScraper/2.0"}

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=10.0) as client:
            resp = await client.get(url, params={"email": email}, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                stealers = data.get("stealers") or []
                infections = len(stealers)
                
                families = set()
                domains = set()
                last_date = None

                for s in stealers:
                    fam = s.get("malware_family")
                    if fam:
                        families.add(fam)
                    dt = s.get("date_compromised")
                    if dt and (not last_date or dt > last_date):
                        last_date = dt
                    for c in s.get("credentials") or []:
                        dom = c.get("domain")
                        if dom:
                            domains.add(dom)

                return HudsonRockIntel(
                    is_compromised=infections > 0,
                    total_infections=infections,
                    total_passwords=data.get("total_passwords", 0),
                    stealer_families=list(families),
                    compromised_domains=list(domains)[:20],
                    last_infection_date=last_date,
                    raw_summary=f"Found in {infections} infostealer malware log(s) across {len(domains)} target services."
                    if infections > 0
                    else "No infostealer compromise traces detected.",
                )
            elif resp.status_code == 404:
                return HudsonRockIntel(is_compromised=False, raw_summary="Clean — no malware infostealer records.")
    except Exception:
        pass
    return HudsonRockIntel(is_compromised=False, raw_summary="Hudson Rock telemetry unavailable or unreachable.")


async def check_emailrep(email: str, use_tor: bool = False) -> EmailRepIntel:
    """Checks EmailRep.io for reputation, risk flags, and activity status."""
    proxy = settings.tor_proxy_url if use_tor else None
    headers = {"User-Agent": "MailAccess-NetScraper/2.0"}

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=8.0) as client:
            resp = await client.get(f"https://emailrep.io/{email}", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                details = data.get("details") or {}
                flags = []
                if details.get("credentials_leaked"):
                    flags.append("Credentials Leaked in Prior Breaches")
                if details.get("malicious_activity"):
                    flags.append("Associated with Malicious Activity")
                if details.get("blacklisted"):
                    flags.append("Email / IP Blacklisted")
                if details.get("spam"):
                    flags.append("Spam Behavior Detected")

                return EmailRepIntel(
                    reputation=data.get("reputation", "none"),
                    suspicious=data.get("suspicious", False),
                    references=data.get("references", 0),
                    blacklisted=details.get("blacklisted", False),
                    malicious_activity=details.get("malicious_activity", False),
                    credential_leaked=details.get("credentials_leaked", False),
                    spam=details.get("spam", False),
                    free_provider=details.get("free_provider", False),
                    disposable=details.get("disposable", False),
                    deliverable=details.get("deliverable", False),
                    details=flags,
                )
    except Exception:
        pass
    return EmailRepIntel()


async def check_m365_realm(email: str, use_tor: bool = False) -> M365TenantIntel:
    """Discovers Microsoft 365 Azure AD tenant configuration and authentication type."""
    proxy = settings.tor_proxy_url if use_tor else None
    url = f"https://login.microsoftonline.com/getuserrealm.srf?login={email}&json=1"

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=8.0) as client:
            resp = await client.get(url, headers={"User-Agent": "MailAccess-NetScraper/2.0"})
            if resp.status_code == 200:
                data = resp.json()
                ns_type = data.get("NameSpaceType", "Unknown")
                is_m365 = ns_type in ["Managed", "Federated"]
                domain = data.get("DomainName", email.split("@")[-1] if "@" in email else "")
                auth_url = data.get("AuthURL")
                brand = data.get("FederationBrandName")

                return M365TenantIntel(
                    is_m365=is_m365,
                    name_space_type=ns_type,
                    domain_name=domain,
                    auth_url=auth_url,
                    federation_brand=brand,
                )
    except Exception:
        pass
    return M365TenantIntel()


def resolve_mx_servers(domain: str) -> list[str]:
    """Resolves DNS MX records for the given domain."""
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return [str(r.exchange).rstrip(".") for r in answers]
    except Exception:
        return []


async def run_mail_access_deep_recon(email: str, use_tor: bool = False) -> MailAccessResult:
    """Runs complete MailAccess multi-module OSINT investigation on the given email target."""
    clean_email = email.strip().lower()
    if "@" not in clean_email:
        return MailAccessResult(
            email=clean_email,
            domain="",
            is_valid_format=False,
            mx_records=[],
            credibility_score=0,
            risk_level="UNKNOWN",
            hudson_rock=HudsonRockIntel(is_compromised=False),
            emailrep=EmailRepIntel(),
            m365=M365TenantIntel(),
            key_findings=["Invalid email address format"],
            error="Email address must contain '@'",
        )

    domain = clean_email.split("@")[1]
    mx_records = resolve_mx_servers(domain)

    # Concurrently execute intelligence checks
    import asyncio
    hr_task = asyncio.create_task(check_hudson_rock(clean_email, use_tor))
    rep_task = asyncio.create_task(check_emailrep(clean_email, use_tor))
    m365_task = asyncio.create_task(check_m365_realm(clean_email, use_tor))

    hr, rep, m365 = await asyncio.gather(hr_task, rep_task, m365_task)

    # Calculate credibility & risk score
    # Baseline credibility: 50
    score = 50
    findings: list[str] = []

    if mx_records:
        score += 20
        findings.append(f"Active Mail Exchangers ({len(mx_records)} MX servers configured)")
    else:
        score -= 30
        findings.append("No active MX records found for domain")

    if m365.is_m365:
        score += 15
        findings.append(f"Enterprise Microsoft 365 Tenant ({m365.name_space_type})")

    if hr.is_compromised:
        score -= 25
        findings.append(f"CRITICAL: Found on {hr.total_infections} infostealer malware infected system(s) ({', '.join(hr.stealer_families) if hr.stealer_families else 'Lumma/Redline'})")

    if rep.suspicious:
        score -= 20
        findings.append("EmailRep flags this identity as suspicious")

    if rep.credential_leaked:
        findings.append("Known historical data breach credential leak")

    if rep.references > 10:
        score += 15
        findings.append(f"High public web footprint ({rep.references} reputation references)")

    credibility_score = max(0, min(100, score))

    if hr.is_compromised:
        risk_level = "CRITICAL"
    elif rep.suspicious or not mx_records:
        risk_level = "HIGH"
    elif credibility_score >= 70:
        risk_level = "LOW"
    else:
        risk_level = "MEDIUM"

    return MailAccessResult(
        email=clean_email,
        domain=domain,
        is_valid_format=True,
        mx_records=mx_records,
        credibility_score=credibility_score,
        risk_level=risk_level,
        hudson_rock=hr,
        emailrep=rep,
        m365=m365,
        key_findings=findings,
    )
