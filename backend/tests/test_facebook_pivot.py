import httpx
import pytest

from app.checkers.facebook_pivot import extract_facebook_id, marketplace_url_for_id


@pytest.mark.asyncio
async def test_extracts_id_from_known_public_profile():
    try:
        facebook_id = await extract_facebook_id("https://www.facebook.com/zuck")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"facebook.com indisponível no momento do teste: {e}")

    assert facebook_id == "4"  # ID conhecido e estável de facebook.com/zuck


@pytest.mark.asyncio
async def test_returns_none_for_page_without_facebook_id_markers():
    try:
        facebook_id = await extract_facebook_id("https://example.com")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"example.com indisponível no momento do teste: {e}")

    assert facebook_id is None


def test_marketplace_url_is_a_pure_string_builder():
    assert marketplace_url_for_id("4") == "https://www.facebook.com/marketplace/profile/4/"
