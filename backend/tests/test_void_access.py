import pytest
from app.recon.void_access import (
    extract_threat_entities,
    search_threat_actors,
    generate_yara_rule,
    generate_sigma_rule,
    generate_stix_bundle,
    run_voidaccess_investigation,
    CURATED_ONION_SEEDS,
)


def test_extract_threat_entities_crypto_and_onion():
    text = """
    Ransom payment must be sent to BTC: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq
    Or ETH wallet: 0x71C634C26b331E0cd51a0457F5633F53e5e7C1B2
    Visit our blog at: http://lockbitaptc2iq4atewgahapbm2xap6xqytbvwtfo2d62746zpmfoigyd.onion
    Contact us via Telegram: @lockbit_support_chat or t.me/lockbit_leaks
    """
    entities = extract_threat_entities(text)
    
    assert any(c["address"] == "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" for c in entities.cryptocurrency)
    assert any(c["address"] == "0x71C634C26b331E0cd51a0457F5633F53e5e7C1B2" for c in entities.cryptocurrency)
    assert any("lockbitaptc2iq4atewgahapbm2xap6xqytbvwtfo2d62746zpmfoigyd.onion" in o for o in entities.onion_urls)
    assert any(m["handle"] == "@lockbit_support_chat" for m in entities.messaging)


def test_extract_threat_entities_cves_and_hashes():
    text = """
    Exploited vulnerability CVE-2023-34362 (MOVEit Transfer SQLi) and technique T1486.
    Payload SHA256: a6e4d2f8e91c7849e83716d123456789abcdef0123456789abcdef0123456789
    Dropped file MD5: 5d41402abc4b2a76b9719d911017c592
    C2 IP: 185.220.101.5
    """
    entities = extract_threat_entities(text)

    assert "CVE-2023-34362" in entities.cves
    assert "T1486" in entities.mitre_techniques
    assert any(h["hash"] == "a6e4d2f8e91c7849e83716d123456789abcdef0123456789abcdef0123456789" for h in entities.hashes)
    assert any(h["hash"] == "5d41402abc4b2a76b9719d911017c592" for h in entities.hashes)
    assert any(n["value"] == "185.220.101.5" for n in entities.network)


def test_search_threat_actors():
    actors = search_threat_actors("LockBit")
    assert len(actors) >= 1
    assert actors[0].name == "LockBit 3.0"
    assert "Bitwise Spider" in actors[0].aliases

    akira = search_threat_actors("Akira")
    assert len(akira) >= 1
    assert akira[0].name == "Akira"
    assert ".akira" in akira[0].malware_extensions


def test_curated_onion_seeds():
    assert len(CURATED_ONION_SEEDS) >= 5
    assert any(s.name == "Torch Search" for s in CURATED_ONION_SEEDS)


def test_generate_yara_and_sigma_rules():
    sample_text = "Hash: a6e4d2f8e91c7849e83716d123456789abcdef0123456789abcdef0123456789 Onion: lockbitaptc2iq4atewgahapbm2xap6xqytbvwtfo2d62746zpmfoigyd.onion"
    entities = extract_threat_entities(sample_text)

    yara_code = generate_yara_rule("Test_LockBit_Rule", entities)
    assert "rule Test_LockBit_Rule" in yara_code
    assert "a6e4d2f8e91c7849e83716d123456789abcdef0123456789abcdef0123456789" in yara_code

    sigma_code = generate_sigma_rule("Test Sigma Rule", entities)
    assert "title: Test Sigma Rule" in sigma_code


def test_generate_stix_bundle():
    sample_text = "BTC: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
    entities = extract_threat_entities(sample_text)
    stix = generate_stix_bundle("INV-1234", entities)
    assert stix["type"] == "bundle"
    assert len(stix["objects"]) >= 2


@pytest.mark.asyncio
async def test_run_voidaccess_investigation():
    res = await run_voidaccess_investigation("LockBit")
    assert res.query == "LockBit"
    assert len(res.matched_actors) >= 1
    assert res.overall_severity == "CRITICAL"
    assert len(res.onion_results) >= 1
