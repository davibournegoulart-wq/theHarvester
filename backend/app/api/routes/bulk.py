from fastapi import APIRouter

from app.bulk.explorer import filter_csv, inspect_csv
from app.bulk.paste_monitor import scan_recent_pastes

router = APIRouter(prefix="/bulk", tags=["bulk"])


@router.get("/inspect")
async def inspect(path: str):
    return inspect_csv(path)


@router.get("/filter")
async def filter_dataset(path: str, query: str):
    return filter_csv(path, query)


@router.get("/paste-monitor")
async def paste_monitor(keywords: str):
    """`keywords` separadas por vírgula, ex: ?keywords=empresa.com,senha"""
    return await scan_recent_pastes([k.strip() for k in keywords.split(",") if k.strip()])
