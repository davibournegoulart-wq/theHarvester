"""Checagem de existência de e-mail via fluxo de "esqueci minha senha"/registro.

Reimplementação nativa do padrão Holehe/Quidam (ver vault: Tools - Identifier
Lookup). Cada serviço tem seu próprio formato de request e de resposta —
diferente do username checker, não dá pra generalizar num JSON simples de
URL, cada adapter precisa saber montar o request específico do serviço.

TODO: implementar um adapter por serviço em `email_services/`, cada um
retornando ExistsResult (exists, rate_limited, leaked_recovery_hint).
Começar por ~5 serviços de alto valor (Twitter, Instagram, Adobe, Amazon,
GitHub) antes de escalar pra 120+.
"""

from dataclasses import dataclass


@dataclass
class EmailCheckResult:
    service: str
    exists: bool
    rate_limited: bool = False
    leaked_recovery_hint: str | None = None  # ex: e-mail/telefone parcialmente ofuscado
    discovered_by: str = "checkers.email"


async def check_email(email: str) -> list[EmailCheckResult]:
    raise NotImplementedError(
        "Implementar adapters por serviço em email_services/. "
        "Ver vault: Tools - Identifier Lookup#Holehe e #Quidam para o padrão de cada fluxo."
    )
