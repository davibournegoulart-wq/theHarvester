import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import bulk, cases, email_forensics, graph, identifiers, recon, arsenal, biometrics
from app.auth import INSECURE_DEFAULT_KEY, require_api_key
from app.config import settings

logger = logging.getLogger("net_scraper")

app = FastAPI(
    title="Net Scraper",
    description="Sistema de investigação OSINT — módulos internos, sem ferramenta de terceiro embutida.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.api_key == INSECURE_DEFAULT_KEY:
    logger.warning(
        "NETSCRAPER_API_KEY não configurado — usando o valor default público. "
        "Configure uma chave própria antes de expor esse serviço fora de localhost."
    )

_auth = [Depends(require_api_key)]

app.include_router(identifiers.router, dependencies=_auth)
app.include_router(recon.router, dependencies=_auth)
app.include_router(email_forensics.router, dependencies=_auth)
app.include_router(graph.router, dependencies=_auth)
app.include_router(bulk.router, dependencies=_auth)
app.include_router(cases.router, dependencies=_auth)
app.include_router(arsenal.router, prefix="/arsenal", dependencies=_auth)
app.include_router(biometrics.router, dependencies=_auth)


@app.on_event("startup")
async def ensure_db_schema():
    try:
        from sqlalchemy import text
        from app.db import engine
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;"))
        logger.info("Database schema check completed: cases.deleted_at verified.")
    except Exception as e:
        logger.error(f"Error ensuring database schema: {e}")


@app.get("/health")
async def health():
    return {"status": "ok"}
