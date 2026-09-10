"""Módulo de scraping profundo para extrair inteligência (entidades) de textos crus e URLs.

Usa expressões regulares e a biblioteca phonenumbers para minerar 
e-mails, números de telefone, carteiras de criptomoedas e documentos (CPF/CNPJ).
Útil para colar "Dumps" ou investigar um thread de fórum inteiro.
"""

import re
import httpx
from bs4 import BeautifulSoup
import phonenumbers
from pydantic import BaseModel

# Regexes
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
BTC_RE = re.compile(r'\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})\b')
ETH_RE = re.compile(r'\b(0x[a-fA-F0-9]{40})\b')
CPF_RE = re.compile(r'\b(?:\d{3}\.){2}\d{3}-\d{2}\b|\b\d{11}\b')

class ScrapedEntities(BaseModel):
    emails: list[str]
    phones: list[str]
    btc_addresses: list[str]
    eth_addresses: list[str]
    cpfs: list[str]
    secrets: list[dict] = []

def extract_entities(text: str) -> ScrapedEntities:
    """Extrai todas as entidades de um texto bruto, incluindo segredos e credenciais."""
    # Emails
    emails = list(set(EMAIL_RE.findall(text)))
    
    # Phones
    phones = []
    try:
        # Busca números pelo texto, assumindo BR como fallback, mas lendo DDI
        for match in phonenumbers.PhoneNumberMatcher(text, "BR"):
            formatted = phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
            phones.append(formatted)
    except Exception:
        pass
    phones = list(set(phones))
    
    # Crypto
    btc = list(set(BTC_RE.findall(text)))
    eth = list(set(ETH_RE.findall(text)))
    
    # CPFs
    cpfs = list(set(CPF_RE.findall(text)))

    # Secrets (Gitleaks / TruffleHog rules)
    from app.recon.secret_scanner import scan_text_for_secrets
    secrets = scan_text_for_secrets(text)
    
    return ScrapedEntities(
        emails=emails,
        phones=phones,
        btc_addresses=btc,
        eth_addresses=eth,
        cpfs=cpfs,
        secrets=secrets,
    )

async def scrape_url(url: str, use_tor: bool = False) -> ScrapedEntities:
    """Baixa o HTML de uma URL (limpando scripts) e extrai inteligência."""
    from app.config import settings
    
    proxies = None
    if use_tor:
        proxies = settings.tor_proxy_url
        
    async with httpx.AsyncClient(proxies=proxies, follow_redirects=True) as client:
        response = await client.get(url, timeout=15.0, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        # Remove scripts e styles para não quebrar os regexes com código fonte
        for script in soup(["script", "style"]):
            script.extract()
            
        text = soup.get_text(separator=' ')
        
    return extract_entities(text)
