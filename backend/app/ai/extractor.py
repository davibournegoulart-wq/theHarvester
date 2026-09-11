import re
import logging
import httpx
from typing import Any
from app.config import settings

logger = logging.getLogger("net_scraper.ai")

BTC_REGEX = re.compile(r"\b(bc1[a-z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b", re.IGNORECASE)
ETH_REGEX = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")
XMR_REGEX = re.compile(r"\b(4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}|8[0-9AB][1-9A-HJ-NP-Za-km-z]{93})\b")
ONION_REGEX = re.compile(r"\b([a-z2-7]{16}|[a-z2-7]{56})\.onion\b", re.IGNORECASE)
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b")
TELEGRAM_REGEX = re.compile(r"(?:https?:\/\/t\.me\/|@)([a-zA-Z0-9_]{5,32})\b")
PGP_REGEX = re.compile(r"-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----")
IPV4_REGEX = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
GEO_REGEX = re.compile(r"([-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)),\s*([-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?))\b")


async def get_ollama_status() -> dict[str, Any]:
    """Test connection to local Ollama server and list available models."""
    url = f"{settings.ollama_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {
                    "online": True,
                    "endpoint": settings.ollama_url,
                    "models": models,
                    "active_model": settings.ollama_model,
                }
    except Exception as e:
        logger.debug(f"Ollama offline or unreachable at {url}: {e}")
    return {
        "online": False,
        "endpoint": settings.ollama_url,
        "models": [],
        "active_model": None,
        "mode": "heuristic_fallback",
    }


def extract_entities_heuristics(text: str) -> dict[str, list[str]]:
    """High-precision offline regex/pattern extractor for technical and forensic entities."""
    btc = list(set(BTC_REGEX.findall(text)))
    eth = list(set(ETH_REGEX.findall(text)))
    xmr = list(set(XMR_REGEX.findall(text)))
    onions = list(set([m if isinstance(m, str) else m[0] for m in ONION_REGEX.findall(text)]))
    # Full onion reconstruction
    raw_onions = list(set(re.findall(r"\b[a-z2-7]{16,56}\.onion\b", text, re.IGNORECASE)))
    emails = list(set(EMAIL_REGEX.findall(text)))
    telegrams = list(set(TELEGRAM_REGEX.findall(text)))
    pgp = ["PGP Public Key Block Detected" for _ in PGP_REGEX.findall(text)]
    
    # Filter private IPs
    raw_ips = list(set(IPV4_REGEX.findall(text)))
    ips = [ip for ip in raw_ips if not (ip.startswith("127.") or ip.startswith("0.") or ip.startswith("255."))]
    
    geo_matches = GEO_REGEX.findall(text)
    coordinates = [f"{lat},{lon}" for lat, lon in geo_matches]

    return {
        "bitcoin_addresses": btc,
        "ethereum_addresses": eth,
        "monero_addresses": xmr,
        "onion_links": raw_onions or onions,
        "emails": emails,
        "telegram_handles": telegrams,
        "ip_addresses": ips,
        "pgp_keys": pgp,
        "coordinates": coordinates,
    }


async def run_ollama_completion(prompt: str, system_prompt: str = "") -> str | None:
    """Query local Ollama instance for text generation / synthesis."""
    url = f"{settings.ollama_url.rstrip('/')}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "system": system_prompt or "You are an expert digital forensics and OSINT intelligence analyst.",
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response", "")
    except Exception as e:
        logger.warning(f"Ollama generation failed: {e}")
    return None


async def analyze_and_synthesize_dossier(dossier_text: str, case_name: str) -> dict[str, Any]:
    """Synthesizes case findings into an executive intelligence brief and extracts all entities."""
    # First extract all forensic entities via heuristic engine
    entities = extract_entities_heuristics(dossier_text)

    # Attempt Ollama local AI synthesis if available
    status = await get_ollama_status()
    ai_summary = None
    if status.get("online"):
        prompt = (
            f"Analyze the following OSINT investigation dossier for case '{case_name}'.\n\n"
            f"Dossier Data:\n{dossier_text[:4000]}\n\n"
            f"Please produce a concise, structured intelligence assessment in Markdown:\n"
            f"1. Executive Summary & Core Threat Profile\n"
            f"2. Key Identified Targets & Alias Linkages\n"
            f"3. High-Priority Investigative Leads & Next Steps\n"
        )
        ai_summary = await run_ollama_completion(prompt)

    # If Ollama is offline, generate structured forensic synthesis deterministically
    if not ai_summary:
        ai_summary = (
            f"### Forensic Intelligence Synthesis — Case: {case_name}\n\n"
            f"**Engine Status**: Local Heuristic Extractor (Offline / Air-Gapped Mode)\n\n"
            f"- **Crypto Artifacts Discovered**: {len(entities['bitcoin_addresses']) + len(entities['ethereum_addresses']) + len(entities['monero_addresses'])} wallet(s)\n"
            f"- **Dark Web Identifiers**: {len(entities['onion_links'])} `.onion` service(s)\n"
            f"- **Communication Channels**: {len(entities['emails'])} email(s), {len(entities['telegram_handles'])} Telegram handle(s)\n"
            f"- **Network & Infrastructure**: {len(entities['ip_addresses'])} public IP address(es)\n"
            f"- **Geolocation Pins**: {len(entities['coordinates'])} coordinate pair(s)\n\n"
            f"*To enable deep contextual LLM reasoning, ensure Ollama is running locally with `ollama run llama3` on port 11434.*"
        )

    return {
        "case_name": case_name,
        "ai_engine_used": "ollama" if (status.get("online") and ai_summary) else "heuristic_engine",
        "model": status.get("active_model") or "built-in-heuristics",
        "summary": ai_summary,
        "entities": entities,
        "total_entities_found": sum(len(v) for v in entities.values()),
    }
