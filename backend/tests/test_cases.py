"""Teste de integração real contra Postgres — cobre o que só era testado manualmente.

Precisa de NETSCRAPER_DATABASE_URL apontando pra um Postgres com as migrations
aplicadas (`alembic upgrade head`). Na CI isso é o serviço postgres do
workflow; localmente, aponte pro Postgres do docker-compose (porta 5433) ou
rode dentro do container `api`.

Nunca faz DELETE nem UPDATE em massa — só cria um caso com nome único por
execução e arquiva ele no final, então é seguro rodar contra um banco com
dado real (o pior caso é sobrar um caso de teste arquivado).
"""

import uuid

import httpx
import pytest
from httpx import ASGITransport

from app.config import settings
from app.main import app

pytestmark = pytest.mark.asyncio


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-API-Key": settings.api_key},
    )


async def test_case_lifecycle_finding_and_report(require_db):
    case_name = f"pytest-integration-{uuid.uuid4().hex[:8]}"
    async with await _client() as client:
        create_resp = await client.post("/cases/", params={"name": case_name})
        assert create_resp.status_code == 200
        case_id = create_resp.json()["id"]

        list_resp = await client.get("/cases/")
        assert any(c["id"] == case_id for c in list_resp.json())

        finding_body = {
            "identifier_type": "username",
            "identifier_value": f"pytest-user-{uuid.uuid4().hex[:6]}",
            "platform": "github",
            "url": "https://github.com/pytest-user",
            "exists": True,
            "discovered_by": "checkers.username",
            "metadata_json": {},
        }

        first_save = await client.post(f"/cases/{case_id}/findings", json=finding_body)
        assert first_save.status_code == 200

        # Salvar o mesmo achado de novo não deve duplicar Account nem gerar 2º log.
        second_save = await client.post(f"/cases/{case_id}/findings", json=finding_body)
        assert second_save.status_code == 200
        assert second_save.json()["id"] == first_save.json()["id"]

        report_resp = await client.get(f"/cases/{case_id}/report")
        assert report_resp.status_code == 200
        report = report_resp.json()
        assert report["by_platform"] == [{"label": "github", "value": 1}]
        assert report["by_discovery_source"] == [{"label": "checkers.username", "value": 1}]

        audit_resp = await client.get(f"/cases/{case_id}/audit-log")
        actions = [entry["action"] for entry in audit_resp.json()]
        assert actions.count("case_created") == 1
        assert actions.count("finding_saved") == 1

        archive_resp = await client.post(f"/cases/{case_id}/archive", params={"actor": "pytest"})
        assert archive_resp.status_code == 200
        assert archive_resp.json()["status"] == "archived"


async def test_report_for_case_with_no_findings_is_empty(require_db):
    case_name = f"pytest-integration-empty-{uuid.uuid4().hex[:8]}"
    async with await _client() as client:
        create_resp = await client.post("/cases/", params={"name": case_name})
        case_id = create_resp.json()["id"]

        report_resp = await client.get(f"/cases/{case_id}/report")
        assert report_resp.status_code == 200
        assert report_resp.json() == {"by_platform": [], "by_discovery_source": []}

        await client.post(f"/cases/{case_id}/archive", params={"actor": "pytest"})


async def test_report_for_unknown_case_returns_404(require_db):
    async with await _client() as client:
        resp = await client.get(f"/cases/{uuid.uuid4()}/report")
        assert resp.status_code == 404


async def test_save_evidence_logs_url_and_note_without_touching_identifiers(require_db):
    case_name = f"pytest-integration-evidence-{uuid.uuid4().hex[:8]}"
    async with await _client() as client:
        create_resp = await client.post("/cases/", params={"name": case_name})
        case_id = create_resp.json()["id"]

        evidence_resp = await client.post(
            f"/cases/{case_id}/evidence",
            json={"url": "https://instagram.com/p/exemplo", "note": "post ameaçador"},
        )
        assert evidence_resp.status_code == 200
        assert evidence_resp.json()["action"] == "evidence_saved"
        assert evidence_resp.json()["payload"]["url"] == "https://instagram.com/p/exemplo"

        audit_resp = await client.get(f"/cases/{case_id}/audit-log")
        actions = [entry["action"] for entry in audit_resp.json()]
        assert actions.count("evidence_saved") == 1

        # Não deve ter criado nenhum achado/relatório — evidência é só log, não Identifier/Account.
        report_resp = await client.get(f"/cases/{case_id}/report")
        assert report_resp.json() == {"by_platform": [], "by_discovery_source": []}

        await client.post(f"/cases/{case_id}/archive", params={"actor": "pytest"})


async def test_save_evidence_for_unknown_case_returns_404(require_db):
    async with await _client() as client:
        resp = await client.post(f"/cases/{uuid.uuid4()}/evidence", json={"url": "https://example.com"})
        assert resp.status_code == 404
