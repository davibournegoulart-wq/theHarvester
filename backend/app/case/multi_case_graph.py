"""Multi-Case Graph Builder.
Allows querying correlation graphs for ANY arbitrary subset of cases (2 or more),
or all cases, linking matching identifiers, accounts, files, and evidence across chosen cases.
"""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.case import CaseFile, AuditLogEntry
from app.models.identifier import Identifier, Account

async def get_edges_for_case_list(db: AsyncSession, case_ids: list[uuid.UUID] | None = None):
    """Returns correlation edges for a specific list of case IDs, or all if None."""
    if case_ids is not None and len(case_ids) == 0:
        return []

    is_multi = case_ids is None or len(case_ids) > 1

    if case_ids and len(case_ids) == 1:
        res_id = await db.execute(select(Identifier).where(Identifier.case_id == case_ids[0]))
        identifiers = res_id.scalars().all()
        res_acc = await db.execute(select(Account).join(Identifier).where(Identifier.case_id == case_ids[0]))
        accounts = res_acc.scalars().all()
        res_files = await db.execute(select(CaseFile).where(CaseFile.case_id == case_ids[0]))
        case_files = res_files.scalars().all()
        res_audit = await db.execute(
            select(AuditLogEntry).where(
                AuditLogEntry.case_id == case_ids[0],
                AuditLogEntry.action == "evidence_saved",
            )
        )
        evidence_logs = res_audit.scalars().all()
    elif case_ids and len(case_ids) > 1:
        res_id = await db.execute(select(Identifier).where(Identifier.case_id.in_(case_ids)))
        identifiers = res_id.scalars().all()
        res_acc = await db.execute(select(Account).join(Identifier).where(Identifier.case_id.in_(case_ids)))
        accounts = res_acc.scalars().all()
        res_files = await db.execute(select(CaseFile).where(CaseFile.case_id.in_(case_ids)))
        case_files = res_files.scalars().all()
        res_audit = await db.execute(
            select(AuditLogEntry).where(
                AuditLogEntry.case_id.in_(case_ids),
                AuditLogEntry.action == "evidence_saved",
            )
        )
        evidence_logs = res_audit.scalars().all()
    else:
        res_id = await db.execute(select(Identifier))
        identifiers = res_id.scalars().all()
        res_acc = await db.execute(select(Account))
        accounts = res_acc.scalars().all()
        res_files = await db.execute(select(CaseFile))
        case_files = res_files.scalars().all()
        res_audit = await db.execute(
            select(AuditLogEntry).where(AuditLogEntry.action == "evidence_saved")
        )
        evidence_logs = res_audit.scalars().all()

    edges = []

    # Cross-case matching
    if is_multi:
        val_map = {}
        for idx in identifiers:
            key = f"{idx.type.value}:{idx.value}"
            if key not in val_map:
                val_map[key] = []
            val_map[key].append(idx)

        for key, copies in val_map.items():
            if len(copies) > 1:
                for i in range(len(copies) - 1):
                    edges.append({
                        "source_id": f"[{copies[i].case_id}] {copies[i].type.value}:{copies[i].value}",
                        "target_id": f"[{copies[i+1].case_id}] {copies[i+1].type.value}:{copies[i+1].value}",
                        "relation_type": "cross_case_match",
                    })

    # Link identifiers to their discovered accounts
    for acc in accounts:
        parent = next((i for i in identifiers if i.id == acc.identifier_id), None)
        if not parent:
            continue

        prefix = f"[{parent.case_id}] " if is_multi else ""
        source = f"{prefix}{parent.type.value}:{parent.value}"
        target = f"{prefix}{acc.platform}:{acc.url or 'exists'}"

        edges.append({
            "source_id": source,
            "target_id": target,
            "relation_type": "has_account",
        })

    # Link Case Files
    for f in case_files:
        prefix = f"[{f.case_id}] " if is_multi else ""
        file_node_id = f"{prefix}{f.typology}:{f.original_filename}"
        
        case_idents = [i for i in identifiers if i.case_id == f.case_id]
        if case_idents:
            parent_ident = case_idents[0]
            ident_node = f"{prefix}{parent_ident.type.value}:{parent_ident.value}"
            edges.append({
                "source_id": ident_node,
                "target_id": file_node_id,
                "relation_type": "has_attachment",
            })
        else:
            edges.append({
                "source_id": f"{prefix}case:dossier",
                "target_id": file_node_id,
                "relation_type": "has_attachment",
            })

    # Link Evidence
    for ev in evidence_logs:
        url = ev.payload.get("url", "")
        if not url:
            continue
        prefix = f"[{ev.case_id}] " if is_multi else ""
        ev_node_id = f"{prefix}evidence:{url}"
        
        case_idents = [i for i in identifiers if i.case_id == ev.case_id]
        if case_idents:
            parent_ident = case_idents[0]
            ident_node = f"{prefix}{parent_ident.type.value}:{parent_ident.value}"
            edges.append({
                "source_id": ident_node,
                "target_id": ev_node_id,
                "relation_type": "evidence_link",
            })

    return edges
