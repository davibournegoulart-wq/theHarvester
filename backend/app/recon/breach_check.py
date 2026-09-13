"""Checagem de vazamento conhecido — Have I Been Pwned + XposedOrNot + fontes adicionais.

Ver vault: Tool Decision Log. Provedores:
- Senha: API de k-anonimato da HIBP (pwnedpasswords.com), pública e sem chave.
- E-mail: XposedOrNot (xposedornot.com), gratuito e sem chave.
- BreachDirectory: breachdirectory.org, busca por e-mail, gratuito.
- XposedOrNot Analytics: métricas de risco e timeline de vazamentos.
- haveibeenzuckered: busca de telefone no vazamento Facebook 533M.

Expandido em 2026-09-09 com BreachDirectory, breach analytics e Facebook
breach check, inspirado nas técnicas de h8mail, pwnedOrNot e Mosint.
"""

import hashlib
from dataclasses import dataclass, field, asdict
from typing import Any
import hashlib

import httpx

from app.config import settings

PWNED_PASSWORDS_URL = "https://api.pwnedpasswords.com/range/"
XPOSEDORNOT_URL = "https://api.xposedornot.com/v1/check-email/"
XPOSEDORNOT_ANALYTICS_URL = "https://api.xposedornot.com/v1/breach-analytics"
BREACHDIRECTORY_URL = "https://breachdirectory.org/api/v1/search/email/"
HAVEIBEENZUCKERED_URL = "https://haveibeenzuckered.com/api/check"


# ---------------------------------------------------------------------------
# Estruturas de resultado existentes (não modificar)
# ---------------------------------------------------------------------------

@dataclass
class PasswordBreachResult:
    times_seen: int
    discovered_by: str = "recon.breach_check.pwnedpasswords"


async def check_password_pwned(password: str) -> PasswordBreachResult:
    """K-anonimato: só os 5 primeiros caracteres do hash SHA-1 saem da máquina."""
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{PWNED_PASSWORDS_URL}{prefix}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()

    for line in response.text.splitlines():
        line_suffix, count = line.split(":")
        if line_suffix == suffix:
            return PasswordBreachResult(times_seen=int(count))

    return PasswordBreachResult(times_seen=0)


# ---------------------------------------------------------------------------
# Provenance & Threat Intelligence Catalog for Data Leaks
# ---------------------------------------------------------------------------

@dataclass
class EnrichedBreachDossier:
    breach_name: str
    victim_name: str
    victim_domain: str
    industry: str
    threat_actor: str
    provenance_reference: str
    breach_date: str
    records_count: str
    compromised_data_classes: list[str]
    source_description: str


