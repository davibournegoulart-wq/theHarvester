"""Análise de certificado TLS de um host remoto.

Conecta ao host na porta 443 (ou porta customizada), extrai o certificado
X.509 apresentado pelo servidor e parseia seus campos. Tudo via stdlib do
Python (`ssl`, `socket`) + `cryptography` (pra parsing detalhado do DER).
Nenhum serviço externo — conexão direta ao host alvo.

Consolida a técnica de tlsx/Qualys SSL Labs: inspeção de certificado,
validade, SANs, cadeia de confiança, detecção de Let's Encrypt / self-signed.
"""

import asyncio
import socket
import ssl
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import partial

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519, ed448

from app.config import settings


@dataclass
class CertificateInfo:
    subject_cn: str | None
    sans: list[str]
    issuer_cn: str | None
    issuer_org: str | None
    serial_number: str
    not_before: str
    not_after: str
    days_until_expiry: int
    key_size: int | None
    signature_algorithm: str | None
    is_self_signed: bool
    is_expired: bool
    is_wildcard: bool
    is_lets_encrypt: bool
    chain: list[str] = field(default_factory=list)
    discovered_by: str = "recon.tls_cert"


def _get_cn(name: x509.Name) -> str | None:
    """Extrai o Common Name (CN) de um x509.Name."""
    try:
        attrs = name.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)
        return attrs[0].value if attrs else None
    except Exception:
        return None


def _get_org(name: x509.Name) -> str | None:
    """Extrai a Organization (O) de um x509.Name."""
    try:
        attrs = name.get_attributes_for_oid(x509.oid.NameOID.ORGANIZATION_NAME)
        return attrs[0].value if attrs else None
    except Exception:
        return None


def _get_key_size(cert: x509.Certificate) -> int | None:
    """Tamanho da chave pública em bits."""
    try:
        pub = cert.public_key()
        if isinstance(pub, rsa.RSAPublicKey):
            return pub.key_size
        if isinstance(pub, ec.EllipticCurvePublicKey):
            return pub.key_size
        if isinstance(pub, (ed25519.Ed25519PublicKey, ed448.Ed448PublicKey)):
            return 256 if isinstance(pub, ed25519.Ed25519PublicKey) else 448
        return None
    except Exception:
        return None


def _fetch_cert_sync(host: str, port: int) -> bytes:
    """Conecta ao host e retorna o certificado DER. Operação bloqueante."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # aceita self-signed pra análise

    with socket.create_connection((host, port), timeout=settings.request_timeout_seconds) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls_sock:
            der_cert = tls_sock.getpeercert(binary_form=True)
            if der_cert is None:
                raise ConnectionError(f"Nenhum certificado retornado por {host}:{port}")
            return der_cert


async def analyze_tls_certificate(host: str, port: int = 443) -> CertificateInfo:
    """Conecta ao host, extrai e analisa o certificado TLS apresentado."""
    loop = asyncio.get_event_loop()
    der_cert = await loop.run_in_executor(None, partial(_fetch_cert_sync, host, port))

    cert = x509.load_der_x509_certificate(der_cert)

    # Subject e Issuer
    subject_cn = _get_cn(cert.subject)
    issuer_cn = _get_cn(cert.issuer)
    issuer_org = _get_org(cert.issuer)

    # SANs (Subject Alternative Names)
    sans: list[str] = []
    try:
        san_ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
        sans = san_ext.value.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound:
        pass

    # Validade
    now = datetime.now(timezone.utc)
    not_before = cert.not_valid_before_utc
    not_after = cert.not_valid_after_utc
    days_until_expiry = (not_after - now).days
    is_expired = now > not_after

    # Self-signed: sujeito == emissor
    is_self_signed = cert.subject == cert.issuer

    # Wildcard: CN ou SAN começa com *
    is_wildcard = any(
        s.startswith("*") for s in ([subject_cn] if subject_cn else []) + sans
    )

    # Let's Encrypt
    is_lets_encrypt = (issuer_org or "").lower().startswith("let's encrypt") or \
                      (issuer_cn or "").lower().startswith("r3") or \
                      (issuer_cn or "").lower().startswith("e1")

    # Algoritmo de assinatura
    sig_algo = cert.signature_algorithm_oid._name if cert.signature_algorithm_oid else None

    # Cadeia (issuer do certificado como entrada única — sem acesso à cadeia completa
    # porque ssl.SSLSocket.getpeercert(binary_form=True) retorna só o leaf)
    chain: list[str] = []
    if issuer_cn and not is_self_signed:
        chain_entry = issuer_cn
        if issuer_org:
            chain_entry = f"{issuer_org} / {issuer_cn}"
        chain.append(chain_entry)

    return CertificateInfo(
        subject_cn=subject_cn,
        sans=sans,
        issuer_cn=issuer_cn,
        issuer_org=issuer_org,
        serial_number=format(cert.serial_number, "x"),
        not_before=not_before.isoformat(),
        not_after=not_after.isoformat(),
        days_until_expiry=days_until_expiry,
        key_size=_get_key_size(cert),
        signature_algorithm=sig_algo,
        is_self_signed=is_self_signed,
        is_expired=is_expired,
        is_wildcard=is_wildcard,
        is_lets_encrypt=is_lets_encrypt,
        chain=chain,
    )
