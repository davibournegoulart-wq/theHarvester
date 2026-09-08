"""Case management — schema de "incidente" com trilha de auditoria imutável.

Ver vault: Tools - Correlation and Case Management#Atlos. Alinhado à
convenção de incidente que o Shomer já usa na ingestão, mesmo sendo código
separado. `log_action` só faz INSERT — nunca UPDATE/DELETE em AuditLogEntry,
isso é o que garante a trilha imutável.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import AuditLogEntry, Case, CaseStatus


async def create_case(db: AsyncSession, name: str) -> Case:
    case = Case(name=name, status=CaseStatus.OPEN)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    await log_action(db, case.id, actor="system", action="case_created", payload={"name": name})
    return case


async def log_action(db: AsyncSession, case_id, actor: str, action: str, payload: dict | None = None) -> AuditLogEntry:
    """Registra uma ação na trilha de auditoria. Nunca editar/apagar uma entrada existente."""
    entry = AuditLogEntry(case_id=case_id, actor=actor, action=action, payload=payload or {})
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def archive_case(db: AsyncSession, case: Case, actor: str) -> Case:
    case.status = CaseStatus.ARCHIVED
    await db.commit()
    await log_action(db, case.id, actor=actor, action="case_archived")
    return case
