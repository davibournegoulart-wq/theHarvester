import pytest
import tempfile
import os
from unittest.mock import patch, MagicMock

# Cloud Enum
from app.recon.cloud_enum import enumerate_cloud_assets

# Corporate Registry
from app.recon.corporate_registry import search_corporate_registries

# Document Meta
from app.recon.document_meta import extract_document_metadata, DocumentMetadata

# Email Security
from app.recon.email_security import audit_email_security


@pytest.mark.asyncio
async def test_enumerate_cloud_assets():
    # Mock network requests to avoid slow/flaky tests
    with patch("httpx.AsyncClient.head") as mock_head:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_head.return_value = mock_response

        # Fast test with low permutations
        result = await enumerate_cloud_assets("testorg")
        assert result.org_name == "testorg"
        assert isinstance(result.total_public, int)
        assert isinstance(result.buckets, list)


@pytest.mark.asyncio
async def test_search_corporate_registries():
    # Test Receita WS directly (public API) or just mock it
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "nome": "EMPRESA TESTE S/A",
            "situacao": "ATIVA"
        }
        mock_get.return_value = mock_response

        result = await search_corporate_registries(query="", cnpj="00000000000191")
        assert result.query == ""
        assert len(result.br_companies) > 0
        assert result.br_companies[0].source == "Receita Federal / ReceitaWS"
        assert result.br_companies[0].name == "EMPRESA TESTE S/A"


@pytest.mark.asyncio
async def test_audit_email_security():
    # Test DNS lookups using a reliable domain
    result = await audit_email_security("google.com")
    assert result.domain == "google.com"
    assert len(result.mx_records) > 0
    assert result.spf is not None
    assert isinstance(result.risk_summary, str)


def test_extract_document_metadata_pdf():
    # Create a tiny valid dummy PDF to test metadata extraction
    try:
        import pymupdf
        doc = pymupdf.open()
        page = doc.new_page()
        page.insert_text((50, 50), "Test PDF")
        doc.set_metadata({
            "author": "Test Author",
            "title": "Test Title",
            "creator": "pytest"
        })
        
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            doc.save(f.name)
            filepath = f.name
        
        doc.close()

        with open(filepath, "rb") as f:
            content = f.read()
            
        result = extract_document_metadata(content, "test.pdf")
        
        assert result.filename == "test.pdf"
        assert result.author == "Test Author"
        assert result.title == "Test Title"
        assert result.creator_tool == "pytest"
        
    finally:
        if 'filepath' in locals() and os.path.exists(filepath):
            os.remove(filepath)
