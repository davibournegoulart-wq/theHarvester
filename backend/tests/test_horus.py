import pytest
from app.recon.horus import (
    normalize_mac,
    lookup_mac_vendor,
    lookup_bank_bin,
    lookup_wifi_bssid,
    scan_threat_intel,
    loki_vault_keygen,
    loki_vault_encrypt,
    loki_vault_decrypt,
    validate_luhn,
)

def test_normalize_mac():
    raw, colon, dash = normalize_mac("b8-27-eb-12-34-56")
    assert raw == "B827EB123456"
    assert colon == "B8:27:EB:12:34:56"
    assert dash == "B8-27-EB-12-34-56"

@pytest.mark.asyncio
async def test_mac_vendor_fallback_and_query():
    # Raspberry Pi Foundation OUI
    res = await lookup_mac_vendor("B8:27:EB:AA:BB:CC")
    assert "Raspberry Pi" in res["vendor"]
    assert res["mac"] == "B8:27:EB:AA:BB:CC"
    assert res["transmission"] == "Unicast"
    assert "Universally Administered" in res["administration"]

    # Cisco OUI
    res_cisco = await lookup_mac_vendor("00:00:0C:11:22:33")
    assert "Cisco" in res_cisco["vendor"]

@pytest.mark.asyncio
async def test_bank_bin_lookup():
    # Visa Chase BIN
    res = await lookup_bank_bin("453201")
    assert res["scheme"] == "Visa"
    assert res["type"] == "Credit"
    assert "Chase" in res["bank"]

    # Mastercard Nubank BIN
    res_nu = await lookup_bank_bin("524188")
    assert res_nu["scheme"] == "Mastercard"
    assert "Nu" in res_nu["bank"] or "Nubank" in res_nu["bank"]
    assert res_nu["country_code"] == "BR"

@pytest.mark.asyncio
async def test_wifi_bssid_query_format():
    # Test valid BSSID input structure
    res = await lookup_wifi_bssid("00:14:6C:7E:40:80")
    assert res["bssid"] == "00:14:6c:7e:40:80"
    assert "provider" in res

def test_loki_crypt_vault_lifecycle():
    key = loki_vault_keygen()
    assert len(key) >= 32

    secret_evidence = "CONFIDENTIAL_OPERATIONAL_TARGET_DOSSIER_#9941"
    encrypted = loki_vault_encrypt(secret_evidence, key)
    assert encrypted != secret_evidence
    assert encrypted.startswith("gAAAA")

    decrypted = loki_vault_decrypt(encrypted, key)
    assert decrypted == secret_evidence

@pytest.mark.asyncio
async def test_threat_intel_scanner():
    res = await scan_threat_intel("8.8.8.8")
    assert res["target"] == "8.8.8.8"
    assert res["target_type"] == "ip"
    assert "risk_level" in res
