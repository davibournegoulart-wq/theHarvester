from fastapi import FastAPI

from app.api.routes import bulk, cases, graph, identifiers, recon

app = FastAPI(
    title="Net Scraper",
    description="Sistema de investigação OSINT — módulos internos, sem ferramenta de terceiro embutida.",
    version="0.1.0",
)

app.include_router(identifiers.router)
app.include_router(recon.router)
app.include_router(graph.router)
app.include_router(bulk.router)
app.include_router(cases.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
