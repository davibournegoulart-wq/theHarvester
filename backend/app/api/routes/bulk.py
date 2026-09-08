from fastapi import APIRouter

from app.bulk.explorer import filter_csv, inspect_csv

router = APIRouter(prefix="/bulk", tags=["bulk"])


@router.get("/inspect")
async def inspect(path: str):
    return inspect_csv(path)


@router.get("/filter")
async def filter_dataset(path: str, query: str):
    return filter_csv(path, query)
