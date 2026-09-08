import httpx
import pytest

from app.recon.breach_check import check_password_pwned


@pytest.mark.asyncio
async def test_detects_widely_breached_password():
    try:
        result = await check_password_pwned("password")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"api.pwnedpasswords.com indisponível no momento do teste: {e}")

    assert result.times_seen > 1_000_000  # "password" está em dezenas de milhões de vazamentos


@pytest.mark.asyncio
async def test_strong_random_password_not_found():
    try:
        result = await check_password_pwned("xK9$mQ2!vL7#pR4&wZ8-pytest-only")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"api.pwnedpasswords.com indisponível no momento do teste: {e}")

    assert result.times_seen == 0
