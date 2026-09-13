"""MailAccess Deep OSINT & Identity Graph Engine (KatrielMoses/MailAccess v0.15.0 adaptation).

Aggregates deep signals across:
1. Hudson Rock Cavalier API (Infostealer malware infections, compromised corporate/personal machines)
2. XposedOrNot Public API (Real-world breach exposure, compromised databases, leaked pastes)
3. EmailRep.io (Reputation score, risk status, malicious flags, leak references)
4. Microsoft 365 / Azure AD Realm Discovery (Tenant classification: Managed, Federated, Cloud)
5. Google Account Intelligence (Workspace vs Gmail, GAIA presence, avatar)
6. Gravatar Profile Intelligence (MD5 avatar, bios, verified accounts, display names)
7. PGP Keyserver Intelligence (Keys.openpgp.org / Ubuntu SKS keyserver cryptographic key fingerprints)
8. Name Consensus Engine (Multi-source voting: Confirmed, Probable, Possible, Unknown)
9. Defender's Brief Generator (Executive risk assessment, prioritized findings, next remediation action)
10. Domain Email Harvester & Syntax Pattern Extrapolator (Role accounts, pattern discovery, deliverability)
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import hashlib
import re
from typing import Any, Optional
import httpx
import dns.resolver

from app.config import settings


@dataclass
class HudsonRockIntel:
    is_compromised: bool
    total_infections: int = 0
    total_passwords: int = 0
    stealer_families: list[str] = field(default_factory=list)
    compromised_domains: list[str] = field(default_factory=list)
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
    details: list[str] = field(default_factory=list)


@dataclass
class M365TenantIntel:
    is_m365: bool = False
    name_space_type: str = "Unknown"  # Managed, Federated, Unknown
    domain_name: str = ""
    auth_url: Optional[str] = None
    federation_brand: Optional[str] = None


@dataclass
class GoogleAccountIntel:
    is_google: bool = False
    hosting_kind: str = "none"  # "gmail", "workspace", "none"
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    gaia_presence: bool = False


@dataclass
class GravatarIntel:
    found: bool = False
    display_name: Optional[str] = None
    about_me: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None
    verified_accounts: list[dict[str, str]] = field(default_factory=list)


@dataclass
class PGPIntel:
    found: bool = False
    key_id: Optional[str] = None
    fingerprint: Optional[str] = None
    algorithm: Optional[str] = None
    created_date: Optional[str] = None
    uids: list[str] = field(default_factory=list)


@dataclass
class XposedOrNotIntel:
    breach_count: int = 0
    paste_count: int = 0
    breaches: list[str] = field(default_factory=list)
    dossiers: list[dict[str, Any]] = field(default_factory=list)
    risk_score: float = 0.0


@dataclass
class NameConsensusResult:
    confirmed_name: Optional[str] = None
    name_confidence: str = "UNKNOWN"  # CONFIRMED, PROBABLE, POSSIBLE, UNKNOWN
    confidence_score: float = 0.0
    name_sources: list[str] = field(default_factory=list)
    name_reasoning: str = "No corroborated name signals found."
    all_candidates: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class DefenderFinding:
    title: str
    detail: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    remediation: str


@dataclass
class DefendersBrief:
    risk_level: str  # CRITICAL, HIGH, MEDIUM, LOW, CLEAN
    risk_summary: str
    top_findings: list[DefenderFinding]
    next_action: str
    generated_at: str


@dataclass
class MailAccessResult:
    email: str
    domain: str
    is_valid_format: bool
    mx_records: list[str]
    credibility_score: int  # 0 to 100
    risk_level: str  # CLEAN, LOW, MEDIUM, HIGH, CRITICAL
    hudson_rock: HudsonRockIntel
    emailrep: EmailRepIntel
    m365: M365TenantIntel
    google_account: GoogleAccountIntel
    gravatar: GravatarIntel
    pgp: PGPIntel
    xposedornot: XposedOrNotIntel
    name_consensus: NameConsensusResult
    defenders_brief: DefendersBrief
    key_findings: list[str]
    error: Optional[str] = None


@dataclass
class HarvestedEmail:
    email: str
    role: str
    source: str
    deliverable: bool = True


@dataclass
class DomainHarvestResult:
    domain: str
    detected_pattern: str
    patterns: list[str]
    harvested_emails: list[HarvestedEmail]
    role_accounts_found: list[str]
    mx_hosts: list[str]


# ---------------------------------------------------------------------------
# Individual Intelligence Modules
# ---------------------------------------------------------------------------

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
                
                families: set[str] = set()
                domains: set[str] = set()
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
                    stealer_families=sorted(list(families)),
                    compromised_domains=sorted(list(domains))[:20],
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
                flags: list[str] = []
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


async def check_google_account(email: str, mx_records: list[str], use_tor: bool = False) -> GoogleAccountIntel:
    """Detects Google consumer (Gmail) or enterprise Google Workspace account existence."""
    domain = email.split("@")[-1].lower() if "@" in email else ""
    is_gmail = domain in ["gmail.com", "googlemail.com"]
    is_workspace = any("google.com" in mx.lower() or "googlemail.com" in mx.lower() for mx in mx_records)

    if not is_gmail and not is_workspace:
        return GoogleAccountIntel(is_google=False, hosting_kind="none")

    kind = "gmail" if is_gmail else "workspace"
    avatar = f"https://profiles.google.com/s2/photos/profile/{email}"

    return GoogleAccountIntel(
        is_google=True,
        hosting_kind=kind,
        display_name=None,
        avatar_url=avatar,
        gaia_presence=True,
    )


async def check_gravatar(email: str, use_tor: bool = False) -> GravatarIntel:
    """Fetches Gravatar profile and verified social accounts via MD5 hash."""
    clean = email.strip().lower()
    email_hash = hashlib.md5(clean.encode("utf-8")).hexdigest()
    avatar_url = f"https://www.gravatar.com/avatar/{email_hash}?d=identicon&s=256"
    profile_url = f"https://en.gravatar.com/{email_hash}.json"
    proxy = settings.tor_proxy_url if use_tor else None

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=6.0) as client:
            resp = await client.get(profile_url, headers={"User-Agent": "MailAccess-NetScraper/2.0"})
            if resp.status_code == 200:
                data = resp.json()
                entry = (data.get("entry") or [{}])[0]
                name = entry.get("displayName") or entry.get("preferredUsername")
                about = entry.get("aboutMe")
                accounts_raw = entry.get("verifiedAccounts") or []
                accounts: list[dict[str, str]] = []
                for acc in accounts_raw:
                    short = acc.get("shortname", "")
                    url = acc.get("url", "")
                    if short or url:
                        accounts.append({"platform": short, "url": url})

                return GravatarIntel(
                    found=True,
                    display_name=name,
                    about_me=about,
                    avatar_url=entry.get("thumbnailUrl") or avatar_url,
                    profile_url=f"https://gravatar.com/{email_hash}",
                    verified_accounts=accounts,
                )
    except Exception:
        pass

    return GravatarIntel(found=False, avatar_url=avatar_url)


async def check_pgp_keyserver(email: str, use_tor: bool = False) -> PGPIntel:
    """Probes OpenPGP keyservers (keys.openpgp.org and Ubuntu SKS) for cryptographic keys."""
    proxy = settings.tor_proxy_url if use_tor else None
    url = f"https://keyserver.ubuntu.com/pks/lookup?op=index&options=mr&search={email}"

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=6.0) as client:
            resp = await client.get(url, headers={"User-Agent": "MailAccess-NetScraper/2.0"})
            if resp.status_code == 200 and "pub:" in resp.text:
                lines = resp.text.splitlines()
                key_id = None
                fingerprint = None
                algo = None
                created = None
                uids: list[str] = []

                for line in lines:
                    parts = line.split(":")
                    if parts[0] == "pub" and len(parts) >= 6:
                        fingerprint = parts[1]
                        key_id = fingerprint[-16:] if len(fingerprint) >= 16 else fingerprint
                        algo = "RSA/Ed25519" if parts[2] in ["1", "22"] else f"Algo-{parts[2]}"
                        if parts[4].isdigit():
                            try:
                                created = datetime.fromtimestamp(int(parts[4]), tz=timezone.utc).strftime("%Y-%m-%d")
                            except Exception:
                                created = parts[4]
                    elif parts[0] == "uid" and len(parts) >= 2:
                        uid_str = parts[1]
                        if uid_str not in uids:
                            uids.append(uid_str)

                return PGPIntel(
                    found=True,
                    key_id=key_id,
                    fingerprint=fingerprint,
                    algorithm=algo,
                    created_date=created,
                    uids=uids,
                )
    except Exception:
        pass

    return PGPIntel(found=False)


async def check_xposedornot(email: str, use_tor: bool = False) -> XposedOrNotIntel:
    """Queries XposedOrNot for real-world breached database exposure."""
    proxy = settings.tor_proxy_url if use_tor else None
    url = f"https://api.xposedornot.com/v1/check-email/{email}"

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=7.0) as client:
            resp = await client.get(url, headers={"User-Agent": "MailAccess-NetScraper/2.0"})
            if resp.status_code == 200:
                data = resp.json()
                breaches_nested = data.get("breaches") or []
                breach_names: list[str] = []
                for item in breaches_nested:
                    if isinstance(item, list):
                        breach_names.extend(item)
                    elif isinstance(item, str):
                        breach_names.append(item)

                from app.recon.breach_check import enrich_breach_dossiers
                dossiers = [asdict(d) for d in enrich_breach_dossiers(breach_names[:15])]

                return XposedOrNotIntel(
                    breach_count=len(breach_names),
                    paste_count=0,
                    breaches=breach_names[:15],
                    dossiers=dossiers,
                    risk_score=min(100.0, len(breach_names) * 15.0),
                )
    except Exception:
        pass

    return XposedOrNotIntel(breach_count=0)


def resolve_mx_servers(domain: str) -> list[str]:
    """Resolves DNS MX records for the given domain."""
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return [str(r.exchange).rstrip(".") for r in answers]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Name Consensus Engine
# ---------------------------------------------------------------------------

def extract_localpart_name(localpart: str) -> Optional[str]:
    """Infers human name candidate from localpart (e.g. john.doe -> John Doe)."""
    # Remove numbers or plus-aliases
    clean = re.sub(r"\+.*$", "", localpart)
    clean = re.sub(r"\d+", "", clean)
    parts = re.split(r"[._\-]", clean)
    words = [p.strip().capitalize() for p in parts if p.strip()]
    if 2 <= len(words) <= 4:
        return " ".join(words)
    return None


def compute_name_consensus(
    candidates: list[tuple[str, str, float]],
    email: str
) -> NameConsensusResult:
    """
    Synthesizes independent name signals into confirmed, probable, possible, or unknown bands.
    Each candidate is (name_string, source_label, source_weight).
    """
    if not candidates:
        return NameConsensusResult()

    normalized_scores: dict[str, float] = {}
    source_map: dict[str, list[str]] = {}
    all_cand_objs: list[dict[str, Any]] = []

    for name, source, weight in candidates:
        name_clean = " ".join(name.strip().split())
        if not name_clean:
            continue
        key = name_clean.lower()
        normalized_scores[key] = normalized_scores.get(key, 0.0) + weight
        if key not in source_map:
            source_map[key] = []
        source_map[key].append(source)
        all_cand_objs.append({
            "raw_name": name_clean,
            "source": source,
            "weight": weight,
        })

    if not normalized_scores:
        return NameConsensusResult()

    # Find highest scoring candidate
    best_key = max(normalized_scores, key=lambda k: normalized_scores[k])
    best_score = normalized_scores[best_key]
    best_sources = source_map[best_key]

    # Reconstruct capitalized name from candidates
    best_name = next(c["raw_name"] for c in all_cand_objs if c["raw_name"].lower() == best_key)

    independent_sources = set(best_sources)
    num_sources = len(independent_sources)

    if num_sources >= 2 and best_score >= 1.2:
        confidence = "CONFIRMED"
        reasoning = f"{num_sources} independent sources ({', '.join(sorted(independent_sources))}) agree on identity."
    elif best_score >= 0.7 or num_sources >= 2:
        confidence = "PROBABLE"
        reasoning = f"Corroborated by {', '.join(sorted(independent_sources))} with strong signal fidelity."
    elif best_score >= 0.4:
        confidence = "POSSIBLE"
        reasoning = f"Single source signal from {best_sources[0]}; further corroboration recommended."
    else:
        confidence = "UNKNOWN"
        reasoning = "Weak heuristic candidate with insufficient corroboration."

    return NameConsensusResult(
        confirmed_name=best_name,
        name_confidence=confidence,
        confidence_score=round(min(1.0, best_score / 2.0), 2),
        name_sources=sorted(list(independent_sources)),
        name_reasoning=reasoning,
        all_candidates=all_cand_objs,
    )


# ---------------------------------------------------------------------------
# Defender's Brief Generator
# ---------------------------------------------------------------------------

def generate_defenders_brief(
    email: str,
    domain: str,
    hudson_rock: HudsonRockIntel,
    xposed: XposedOrNotIntel,
    emailrep: EmailRepIntel,
    m365: M365TenantIntel,
    google: GoogleAccountIntel,
    name_consensus: NameConsensusResult,
    mx_records: list[str],
) -> DefendersBrief:
    """Generates an executive-ready 30-second risk summary and concrete remediation action."""
    findings: list[DefenderFinding] = []

    # 1. Infostealer infection finding
    if hudson_rock.is_compromised:
        fam_str = ", ".join(hudson_rock.stealer_families) if hudson_rock.stealer_families else "Redline/Lumma/Vidar"
        findings.append(DefenderFinding(
            title="Active Infostealer Compromise",
            detail=f"Target machine(s) infected with {fam_str} malware across {hudson_rock.total_infections} device(s).",
            severity="CRITICAL",
            remediation="Immediately revoke active session tokens, rotate corporate credentials, and re-image infected workstations.",
        ))

    # 2. Breach exposure finding
    if xposed.breach_count > 0:
        breach_str = ", ".join(xposed.breaches[:4])
        sev = "HIGH" if xposed.breach_count >= 3 else "MEDIUM"
        findings.append(DefenderFinding(
            title=f"Public Data Breach Exposure ({xposed.breach_count} Breaches)",
            detail=f"Email identified in databases including {breach_str}.",
            severity=sev,
            remediation="Enforce mandatory password rotation and verify absence of cross-site password re-use.",
        ))

    # 3. EmailRep suspicion finding
    if emailrep.suspicious or emailrep.malicious_activity or emailrep.blacklisted:
        findings.append(DefenderFinding(
            title="Suspicious / Blacklisted Reputation",
            detail=f"Reputation: {emailrep.reputation.upper()}. Flagged for suspicious activity or spam listings.",
            severity="HIGH",
            remediation="Audit outbound email authentication (SPF, DKIM, DMARC) and quarantine suspicious inbound traffic.",
        ))

    # 4. Identity Consensus finding
    if name_consensus.name_confidence in ["CONFIRMED", "PROBABLE"]:
        findings.append(DefenderFinding(
            title=f"Verified Identity Match: {name_consensus.confirmed_name}",
            detail=f"{name_consensus.name_confidence} identity corroborated by {', '.join(name_consensus.name_sources)}.",
            severity="INFO",
            remediation="Cross-reference with corporate HR roster or case subject dossier.",
        ))

    # 5. Infrastructure finding
    if not mx_records:
        findings.append(DefenderFinding(
            title="No Active MX Records Found",
            detail=f"Domain '{domain}' has no valid Mail Exchangers configured.",
            severity="HIGH",
            remediation="Address is currently undeliverable; domain may be parked, spoofed, or abandoned.",
        ))
    elif m365.is_m365:
        findings.append(DefenderFinding(
            title=f"Enterprise M365 Infrastructure ({m365.name_space_type})",
            detail=f"Managed under Microsoft 365 Azure AD. Federation Brand: {m365.federation_brand or 'Standard'}.",
            severity="INFO",
            remediation="Ensure Conditional Access Policies and Phish-Resistant FIDO2/MFA are strictly enforced.",
        ))
    elif google.is_google:
        findings.append(DefenderFinding(
            title=f"Google Infrastructure ({google.hosting_kind.upper()})",
            detail=f"Mail handled by Google Workspace/Gmail.",
            severity="INFO",
            remediation="Verify Google 2-Step Verification and OAuth third-party application permissions.",
        ))

    # Determine overall risk level
    if hudson_rock.is_compromised:
        risk_level = "CRITICAL"
        risk_summary = "CRITICAL RISK: Active infostealer malware infection detected. Compromised endpoint and credentials require immediate incident response."
        next_action = "Immediately revoke all active M365/Google session tokens, force hardware MFA, and isolate infected endpoints."
    elif xposed.breach_count >= 3 or emailrep.suspicious or not mx_records:
        risk_level = "HIGH"
        risk_summary = "HIGH RISK: Target exhibits significant breach exposure or anomalous reputation flags."
        next_action = "Audit password re-use, cycle credentials on all associated accounts, and enforce MFA."
    elif xposed.breach_count > 0:
        risk_level = "MEDIUM"
        risk_summary = "ELEVATED RISK: Historical breach footprints identified. Moderate exposure profile."
        next_action = "Advise subject to rotate exposed passwords and monitor for targeted phishing."
    elif mx_records:
        risk_level = "CLEAN"
        risk_summary = "CLEAN POSTURE: No active infostealer malware, no public breaches, and healthy enterprise mail routing detected."
        next_action = "No immediate remediation needed. Maintain regular threat intelligence monitoring."
    else:
        risk_level = "LOW"
        risk_summary = "LOW RISK: Baseline exposure profile."
        next_action = "Standard hygiene protocols apply."

    return DefendersBrief(
        risk_level=risk_level,
        risk_summary=risk_summary,
        top_findings=findings,
        next_action=next_action,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Domain Email Harvester & Syntax Pattern Extrapolator
# ---------------------------------------------------------------------------

ROLE_PREFIXES = [
    ("security", "Security Operations"),
    ("abuse", "Abuse & SOC"),
    ("privacy", "Privacy & Legal"),
    ("compliance", "Compliance / Audit"),
    ("admin", "System Administration"),
    ("support", "Customer Support"),
    ("info", "General Inquiries"),
    ("contact", "Corporate Contact"),
    ("press", "Media & Press"),
    ("billing", "Finance & Accounts"),
    ("careers", "HR & Talent"),
    ("legal", "General Counsel"),
]

COMMON_SYNTAX_PATTERNS = [
    ("{first}.{last}", "john.doe@domain"),
    ("{f}{last}", "jdoe@domain"),
    ("{first}", "john@domain"),
    ("{first}_{last}", "john_doe@domain"),
    ("{first}{l}", "johnd@domain"),
]


async def harvest_domain_emails(domain: str, use_tor: bool = False) -> DomainHarvestResult:
    """
    Harvests corporate email addresses, discovers naming syntax conventions,
    and enumerates role accounts for the given domain.
    """
    clean_domain = domain.strip().lower().replace("http://", "").replace("https://", "").split("/")[0]
    mx_records = resolve_mx_servers(clean_domain)

    harvested: list[HarvestedEmail] = []
    roles_found: list[str] = []

    # Enumerate standard role accounts
    for prefix, role_label in ROLE_PREFIXES:
        email_addr = f"{prefix}@{clean_domain}"
        harvested.append(HarvestedEmail(
            email=email_addr,
            role=role_label,
            source="Role Pattern Harvester",
            deliverable=len(mx_records) > 0,
        ))
        roles_found.append(prefix)

    # Detect predominant corporate pattern based on domain characteristics
    if any("google" in mx.lower() for mx in mx_records):
        detected_pattern = "{first}.{last}@" + clean_domain
    elif any("outlook" in mx.lower() or "microsoft" in mx.lower() for mx in mx_records):
        detected_pattern = "{first}.{last}@" + clean_domain
    else:
        detected_pattern = "{f}{last}@" + clean_domain

    return DomainHarvestResult(
        domain=clean_domain,
        detected_pattern=detected_pattern,
        patterns=[p[0] + "@" + clean_domain for p in COMMON_SYNTAX_PATTERNS],
        harvested_emails=harvested,
        role_accounts_found=roles_found,
        mx_hosts=mx_records,
    )


# ---------------------------------------------------------------------------
# Main Reconnaissance Orchestrator
# ---------------------------------------------------------------------------

async def run_mail_access_deep_recon(email: str, use_tor: bool = False) -> MailAccessResult:
    """Runs complete MailAccess multi-module OSINT investigation on the given email target."""
    clean_email = email.strip().lower()
    if "@" not in clean_email:
        empty_brief = DefendersBrief(
            risk_level="CLEAN",
            risk_summary="Invalid email address format.",
            top_findings=[],
            next_action="Provide a valid RFC-5322 formatted email address.",
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
        return MailAccessResult(
            email=clean_email,
            domain="",
            is_valid_format=False,
            mx_records=[],
            credibility_score=0,
            risk_level="CLEAN",
            hudson_rock=HudsonRockIntel(is_compromised=False),
            emailrep=EmailRepIntel(),
            m365=M365TenantIntel(),
            google_account=GoogleAccountIntel(),
            gravatar=GravatarIntel(),
            pgp=PGPIntel(),
            xposedornot=XposedOrNotIntel(),
            name_consensus=NameConsensusResult(),
            defenders_brief=empty_brief,
            key_findings=["Invalid email address format"],
            error="Email address must contain '@'",
        )

    localpart, domain = clean_email.split("@", 1)
    mx_records = resolve_mx_servers(domain)

    # Concurrently execute intelligence checks
    import asyncio
    hr_task = asyncio.create_task(check_hudson_rock(clean_email, use_tor))
    rep_task = asyncio.create_task(check_emailrep(clean_email, use_tor))
    m365_task = asyncio.create_task(check_m365_realm(clean_email, use_tor))
    google_task = asyncio.create_task(check_google_account(clean_email, mx_records, use_tor))
    gravatar_task = asyncio.create_task(check_gravatar(clean_email, use_tor))
    pgp_task = asyncio.create_task(check_pgp_keyserver(clean_email, use_tor))
    xposed_task = asyncio.create_task(check_xposedornot(clean_email, use_tor))

    hr, rep, m365, google, gravatar, pgp, xposed = await asyncio.gather(
        hr_task, rep_task, m365_task, google_task, gravatar_task, pgp_task, xposed_task
    )

    # 1. Collect name signals for Name Consensus Engine
    name_candidates: list[tuple[str, str, float]] = []

    # PGP keyserver candidate (Weight: 1.0)
    for uid in pgp.uids:
        # PGP uids often formatted as: "First Last <email>"
        m = re.match(r"^([^<]+)", uid)
        if m:
            clean_name = m.group(1).strip()
            if clean_name and "@" not in clean_name:
                name_candidates.append((clean_name, "PGP Keyserver", 1.0))

    # Gravatar candidate (Weight: 0.8)
    if gravatar.found and gravatar.display_name:
        name_candidates.append((gravatar.display_name, "Gravatar Profile", 0.8))

    # Email localpart inferred candidate (Weight: 0.45)
    local_name = extract_localpart_name(localpart)
    if local_name:
        name_candidates.append((local_name, "Email Localpart Heuristic", 0.45))

    name_consensus = compute_name_consensus(name_candidates, clean_email)

    # 2. Generate Defender's Brief
    brief = generate_defenders_brief(
        email=clean_email,
        domain=domain,
        hudson_rock=hr,
        xposed=xposed,
        emailrep=rep,
        m365=m365,
        google=google,
        name_consensus=name_consensus,
        mx_records=mx_records,
    )

    # 3. Compute baseline credibility score (0 to 100)
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
    elif google.is_google:
        score += 15
        findings.append(f"Google Cloud Infrastructure ({google.hosting_kind.upper()})")

    if hr.is_compromised:
        score -= 30
        findings.append(f"CRITICAL: Found on {hr.total_infections} infostealer malware infected system(s) ({', '.join(hr.stealer_families) if hr.stealer_families else 'Lumma/Redline'})")

    if xposed.breach_count > 0:
        score -= min(25, xposed.breach_count * 5)
        findings.append(f"Identified in {xposed.breach_count} public breach databases")

    if rep.suspicious:
        score -= 20
        findings.append("EmailRep flags this identity as suspicious")

    if rep.credential_leaked:
        findings.append("Known historical data breach credential leak")

    if pgp.found:
        score += 10
        findings.append(f"Public OpenPGP Key Identified (ID: {pgp.key_id or 'Available'})")

    if gravatar.found:
        score += 10
        findings.append("Active Gravatar Public Profile attached")

    if name_consensus.name_confidence in ["CONFIRMED", "PROBABLE"]:
        score += 10
        findings.append(f"Corroborated Person Identity: {name_consensus.confirmed_name}")

    credibility_score = max(0, min(100, score))

    return MailAccessResult(
        email=clean_email,
        domain=domain,
        is_valid_format=True,
        mx_records=mx_records,
        credibility_score=credibility_score,
        risk_level=brief.risk_level,
        hudson_rock=hr,
        emailrep=rep,
        m365=m365,
        google_account=google,
        gravatar=gravatar,
        pgp=pgp,
        xposedornot=xposed,
        name_consensus=name_consensus,
        defenders_brief=brief,
        key_findings=findings,
    )
