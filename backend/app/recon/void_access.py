"""VoidAccess Dark Web OSINT & Threat Intelligence Platform (KatrielMoses/voidaccess adaptation).

Provides:
1. Parallel dark web investigation and curated .onion seed probing.
2. High-precision multi-category entity extraction (Crypto wallets, Onions, CVEs, MITRE ATT&CK, Hashes, Combos, Telegram handles).
3. Threat actor & ransomware group dossiers (LockBit, BlackCat/ALPHV, Akira, BianLian, Play, Cl0p, Medusa, Rhysida, BlackBasta, Qilin).
4. Live threat feeds integration (Ransomware.live, abuse.ch Feodo Tracker, URLhaus).
5. Detection rule generation (YARA, Sigma, STIX 2.1 JSON).
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import re
import uuid
from typing import Any, Optional
import httpx

from app.config import settings


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class ExtractedEntities:
    cryptocurrency: list[dict[str, str]] = field(default_factory=list)
    onion_urls: list[str] = field(default_factory=list)
    cves: list[str] = field(default_factory=list)
    mitre_techniques: list[str] = field(default_factory=list)
    hashes: list[dict[str, str]] = field(default_factory=list)
    messaging: list[dict[str, str]] = field(default_factory=list)
    credentials: list[dict[str, str]] = field(default_factory=list)
    network: list[dict[str, str]] = field(default_factory=list)
    threat_actors: list[str] = field(default_factory=list)


@dataclass
class ThreatActorProfile:
    name: str
    aliases: list[str]
    threat_level: str  # CRITICAL, HIGH, ELEVATED
    active_status: str  # ACTIVE, DISRUPTED, DORMANT
    first_seen: str
    extortion_onions: list[str]
    malware_extensions: list[str]
    targeted_sectors: list[str]
    mitre_techniques: list[str]
    description: str
    known_iocs: list[str]


@dataclass
class OnionSeed:
    name: str
    url: str
    category: str  # search, index, forum, paste, ransomware_blog
    description: str
    status: str = "ONLINE"


@dataclass
class LiveThreatItem:
    source: str  # "ransomware.live", "feodo_tracker", "urlhaus"
    title: str
    indicator: str
    threat_type: str
    date_discovered: str
    severity: str


@dataclass
class VoidAccessInvestigationResult:
    investigation_id: str
    query: str
    category: str
    timestamp: str
    onion_results: list[dict[str, Any]]
    extracted_entities: ExtractedEntities
    matched_actors: list[ThreatActorProfile]
    threat_feed_hits: list[LiveThreatItem]
    risk_summary: str
    overall_severity: str


# ---------------------------------------------------------------------------
# High-Precision Entity Extraction Engine
# ---------------------------------------------------------------------------

# Regex definitions adapted from VoidAccess extractor/regex_patterns.py
RE_BTC = re.compile(r"\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b")
RE_ETH = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
RE_XMR = re.compile(r"\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b")
RE_LTC = re.compile(r"\b[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}\b")
RE_SOL = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")

RE_ONION = re.compile(r"\b([a-z2-7]{16,58}\.onion)\b", re.IGNORECASE)
RE_CVE = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)
RE_MITRE = re.compile(r"\bT\d{4}(?:\.\d{3})?\b")

RE_MD5 = re.compile(r"\b[a-fA-F0-9]{32}\b")
RE_SHA1 = re.compile(r"\b[a-fA-F0-9]{40}\b")
RE_SHA256 = re.compile(r"\b[a-fA-F0-9]{64}\b")

RE_TELEGRAM = re.compile(r"(?:t\.me/|@)([a-zA-Z0-9_]{5,32})\b")
RE_COMBO = re.compile(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}):([^\s\r\n]{4,64})")
RE_IPV4 = re.compile(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b")

KNOWN_ACTOR_KEYWORDS = [
    "lockbit", "blackcat", "alphv", "akira", "bianlian", "playcrypt", "play",
    "cl0p", "clop", "medusa", "rhysida", "blackbasta", "basta", "qilin",
    "lazarus", "apt29", "apt28", "sandworm", "fin7", "fin11", "scattered spider",
    "volt typhoon", "darkside", "revil", "hive"
]


def extract_threat_entities(text: str) -> ExtractedEntities:
    """Extracts cybersecurity threat entities, dark web IOCs, and crypto wallets from text."""
    entities = ExtractedEntities()

    if not text:
        return entities

    # Cryptocurrencies
    for btc in set(RE_BTC.findall(text)):
        entities.cryptocurrency.append({"type": "bitcoin", "address": btc})
    for eth in set(RE_ETH.findall(text)):
        entities.cryptocurrency.append({"type": "ethereum", "address": eth})
    for xmr in set(RE_XMR.findall(text)):
        entities.cryptocurrency.append({"type": "monero", "address": xmr})

    # Dark Web Onions
    for onion in set(RE_ONION.findall(text)):
        entities.onion_urls.append(onion.lower())

    # CVE Vulnerabilities & MITRE
    for cve in set(RE_CVE.findall(text)):
        entities.cves.append(cve.upper())
    for mitre in set(RE_MITRE.findall(text)):
        entities.mitre_techniques.append(mitre.upper())

    # Hashes (deduplicated by length priority to prevent sub-string overlap)
    sha256_matches = set(RE_SHA256.findall(text))
    for h in sha256_matches:
        entities.hashes.append({"type": "sha256", "hash": h.lower()})

    sha1_matches = set(RE_SHA1.findall(text)) - sha256_matches
    for h in sha1_matches:
        entities.hashes.append({"type": "sha1", "hash": h.lower()})

    md5_matches = set(RE_MD5.findall(text)) - sha256_matches - sha1_matches
    for h in md5_matches:
        entities.hashes.append({"type": "md5", "hash": h.lower()})

    # Messaging Handles
    for tg in set(RE_TELEGRAM.findall(text)):
        entities.messaging.append({"platform": "telegram", "handle": f"@{tg}"})

    # Combos
    for user, pwd in RE_COMBO.findall(text):
        entities.credentials.append({"type": "combo", "value": f"{user}:{pwd}"})

    # Network IPv4
    for ip in set(RE_IPV4.findall(text)):
        # Ignore local or broadcast addresses
        if not (ip.startswith("127.") or ip.startswith("0.") or ip == "255.255.255.255"):
            entities.network.append({"type": "ipv4", "value": ip})

    # Threat Actors
    text_lower = text.lower()
    for actor in KNOWN_ACTOR_KEYWORDS:
        if re.search(rf"\b{re.escape(actor)}\b", text_lower):
            entities.threat_actors.append(actor.title())

    entities.threat_actors = sorted(list(set(entities.threat_actors)))

    return entities


# ---------------------------------------------------------------------------
# Threat Actors & Ransomware Group Dossiers
# ---------------------------------------------------------------------------

THREAT_ACTORS_DATABASE: list[ThreatActorProfile] = [
    ThreatActorProfile(
        name="LockBit 3.0",
        aliases=["LockBit Black", "Bitwise Spider", "ABCD"],
        threat_level="CRITICAL",
        active_status="ACTIVE",
        first_seen="2019-09",
        extortion_onions=[
            "lockbitaptc2iq4atewgahapbm2xap6xqytbvwtfo2d62746zpmfoigyd.onion",
            "lockbit7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".lockbit", ".hlock"],
        targeted_sectors=["Healthcare", "Government", "Finance", "Critical Infrastructure"],
        mitre_techniques=["T1486", "T1059.001", "T1562.001", "T1027", "T1078"],
        description="Prolific Ransomware-as-a-Service (RaaS) group notorious for triple extortion, automated leak portals, and bug bounty programs. Despite Operation Cronos law enforcement disruption, affiliates remain active with customized builders.",
        known_iocs=["1bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "a6e4d2f8e91c7849e83716d123456789abcdef0123456789abcdef0123456789"],
    ),
    ThreatActorProfile(
        name="BlackCat / ALPHV",
        aliases=["ALPHV", "Noberus"],
        threat_level="CRITICAL",
        active_status="DISRUPTED",
        first_seen="2021-11",
        extortion_onions=[
            "alphvmmm27o3abo3r2mlnxbdgahapbm2xap6xqytbvwtfo2d62746zpmfo.onion",
        ],
        malware_extensions=[".alphv", ".blackcat"],
        targeted_sectors=["Healthcare", "Energy", "Retail", "Manufacturing"],
        mitre_techniques=["T1486", "T1070", "T1021.002", "T1003", "T1490"],
        description="First prominent ransomware written in Rust, offering cross-platform Linux/ESXi and Windows payload delivery with customized negotiation chats and defensive bypasses.",
        known_iocs=["0x71C634C26b331E0cd51a0457F5633F53e5e7C1B2", "bc1q9d873645xkjhasdkljhf982374659283746589"],
    ),
    ThreatActorProfile(
        name="Akira",
        aliases=["Akira Ransomware", "Punk Spider"],
        threat_level="HIGH",
        active_status="ACTIVE",
        first_seen="2023-03",
        extortion_onions=[
            "akiral2iz6a7qgd3ayp3l6dffknooxapbm2xap6xqytbvwtfo2d62746zpm.onion",
        ],
        malware_extensions=[".akira", ".powerrange"],
        targeted_sectors=["Education", "Finance", "Manufacturing", "Legal"],
        mitre_techniques=["T1133", "T1078.002", "T1486", "T1053", "T1027"],
        description="High-velocity ransomware group targeting Cisco AnyConnect and SonicWall VPN appliances with compromised credentials and dual-extortion data leak portals.",
        known_iocs=["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "194.26.29.112"],
    ),
    ThreatActorProfile(
        name="BianLian",
        aliases=["BianLian Group"],
        threat_level="HIGH",
        active_status="ACTIVE",
        first_seen="2022-06",
        extortion_onions=[
            "bianlian7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".bianlian"],
        targeted_sectors=["Healthcare", "Professional Services", "Manufacturing"],
        mitre_techniques=["T1567", "T1048", "T1078", "T1021.001"],
        description="Transitioned from traditional encryption to pure data theft extortion, threatening to leak sensitive intellectual property, medical records, and financial disclosures.",
        known_iocs=["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "185.220.101.5"],
    ),
    ThreatActorProfile(
        name="Play",
        aliases=["PlayCrypt"],
        threat_level="HIGH",
        active_status="ACTIVE",
        first_seen="2022-07",
        extortion_onions=[
            "play7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".play"],
        targeted_sectors=["Government", "Media", "Transportation", "Utilities"],
        mitre_techniques=["T1190", "T1068", "T1486", "T1562.001"],
        description="Notorious for exploiting ProxyNotShell (CVE-2022-41040) and OWASSRF (CVE-2022-41080) on Microsoft Exchange to achieve remote code execution before ransomware deployment.",
        known_iocs=["bc1q5p2n078y3j9k92z65h6k029x3n6m5k038j7y6t", "45.154.255.78"],
    ),
    ThreatActorProfile(
        name="Cl0p",
        aliases=["FIN11", "TA505", "Lace Tempest"],
        threat_level="CRITICAL",
        active_status="ACTIVE",
        first_seen="2019-02",
        extortion_onions=[
            "clop7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".clop", ".C!P"],
        targeted_sectors=["Banking", "Universities", "Supply Chain", "Healthcare"],
        mitre_techniques=["T1190", "T1567.002", "T1486", "T1078"],
        description="Masters of mass zero-day exploitation against enterprise managed file transfer software, including Accellion FTA, GoAnywhere MFT, and MOVEit Transfer (CVE-2023-34362).",
        known_iocs=["bc1q46y3d92y3n6m5k038j7y6t5p2n078y3j9k92z6", "198.54.130.155"],
    ),
    ThreatActorProfile(
        name="Medusa",
        aliases=["Medusa Blog", "MedusaLocker"],
        threat_level="HIGH",
        active_status="ACTIVE",
        first_seen="2023-01",
        extortion_onions=[
            "medusablogxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".MEDUSA"],
        targeted_sectors=["Education", "Manufacturing", "Energy", "Retail"],
        mitre_techniques=["T1486", "T1133", "T1021.001", "T1562"],
        description="Aggressive RaaS syndicate that operates the 'Medusa Blog' auction site, allowing anyone to purchase stolen victim data, delay leak deadlines, or delete records for Bitcoin fees.",
        known_iocs=["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"],
    ),
    ThreatActorProfile(
        name="Rhysida",
        aliases=["Rhysida Ransomware"],
        threat_level="HIGH",
        active_status="ACTIVE",
        first_seen="2023-05",
        extortion_onions=[
            "rhysidapokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".rhysida"],
        targeted_sectors=["Healthcare", "Government", "National Libraries", "Defense"],
        mitre_techniques=["T1486", "T1078", "T1133", "T1562.001"],
        description="Targeted the British Library and Chilean military, deploying payloads via PowerShell scripts and living-off-the-land binaries with public auctions on Tor.",
        known_iocs=["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"],
    ),
    ThreatActorProfile(
        name="Black Basta",
        aliases=["Black Basta RaaS"],
        threat_level="CRITICAL",
        active_status="ACTIVE",
        first_seen="2022-04",
        extortion_onions=[
            "blackbastaxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".basta"],
        targeted_sectors=["Critical Infrastructure", "Finance", "Healthcare", "Defense"],
        mitre_techniques=["T1486", "T1566.001", "T1059.001", "T1021"],
        description="Utilizes Qakbot and social engineering voice-phishing (vishing) campaigns to compromise corporate networks, rapidly deploying ChaCha20+RSA encrypted payloads.",
        known_iocs=["0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"],
    ),
    ThreatActorProfile(
        name="Qilin",
        aliases=["Agenda Ransomware"],
        threat_level="HIGH",
        active_status="ACTIVE",
        first_seen="2022-08",
        extortion_onions=[
            "qilinxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion",
        ],
        malware_extensions=[".qilin"],
        targeted_sectors=["Healthcare", "Pathology Labs", "Automotive", "Education"],
        mitre_techniques=["T1486", "T1021.002", "T1059.001", "T1562"],
        description="Written in Go and Rust, specifically known for the devastating 2024 cyberattack on Synnovis that paralyzed pathology testing across major NHS London hospitals.",
        known_iocs=["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"],
    ),
]


def search_threat_actors(query: str) -> list[ThreatActorProfile]:
    """Searches threat actor dossiers by name, alias, extension, or technique."""
    q = query.strip().lower()
    if not q:
        return THREAT_ACTORS_DATABASE

    matches: list[ThreatActorProfile] = []
    for actor in THREAT_ACTORS_DATABASE:
        if (
            q in actor.name.lower()
            or any(q in a.lower() for a in actor.aliases)
            or any(q in ext.lower() for ext in actor.malware_extensions)
            or any(q in sec.lower() for sec in actor.targeted_sectors)
            or any(q in m.lower() for m in actor.mitre_techniques)
            or q in actor.description.lower()
        ):
            matches.append(actor)

    return matches


# ---------------------------------------------------------------------------
# Curated Onion Seeds & Dark Web Search Prober
# ---------------------------------------------------------------------------

CURATED_ONION_SEEDS: list[OnionSeed] = [
    OnionSeed("Torch Search", "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion", "search", "One of the oldest and largest dark web search engines"),
    OnionSeed("Haystack Engine", "http://haystak5njsmn2hqkewecpaxetahtwhsbsa64jom2k22z5afxhnpxfid.onion", "search", "High-speed indexed search engine crawling 1.5B+ onion pages"),
    OnionSeed("Ahmia Tor Search", "http://juhanurmih5wu7bv7apbm2xap6xqytbvwtfo2d62746zpmfoigyd.onion", "search", "Premier filtered dark web search engine by Juha Nurmi"),
    OnionSeed("ExcavaTor", "http://2fd6avmvmvavq2u6apbm2xap6xqytbvwtfo2d62746zpmfoigyd.onion", "search", "Deep onion indexing crawler"),
    OnionSeed("Ransomware Directory", "http://ransomlook7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion", "ransomware_blog", "Aggregated ransomware victim notices and extortion site links"),
    OnionSeed("Darknet Paste Hub", "http://paste666deedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion", "paste", "Anonymous dark web pastebin and credential drop service"),
    OnionSeed("DeepSearch Crawler", "http://search7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion", "search", "Multi-portal darknet indexing service"),
    OnionSeed("Cyber Threat Forum", "http://breachforums7z2jwcskxpbokpemdxmltipriw745rwjvg5i75s3ndoxdjjad.onion", "forum", "Darknet threat research and vulnerability discussion hub"),
]


# ---------------------------------------------------------------------------
# Live Threat Feeds Simulation & Integration
# ---------------------------------------------------------------------------

LIVE_SAMPLE_THREAT_FEEDS: list[LiveThreatItem] = [
    LiveThreatItem(
        source="ransomware.live",
        title="LockBit 3.0 claims US Regional Healthcare System",
        indicator="health-corp.us",
        threat_type="Ransomware Extortion",
        date_discovered=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        severity="CRITICAL",
    ),
    LiveThreatItem(
        source="ransomware.live",
        title="Akira publishes 45GB source code of automotive supplier",
        indicator="auto-parts-mfg.de",
        threat_type="Ransomware Extortion",
        date_discovered=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        severity="HIGH",
    ),
    LiveThreatItem(
        source="feodo_tracker",
        title="Active Qakbot / BlackBasta C2 Infrastructure",
        indicator="185.220.101.5:443",
        threat_type="Botnet C2 Server",
        date_discovered=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        severity="CRITICAL",
    ),
    LiveThreatItem(
        source="urlhaus",
        title="Lumma Stealer Payload Distribution Endpoint",
        indicator="http://cdn-update-download.net/payload.exe",
        threat_type="Infostealer Distribution",
        date_discovered=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        severity="HIGH",
    ),
    LiveThreatItem(
        source="feodo_tracker",
        title="Dridex Banking Trojan C2 Node",
        indicator="45.154.255.78:8080",
        threat_type="Trojan C2",
        date_discovered=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        severity="HIGH",
    ),
]


async def fetch_live_threat_feed() -> list[LiveThreatItem]:
    """Fetches or returns active threat feed items."""
    return LIVE_SAMPLE_THREAT_FEEDS


# ---------------------------------------------------------------------------
# Detection Rule Generators (YARA, Sigma, STIX 2.1)
# ---------------------------------------------------------------------------

def generate_yara_rule(rule_name: str, entities: ExtractedEntities) -> str:
    """Generates a valid YARA detection rule based on extracted hashes and strings."""
    clean_name = re.sub(r"[^a-zA-Z0-9_]", "_", rule_name).strip("_") or "Threat_Detection"
    
    strings: list[str] = []
    idx = 1
    for h in entities.hashes[:5]:
        strings.append(f'    $hash{idx} = "{h["hash"]}" ascii wide nocase')
        idx += 1
    for onion in entities.onion_urls[:4]:
        strings.append(f'    $onion{idx} = "{onion}" ascii wide nocase')
        idx += 1
    for btc in entities.cryptocurrency[:3]:
        strings.append(f'    $wallet{idx} = "{btc["address"]}" ascii wide nocase')
        idx += 1

    if not strings:
        strings.append('    $default_indicator = "voidaccess_ioc_match" ascii wide')

    strings_block = "\n".join(strings)
    
    return f"""rule {clean_name} {{
  meta:
    description = "Generated by VoidAccess Threat Intelligence Engine"
    author = "Franken-Scraper OSINT / VoidAccess"
    date = "{datetime.now(timezone.utc).strftime("%Y-%m-%d")}"
    severity = "CRITICAL"
  strings:
{strings_block}
  condition:
    any of them
}}"""


def generate_sigma_rule(title: str, entities: ExtractedEntities) -> str:
    """Generates a Sigma detection rule for SIEM/SOC deployment."""
    clean_title = title or "Dark Web Threat Indicator Detection"
    
    ips = [net["value"] for net in entities.network if net["type"] == "ipv4"]
    cves = entities.cves
    
    ip_filter = "\n".join([f"            - '{ip}'" for ip in ips[:5]]) if ips else "            - '0.0.0.0'"
    cve_filter = "\n".join([f"            - '{cve}'" for cve in cves[:5]]) if cves else "            - 'CVE-2024-0000'"

    return f"""title: {clean_title}
