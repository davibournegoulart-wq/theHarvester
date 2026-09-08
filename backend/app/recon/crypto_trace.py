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

    balance_eth = int(data.get("coin_balance") or 0) / 1e18

    return WalletTraceResult(
        address=address,
        chain="eth",
        balance=balance_eth,
        tx_count=int(data.get("tx_count") or 0),
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