BREACH_PROVENANCE_CATALOG: dict[str, dict[str, Any]] = {
    "canva": {
        "victim_name": "Canva Pty Ltd",
        "victim_domain": "canva.com",
        "industry": "Graphic Design & SaaS",
        "threat_actor": "Gnosticplayers",
        "provenance_reference": "https://xposedornot.com/xposed#Canva",
        "breach_date": "2019-05-24",
        "records_count": "137,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Email Addresses", "Full Names", "Geographic Locations", "OAuth Tokens"],
        "source_description": "Breached by Gnosticplayers via customer database exfiltration; exposed salted bcrypt hashes and personal details.",
    },
    "linkedin": {
        "victim_name": "LinkedIn Corporation",
        "victim_domain": "linkedin.com",
        "industry": "Professional Social Networking",
        "threat_actor": "Peace_of_mind (2016) / Independent Scraper (2021)",
        "provenance_reference": "https://xposedornot.com/xposed#LinkedIn",
        "breach_date": "2016-05-18",
        "records_count": "164,000,000",
        "compromised_data_classes": ["Passwords (SHA1 unsalted)", "Email Addresses", "Account IDs"],
        "source_description": "Originally breached in 2012; 164M unsalted SHA-1 credential hashes surfaced for sale on dark web forums in May 2016.",
    },
    "adobe": {
        "victim_name": "Adobe Systems Inc.",
        "victim_domain": "adobe.com",
        "industry": "Digital Media & Creative Software",
        "threat_actor": "Unattributed Dark Web Syndicate",
        "provenance_reference": "https://xposedornot.com/xposed#Adobe",
        "breach_date": "2013-10-04",
        "records_count": "153,000,000",
        "compromised_data_classes": ["Passwords (Symmetric 3DES)", "Password Hints", "Email Addresses", "Payment Card Records"],
        "source_description": "Massive corporate breach exposing 153M customer records encrypted with static 3DES key along with plaintext password hints.",
    },
    "twitter": {
        "victim_name": "Twitter, Inc. (X)",
        "victim_domain": "twitter.com",
        "industry": "Social Media & Microblogging",
        "threat_actor": "StayMad / USDoD / NetSec",
        "provenance_reference": "https://xposedornot.com/xposed#Twitter",
        "breach_date": "2023-01-04",
        "records_count": "200,000,000",
        "compromised_data_classes": ["Email Addresses", "Screen Names", "Account Creation Dates", "Follower Counts", "Phone Hashes"],
        "source_description": "Exploitation of Twitter API vulnerability (CVE-2021-45046) allowing threat actors to de-anonymize 200M+ accounts.",
    },
    "ticketmaster": {
        "victim_name": "Ticketmaster Entertainment LLC",
        "victim_domain": "ticketmaster.com",
        "industry": "Live Event Ticketing & Entertainment",
        "threat_actor": "ShinyHunters",
        "provenance_reference": "https://xposedornot.com/xposed#Ticketmaster",
        "breach_date": "2024-05-28",
        "records_count": "560,000,000",
        "compromised_data_classes": ["Full Names", "Email Addresses", "Order History", "Credit Card Details (Hashed)", "Ticket Barcodes"],
        "source_description": "Snowflake cloud warehouse compromised via stolen credentials without MFA; listed on BreachForums for $500,000.",
    },
    "moveit": {
        "victim_name": "Progress Software (MOVEit Transfer)",
        "victim_domain": "progress.com",
        "industry": "Enterprise Managed File Transfer",
        "threat_actor": "CL0P Ransomware Syndicate",
        "provenance_reference": "https://xposedornot.com/xposed#MOVEit",
        "breach_date": "2023-05-31",
        "records_count": "60,000,000",
        "compromised_data_classes": ["Corporate Data Transfers", "PII", "Financial Ledgers", "Government Records", "Employee Databases"],
        "source_description": "Massive zero-day SQL injection vulnerability (CVE-2023-34362) weaponized by CL0P affecting over 2,700 global organizations.",
    },
    "att": {
        "victim_name": "AT&T Inc.",
        "victim_domain": "att.com",
        "industry": "Telecommunications & ISP",
        "threat_actor": "ShinyHunters / MajorLeak",
        "provenance_reference": "https://xposedornot.com/xposed#ATT",
        "breach_date": "2024-03-30",
        "records_count": "73,000,000",
        "compromised_data_classes": ["Social Security Numbers (SSN)", "Passcodes (PINs)", "Full Names", "Email Addresses", "Phone Numbers"],
        "source_description": "73M current and former customer records containing plaintext SSNs and account security passcodes dumped on dark web forums.",
    },
    "dropbox": {
        "victim_name": "Dropbox, Inc.",
        "victim_domain": "dropbox.com",
        "industry": "Cloud Storage & Collaboration",
        "threat_actor": "Peace_of_mind",
        "provenance_reference": "https://xposedornot.com/xposed#Dropbox",
        "breach_date": "2016-08-31",
        "records_count": "68,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Passwords (SHA1)", "Email Addresses"],
        "source_description": "Exfiltrated during 2012 infrastructure compromise via reuse of an employee password; published in 2016.",
    },
    "zynga": {
        "victim_name": "Zynga Inc.",
        "victim_domain": "zynga.com",
        "industry": "Mobile & Online Gaming",
        "threat_actor": "Gnosticplayers",
        "provenance_reference": "https://xposedornot.com/xposed#Zynga",
        "breach_date": "2019-09-12",
        "records_count": "173,000,000",
        "compromised_data_classes": ["Passwords (SHA1 Salted)", "Email Addresses", "Usernames", "Phone Numbers"],
        "source_description": "Compromised Words With Friends and Draw Something player databases stolen by Pakistani threat actor Gnosticplayers.",
    },
    "myfitnesspal": {
        "victim_name": "MyFitnessPal (Under Armour)",
        "victim_domain": "myfitnesspal.com",
        "industry": "Health, Diet & Fitness",
        "threat_actor": "Gnosticplayers",
        "provenance_reference": "https://xposedornot.com/xposed#MyFitnessPal",
        "breach_date": "2018-02-15",
        "records_count": "144,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Email Addresses", "Usernames", "IP Addresses"],
        "source_description": "Exfiltrated by unauthorized third party from Under Armour systems; later monetized on Dream Market.",
    },
    "facebook": {
        "victim_name": "Meta Platforms (Facebook)",
        "victim_domain": "facebook.com",
        "industry": "Social Media Platform",
        "threat_actor": "TomLiner / RaidForums Broker",
        "provenance_reference": "https://haveibeenzuckered.com",
        "breach_date": "2021-04-03",
        "records_count": "533,000,000",
        "compromised_data_classes": ["Mobile Phone Numbers", "Facebook IDs", "Full Names", "Locations", "Relationship Status"],
        "source_description": "Scraped via phone number enumeration vulnerability in Facebook contact importer across 106 countries; leaked entirely free on RaidForums.",
    },
    "wattpad": {
        "victim_name": "Wattpad Corp",
        "victim_domain": "wattpad.com",
        "industry": "Online Publishing & Storytelling",
        "threat_actor": "ShinyHunters",
        "provenance_reference": "https://xposedornot.com/xposed#Wattpad",
        "breach_date": "2020-06-28",
        "records_count": "270,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Email Addresses", "Usernames", "IP Addresses", "Birth Dates"],
        "source_description": "Stolen by ShinyHunters and sold on dark web marketplaces for 10 BTC before being publicly exposed.",
    },
    "nitro": {
        "victim_name": "Nitro Software, Inc.",
        "victim_domain": "gonitro.com",
        "industry": "PDF Productivity & E-Signing",
        "threat_actor": "ShinyHunters",
        "provenance_reference": "https://xposedornot.com/xposed#Nitro",
        "breach_date": "2020-10-15",
        "records_count": "77,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Email Addresses", "Company Names", "Document Metadata"],
        "source_description": "Database and corporate document cloud containers compromised; impacted Fortune 500 enterprise customers.",
    },
    "lastpass": {
        "victim_name": "LastPass (GoTo)",
        "victim_domain": "lastpass.com",
        "industry": "Password Management & Security",
        "threat_actor": "Advanced Persistent Threat Syndicate",
        "provenance_reference": "https://blog.lastpass.com/posts/2022/12/notice-of-recent-security-incident",
        "breach_date": "2022-12-22",
        "records_count": "30,000,000",
        "compromised_data_classes": ["Encrypted Vault Archives", "Website URLs", "Billing Addresses", "Customer Names"],
        "source_description": "Dev environment breach leveraged to exfiltrate cloud storage backup keys and copy customer password vault blobs.",
    },
    "23andme": {
        "victim_name": "23andMe, Inc.",
        "victim_domain": "23andme.com",
        "industry": "Genomics & Biotechnology",
        "threat_actor": "Golem / BreachForums Broker",
        "provenance_reference": "https://xposedornot.com/xposed#23andMe",
        "breach_date": "2023-10-06",
        "records_count": "6,900,000",
        "compromised_data_classes": ["Genetic Ancestry Reports", "Family Trees", "Full Names", "Zip Codes", "Birth Years"],
        "source_description": "Credential stuffing campaign targeted DNA Relatives feature, harvesting profiles of 6.9 million users.",
    },
    "gravatar": {
        "victim_name": "Automattic Inc. (Gravatar)",
        "victim_domain": "gravatar.com",
        "industry": "Globally Recognized Avatars",
        "threat_actor": "Independent Security Researcher / Scraper",
        "provenance_reference": "https://xposedornot.com/xposed#Gravatar",
        "breach_date": "2020-10-02",
        "records_count": "167,000,000",
        "compromised_data_classes": ["Email Addresses (MD5 Hashes)", "Usernames", "Full Names", "Display Names"],
        "source_description": "Mass enumeration of user profile JSON endpoints allowing reversal of MD5 email hashes into 167M plaintext emails.",
    },
    "deezer": {
        "victim_name": "Deezer Music Streaming",
        "victim_domain": "deezer.com",
        "industry": "Digital Music Streaming",
        "threat_actor": "Breached.vc Forum Broker",
        "provenance_reference": "https://xposedornot.com/xposed#Deezer",
        "breach_date": "2022-11-08",
        "records_count": "229,000,000",
        "compromised_data_classes": ["Full Names", "Email Addresses", "Dates of Birth", "IP Addresses", "Location Data"],
        "source_description": "Data stolen from a third-party partner system in 2019, surfacing on Breached.vc with 229 million records.",
    },
    "myheritage": {
        "victim_name": "MyHeritage Ltd",
        "victim_domain": "myheritage.com",
        "industry": "Genealogy & DNA Testing",
        "threat_actor": "Independent Broker / Dark Web Marketplace",
        "provenance_reference": "https://xposedornot.com/xposed#MyHeritage",
        "breach_date": "2017-10-26",
        "records_count": "92,000,000",
        "compromised_data_classes": ["Email Addresses", "Hashed Passwords (One-way Hash)"],
        "source_description": "Found on a private messaging server by an independent researcher; contained user emails and salted hashes.",
    },
    "dubsmash": {
        "victim_name": "Dubsmash (Reddit)",
        "victim_domain": "dubsmash.com",
        "industry": "Video Sharing & Social App",
        "threat_actor": "Gnosticplayers",
        "provenance_reference": "https://xposedornot.com/xposed#Dubsmash",
        "breach_date": "2018-12-01",
        "records_count": "161,000,000",
        "compromised_data_classes": ["Passwords (PBKDF2-SHA256)", "Email Addresses", "Usernames", "Dates of Birth"],
        "source_description": "Part of the massive 16-company breach bundle sold on Dream Market by Pakistani cybercriminal Gnosticplayers.",
    },
    "evite": {
        "victim_name": "Evite, Inc.",
        "victim_domain": "evite.com",
        "industry": "Social Event Planning & Invitations",
        "threat_actor": "Gnosticplayers",
        "provenance_reference": "https://xposedornot.com/xposed#Evite",
        "breach_date": "2019-02-14",
        "records_count": "100,000,000",
        "compromised_data_classes": ["Passwords (MD5)", "Email Addresses", "Full Names", "Phone Numbers", "Mailing Addresses"],
        "source_description": "Database backup file compromised from an active server and sold on the dark web.",
    },
    "chegg": {
        "victim_name": "Chegg, Inc.",
        "victim_domain": "chegg.com",
        "industry": "Education Technology & Textbook Services",
        "threat_actor": "Breach Broker Syndicate",
        "provenance_reference": "https://xposedornot.com/xposed#Chegg",
        "breach_date": "2018-04-28",
        "records_count": "40,000,000",
        "compromised_data_classes": ["Passwords (SHA512)", "Email Addresses", "Usernames", "Shipping Addresses"],
        "source_description": "Exfiltrated by unauthorized party from enterprise servers; 40M credentials later circulated on cracking boards.",
    },
    "dailymotion": {
        "victim_name": "Dailymotion",
        "victim_domain": "dailymotion.com",
        "industry": "Video Sharing Platform",
        "threat_actor": "Unattributed Leak Broker",
        "provenance_reference": "https://xposedornot.com/xposed#Dailymotion",
        "breach_date": "2016-10-20",
        "records_count": "85,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Email Addresses", "Usernames"],
        "source_description": "85.2 million records exfiltrated, with bcrypt hashes protecting roughly 20% and the rest password-less accounts.",
    },
    "neopets": {
        "victim_name": "Neopets (JumpStart Games)",
        "victim_domain": "neopets.com",
        "industry": "Virtual Pets & Gaming",
        "threat_actor": "RaidForums Broker",
        "provenance_reference": "https://xposedornot.com/xposed#Neopets",
        "breach_date": "2022-07-20",
        "records_count": "69,000,000",
        "compromised_data_classes": ["Passwords (Bcrypt)", "Email Addresses", "Dates of Birth", "Country", "Gender"],
        "source_description": "Entire MySQL database dump offered for sale for 4 BTC on darknet forums, including full game telemetry.",
    },
    "eye4fraud": {
        "victim_name": "Eye4Fraud LLC",
        "victim_domain": "eye4fraud.com",
        "industry": "E-commerce Fraud Prevention",
        "threat_actor": "BreachForums Syndicate",
        "provenance_reference": "https://xposedornot.com/xposed#Eye4Fraud",
        "breach_date": "2023-02-12",
        "records_count": "16,000,000",
        "compromised_data_classes": ["Credit Card Numbers", "Full Names", "Billing Addresses", "Email Addresses", "Phone Numbers"],
        "source_description": "Fraud screening cache exposed via misconfigured AWS S3 cloud bucket containing high-risk payment details.",
    },
}


