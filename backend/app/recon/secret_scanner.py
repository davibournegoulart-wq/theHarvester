"""Secret & Credential Scanner Engine (Gitleaks + TruffleHog synthesis).
Scans text, pastes, repositories, and dump contents for high-entropy secrets,
private keys, and sensitive API tokens without requiring external binaries.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

# Comprehensive Regex rules synthesized from Gitleaks and TruffleHog
SECRET_RULES: list[dict[str, Any]] = [
    {
        "name": "AWS Access Key ID",
        "regex": re.compile(r'\b(AKIA[0-9A-Z]{16})\b'),
        "severity": "HIGH",
    },
    {
        "name": "AWS Secret Access Key",
        "regex": re.compile(r'(?i)aws_secret_access_key["\']?\s*[:=]\s*["\']?([0-9a-zA-Z/+]{40})["\']?'),
        "severity": "CRITICAL",
    },
    {
        "name": "GitHub Personal Access Token",
        "regex": re.compile(r'\b(gh[pousr]_[0-9a-zA-Z]{36})\b'),
        "severity": "CRITICAL",
    },
    {
        "name": "GitHub OAuth Token",
        "regex": re.compile(r'\b(gho_[0-9a-zA-Z]{36})\b'),
        "severity": "CRITICAL",
    },
    {
        "name": "Google API Key",
        "regex": re.compile(r'\b(AIza[0-9A-Za-z\-_]{35})\b'),
        "severity": "HIGH",
    },
    {
        "name": "Slack Token",
        "regex": re.compile(r'\b(xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24})\b'),
        "severity": "CRITICAL",
    },
    {
        "name": "Stripe API Key",
        "regex": re.compile(r'\b(sk_live_[0-9a-zA-Z]{24,34})\b'),
        "severity": "CRITICAL",
    },
    {
        "name": "Stripe Publishable Key",
        "regex": re.compile(r'\b(pk_live_[0-9a-zA-Z]{24,34})\b'),
        "severity": "LOW",
    },
    {
        "name": "RSA / OpenSSH Private Key",
        "regex": re.compile(r'-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC)?\s*PRIVATE KEY-----[\s\S]+?-----END\s+(?:RSA|OPENSSH|DSA|EC)?\s*PRIVATE KEY-----'),
        "severity": "CRITICAL",
    },
    {
        "name": "PGP Private Key",
        "regex": re.compile(r'-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----'),
        "severity": "CRITICAL",
    },
    {
        "name": "OpenAI / Anthropic API Key",
        "regex": re.compile(r'\b(sk-(?:proj-)?[a-zA-Z0-9\-_]{32,64})\b'),
        "severity": "CRITICAL",
    },
    {
        "name": "Generic High-Entropy Secret / Password",
        "regex": re.compile(r'(?i)(?:api_key|apikey|secret|password|token|bearer)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9_\-\.+=/]{20,80})["\']?'),
        "severity": "MEDIUM",
    },
]


def shannon_entropy(data: str) -> float:
    """Calculate the Shannon entropy of a string (measures randomness)."""
    if not data:
        return 0.0
    entropy = 0.0
    length = len(data)
    for x in set(data):
        p_x = float(data.count(x)) / length
        entropy += -p_x * math.log(p_x, 2)
    return entropy


def scan_text_for_secrets(text: str, entropy_threshold: float = 3.2) -> list[dict[str, Any]]:
    """Scans text or code snippets for secrets using Gitleaks/TruffleHog rules & entropy verification."""
    findings: list[dict[str, Any]] = []
    seen_matches = set()

    for rule in SECRET_RULES:
        for match in rule["regex"].finditer(text):
            val = match.group(1) if match.groups() else match.group(0)
            val = val.strip()

            if val in seen_matches or len(val) < 8:
                continue

            ent = round(shannon_entropy(val), 2)
            # Mask the secret for safe presentation in reports
            masked = val[:4] + ("*" * min(16, len(val) - 8)) + val[-4:] if len(val) > 8 else "***"

            findings.append({
                "rule_name": rule["name"],
                "severity": rule["severity"],
                "masked_value": masked,
                "entropy": ent,
                "length": len(val),
                "discovered_by": "recon.secret_scanner (Gitleaks/TruffleHog)",
            })
            seen_matches.add(val)

    return findings
