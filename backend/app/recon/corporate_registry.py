"""Consultas a registros corporativos governamentais e bases oficiais.

Implementa regras de arquitetura buscando apenas fontes governamentais/oficiais:
- SEC EDGAR (EUA)
- Companies House (Reino Unido)
- Receita Federal CNPJ (Brasil) - via API pública ReceitaWS (limite 3/min)
- ICIJ Offshore Leaks Database
"""

from dataclasses import dataclass, field

import httpx

from app.config import settings


@dataclass
class CompanyFiling:
    company_name: str
    identifier: str
    filing_date: str | None
    form_type: str | None
    source: str
    url: str | None
    discovered_by: str = "recon.corporate_registry"


@dataclass
class CompanyInfo:
    name: str
    identifier: str
    country: str
    source: str
    trade_name: str | None = None
    status: str | None = None
    registration_date: str | None = None
    extra: dict = field(default_factory=dict)
    discovered_by: str = "recon.corporate_registry"


@dataclass
class OffshoreLeakResult:
    name: str
    source_dataset: str
    jurisdiction: str | None = None
    url: str | None = None
    discovered_by: str = "recon.corporate_registry"


@dataclass
class CorporateRegistryResult:
    query: str
    sec_filings: list[CompanyFiling]
    uk_companies: list[CompanyInfo]
    br_companies: list[CompanyInfo]
    offshore_leaks: list[OffshoreLeakResult]
    discovered_by: str = "recon.corporate_registry"


async def search_corporate_registries(query: str, cnpj: str | None = None) -> CorporateRegistryResult:
    sec_filings = []
    uk_companies = []
    br_companies = []
    offshore_leaks = []

    # SEC exige User-Agent declarado na política de acesso deles — sem isso,
    # bloqueia com 403 "Undeclared Automated Tool" (confirmado ao vivo,
    # 2026-09-09). Usa identificação genérica do projeto, não dado pessoal
    # do investigador (nunca enviamos e-mail do usuário a serviço externo
    # sem pedido explícito).
    sec_headers = {"User-Agent": "NetScraper OSINT Research netscraper-research@example.com"}

    async with httpx.AsyncClient() as client:
        # 1. SEC EDGAR (EUA)
        try:
            sec_url = f"https://efts.sec.gov/LATEST/search-index?q={query}&dateRange=custom&startdt=2000-01-01&enddt=2026-12-31&forms=10-K"
            sec_resp = await client.get(sec_url, headers=sec_headers, timeout=settings.request_timeout_seconds)
            if sec_resp.status_code == 200:
                data = sec_resp.json()
                hits = data.get("hits", {}).get("hits", [])
                for hit in hits:
                    source = hit.get("_source", {})
                    ciks = source.get("ciks", [])
                    cik = ciks[0] if ciks else "unknown"
                    sec_filings.append(CompanyFiling(
                        company_name=source.get("display_names", [""])[0],
                        identifier=cik,
                        filing_date=source.get("file_date"),
                        form_type=source.get("form"),
                        source="SEC EDGAR",
                        url=f"https://www.sec.gov/edgar/browse/?CIK={cik}",
                    ))
        except Exception:
            pass

        # 2. Companies House (UK)
        if settings.companies_house_api_key:
            try:
                ch_url = f"https://api.company-information.service.gov.uk/search/companies?q={query}"
                ch_resp = await client.get(
                    ch_url,
                    auth=(settings.companies_house_api_key, ""),
                    timeout=settings.request_timeout_seconds,
                )
                if ch_resp.status_code == 200:
                    data = ch_resp.json()
                    for item in data.get("items", []):
                        uk_companies.append(CompanyInfo(
                            name=item.get("title", ""),
                            identifier=item.get("company_number", ""),
                            country="UK",
                            source="Companies House",
                            status=item.get("company_status"),
                            registration_date=item.get("date_of_creation"),
                            extra={"address": item.get("address", {})},
                        ))
            except Exception:
                pass

        # 3. Receita Federal CNPJ (Brasil) - usando ReceitaWS público
        if cnpj:
            clean_cnpj = "".join(filter(str.isdigit, cnpj))
            if clean_cnpj:
                try:
                    br_url = f"https://receitaws.com.br/v1/cnpj/{clean_cnpj}"
                    br_resp = await client.get(br_url, timeout=settings.request_timeout_seconds)
                    if br_resp.status_code == 200:
                        data = br_resp.json()
                        if data.get("status") != "ERROR":
                            br_companies.append(CompanyInfo(
                                name=data.get("nome", ""),
                                trade_name=data.get("fantasia"),
                                identifier=clean_cnpj,
                                country="BR",
                                source="Receita Federal / ReceitaWS",
                                status=data.get("situacao"),
                                registration_date=data.get("abertura"),
                                extra={
                                    "capital_social": data.get("capital_social"),
                                    "atividade_principal": data.get("atividade_principal", []),
                                }
                            ))
                except Exception:
                    pass

        # 4. ICIJ Offshore Leaks
        # O endpoint antigo `/api/v1/search` (GET, estilo Elasticsearch) foi
        # descontinuado — retorna 404 puro (confirmado ao vivo, 2026-09-09),
        # fazendo esse bloco sempre falhar silenciosamente via o except abaixo.
        # A API atual é a Reconciliation API (W3C reconciliation service spec):
        # POST /api/v1/reconcile com {"query": "..."} , resposta em `result[]`
        # com id/name/description/types (sem paginação/jurisdiction estruturada
        # — description e types que indicam o dataset de origem).
        try:
            icij_resp = await client.post(
                "https://offshoreleaks.icij.org/api/v1/reconcile",
                json={"query": query},
                timeout=settings.request_timeout_seconds,
            )
            if icij_resp.status_code in (200, 201):
                data = icij_resp.json()
                for hit in data.get("result", [])[:10]:
                    types = hit.get("types", [])
                    type_name = types[0].get("name", "unknown") if types else "unknown"
                    offshore_leaks.append(OffshoreLeakResult(
                        name=hit.get("name", ""),
                        jurisdiction=None,
                        source_dataset=hit.get("description", type_name),
                        url=f"https://offshoreleaks.icij.org/nodes/{hit.get('id')}",
                    ))
        except Exception:
            pass

    return CorporateRegistryResult(
        query=query,
        sec_filings=sec_filings,
        uk_companies=uk_companies,
        br_companies=br_companies,
        offshore_leaks=offshore_leaks,
    )
