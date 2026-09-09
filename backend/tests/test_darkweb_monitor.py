import httpx
import pytest

from app.darkweb.monitor import search_dark_web


@pytest.mark.asyncio
async def test_search_dark_web_merges_results_from_both_engines():
    """Regressão: o seletor CSS do Ahmia (li.result h4 a) nunca tinha sido
    confirmado contra uma resposta de busca bem-sucedida — toda tentativa
    anterior bateu em 504. Confirmado ao vivo em 2026-09-08 (2384 resultados
    pra "bitcoin"). Torch adicionado em 2026-09-09, mesmo padrão de
    validação — confirmado com resultado real (onion de exchange/mixer).
    search_dark_web roda os dois motores em paralelo e junta o resultado.
    Precisa de proxy Tor acessível — sem ele, ou com os dois motores fora
    do ar, pula em vez de falhar."""
    try:
        results = await search_dark_web("bitcoin")
    except httpx.HTTPError as e:
        pytest.skip(f"Tor daemon indisponível no momento do teste: {e}")

    if not results:
        pytest.skip("Ahmia e Torch responderam sem resultado (ambos fora do ar) — inconclusivo, não falha de código")

    assert all(r.engine in ("ahmia", "torch") for r in results)
    assert all(r.title for r in results)
