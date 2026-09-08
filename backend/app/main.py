import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import bulk, cases, graph, identifiers, recon
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
app.include_router(graph.router, dependencies=_auth)
app.include_router(bulk.router, dependencies=_auth)
app.include_router(cases.router, dependencies=_auth)


@app.get("/health")
async def health():
    return {"status": "ok"}