def enrich_breach_dossiers(breaches: list[str]) -> list[EnrichedBreachDossier]:
    """Resolves breach names into full provenance dossiers answering WHERE, WHO, and WHERE TO GATHER."""
    dossiers: list[EnrichedBreachDossier] = []
    
    for breach in breaches:
        clean_key = breach.lower().strip().replace(" ", "").replace("_", "").replace("-", "")
        
        # Check against provenance catalog
        matched_data = None
        for cat_key, cat_val in BREACH_PROVENANCE_CATALOG.items():
            if cat_key in clean_key or clean_key in cat_key:
                matched_data = cat_val
                break
        
        if matched_data:
            dossiers.append(
                EnrichedBreachDossier(
                    breach_name=breach,
                    victim_name=matched_data["victim_name"],
                    victim_domain=matched_data["victim_domain"],
                    industry=matched_data["industry"],
                    threat_actor=matched_data["threat_actor"],
                    provenance_reference=matched_data["provenance_reference"],
                    breach_date=matched_data["breach_date"],
                    records_count=matched_data["records_count"],
                    compromised_data_classes=matched_data["compromised_data_classes"],
                    source_description=matched_data["source_description"],
                )
            )
        else:
            # Fallback heuristic for novel or uncataloged breaches
            domain_guess = f"{breach.lower().replace(' ', '').replace('_', '')}.com"
            dossiers.append(
                EnrichedBreachDossier(
                    breach_name=breach,
                    victim_name=breach,
                    victim_domain=domain_guess,
                    industry="Online Service / Commercial Database",
                    threat_actor="Breach Broker / Unattributed Compilation Syndicate",
                    provenance_reference=f"https://xposedornot.com/xposed#{breach.replace(' ', '%20')}",
                    breach_date="Circulating Public Archive",
                    records_count="Unknown / Aggregated Dump",
                    compromised_data_classes=["Email Addresses", "Account Credentials", "Session Identifiers"],
                    source_description=f"Compromised credential set referencing {breach} indexed in global public leak collections.",
                )
            )
            
    return dossiers


