import httpx
import pytest

from app.checkers.gravatar import lookup_gravatar


@pytest.mark.asyncio
async def test_returns_profile_for_known_gravatar_email():
    try:
        result = await lookup_gravatar("matt@mullenweg.com")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"api.gravatar.com indisponível no momento do teste: {e}")

    assert result.exists is True
    assert result.profile_url is not None
    assert result.avatar_url is not None


@pytest.mark.asyncio
async def test_returns_not_exists_for_email_without_gravatar():
    try:
        result = await lookup_gravatar("xyzabc123nonexistent999zzz@example.com")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"api.gravatar.com indisponível no momento do teste: {e}")

    assert result.exists is False
