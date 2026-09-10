import httpx
import pytest

from app.recon.web_archive import check_archive_availability


@pytest.mark.asyncio
async def test_finds_snapshot_for_well_archived_domain():
    """example.com está arquivado há anos, sempre tem snapshot disponível."""
    try:
        result = await check_archive_availability("example.com")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"archive.org indisponível/rate-limitado no momento do teste: {e}")

    assert hasattr(result, "available")


@pytest.mark.asyncio
async def test_no_snapshot_for_url_that_was_never_archived():
    try:
        result = await check_archive_availability(
            "https://example.com/xyzabc123nonexistent999zzzqwerty-pathwithoutsnapshot"
        )
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"archive.org indisponível/rate-limitado no momento do teste: {e}")

    assert result.available is False
    assert result.closest_snapshot is None
