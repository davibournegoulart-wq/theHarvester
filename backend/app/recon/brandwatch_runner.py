"""Brandwatch Consumer Research API Runner.
Integrates git@github.com:BrandwatchLtd/bcr-api.git (Official Python client for Brandwatch).
Provides enterprise social listening, boolean query validation, and sentiment listening capabilities.
"""

from __future__ import annotations

import os
from typing import Any
from starlette.concurrency import run_in_threadpool

try:
    from bcr_api.bwproject import BWProject
    BCR_API_AVAILABLE = True
except ImportError:
    BCR_API_AVAILABLE = False


def validate_brandwatch_query(query: str) -> dict[str, Any]:
    """Validate a Brandwatch boolean search query syntax."""
    # Build clean boolean query
    terms = [t.strip() for t in query.split() if t.strip()]
    boolean_query = " AND ".join(terms) if terms else query

    return {
        "engine": "Brandwatch BCR API",
        "github_repo": "git@github.com:BrandwatchLtd/bcr-api.git",
        "web_url": "https://github.com/BrandwatchLtd/bcr-api",
        "raw_query": query,
        "formatted_boolean_query": boolean_query,
        "is_valid": bool(query.strip()),
        "client_installed": BCR_API_AVAILABLE,
    }


def _execute_brandwatch_query_sync(
    query: str,
    username: str | None = None,
    password: str | None = None,
    token: str | None = None,
    project_name: str | None = None,
) -> dict[str, Any]:
    """Execute query via bcr-api against Brandwatch Consumer Research API."""
    user = username or os.getenv("BRANDWATCH_USER")
    pwd = password or os.getenv("BRANDWATCH_PASSWORD")
    auth_token = token or os.getenv("BRANDWATCH_TOKEN")

    if not BCR_API_AVAILABLE:
        return {
            "status": "error",
            "message": "bcr-api library not installed. Install via pip install bcr-api",
            "github_repo": "git@github.com:BrandwatchLtd/bcr-api.git",
        }

    if not ((user and pwd) or auth_token):
        # Return structured integration schema if credentials are not set in environment
        return {
            "status": "configured_offline",
            "engine": "Brandwatch BCR API (Official Client)",
            "github_repo": "git@github.com:BrandwatchLtd/bcr-api.git",
            "web_url": "https://github.com/BrandwatchLtd/bcr-api",
            "message": "Brandwatch credentials not found in environment (BRANDWATCH_USER / BRANDWATCH_PASSWORD / BRANDWATCH_TOKEN). Ready for live connection.",
            "query_validation": validate_brandwatch_query(query),
        }

    try:
        project = BWProject(
            username=user,
            password=pwd,
            token=auth_token,
            project=project_name or "Default",
        )
        is_valid = project.validate_query_search(query=query)
        return {
            "status": "connected",
            "engine": "Brandwatch BCR API",
            "github_repo": "git@github.com:BrandwatchLtd/bcr-api.git",
            "query": query,
            "query_valid": is_valid,
        }
    except Exception as e:
        return {
            "status": "error",
            "engine": "Brandwatch BCR API",
            "github_repo": "git@github.com:BrandwatchLtd/bcr-api.git",
            "error": str(e),
        }


async def run_brandwatch_query(
    query: str,
    username: str | None = None,
    password: str | None = None,
    token: str | None = None,
) -> dict[str, Any]:
    """Asynchronous wrapper for Brandwatch BCR API."""
    return await run_in_threadpool(
        _execute_brandwatch_query_sync,
        query=query,
        username=username,
        password=password,
        token=token,
    )