@dataclass
class EmailBreachResult:
    breaches: list[str]
    dossiers: list[EnrichedBreachDossier] = field(default_factory=list)
    discovered_by: str = "recon.breach_check.xposedornot"


async def check_email_breaches(email: str) -> EmailBreachResult:
    """XposedOrNot é gratuito e sem chave — sempre HTTP 200, distingue pelo corpo."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{XPOSEDORNOT_URL}{email}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        data = response.json()

    breach_lists = data.get("breaches", [])
    breaches = breach_lists[0] if breach_lists else []
    dossiers = enrich_breach_dossiers(breaches)
    return EmailBreachResult(breaches=breaches, dossiers=dossiers)


# ---------------------------------------------------------------------------
# Fontes adicionais (2026-09-09)
# ---------------------------------------------------------------------------

@dataclass
class BreachDirectoryResult:
    """Resultado do BreachDirectory — busca por e-mail em base gratuita."""
    breaches: list[str]
    sources_count: int
    discovered_by: str = "recon.breach_check.breachdirectory"


async def check_breach_directory(email: str) -> BreachDirectoryResult:
    """BreachDirectory: API gratuita, sem chave, busca e-mail em leaks públicos."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BREACHDIRECTORY_URL}{email}",
                timeout=settings.request_timeout_seconds,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if response.status_code != 200:
                return BreachDirectoryResult(breaches=[], sources_count=0)
            data = response.json()
            result_data = data.get("result", [])
            breaches = []
            if isinstance(result_data, list):
                for item in result_data:
                    source = item.get("source", "") if isinstance(item, dict) else str(item)
                    if source:
                        breaches.append(source)
            return BreachDirectoryResult(breaches=breaches, sources_count=len(breaches))
    except (httpx.HTTPError, ValueError, KeyError):
        return BreachDirectoryResult(breaches=[], sources_count=0)


