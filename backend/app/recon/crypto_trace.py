"""Rastreio de carteira cripto (BTC/ETH), cruzado com lista de sanção.

Ver vault: Tool Decision Log. Mesmas fontes keyless/públicas que o OSIRIS
usa: blockstream.info (BTC) e Blockscout (ETH). O mirror da lista de
endereço sancionado (0xB10C/ofac-sanctioned-digital-currency-addresses,
confirmado ao vivo: arquivos `sanctioned_addresses_XBT.txt`/`_ETH.txt`, um
endereço por linha) é espelho de dado governamental (OFAC), não serviço
privado.

Cache em memória com TTL simples — evita buscar o arquivo a cada chamada,
mesmo padrão que o OSIRIS usa (~7MB cacheado por 24h pra OpenSanctions).
"""

import time
from dataclasses import dataclass

import httpx

from app.config import settings

BLOCKSTREAM_API = "https://blockstream.info/api"
BLOCKSCOUT_API = "https://eth.blockscout.com/api/v2"

_OFAC_CRYPTO_LIST_URLS = {
    "btc": "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_XBT.txt",
    "eth": "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.txt",
}
_CACHE_TTL_SECONDS = 24 * 60 * 60
_sanctioned_cache: dict[str, tuple[float, set[str]]] = {}


@dataclass
class WalletTraceResult:
    address: str
    chain: str  # "btc" | "eth"
    balance: float
    tx_count: int
    is_sanctioned: bool
    discovered_by: str = "recon.crypto_trace"


async def trace_btc_wallet(address: str) -> WalletTraceResult:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BLOCKSTREAM_API}/address/{address}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        data = response.json()

    funded = data["chain_stats"]["funded_txo_sum"]
    spent = data["chain_stats"]["spent_txo_sum"]
    balance_btc = (funded - spent) / 1e8

    return WalletTraceResult(
        address=address,
        chain="btc",
        balance=balance_btc,
        tx_count=data["chain_stats"]["tx_count"],
        is_sanctioned=await _is_sanctioned_address(address, "btc"),
    )


async def trace_eth_wallet(address: str) -> WalletTraceResult:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BLOCKSCOUT_API}/addresses/{address}", timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        data = response.json()

        # `tx_count` não existe nesse endpoint (confirmado ao vivo em 2026-09-08 —
        # sempre voltava 0 silenciosamente). O total de transações mora em
        # /addresses/{address}/counters, campo `transactions_count`.
        counters_response = await client.get(
            f"{BLOCKSCOUT_API}/addresses/{address}/counters", timeout=settings.request_timeout_seconds
        )
        counters_response.raise_for_status()
        counters = counters_response.json()

    balance_eth = int(data.get("coin_balance") or 0) / 1e18

    return WalletTraceResult(
        address=address,
        chain="eth",
        balance=balance_eth,
        tx_count=int(counters.get("transactions_count") or 0),
        is_sanctioned=await _is_sanctioned_address(address, "eth"),
    )


async def _load_sanctioned_set(chain: str) -> set[str]:
    cached = _sanctioned_cache.get(chain)
    if cached and (time.monotonic() - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(_OFAC_CRYPTO_LIST_URLS[chain], timeout=settings.request_timeout_seconds)
        response.raise_for_status()

    addresses = {line.strip() for line in response.text.splitlines() if line.strip()}
    _sanctioned_cache[chain] = (time.monotonic(), addresses)
    return addresses


async def _is_sanctioned_address(address: str, chain: str) -> bool:
    sanctioned = await _load_sanctioned_set(chain)
    return address in sanctioned


ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api"


async def _trace_evm_chain_via_etherscan_v2(address: str, chain_id: int, chain_name: str, api_key: str | None) -> dict:
    """BscScan/PolygonScan V1 (api.bscscan.com, api.polygonscan.com) foram
    descontinuadas — confirmado ao vivo (2026-09-09): V1 redireciona 301 pra
    doc de migração, e mesmo quando responde 200 (caso do BscScan), o corpo
    diz "deprecated V1 endpoint" e `status` nunca é "1", fazendo o saldo
    sempre voltar 0.0 silenciosamente, sem erro visível algum. A Etherscan
    unificou tudo numa API V2 só, selecionando a chain via `chainid`
    (56=BSC, 137=Polygon) — mesma chave de API pra qualquer chain suportada.
    """
    key = api_key or "YourApiKeyToken"
    async with httpx.AsyncClient() as client:
        balance_resp = await client.get(
            ETHERSCAN_V2_URL,
            params={
                "chainid": chain_id,
                "module": "account",
                "action": "balance",
                "address": address,
                "tag": "latest",
                "apikey": key,
            },
            timeout=settings.request_timeout_seconds,
        )
        balance_resp.raise_for_status()
        balance_data = balance_resp.json()
        balance = int(balance_data.get("result", 0)) / 1e18 if balance_data.get("status") == "1" else 0.0

        tx_resp = await client.get(
            ETHERSCAN_V2_URL,
            params={
                "chainid": chain_id,
                "module": "account",
                "action": "txlist",
                "address": address,
                "startblock": "0",
                "endblock": "99999999",
                "page": "1",
                "offset": "10",
                "sort": "desc",
                "apikey": key,
            },
            timeout=settings.request_timeout_seconds,
        )
        tx_resp.raise_for_status()
        tx_data = tx_resp.json()
        txs = tx_data.get("result", []) if tx_data.get("status") == "1" else []
        tx_count = len(txs)  # essa API só traz os últimos até 'offset', então tx_count aqui reflete isso

    return {
        "address": address,
        "chain": chain_name,
        "balance": balance,
        "tx_count": tx_count,
        "recent_txs": txs,
        "discovered_by": f"recon.crypto_trace.{chain_name}",
    }


async def trace_bsc_wallet(address: str) -> dict:
    return await _trace_evm_chain_via_etherscan_v2(address, chain_id=56, chain_name="bsc", api_key=settings.bscscan_api_key)


async def trace_polygon_wallet(address: str) -> dict:
    return await _trace_evm_chain_via_etherscan_v2(address, chain_id=137, chain_name="polygon", api_key=settings.polygonscan_api_key)

