from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import bulk, cases, graph, identifiers, recon
from app.config import settings

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

app.include_router(identifiers.router)
app.include_router(recon.router)
app.include_router(graph.router)
app.include_router(bulk.router)
app.include_router(cases.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