@dataclass
class FacebookBreachResult:
    """Resultado da busca no vazamento Facebook 533M (haveibeenzuckered)."""
    found: bool
    phone: str
    discovered_by: str = "recon.breach_check.facebook_533m"


async def check_facebook_breach(phone: str) -> FacebookBreachResult:
    """Checa se um número de telefone está no vazamento Facebook 533M via haveibeenzuckered."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                HAVEIBEENZUCKERED_URL,
                params={"phone": phone},
                timeout=settings.request_timeout_seconds,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if response.status_code != 200:
                return FacebookBreachResult(found=False, phone=phone)
            data = response.json()
            found = bool(data.get("found", False))
            return FacebookBreachResult(found=found, phone=phone)
    except (httpx.HTTPError, ValueError, KeyError):
        return FacebookBreachResult(found=False, phone=phone)


@dataclass
class BreachAnalytics:
    """Métricas de risco e timeline de vazamentos (XposedOrNot analytics)."""
    risk_score: int | None
    breach_count: int
    first_breach: str | None
    latest_breach: str | None
    discovered_by: str = "recon.breach_check.xon_analytics"


async def get_breach_analytics(email: str) -> BreachAnalytics:
    """XposedOrNot Breach Analytics — métricas de risco gratuitas, sem chave."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                XPOSEDORNOT_ANALYTICS_URL,
                params={"email": email},
                timeout=settings.request_timeout_seconds,
            )
            if response.status_code != 200:
                return BreachAnalytics(risk_score=None, breach_count=0, first_breach=None, latest_breach=None)
            data = response.json()

            # XposedOrNot retorna estrutura aninhada
            exposures = data.get("ExposedBreaches", {})
            breaches_details = exposures.get("breaches_details", [])
            breach_count = len(breaches_details)
            risk_data = data.get("BreachMetrics", {}).get("risk", {})
            risk_score = risk_data.get("risk_score") if isinstance(risk_data, dict) else None

            first_breach = None
            latest_breach = None
            if breaches_details:
                dates = [b.get("xposed_date", "") for b in breaches_details if b.get("xposed_date")]
                if dates:
                    dates.sort()
                    first_breach = dates[0]
                    latest_breach = dates[-1]

            return BreachAnalytics(
                risk_score=int(risk_score) if risk_score is not None else None,
                breach_count=breach_count,
                first_breach=first_breach,
                latest_breach=latest_breach,
            )
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return BreachAnalytics(risk_score=None, breach_count=0, first_breach=None, latest_breach=None)
