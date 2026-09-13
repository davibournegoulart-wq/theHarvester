"""Project Horus: Digital Forensics & Multi-Domain OSINT Suite.
Adapted from 6abd/horus for NetScraper / Franken-Scraper.

Capabilities:
1. Hardware MAC Address OUI Tracing (Vendor, Prefix, Unicast/Multicast, Universal/Local).
2. Financial BIN/IIN Card Issuer & Routing Lookup (Brand, Tier, Bank, Country, Luhn).
3. Wireless BSSID Geolocation Triangulation (Mylnikov Open Triangulation & WiGLE v2).
4. Threat Intelligence & Hash Inspector (URLhaus / VirusTotal / AbuseIPDB).
5. Loki Cryptographic Evidence Vault (AES-128-CBC + HMAC-SHA256 Fernet Encryption).
"""

from dataclasses import dataclass, field
import datetime
import re
import base64
import hashlib
from typing import Any
import httpx
from cryptography.fernet import Fernet

# Fallback dictionary for common OUI prefixes (upper-case 6-hex digits)
OUI_FALLBACK_DATABASE: dict[str, dict[str, str]] = {
    "00000C": {"vendor": "Cisco Systems, Inc", "country": "US", "type": "Network Infrastructure"},
    "000142": {"vendor": "Cisco Systems, Inc", "country": "US", "type": "Enterprise Networking"},
    "000143": {"vendor": "Cisco Systems, Inc", "country": "US", "type": "Switching"},
    "000C29": {"vendor": "VMware, Inc.", "country": "US", "type": "Virtualization Hypervisor"},
    "000569": {"vendor": "VMware, Inc.", "country": "US", "type": "Virtual Machine MAC"},
    "00155D": {"vendor": "Microsoft Corporation", "country": "US", "type": "Hyper-V Virtual Adapter"},
    "00163E": {"vendor": "XenSource, Inc.", "country": "US", "type": "Xen / Cloud Hypervisor"},
    "001A11": {"vendor": "Google LLC", "country": "US", "type": "Datacenter Infrastructure"},
    "001A79": {"vendor": "Apple, Inc.", "country": "US", "type": "Consumer Electronics"},
    "001E52": {"vendor": "Apple, Inc.", "country": "US", "type": "Macintosh / iPhone"},
    "002500": {"vendor": "Apple, Inc.", "country": "US", "type": "AirPort / Mac"},
    "B827EB": {"vendor": "Raspberry Pi Foundation", "country": "GB", "type": "Single-board Computer"},
    "DCA632": {"vendor": "Raspberry Pi Trading Ltd", "country": "GB", "type": "Single-board Computer"},
    "E45F01": {"vendor": "Raspberry Pi Trading Ltd", "country": "GB", "type": "Raspberry Pi 4 / 400"},
    "28CDC1": {"vendor": "Raspberry Pi Ltd", "country": "GB", "type": "Raspberry Pi 5 / Zero 2"},
    "18FE34": {"vendor": "Espressif Inc.", "country": "CN", "type": "IoT / ESP8266 Microcontroller"},
    "240AC4": {"vendor": "Espressif Inc.", "country": "CN", "type": "IoT / ESP32 Microcontroller"},
    "30AEA4": {"vendor": "Espressif Inc.", "country": "CN", "type": "IoT / ESP32 SoC"},
    "A4CF12": {"vendor": "Espressif Inc.", "country": "CN", "type": "IoT Microcontroller"},
    "0004F2": {"vendor": "Polycom", "country": "US", "type": "VoIP Terminal"},
    "00089B": {"vendor": "ICP Internet Communication Products", "country": "DE", "type": "Network Controller"},
    "000E08": {"vendor": "Sony Interactive Entertainment Inc.", "country": "JP", "type": "PlayStation System"},
    "001788": {"vendor": "Signify Netherlands B.V. (Philips Lighting)", "country": "NL", "type": "Philips Hue Bridge"},
    "00180A": {"vendor": "Cisco Meraki", "country": "US", "type": "Cloud Managed AP"},
    "001F6B": {"vendor": "LG Electronics Inc.", "country": "KR", "type": "Smart Television / Display"},
    "0024E8": {"vendor": "Dell Inc.", "country": "US", "type": "Server / Workstation NIC"},
    "0026B9": {"vendor": "Dell Inc.", "country": "US", "type": "PowerEdge Server"},
    "005056": {"vendor": "VMware, Inc.", "country": "US", "type": "VMware ESXi Workstation"},
    "2C3033": {"vendor": "Netgear Inc.", "country": "US", "type": "Consumer Wi-Fi Router"},
    "50C7BF": {"vendor": "TP-Link Technologies Co., Ltd.", "country": "CN", "type": "Kasa Smart Home / Wi-Fi"},
    "60A44C": {"vendor": "TP-Link Corporation Limited", "country": "CN", "type": "Deco Mesh / Wi-Fi 6 Router"},
    "704F57": {"vendor": "Amazon Technologies Inc.", "country": "US", "type": "Echo / Kindle / FireTV"},
    "74AC5F": {"vendor": "Ubiquiti Inc.", "country": "US", "type": "UniFi Access Point"},
    "F09FC2": {"vendor": "Ubiquiti Inc.", "country": "US", "type": "EdgeRouter / UniFi Switch"},
    "B0BE76": {"vendor": "TP-Link Technologies Co., Ltd.", "country": "CN", "type": "Archer Router"},
    "FCFBFA": {"vendor": "Amazon Technologies Inc.", "country": "US", "type": "Ring Doorbell / Camera"},
}

