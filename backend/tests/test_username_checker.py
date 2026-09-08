import pytest

from app.checkers.username import _evaluate, _load_sites, check_username


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


def test_redirect_away_detects_gitlab_style_bounce():
    """GitLab: usuário existente fica na mesma URL; inexistente redireciona pra
    /users/sign_in (seguido automaticamente pelo httpx, então status vira 200 nos
    dois casos — só o path final distingue)."""
    definition = {"url": "https://gitlab.com/{}", "error_type": "redirect_away"}
    assert _evaluate(definition, "someuser", 200, "", "/someuser") is True
    assert _evaluate(definition, "someuser", 200, "", "/users/sign_in") is False


def test_title_not_generic_treats_empty_title_as_not_found():
    """X.com pra usuário inexistente: status 200, mas sem <title> nenhum
    (confirmado ao vivo em 2026-09-08 — o status_code check antigo dava
    falso positivo porque x.com parou de retornar 404)."""
    definition = {"error_type": "title_not_generic", "generic_title": ""}
    assert _evaluate(definition, "someuser", 200, "<html><body>sem title</body></html>", "/someuser") is False
    assert _evaluate(definition, "someuser", 200, "<title>Someone (@someuser) / X</title>", "/someuser") is True
