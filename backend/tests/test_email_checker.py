import pytest

from app.checkers.email import check_email


@pytest.mark.asyncio
async def test_check_email_returns_list():
    results = await check_email("xyzabc123nonexistent999zzz@gmail.com")
    assert isinstance(results, list)
    for r in results:
        assert r.exists is False