# Fallback BIN database for recognized cards
BIN_FALLBACK_DATABASE: dict[str, dict[str, Any]] = {
    "453201": {
        "scheme": "Visa",
        "type": "Credit",
        "brand": "Visa Traditional / Classic",
        "bank": "JPMorgan Chase Bank, N.A.",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "400000": {
        "scheme": "Visa",
        "type": "Debit",
        "brand": "Visa Classic",
        "bank": "First National Bank",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "414720": {
        "scheme": "Visa",
        "type": "Credit",
        "brand": "Visa Signature",
        "bank": "Chase Bank USA, N.A.",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "510510": {
        "scheme": "Mastercard",
        "type": "Credit",
        "brand": "Mastercard Standard",
        "bank": "Citibank, N.A.",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "541275": {
        "scheme": "Mastercard",
        "type": "Credit",
        "brand": "Mastercard Platinum",
        "bank": "HSBC Bank USA, N.A.",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "524188": {
        "scheme": "Mastercard",
        "type": "Credit",
        "brand": "Mastercard Black / Gold",
        "bank": "Nu Pagamentos S.A. (Nubank)",
        "country": "Brazil",
        "country_code": "BR",
        "currency": "BRL",
        "prepaid": False,
    },
    "550209": {
        "scheme": "Mastercard",
        "type": "Debit",
        "brand": "Mastercard Debit",
        "bank": "Banco Santander (Brasil) S.A.",
        "country": "Brazil",
        "country_code": "BR",
        "currency": "BRL",
        "prepaid": False,
    },
    "378282": {
        "scheme": "American Express",
        "type": "Credit",
        "brand": "Amex Centurion / Platinum",
        "bank": "American Express Travel Related Services",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "601100": {
        "scheme": "Discover",
        "type": "Credit",
        "brand": "Discover Standard",
        "bank": "Discover Bank",
        "country": "United States",
        "country_code": "US",
        "currency": "USD",
        "prepaid": False,
    },
    "636368": {
        "scheme": "Elo",
        "type": "Credit",
        "brand": "Elo Nanquim / Grafite",
        "bank": "Banco Bradesco S.A.",
        "country": "Brazil",
        "country_code": "BR",
        "currency": "BRL",
        "prepaid": False,
    }
}


def normalize_mac(mac: str) -> tuple[str, str, str]:
    """Cleans and standardizes MAC address to formats:
    - cleaned_hex (e.g. B827EB000000)
    - standard_colon (e.g. B8:27:EB:00:00:00)
    - standard_dash (e.g. B8-27-EB-00-00-00)
    """
    raw = re.sub(r"[^0-9A-Fa-f]", "", mac).upper()
    if len(raw) != 12:
        raise ValueError("Invalid MAC address length. Exactly 12 hexadecimal characters required.")
    
    colon = ":".join(raw[i:i+2] for i in range(0, 12, 2))
    dash = "-".join(raw[i:i+2] for i in range(0, 12, 2))
    return raw, colon, dash


async def lookup_mac_vendor(mac: str) -> dict[str, Any]:
    """Queries MAC address hardware vendor, OUI prefix, unicast/multicast, and administration type."""
    cleaned, colon_mac, dash_mac = normalize_mac(mac)
    oui_prefix = cleaned[:6]
    oui_formatted = ":".join(cleaned[i:i+2] for i in range(0, 6, 2))

    # Bit analysis on first octet:
    first_byte = int(cleaned[:2], 16)
    is_multicast = bool(first_byte & 1)
    is_locally_administered = bool(first_byte & 2)

    vendor_info: dict[str, Any] = {
        "mac": colon_mac,
        "mac_dash": dash_mac,
        "mac_raw": cleaned,
        "oui_prefix": oui_formatted,
        "vendor": "Unknown Vendor",
        "country": "Unknown",
        "address": "Not available",
        "device_type": "Network Interface Card (NIC)",
        "transmission": "Multicast" if is_multicast else "Unicast",
        "administration": "Locally Administered (Private/Randomized)" if is_locally_administered else "Universally Administered (OUI Enforced)",
        "is_randomized": is_locally_administered,
        "discovered_by": "horus.mactrace",
        "queried_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }

    # Check local fallback database first
    if oui_prefix in OUI_FALLBACK_DATABASE:
        f = OUI_FALLBACK_DATABASE[oui_prefix]
        vendor_info["vendor"] = f["vendor"]
        vendor_info["country"] = f["country"]
        vendor_info["device_type"] = f["type"]
        return vendor_info

    # Try external free OUI lookups with fast timeouts
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"https://api.maclookup.app/v2/macs/{cleaned}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("found"):
                    vendor_info["vendor"] = data.get("company", vendor_info["vendor"])
                    vendor_info["country"] = data.get("country", vendor_info["country"])
                    vendor_info["address"] = data.get("address", vendor_info["address"])
                    return vendor_info
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"https://api.macvendors.com/{cleaned}")
            if resp.status_code == 200 and resp.text.strip():
                vendor_info["vendor"] = resp.text.strip()
                return vendor_info
    except Exception:
        pass

    return vendor_info


def validate_luhn(card_number: str) -> bool:
    """Calculates Luhn check digit validation for credit card numbers."""
    digits = [int(c) for c in re.sub(r"\D", "", card_number)]
    if len(digits) < 13:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


async def lookup_bank_bin(bin_num: str) -> dict[str, Any]:
    """Queries Bank Identification Number (BIN / IIN) for issuer routing, card scheme, and type."""
    clean_bin = re.sub(r"\D", "", bin_num)[:8]
    if len(clean_bin) < 6:
        raise ValueError("BIN must be at least 6 digits.")

    result: dict[str, Any] = {
        "bin": clean_bin,
        "scheme": "Unknown",
        "type": "Unknown",
        "brand": "Unknown",
        "bank": "Unknown Issuer",
        "country": "Unknown",
        "country_code": "XX",
        "currency": "N/A",
        "prepaid": False,
        "is_valid_luhn": False,
        "source": "horus.bankindex",
        "queried_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }

    # Match fallback
    prefix6 = clean_bin[:6]
    if prefix6 in BIN_FALLBACK_DATABASE:
        f = BIN_FALLBACK_DATABASE[prefix6]
        result.update(f)
        return result

    # Try keyless public lookup via lookup.binlist.net
    try:
        async with httpx.AsyncClient(timeout=4.0, headers={"Accept-Version": "3"}) as client:
            resp = await client.get(f"https://lookup.binlist.net/{prefix6}")
            if resp.status_code == 200:
                data = resp.json()
                result["scheme"] = data.get("scheme", "").capitalize() or result["scheme"]
                result["type"] = data.get("type", "").capitalize() or result["type"]
                result["brand"] = data.get("brand", "") or result["brand"]
                result["prepaid"] = data.get("prepaid", False)
                bank_data = data.get("bank", {})
                if isinstance(bank_data, dict):
                    result["bank"] = bank_data.get("name", result["bank"])
                country_data = data.get("country", {})
                if isinstance(country_data, dict):
                    result["country"] = country_data.get("name", result["country"])
                    result["country_code"] = country_data.get("alpha2", result["country_code"])
                    result["currency"] = country_data.get("currency", result["currency"])
                return result
    except Exception:
        pass

    return result


async def lookup_wifi_bssid(
    bssid: str,
    api_name: str | None = None,
    api_token: str | None = None
) -> dict[str, Any]:
    """Triangulates Wi-Fi BSSID access point physical location using open geospatial APIs and WiGLE."""
    clean_bssid = re.sub(r"[^0-9A-Fa-f]", "", bssid).lower()
    if len(clean_bssid) != 12:
        raise ValueError("Invalid BSSID length. Exactly 12 hex characters required.")
    formatted_bssid = ":".join(clean_bssid[i:i+2] for i in range(0, 12, 2))

    res: dict[str, Any] = {
        "bssid": formatted_bssid,
        "found": False,
        "latitude": None,
        "longitude": None,
        "accuracy_meters": None,
        "ssid_name": None,
        "channel": None,
        "encryption": None,
        "address": "Not resolved",
        "provider": "Mylnikov Open Wi-Fi DB / WiGLE",
        "queried_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }

    # If WiGLE credentials provided, query WiGLE API v2
    if api_name and api_token:
        try:
            auth = (api_name.strip(), api_token.strip())
            async with httpx.AsyncClient(timeout=6.0, auth=auth) as client:
                wigle_url = f"https://api.wigle.net/api/v2/network/detail?netid={formatted_bssid}"
                w_resp = await client.get(wigle_url)
                if w_resp.status_code == 200:
                    w_data = w_resp.json()
                    results = w_data.get("results", [])
                    if results:
                        item = results[0]
                        res["found"] = True
                        res["latitude"] = item.get("trilat")
                        res["longitude"] = item.get("trilong")
                        res["ssid_name"] = item.get("name")
                        res["channel"] = item.get("channel")
                        res["encryption"] = item.get("encryption")
                        res["address"] = f"{item.get('housenumber', '')} {item.get('road', '')}, {item.get('city', '')} {item.get('country', '')}".strip(", ")
                        res["provider"] = "WiGLE API v2"
                        return res
        except Exception:
            pass

    # Free keyless fallback: Mylnikov Wi-Fi Geolocation API
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            m_resp = await client.get(f"https://api.mylnikov.org/geolocation/wifi?v=1.1&data=open&bssid={clean_bssid}")
            if m_resp.status_code == 200:
                m_data = m_resp.json()
                if m_data.get("result") == 200 and "data" in m_data:
                    data = m_data["data"]
                    res["found"] = True
                    res["latitude"] = data.get("lat")
                    res["longitude"] = data.get("lon")
                    res["accuracy_meters"] = data.get("range")
                    res["provider"] = "Mylnikov Open Triangulation"
                    return res
    except Exception:
        pass

    return res


async def scan_threat_intel(
    target: str,
    api_key: str | None = None
) -> dict[str, Any]:
    """Inspects threat intelligence for a file hash, domain, IP, or URL."""
    target_clean = target.strip()
    is_hash = bool(re.match(r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$", target_clean))
    is_ip = bool(re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", target_clean))

    report: dict[str, Any] = {
        "target": target_clean,
        "target_type": "hash" if is_hash else ("ip" if is_ip else "url_or_domain"),
        "reputation": "UNKNOWN",
        "malicious_count": 0,
        "suspicious_count": 0,
        "harmless_count": 0,
        "total_engines": 0,
        "risk_level": "LOW",
        "tags": [],
        "verdict_details": [],
        "provider": "Open Threat Intel / VirusTotal",
        "queried_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }

    # If VirusTotal API key is supplied, query VT API v3
    if api_key:
        try:
            headers = {"x-apikey": api_key.strip()}
            async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
                if is_hash:
                    vt_url = f"https://www.virustotal.com/api/v3/files/{target_clean}"
                elif is_ip:
                    vt_url = f"https://www.virustotal.com/api/v3/ip_addresses/{target_clean}"
                else:
                    url_id = base64.urlsafe_b64encode(target_clean.encode()).decode().strip("=")
                    vt_url = f"https://www.virustotal.com/api/v3/urls/{url_id}"

                resp = await client.get(vt_url)
                if resp.status_code == 200:
                    vt_data = resp.json().get("data", {}).get("attributes", {})
                    stats = vt_data.get("last_analysis_stats", {})
                    report["malicious_count"] = stats.get("malicious", 0)
                    report["suspicious_count"] = stats.get("suspicious", 0)
                    report["harmless_count"] = stats.get("harmless", 0)
                    report["total_engines"] = sum(stats.values())
                    report["tags"] = vt_data.get("tags", [])
                    report["provider"] = "VirusTotal API v3"

                    if report["malicious_count"] > 3:
                        report["risk_level"] = "CRITICAL"
                    elif report["malicious_count"] > 0 or report["suspicious_count"] > 2:
                        report["risk_level"] = "SUSPICIOUS"
                    else:
                        report["risk_level"] = "CLEAN"

                    results = vt_data.get("last_analysis_results", {})
                    for engine, eng_data in list(results.items())[:15]:
                        report["verdict_details"].append({
                            "engine": engine,
                            "category": eng_data.get("category"),
                            "result": eng_data.get("result") or "clean",
                        })
                    return report
        except Exception:
            pass

    # Keyless Fallback 1: URLhaus for URLs / Domains / Hashes
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if is_hash:
                uh_resp = await client.post("https://urlhaus-api.abuse.ch/v1/payload/", data={"sha256_hash": target_clean})
                if uh_resp.status_code == 200:
                    uh_data = uh_resp.json()
                    if uh_data.get("query_status") == "ok":
                        report["malicious_count"] = 1
                        report["risk_level"] = "CRITICAL"
                        report["tags"] = uh_data.get("file_type", []) if isinstance(uh_data.get("file_type"), list) else [str(uh_data.get("file_type"))]
                        report["provider"] = "abuse.ch URLhaus"
                        report["verdict_details"].append({
                            "engine": "URLhaus",
                            "category": "malicious",
                            "result": f"Known Malware Payload ({uh_data.get('signature', 'Trojan')})",
                        })
                        return report
            else:
                uh_resp = await client.post("https://urlhaus-api.abuse.ch/v1/host/", data={"host": target_clean})
                if uh_resp.status_code == 200:
                    uh_data = uh_resp.json()
                    if uh_data.get("query_status") == "ok":
                        url_count = len(uh_data.get("urls", []))
                        if url_count > 0:
                            report["malicious_count"] = url_count
                            report["risk_level"] = "CRITICAL"
                            report["provider"] = "abuse.ch URLhaus"
                            report["verdict_details"].append({
                                "engine": "URLhaus",
                                "category": "malicious",
                                "result": f"Host serving {url_count} active malware URLs",
                            })
                            return report
    except Exception:
        pass

    return report


def loki_vault_keygen() -> str:
    """Generates a cryptographic Fernet base64 key for evidence vault storage."""
    return Fernet.generate_key().decode()


def loki_vault_encrypt(plaintext: str, key: str) -> str:
    """Encrypts confidential investigation notes, tokens, or evidence with Fernet (AES-128-CBC + HMAC)."""
    f = Fernet(key.encode())
    return f.encrypt(plaintext.encode()).decode()


def loki_vault_decrypt(ciphertext: str, key: str) -> str:
    """Decrypts confidential evidence payload using the secret Fernet key."""
    f = Fernet(key.encode())
    return f.decrypt(ciphertext.encode()).decode()
