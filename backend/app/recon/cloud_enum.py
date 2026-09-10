"""Descoberta de ativos de armazenamento em nuvem (S3, Azure Blob, GCP).

Verifica existência e exposição pública de buckets baseados em permutações
do nome de uma organização.

Retorna status 'public' (200), 'exists_private' (403), ou 'not_found' (404).
"""

import asyncio
from dataclasses import dataclass

import httpx

from app.config import settings


@dataclass
class CloudBucket:
    name: str
    provider: str
    url: str
    status: str  # 'public' | 'exists_private' | 'not_found'
    discovered_by: str = "recon.cloud_enum"


@dataclass
class CloudEnumResult:
    org_name: str
    buckets: list[CloudBucket]
    total_found: int
    total_public: int
    discovered_by: str = "recon.cloud_enum"


PERMUTATION_SUFFIXES = [
    "",
    "-dev",
    "-staging",
    "-prod",
    "-backup",
    "-data",
    "-assets",
    "-media",
    "-logs",
    "-static",
    "-public",
    "-private",
    "-internal",
    "-cdn",
    "-uploads",
]


async def _check_bucket(client: httpx.AsyncClient, name: str, provider: str, url: str) -> CloudBucket:
    try:
        response = await client.head(url, timeout=settings.request_timeout_seconds)
        if response.status_code == 200:
            status = "public"
        elif response.status_code == 403:
            status = "exists_private"
        else:
            status = "not_found"
    except httpx.RequestError:
        status = "not_found"

    return CloudBucket(
        name=name,
        provider=provider,
        url=url,
        status=status,
    )


async def enumerate_cloud_assets(org_name: str) -> CloudEnumResult:
    buckets_to_check = []
    
    for suffix in PERMUTATION_SUFFIXES:
        perm = f"{org_name}{suffix}"
        
        # AWS S3
        buckets_to_check.append((perm, "aws", f"https://{perm}.s3.amazonaws.com/"))
        
        # Azure Blob (root container)
        buckets_to_check.append((perm, "azure", f"https://{perm}.blob.core.windows.net/"))
        
        # GCP Storage
        buckets_to_check.append((perm, "gcp", f"https://storage.googleapis.com/{perm}"))

    semaphore = asyncio.Semaphore(settings.max_concurrent_checks)

    async def _check_with_semaphore(client: httpx.AsyncClient, name: str, provider: str, url: str):
        async with semaphore:
            return await _check_bucket(client, name, provider, url)

    async with httpx.AsyncClient() as client:
        tasks = [
            _check_with_semaphore(client, name, provider, url)
            for name, provider, url in buckets_to_check
        ]
        results = await asyncio.gather(*tasks)

    # Filter out not_found
    found_buckets = [b for b in results if b.status != "not_found"]
    
    return CloudEnumResult(
        org_name=org_name,
        buckets=found_buckets,
        total_found=len(found_buckets),
        total_public=sum(1 for b in found_buckets if b.status == "public"),
    )
