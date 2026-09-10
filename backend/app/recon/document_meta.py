"""Extração de metadados de documentos (PDF, DOCX, XLSX).

Reimplementação nativa da técnica usada por ferramentas como FOCA,
exiftool ou metagoofil. Extrai metadados do documento em si (título, autor,
software criador, datas de modificação), sem depender de serviços externos.

Usa bibliotecas puras de leitura de documento (pymupdf para PDF, python-docx
para DOCX e openpyxl para XLSX), rodando offline com o próprio arquivo enviado.
"""

from dataclasses import dataclass, field
from io import BytesIO
import zipfile

import pymupdf
import docx
import openpyxl

@dataclass
class DocumentMetadata:
    filename: str | None
    file_type: str
    title: str | None = None
    author: str | None = None
    subject: str | None = None
    keywords: str | None = None
    creator_tool: str | None = None
    creation_date: str | None = None
    modification_date: str | None = None
    last_modified_by: str | None = None
    company: str | None = None
    page_count: int | None = None
    revision: str | None = None
    template: str | None = None
    application: str | None = None
    extra: dict = field(default_factory=dict)
    discovered_by: str = "recon.document_meta"

def _detect_file_type(content: bytes) -> str | None:
    if content.startswith(b"%PDF"):
        return "pdf"
    
    if content.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(BytesIO(content)) as zf:
                names = zf.namelist()
                if "word/document.xml" in names:
                    return "docx"
                if "xl/workbook.xml" in names:
                    return "xlsx"
        except zipfile.BadZipFile:
            pass
            
    return None

def _extract_pdf_metadata(content: bytes) -> DocumentMetadata:
    doc = pymupdf.open(stream=content, filetype="pdf")
    meta = doc.metadata
    
    return DocumentMetadata(
        filename=None,
        file_type="pdf",
        title=meta.get("title") if meta.get("title") else None,
        author=meta.get("author") if meta.get("author") else None,
        subject=meta.get("subject") if meta.get("subject") else None,
        keywords=meta.get("keywords") if meta.get("keywords") else None,
        creator_tool=meta.get("creator") if meta.get("creator") else None,
        creation_date=meta.get("creationDate") if meta.get("creationDate") else None,
        modification_date=meta.get("modDate") if meta.get("modDate") else None,
        page_count=doc.page_count,
        extra={"producer": meta.get("producer"), "encrypted": doc.is_encrypted}
    )

def _extract_docx_metadata(content: bytes) -> DocumentMetadata:
    try:
        doc = docx.Document(BytesIO(content))
        prop = doc.core_properties
        
        return DocumentMetadata(
            filename=None,
            file_type="docx",
            title=prop.title if prop.title else None,
            author=prop.author if prop.author else None,
            subject=prop.subject if prop.subject else None,
            keywords=prop.keywords if prop.keywords else None,
            last_modified_by=prop.last_modified_by if prop.last_modified_by else None,
            revision=str(prop.revision) if prop.revision else None,
            creation_date=str(prop.created) if prop.created else None,
            modification_date=str(prop.modified) if prop.modified else None,
            # python-docx doesn't easily expose company, manager, application, template directly
            # via simple properties, so they remain None unless we parse the XML directly.
        )
    except Exception:
        return DocumentMetadata(filename=None, file_type="docx")

def _extract_xlsx_metadata(content: bytes) -> DocumentMetadata:
    try:
        wb = openpyxl.load_workbook(filename=BytesIO(content), read_only=True)
        prop = wb.properties
        return DocumentMetadata(
            filename=None,
            file_type="xlsx",
            title=prop.title if prop.title else None,
            author=prop.creator if prop.creator else None,
            subject=prop.subject if prop.subject else None,
            keywords=prop.keywords if prop.keywords else None,
            last_modified_by=prop.lastModifiedBy if hasattr(prop, "lastModifiedBy") and prop.lastModifiedBy else None,
            creation_date=str(prop.created) if hasattr(prop, "created") and prop.created else None,
            modification_date=str(prop.modified) if hasattr(prop, "modified") and prop.modified else None,
        )
    except Exception:
        return DocumentMetadata(filename=None, file_type="xlsx")

def extract_document_metadata(content: bytes, filename: str | None = None) -> DocumentMetadata | None:
    file_type = _detect_file_type(content)
    if not file_type:
        return None
        
    if file_type == "pdf":
        meta = _extract_pdf_metadata(content)
    elif file_type == "docx":
        meta = _extract_docx_metadata(content)
    elif file_type == "xlsx":
        meta = _extract_xlsx_metadata(content)
    else:
        return None
        
    meta.filename = filename
    return meta

