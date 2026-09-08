import httpx
import pytest

from app.recon.ip_reputation import lookup_ip


@pytest.mark.asyncio
async def test_lookup_known_cloudflare_ip():
    try:
        result = await lookup_ip("1.1.1.1")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"rdap.org indisponível no momento do teste: {e}")

    assert result.ip == "1.1.1.1"
    assert result.country == "AU"
    assert result.asn_holder is not None
    assert result.raw  # corpo RDAP bruto preservado
