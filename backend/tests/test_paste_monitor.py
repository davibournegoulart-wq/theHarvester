import httpx
import pytest

from app.bulk.paste_monitor import _find_matches, _list_recent_paste_ids


@pytest.mark.asyncio
async def test_list_recent_paste_ids_returns_valid_ids():
    """Pastebin rate-limita/bloqueia sob carga (confirmado ao vivo em
    2026-09-08 — 503 após poucos testes seguidos, e depois ReadTimeout puro
    rodando em CI — confirmado ao vivo em run 34208840736); tratar como
    inconclusivo, não falha de código, senão a CI fica instável por causa
    de terceiro."""
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        try:
            ids = await _list_recent_paste_ids(client)
        except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
            pytest.skip(f"Pastebin indisponível/rate-limitado no momento do teste: {e}")

    assert isinstance(ids, list)
    for paste_id in ids:
        assert len(paste_id) == 8
        assert paste_id.isalnum()


def test_find_matches_is_case_insensitive_and_includes_snippet():
    body = "linha qualquer\nsenha: MinhaSenh4Secreta\noutra linha"
    matches = _find_matches("abc12345", body, ["minhasenh4secreta"])

    assert len(matches) == 1
    assert matches[0].paste_url == "https://pastebin.com/abc12345"
    assert matches[0].keyword_matched == "minhasenh4secreta"
    assert "MinhaSenh4Secreta" in matches[0].snippet


def test_find_matches_returns_one_match_per_keyword_found():
    body = "contém foo e bar, mas não baz"
    matches = _find_matches("abc12345", body, ["foo", "bar", "baz-nao-existe"])

    matched_keywords = {m.keyword_matched for m in matches}
    assert matched_keywords == {"foo", "bar"}


def test_find_matches_returns_empty_when_no_keyword_present():
    assert _find_matches("abc12345", "conteúdo sem nada relevante", ["segredo"]) == []