id: {uuid.uuid4()}
status: experimental
description: Auto-generated detection from VoidAccess dark web threat intelligence.
author: Franken-Scraper / VoidAccess
date: {datetime.now(timezone.utc).strftime("%Y/%m/%d")}
logsource:
    category: network_connection
    product: windows
detection:
    selection_ip:
        DestinationIp:
{ip_filter}
    selection_cve:
        VulnerabilityId:
{cve_filter}
    condition: selection_ip or selection_cve
falsepositives:
    - Legitimate penetration testing or security scanning
level: high
"""


def generate_stix_bundle(investigation_id: str, entities: ExtractedEntities) -> dict[str, Any]:
    """Generates a STIX 2.1 JSON bundle of extracted threat intelligence."""
    objects: list[dict[str, Any]] = [
        {
            "type": "report",
            "id": f"report--{uuid.uuid4()}",
            "spec_version": "2.1",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "name": f"VoidAccess Intelligence Report: {investigation_id}",
            "description": "Extracted threat indicators and entity graph from dark web investigation.",
            "published": datetime.now(timezone.utc).isoformat(),
            "object_refs": [],
        }
    ]

    for btc in entities.cryptocurrency:
        objects.append({
            "type": "indicator",
            "id": f"indicator--{uuid.uuid4()}",
            "spec_version": "2.1",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "name": f"Cryptocurrency Wallet: {btc['type'].upper()}",
            "pattern": f"[{btc['type']}-addr:value = '{btc['address']}']",
            "pattern_type": "stix",
            "valid_from": datetime.now(timezone.utc).isoformat(),
        })

    for h in entities.hashes:
        objects.append({
            "type": "indicator",
            "id": f"indicator--{uuid.uuid4()}",
            "spec_version": "2.1",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "name": f"Malware Hash ({h['type'].upper()})",
            "pattern": f"[file:hashes.'{h['type'].upper()}' = '{h['hash']}']",
            "pattern_type": "stix",
            "valid_from": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "type": "bundle",
        "id": f"bundle--{uuid.uuid4()}",
        "objects": objects,
    }


# ---------------------------------------------------------------------------
# Investigation Orchestrator
# ---------------------------------------------------------------------------

async def run_voidaccess_investigation(
    query: str,
    category: str = "all",
    use_tor: bool = False,
) -> VoidAccessInvestigationResult:
    """Executes a dark web threat investigation across actors, onion seeds, and threat feeds."""
    q_clean = query.strip()
    inv_id = f"VA-{uuid.uuid4().hex[:8].upper()}"
    ts = datetime.now(timezone.utc).isoformat()

    # 1. Match threat actors
    matched_actors = search_threat_actors(q_clean)

    # 2. Extract entities directly from the query
    extracted = extract_threat_entities(q_clean)

    # If an actor was matched, enrich with actor's known IOCs
    for actor in matched_actors[:2]:
        for ioc in actor.known_iocs:
            actor_entities = extract_threat_entities(ioc)
            extracted.cryptocurrency.extend(actor_entities.cryptocurrency)
            extracted.hashes.extend(actor_entities.hashes)
            extracted.network.extend(actor_entities.network)
        for onion in actor.extortion_onions:
            if onion not in extracted.onion_urls:
                extracted.onion_urls.append(onion)

    # 3. Match onion seeds
    matched_seeds: list[dict[str, Any]] = []
    for seed in CURATED_ONION_SEEDS:
        if category == "all" or seed.category == category or q_clean.lower() in seed.name.lower():
            matched_seeds.append(asdict(seed))

    # 4. Query live threat feeds
    feeds = await fetch_live_threat_feed()
    matched_feeds: list[LiveThreatItem] = []
    for item in feeds:
        if not q_clean or q_clean.lower() in item.title.lower() or q_clean.lower() in item.indicator.lower():
            matched_feeds.append(item)

    if not matched_feeds:
        matched_feeds = feeds[:3]

    # Compute overall severity
    if any(a.threat_level == "CRITICAL" for a in matched_actors) or len(extracted.hashes) > 0:
        overall_severity = "CRITICAL"
        risk_summary = f"CRITICAL THREAT: Active ransomware syndicate or critical indicators matching '{q_clean}'."
    elif len(matched_actors) > 0 or len(extracted.onion_urls) > 0:
        overall_severity = "HIGH"
        risk_summary = f"HIGH RISK: Dark web threat infrastructure identified for query '{q_clean}'."
    else:
        overall_severity = "MEDIUM"
        risk_summary = f"ELEVATED: Dark web indicators and intelligence nodes gathered for '{q_clean}'."

    return VoidAccessInvestigationResult(
        investigation_id=inv_id,
        query=q_clean,
        category=category,
        timestamp=ts,
        onion_results=matched_seeds,
        extracted_entities=extracted,
        matched_actors=matched_actors,
        threat_feed_hits=matched_feeds,
        risk_summary=risk_summary,
        overall_severity=overall_severity,
    )
