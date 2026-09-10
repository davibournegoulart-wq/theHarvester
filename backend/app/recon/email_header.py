"""Análise forense de cabeçalhos de e-mail puro Python.

Ver vault: Tools - Domain and Org Recon#Análise de cabeçalhos.
Este módulo parseia o caminho de roteamento (Received hops), checa autenticação
(SPF/DKIM/DMARC) e detecta anomalias como spoofing ou clientes suspeitos.
Tudo isso é extraído das strings brutas, usando a biblioteca padrão do Python
(`email` e `re`), sem realizar nenhuma chamada a serviço externo.
"""

import email
import email.message
import re
from dataclasses import dataclass, field
from datetime import datetime
from email.utils import parsedate_to_datetime

@dataclass
class EmailHop:
    ip: str | None
    hostname: str | None
    timestamp: str | None
    protocol: str | None
    delay_seconds: float | None

@dataclass
class AuthResult:
    mechanism: str
    result: str
    details: str | None

@dataclass
class HeaderAnomaly:
    type: str
    description: str
    severity: str

@dataclass
class EmailHeaderAnalysis:
    hops: list[EmailHop]
    auth_results: list[AuthResult]
    anomalies: list[HeaderAnomaly]
    from_address: str | None
    return_path: str | None
    subject: str | None
    message_id: str | None
    date: str | None
    x_mailer: str | None
    discovered_by: str = "recon.email_header"

def analyze_email_headers(raw_headers: str) -> EmailHeaderAnalysis:
    """Parseia cabeçalhos de e-mail a partir de uma string."""
    msg = email.message_from_string(raw_headers)
    return _analyze_message(msg)

def analyze_eml_file(eml_content: bytes) -> EmailHeaderAnalysis:
    """Parseia arquivo .eml a partir de bytes."""
    msg = email.message_from_bytes(eml_content)
    return _analyze_message(msg)

def _analyze_message(msg: email.message.Message) -> EmailHeaderAnalysis:
    hops: list[EmailHop] = []
    auth_results: list[AuthResult] = []
    anomalies: list[HeaderAnomaly] = []
    
    # Received headers parsing
    received_headers = msg.get_all('Received', [])
    # Reverter para que o caminho seja do remetente original (último no cabeçalho)
    # até o destinatário (primeiro no cabeçalho).
    # Na verdade, os Received vêm empilhados de cima para baixo: último hop no topo.
    
    last_dt: datetime | None = None
    
    # Regex para parsing de Received
    ip_pattern = re.compile(r'\[(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]+)\]')
    from_by_pattern = re.compile(r'from\s+([^\s]+)\s+')
    with_pattern = re.compile(r'with\s+([a-zA-Z0-9]+)')
    
    # Parse in original order to calculate delays, but store hops logically
    for header in reversed(received_headers):
        # limpa quebras de linha
        header_clean = ' '.join(header.split())
        
        # IP
        ip_match = ip_pattern.search(header_clean)
        ip = ip_match.group(1) if ip_match else None
        
        # Hostname (after 'from ')
        hostname_match = from_by_pattern.search(header_clean)
        hostname = hostname_match.group(1) if hostname_match else None
        
        # Protocol
        protocol_match = with_pattern.search(header_clean)
        protocol = protocol_match.group(1) if protocol_match else None
        
        # Timestamp
        timestamp_str = None
        delay = None
        current_dt = None
        parts = header_clean.split(';')
        if len(parts) > 1:
            timestamp_str = parts[-1].strip()
            try:
                current_dt = parsedate_to_datetime(timestamp_str)
                timestamp_str = current_dt.isoformat()
            except Exception:
                pass
        
        if current_dt and last_dt:
            delta = (current_dt - last_dt).total_seconds()
            delay = delta if delta >= 0 else None
        
        last_dt = current_dt or last_dt
        
        hops.append(EmailHop(
            ip=ip,
            hostname=hostname,
            timestamp=timestamp_str,
            protocol=protocol,
            delay_seconds=delay
        ))

    # Authentication Results
    auth_headers = msg.get_all('Authentication-Results', [])
    auth_pattern = re.compile(r'([a-zA-Z0-9]+)=([a-zA-Z0-9]+)(.*?)(?:;|$)')
    for auth in auth_headers:
        for match in auth_pattern.findall(' '.join(auth.split())):
            mechanism, result, details = match
            if mechanism.lower() in ('spf', 'dkim', 'dmarc'):
                auth_results.append(AuthResult(
                    mechanism=mechanism.lower(),
                    result=result.lower(),
                    details=details.strip() if details.strip() else None
                ))

    # Basics
    from_address = msg.get('From')
    return_path = msg.get('Return-Path')
    subject = msg.get('Subject')
    message_id = msg.get('Message-ID')
    date = msg.get('Date')
    x_mailer = msg.get('X-Mailer') or msg.get('User-Agent')

    # Anomalies detection
    # 1. Spoofing: Return-Path mismatches From
    def extract_email(addr: str | None) -> str | None:
        if not addr:
            return None
        match = re.search(r'<([^>]+)>', addr)
        return match.group(1).lower() if match else addr.strip().lower()

    from_email = extract_email(from_address)
    rp_email = extract_email(return_path)
    if from_email and rp_email and from_email != rp_email:
        anomalies.append(HeaderAnomaly(
            type="spoofing_indicator",
            description=f"From address ({from_email}) mismatches Return-Path ({rp_email})",
            severity="warning"
        ))

    # 2. X-Mailer suspicions (PHP scripts, unknown agents)
    if x_mailer:
        mailer_lower = x_mailer.lower()
        if 'php' in mailer_lower or 'mass' in mailer_lower:
            anomalies.append(HeaderAnomaly(
                type="suspicious_mailer",
                description=f"Unusual or script-like X-Mailer/User-Agent: {x_mailer}",
                severity="info"
            ))

    return EmailHeaderAnalysis(
        hops=hops,
        auth_results=auth_results,
        anomalies=anomalies,
        from_address=from_address,
        return_path=return_path,
        subject=subject,
        message_id=message_id,
        date=date,
        x_mailer=x_mailer
    )
