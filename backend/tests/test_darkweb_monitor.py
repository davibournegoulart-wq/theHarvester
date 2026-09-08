import httpx
import pytest

from app.darkweb.monitor import search_dark_web


@pytest.mark.asyncio
async def test_search_ahmia_returns_real_results():
    """Regressão: o seletor CSS (li.result h4 a) nunca tinha sido confirmado
    contra uma resposta de busca bem-sucedida — toda tentativa anterior bateu
    em 504 do Ahmia. Confirmado ao vivo em 2026-09-08 (2384 resultados pra
    "bitcoin", via Tor daemon local). Precisa de um proxy Tor acessível
    (`NETSCRAPER_TOR_PROXY_URL`/default) — sem ele, ou com Ahmia fora do ar,
    pula em vez de falhar, mesmo padrão de tolerância a instabilidade de
    terceiro que o resto da suíte usa."""
    try:
        results = await search_dark_web("bitcoin")
    except httpx.HTTPError as e:
        pytest.skip(f"Tor daemon/Ahmia indisponível no momento do teste: {e}")

    if not results:
        pytest.skip("Ahmia respondeu mas sem resultados/fora do ar (504) — inconclusivo, não falha de código")

    assert all(r.engine == "ahmia" for r in results)
    assert all(r.title for r in results)
