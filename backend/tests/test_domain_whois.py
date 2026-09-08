import httpx
import pytest

from app.recon.domain_whois import lookup_domain_whois


@pytest.mark.asyncio
async def test_returns_registration_date_and_age_for_protected_domain():
    """facebook.com tem contato de registrante redigido por privacidade (comum
    em .com desde GDPR/2018) — mas a data de registro sempre fica disponível."""
    try:
        result = await lookup_domain_whois("facebook.com")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"rdap.org indisponível no momento do teste: {e}")

    assert result.created_at is not None
    assert result.age_days is not None and result.age_days > 1000
    assert result.registrant_email is None  # redigido por privacidade — comportamento esperado


@pytest.mark.asyncio
async def test_returns_registrant_for_unprotected_br_domain():
    """registro.br não tem proteção de privacidade — expõe o registrante real."""
    try:
        result = await lookup_domain_whois("registro.br")
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"rdap.registro.br indisponível no momento do teste: {e}")

    assert result.registrant_name is not None
    assert "NIC.BR" in result.registrant_name.upper() or "NIC.br" in result.registrant_name
