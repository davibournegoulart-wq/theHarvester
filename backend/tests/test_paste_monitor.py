import httpx
import pytest

from app.bulk.paste_monitor import _list_recent_paste_ids


@pytest.mark.asyncio
async def test_list_recent_paste_ids_returns_valid_ids():
    """Pastebin rate-limita/bloqueia sob carga (confirmado ao vivo em
    2026-09-08 — 503 após poucos testes seguidos); tratar como
    inconclusivo, não falha de código, senão a CI fica instável por causa
    de terceiro."""
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        try:
            ids = await _list_recent_paste_ids(client)
        except httpx.HTTPStatusError as e:
            pytest.skip(f"Pastebin indisponível/rate-limitado no momento do teste: {e}")

    assert isinstance(ids, list)
    for paste_id in ids:
        assert len(paste_id) == 8
        assert paste_id.isalnum()
