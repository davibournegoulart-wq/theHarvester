"""Auditoria de segurança de e-mail de domínio.

Ver vault: Tools - Domain and Org Recon#Auditoria DNS para e-mail.
Busca e analisa os registros de infraestrutura e segurança de correio eletrônico:
MX, SPF, DMARC, DKIM e BIMI via consultas DNS (usando dnspython).
Não utiliza API de terceiros; realiza a resolução DNS diretamente, extraindo
e avaliando a robustez dos controles de anti-spoofing/autenticação de domínio.
"""

import asyncio
from dataclasses import dataclass
import re
import dns.resolver
import dns.rdtypes.ANY.MX  # submódulo não vem carregado só com `import dns.resolver` — precisa import explícito pro type hint abaixo não quebrar com AttributeError

@dataclass
class MXRecord:
    priority: int
    host: str
    provider: str | None

@dataclass
class SPFResult:
    raw: str
    mechanisms: list[str]
    qualifier: str
    permissive: bool
    discovered_by: str = "recon.email_security.dns_spf"

@dataclass
class DMARCResult:
    raw: str
    policy: str
    rua: list[str]
    ruf: list[str]
    pct: int
    adkim: str | None
    aspf: str | None
    discovered_by: str = "recon.email_security.dns_dmarc"

@dataclass
class DKIMResult:
    selector: str
    found: bool
    raw: str | None
    discovered_by: str = "recon.email_security.dns_dkim"

@dataclass
class BIMIResult:
    found: bool
    raw: str | None
    discovered_by: str = "recon.email_security.dns_bimi"

@dataclass
class EmailSecurityAudit:
    domain: str
    mx_records: list[MXRecord]
    spf: SPFResult | None
    dmarc: DMARCResult | None
    dkim_results: list[DKIMResult]
    bimi: BIMIResult | None
    risk_summary: str
    discovered_by: str = "recon.email_security"

KNOWN_PROVIDERS = {
    "google.com": "Google Workspace",
    "outlook.com": "Microsoft 365",
    "protonmail.ch": "ProtonMail",
    "zoho.com": "Zoho Mail",
    "zohomail.com": "Zoho Mail"
}

async def audit_email_security(domain: str) -> EmailSecurityAudit:
    """Realiza uma auditoria completa de segurança de e-mail consultando DNS."""
    # Wrap sync DNS resolution in an executor to avoid blocking the event loop
    loop = asyncio.get_running_loop()
    
    # Resolvers
    def resolve_txt(target: str) -> list[str]:
        try:
            answers = dns.resolver.resolve(target, "TXT")
            return [b"".join(rdata.strings).decode("utf-8") for rdata in answers]
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.DNSException):
            return []

    def resolve_mx(target: str) -> list[dns.rdtypes.ANY.MX.MX]:
        try:
            answers = dns.resolver.resolve(target, "MX")
            return list(answers)
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.DNSException):
            return []

    # MX Records
    mx_records_raw = await loop.run_in_executor(None, resolve_mx, domain)
    mx_records = []
    for mx in mx_records_raw:
        host = str(mx.exchange).rstrip('.')
        provider = None
        for key, value in KNOWN_PROVIDERS.items():
            if host.endswith(key):
                provider = value
                break
        mx_records.append(MXRecord(priority=mx.preference, host=host, provider=provider))

    # SPF Record
    txt_records = await loop.run_in_executor(None, resolve_txt, domain)
    spf_record = None
    spf_result = None
    for txt in txt_records:
        if txt.startswith("v=spf1"):
            spf_record = txt
            break
            
    if spf_record:
        parts = spf_record.split()
        mechanisms = [p for p in parts[1:] if not p.endswith("all")]
        qualifier = "~"
        permissive = False
        
        all_mech = next((p for p in parts if p.endswith("all")), None)
        if all_mech:
            qualifier = all_mech[0] if all_mech[0] in "-~+?" else ""
            if qualifier in ("+", "?"):
                permissive = True
                
        spf_result = SPFResult(
            raw=spf_record,
            mechanisms=mechanisms,
            qualifier=qualifier,
            permissive=permissive
        )

    # DMARC Record
    dmarc_records = await loop.run_in_executor(None, resolve_txt, f"_dmarc.{domain}")
    dmarc_result = None
    for txt in dmarc_records:
        if txt.startswith("v=DMARC1"):
            policy = "none"
            rua, ruf = [], []
            pct = 100
            adkim, aspf = None, None
            
            for part in txt.split(";"):
                part = part.strip()
                if part.startswith("p="):
                    policy = part[2:]
                elif part.startswith("rua="):
                    rua = part[4:].split(",")
                elif part.startswith("ruf="):
                    ruf = part[4:].split(",")
                elif part.startswith("pct="):
                    try:
                        pct = int(part[4:])
                    except ValueError:
                        pass
                elif part.startswith("adkim="):
                    adkim = part[6:]
                elif part.startswith("aspf="):
                    aspf = part[5:]
                    
            dmarc_result = DMARCResult(
                raw=txt,
                policy=policy,
                rua=rua,
                ruf=ruf,
                pct=pct,
                adkim=adkim,
                aspf=aspf
            )
            break

    # DKIM Records
    common_selectors = ["default", "google", "s1", "s2", "k1", "selector1", "selector2", "dkim", "mail"]
    dkim_results = []
    for selector in common_selectors:
        dkim_txt = await loop.run_in_executor(None, resolve_txt, f"{selector}._domainkey.{domain}")
        found = False
        raw = None
        for txt in dkim_txt:
            if txt.startswith("v=DKIM1") or "p=" in txt:
                found = True
                raw = txt
                break
        dkim_results.append(DKIMResult(selector=selector, found=found, raw=raw))

    # BIMI Record
    bimi_records = await loop.run_in_executor(None, resolve_txt, f"default._bimi.{domain}")
    bimi_result = None
    for txt in bimi_records:
        if txt.startswith("v=BIMI1"):
            bimi_result = BIMIResult(found=True, raw=txt)
            break
    if not bimi_result:
        bimi_result = BIMIResult(found=False, raw=None)

    # Risk Summary
    risks = []
    if not spf_result:
        risks.append("No SPF record found.")
    elif spf_result.permissive:
        risks.append(f"Permissive SPF record (qualifier: {spf_result.qualifier}all).")
        
    if not dmarc_result:
        risks.append("No DMARC record found.")
    elif dmarc_result.policy == "none":
        risks.append("DMARC policy is 'none' (monitoring only).")
        
    if not any(dkim.found for dkim in dkim_results):
        risks.append("No DKIM keys found using common selectors.")
        
    risk_summary = "High Risk: " + "; ".join(risks) if risks else "Low Risk: Strong email security configuration."

    return EmailSecurityAudit(
        domain=domain,
        mx_records=mx_records,
        spf=spf_result,
        dmarc=dmarc_result,
        dkim_results=dkim_results,
        bimi=bimi_result,
        risk_summary=risk_summary
    )
