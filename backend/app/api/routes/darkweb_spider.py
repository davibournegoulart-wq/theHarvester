import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.darkweb.spider import start_spider, ACTIVE_SPIDER_JOBS

router = APIRouter(prefix="/darkweb/spider", tags=["Tor Hidden Service Spider"])
logger = logging.getLogger("net_scraper.api.tor_spider")


class SpiderStartRequest(BaseModel):
    seeds: list[str]
    max_depth: int = 1
    max_pages: int = 20


@router.post("/start")
async def start_crawl(req: SpiderStartRequest):
    """Starts an asynchronous Tor hidden service crawler job."""
    if not req.seeds:
        raise HTTPException(status_code=400, detail="At least one seed .onion URL is required")

    job = start_spider(
        seeds=req.seeds,
        max_depth=min(max(1, req.max_depth), 2),
        max_pages=min(max(1, req.max_pages), 50),
    )
    return {
        "status": "started",
        "job_id": job.job_id,
        "seeds": job.seeds,
        "max_depth": job.max_depth,
        "max_pages": job.max_pages,
    }


@router.get("/status/{job_id}")
async def get_crawl_status(job_id: str):
    """Retrieves live status, log stream, and processed count for a spider job."""
    job = ACTIVE_SPIDER_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Spider job not found")

    return {
        "job_id": job.job_id,
        "status": job.status,
        "visited_count": len(job.visited),
        "results_count": len(job.results),
        "max_pages": job.max_pages,
        "logs": job.logs[-25:],  # Return last 25 logs
    }


@router.get("/results/{job_id}")
async def get_crawl_results(job_id: str):
    """Retrieves full discovered node graph, crypto addresses, and artifacts from a crawl."""
    job = ACTIVE_SPIDER_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Spider job not found")

    return {
        "job_id": job.job_id,
        "status": job.status,
        "results": job.results,
        "total_results": len(job.results),
    }


@router.post("/stop/{job_id}")
async def stop_crawl(job_id: str):
    """Aborts a currently running spider crawl."""
    job = ACTIVE_SPIDER_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Spider job not found")

    job.is_cancelled = True
    job.status = "CANCELLED"
    return {"status": "cancelled", "job_id": job.job_id}
