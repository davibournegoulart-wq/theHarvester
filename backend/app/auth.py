"""Autenticação por chave de API — protege todo endpoint que não seja /health.

Não é sistema multi-usuário (não há necessidade disso ainda — a arquitetura
inteira assume "o investigador", singular). É uma trava simples: sem a
chave certa no header `X-API-Key`, a API recusa.

Config: `NETSCRAPER_API_KEY` (env var do servidor). Se não for configurado
explicitamente, usa um valor default óbvio e loga aviso — nunca falha
silenciosamente pra "sem autenticação".
"""

import secrets

from fastapi import Header, Query, HTTPException

from app.config import settings

INSECURE_DEFAULT_KEY = "change-me-net-scraper-insecure-default"


def require_api_key(
    x_api_key: str | None = Header(default=None),
    api_key: str | None = Query(default=None),
) -> None:
    token = x_api_key or api_key
    if token is None or not secrets.compare_digest(token, settings.api_key):
        raise HTTPException(status_code=401, detail="X-API-Key ausente ou inválido.")
