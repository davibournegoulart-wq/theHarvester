"""Rotas de análise forense de e-mail — cabeçalhos e segurança de domínio.

Endpoints:
- POST /email-forensics/headers/analyze — parseia cabeçalhos brutos ou .eml
- GET  /email-forensics/security/{domain} — auditoria SPF/DMARC/DKIM/MX
"""

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.recon.email_header import analyze_email_headers, analyze_eml_file
from app.recon.email_security import audit_email_security

router = APIRouter(prefix="/email-forensics", tags=["email-forensics"])


class RawHeadersRequest(BaseModel):
    raw_headers: str


@router.post("/headers/analyze")
async def analyze_headers(body: RawHeadersRequest):
    """Parseia cabeçalhos de e-mail colados como texto bruto."""
    if not body.raw_headers.strip():
        raise HTTPException(status_code=400, detail="Cabeçalhos vazios.")
    return analyze_email_headers(body.raw_headers)


@router.post("/headers/analyze-eml")
async def analyze_eml(file: UploadFile = File(...)):
    """Parseia arquivo .eml enviado por upload."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    try:
        return analyze_eml_file(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível parsear o arquivo .eml.")


@router.get("/security/{domain}")
async def email_security_audit(domain: str):
    """Auditoria de segurança de e-mail de um domínio: MX, SPF, DMARC, DKIM, BIMI."""
    return await audit_email_security(domain)
