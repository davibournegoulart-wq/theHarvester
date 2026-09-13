import pytest
from app.recon.torbot import check_onion_status, extract_onion_intel, crawl_onion_link_tree

@pytest.mark.asyncio
async def test_torbot_onion_check():
    res = await check_onion_status("https://check.torproject.org", timeout=15.0)
    assert res["url"] == "https://check.torproject.org"
    assert res["online"] is True
    assert res["status_code"] == 200
    assert "checked_at" in res
    assert res["latency_ms"] > 0

@pytest.mark.asyncio
async def test_torbot_intel_extraction():
    res = await extract_onion_intel("https://check.torproject.org", timeout=15.0)
    assert res["url"] == "https://check.torproject.org"
    assert res["status_code"] == 200
    assert "content_hash_sha256" in res
    assert isinstance(res["crypto_wallets"], dict)
    assert "bitcoin" in res["crypto_wallets"]
    assert "monero" in res["crypto_wallets"]
    assert "ethereum" in res["crypto_wallets"]

@pytest.mark.asyncio
async def test_torbot_crawl():
    res = await crawl_onion_link_tree("https://check.torproject.org", depth=1, max_pages=3)
    assert res["seed_url"] == "https://check.torproject.org"
    assert len(res["nodes"]) >= 1
    assert any(n["id"] == "https://check.torproject.org" for n in res["nodes"])
