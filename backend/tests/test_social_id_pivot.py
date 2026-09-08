import httpx
import pytest

from app.checkers.social_id_pivot import extract_instagram_id, extract_tiktok_id


@pytest.mark.asyncio
async def test_extracts_instagram_id_from_known_public_profile():
    try:
        result = await extract_instagram_id("instagram")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"instagram.com indisponível no momento do teste: {e}")

    assert result.platform == "instagram"
    assert result.user_id == "25025320"  # ID conhecido e estável da própria conta @instagram


@pytest.mark.asyncio
async def test_extracts_tiktok_id_from_known_public_profile():
    try:
        result = await extract_tiktok_id("tiktok")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"tiktok.com indisponível no momento do teste: {e}")

    assert result.platform == "tiktok"
    assert result.user_id == "107955"  # ID conhecido e estável da própria conta @tiktok
    assert result.sec_uid is not None
