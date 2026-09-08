"""Descoberta de padrão de e-mail corporativo — substitui hunter.io por completo.

Ver vault: Tools - Domain and Org Recon#Descoberta de e-mail corporativo —
substituindo hunter.io. Técnica: permutação de nome + verificação via
handshake SMTP/MX (RCPT TO sem DATA, nunca envia mensagem) + WHOIS + reaproveita
`recon.domain`.

`verify_via_smtp` usa protocolo SMTP puro (`smtplib`, biblioteca padrão do
Python) contra o servidor MX do próprio domínio — não é chamada a nenhum
serviço de terceiro, é o mesmo protocolo que qualquer cliente de e-mail usa.
Muitos servidores hoje mitigam esse handshake (aceitam qualquer RCPT TO pra
não vazar quais contas existem — "catch-all"), então o resultado é
best-effort, não garantido; documentado no retorno via `smtp_accepted`.
"""

import smtplib
import socket
from dataclasses import dataclass

import dns.resolver


@dataclass
class EmailPatternResult:
    email: str
    verified: bool
    method: str  # "smtp_handshake" | "whois_registrant" | "subdomain_staff_page"
    discovered_by: str = "recon.email_pattern"


def generate_permutations(first_name: str, last_name: str, domain: str) -> list[str]:
    first, last = first_name.lower(), last_name.lower()
    return [
        f"{first}.{last}@{domain}",
        f"{first[0]}{last}@{domain}",
        f"{first}{last[0]}@{domain}",
        f"{first}@{domain}",
        f"{first}_{last}@{domain}",
    ]


def _get_mx_host(domain: str) -> str | None:
    try:
        answers = dns.resolver.resolve(domain, "MX")
        best = min(answers, key=lambda r: r.preference)
        return str(best.exchange).rstrip(".")
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.DNSException):
        return None


def verify_via_smtp(email: str, mail_from: str = "verify@netscraper.local", timeout: float = 6.0) -> bool | None:
    """Retorna True (aceito), False (rejeitado), ou None (não deu pra checar —
    ex: domínio catch-all, timeout, ou porta 25 bloqueada pela rede local)."""
    domain = email.split("@", 1)[1]
    mx_host = _get_mx_host(domain)
    if not mx_host:
        return None

    try:
        with smtplib.SMTP(mx_host, 25, timeout=timeout) as smtp:
            smtp.helo("netscraper.local")
            smtp.mail(mail_from)
            code, _ = smtp.rcpt(email)
            return 200 <= code < 300
    except (smtplib.SMTPException, socket.error, TimeoutError):
        return None
