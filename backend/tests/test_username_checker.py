import pytest

from app.checkers.username import _load_sites, check_username


def test_sites_file_loads():
    sites = _load_sites()
    assert len(sites) > 0
    for definition in sites.values():
        assert "url" in definition
        assert "{}" in definition["url"]


@pytest.mark.asyncio
async def test_check_username_returns_list():
    results = await check_username("this-username-almost-certainly-does-not-exist-xyz123")
    assert isinstance(results, list)


@pytest.mark.asyncio
async def test_no_false_positive_on_nonexistent_username():
    """Regressão: versão anterior tratava qualquer status != 404 (ex: 403 de
    anti-bot, 200 de casca SPA) como 'existe', gerando falso positivo em
    massa. Confirmado ao vivo em 2026-09-08 contra 7 de 10 sites do seed."""
    results = await check_username("xyzabc123nonexistent999zzz")
    assert results == []
