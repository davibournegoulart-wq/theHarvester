import httpx
import pytest

from app.recon.crypto_trace import trace_btc_wallet, trace_eth_wallet

GENESIS_BTC_ADDRESS = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
VITALIK_ETH_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"


@pytest.mark.asyncio
async def test_trace_btc_wallet_genesis_address():
    """Endereço genesis do Bitcoin — saldo/tx_count nunca mudam, serve de fixture viva."""
    try:
        result = await trace_btc_wallet(GENESIS_BTC_ADDRESS)
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"blockstream.info indisponível no momento do teste: {e}")

    assert result.chain == "btc"
    assert result.balance > 0
    assert result.tx_count > 0
    assert result.is_sanctioned is False


@pytest.mark.asyncio
async def test_trace_eth_wallet_returns_nonzero_tx_count():
    """Regressão: tx_count vinha sempre 0 porque o campo não existe no endpoint
    /addresses/{address} do Blockscout — mora em /addresses/{address}/counters
    (`transactions_count`). Confirmado ao vivo em 2026-09-08 contra este endereço,
    que tem histórico de transação alto e estável o bastante pra servir de fixture."""
    try:
        result = await trace_eth_wallet(VITALIK_ETH_ADDRESS)
    except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
        pytest.skip(f"Blockscout indisponível no momento do teste: {e}")

    assert result.chain == "eth"
    assert result.balance >= 0
    assert result.tx_count > 1000  # esse endereço tem dezenas de milhares de tx
    assert result.is_sanctioned is False
