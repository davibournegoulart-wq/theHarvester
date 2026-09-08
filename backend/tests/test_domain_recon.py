from unittest.mock import AsyncMock

import httpx
import pytest

from app.recon.domain import find_subdomains


class _FakeResponse:
    def __init__(self, json_data):
        self._json_data = json_data

    def raise_for_status(self):
        pass

    def json(self):
        return self._json_data


@pytest.mark.asyncio
async def test_parses_and_dedupes_crtsh_entries(monkeypatch):
    """crt.sh é instável demais pra confiar só em teste ao vivo (ver teste
    abaixo) — essa aqui trava a lógica de parsing/dedup sem depender da rede,
    simulando exatamente o formato que o crt.sh retorna (name_value com
    múltiplas linhas por entrada, por causa de certificado wildcard/SAN)."""
    fake_entries = [
        {"name_value": "www.example.com\nexample.com"},
        {"name_value": "www.example.com"},  # duplicado, deve aparecer só uma vez
        {"name_value": "mail.example.com"},
        {"name_value": "irrelevante.outrodominio.com"},  # não termina em example.com, deve ser ignorado
    ]

    async def fake_get(self, url, params=None, timeout=None):
        return _FakeResponse(fake_entries)

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    results = await find_subdomains("example.com")
    subdomains = {r.subdomain for r in results}

    assert subdomains == {"www.example.com", "example.com", "mail.example.com"}
    assert all(r.discovered_by == "recon.domain.crtsh" for r in results)


@pytest.mark.asyncio
async def test_find_subdomains_against_a_domain_with_many_certificates():
    """crt.sh é extremamente instável (confirmado ao vivo em 2026-09-08: de 11
    tentativas seguidas contra google.com, só 1 voltou 200 — o resto foi
    502/404/timeout). A função já trata erro HTTP como lista vazia (não
    quebra), então não dá pra distinguir "crt.sh caiu" de "não achou nada" só
    pelo retorno — por isso o teste pula quando vier vazio, em vez de
    considerar isso uma falha."""
    results = await find_subdomains("google.com")
    if not results:
        pytest.skip("crt.sh não respondeu com sucesso neste momento (502/404/timeout) — instabilidade conhecida")

    assert all(r.subdomain.endswith("google.com") for r in results)
    assert all(r.discovered_by == "recon.domain.crtsh" for r in results)
