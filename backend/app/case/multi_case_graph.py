"""Multi-Case Graph Builder.
Allows querying correlation graphs for ANY arbitrary subset of cases (2 or more),
or all cases, linking matching identifiers, accounts, files, geolocations, secrets,
biometrics, and evidence across chosen cases in Maltego style.
"""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.case import Case, CaseFile, CaseGeolocation, AuditLogEntry
from app.models.identifier import Identifier, Account

async def get_graph_elements_for_case_list(db: AsyncSession, case_ids: list[uuid.UUID] | None = None) -> tuple[list[dict], list[dict]]:
    """Returns all graph nodes and correlation edges for a list of case IDs (or all cases if None)."""
    if case_ids is not None and len(case_ids) == 0:
        return [], []

    nodes: list[dict] = []
    edges: list[dict] = []
    node_ids_set: set[str] = set()

    def add_node(n_id: str, label: str, n_type: str = "default", details: dict | None = None, image: str | None = None):
        if n_id not in node_ids_set:
            node_ids_set.add(n_id)
            nodes.append({
                "id": n_id,
                "label": label,
                "type": n_type,
                "details": details or {},
                "image": image,
            })
        else:
            if image:
                for existing in nodes:
                    if existing["id"] == n_id and not existing.get("image"):
                        existing["image"] = image
                        break

    def add_edge(source: str, target: str, rel_type: str = "related", confidence: float = 1.0, label: str | None = None):
        edges.append({
            "source_id": source,
            "target_id": target,
            "relation_type": rel_type,
            "confidence": confidence,
            "label": label or rel_type,
        })

    is_multi = case_ids is None or len(case_ids) > 1

    # 1. Cases
    if case_ids and len(case_ids) == 1:
        res_cases = await db.execute(select(Case).where(Case.id == case_ids[0]))
    elif case_ids and len(case_ids) > 1:
        res_cases = await db.execute(select(Case).where(Case.id.in_(case_ids)))
    else:
        res_cases = await db.execute(select(Case))
    cases = res_cases.scalars().all()

    for c in cases:
        c_node_id = f"case:{c.id}"
        add_node(
            c_node_id,
            label=f"CASE: {c.name}",
            n_type="case",
            details={"id": str(c.id), "name": c.name, "status": c.status.value, "created_at": c.created_at.isoformat()},
        )

    audit_filter = AuditLogEntry.action.in_([
        "evidence_saved",
        "secret_exposed",
        "secrets_detected",
        "leak_found",
        "face_matched",
        "face_detected",
        "biometric_recon",
        "geolocation_pinned",
        "manual_edge_created",
    ])

    # 2. Identifiers & Accounts
    if case_ids and len(case_ids) == 1:
        res_id = await db.execute(select(Identifier).where(Identifier.case_id == case_ids[0]))
        identifiers = res_id.scalars().all()
        res_acc = await db.execute(select(Account).join(Identifier).where(Identifier.case_id == case_ids[0]))
        accounts = res_acc.scalars().all()
        res_geo = await db.execute(select(CaseGeolocation).where(CaseGeolocation.case_id == case_ids[0]))
        geolocations = res_geo.scalars().all()
        res_files = await db.execute(select(CaseFile).where(CaseFile.case_id == case_ids[0]))
        case_files = res_files.scalars().all()
        res_audit = await db.execute(select(AuditLogEntry).where(AuditLogEntry.case_id == case_ids[0], audit_filter))
        audit_logs = res_audit.scalars().all()
    elif case_ids and len(case_ids) > 1:
        res_id = await db.execute(select(Identifier).where(Identifier.case_id.in_(case_ids)))
        identifiers = res_id.scalars().all()
        res_acc = await db.execute(select(Account).join(Identifier).where(Identifier.case_id.in_(case_ids)))
        accounts = res_acc.scalars().all()
        res_geo = await db.execute(select(CaseGeolocation).where(CaseGeolocation.case_id.in_(case_ids)))
        geolocations = res_geo.scalars().all()
        res_files = await db.execute(select(CaseFile).where(CaseFile.case_id.in_(case_ids)))
        case_files = res_files.scalars().all()
        res_audit = await db.execute(select(AuditLogEntry).where(AuditLogEntry.case_id.in_(case_ids), audit_filter))
        audit_logs = res_audit.scalars().all()
    else:
        res_id = await db.execute(select(Identifier))
        identifiers = res_id.scalars().all()
        res_acc = await db.execute(select(Account))
        accounts = res_acc.scalars().all()
        res_geo = await db.execute(select(CaseGeolocation))
        geolocations = res_geo.scalars().all()
        res_files = await db.execute(select(CaseFile))
        case_files = res_files.scalars().all()
        res_audit = await db.execute(select(AuditLogEntry).where(audit_filter))
        audit_logs = res_audit.scalars().all()

    ident_map = {i.id: i for i in identifiers}

    # Connect Identifiers to their Case Hubs
    for idx in identifiers:
        prefix = f"[{idx.case_id}] " if is_multi else ""
        idx_node_id = f"{prefix}{idx.type.value}:{idx.value}"
        add_node(
            idx_node_id,
            label=idx.value,
            n_type=idx.type.value,
            details={"type": idx.type.value, "value": idx.value, "case_id": str(idx.case_id)},
        )
        case_node_id = f"case:{idx.case_id}"
        if case_node_id in node_ids_set:
            add_edge(case_node_id, idx_node_id, rel_type="investigates", confidence=1.0)

    # Connect Accounts to parent Identifiers
    for acc in accounts:
        parent = ident_map.get(acc.identifier_id)
        if not parent:
            continue
        prefix = f"[{parent.case_id}] " if is_multi else ""
        parent_node_id = f"{prefix}{parent.type.value}:{parent.value}"
        
        platform_name = acc.platform.lower()
        clean_label = acc.url or f"@{acc.platform}"
        if acc.url and "/" in acc.url:
            parts = [p for p in acc.url.rstrip("/").split("/") if p]
            if parts:
                clean_label = f"@{parts[-1]} ({acc.platform})"
        
        acc_node_id = f"{prefix}account:{platform_name}:{acc.url or acc.id}"
        add_node(
            acc_node_id,
            label=clean_label,
            n_type=platform_name,
            details={
                "platform": acc.platform,
                "url": acc.url,
                "discovered_by": acc.discovered_by,
                "exists": acc.exists,
                "metadata": acc.metadata_json,
            },
        )
        add_edge(parent_node_id, acc_node_id, rel_type="has_account", confidence=1.0)

    # Connect Case Geolocations
    for geo in geolocations:
        prefix = f"[{geo.case_id}] " if is_multi else ""
        geo_node_id = f"{prefix}geolocation:{geo.id}"
        label_text = geo.label or f"{geo.latitude:.4f}, {geo.longitude:.4f}"
        add_node(
            geo_node_id,
            label=f"📍 {label_text}",
            n_type="geolocation",
            details={
                "id": str(geo.id),
                "label": geo.label,
                "latitude": geo.latitude,
                "longitude": geo.longitude,
                "source": geo.source,
                "description": geo.description,
                "source_url": geo.source_url,
                "attached_file_id": str(geo.attached_file_id) if geo.attached_file_id else None,
            },
        )
        case_node_id = f"case:{geo.case_id}"
        if case_node_id in node_ids_set:
            add_edge(case_node_id, geo_node_id, rel_type="located_at", confidence=1.0)

        if geo.attached_file_id:
            file_node_id = f"{prefix}file:{geo.attached_file_id}"
            add_edge(geo_node_id, file_node_id, rel_type="located_document", confidence=1.0)

    # Connect Case Files / Databank Storage
    for f in case_files:
        prefix = f"[{f.case_id}] " if is_multi else ""
        file_node_id = f"{prefix}file:{f.id}"
        typology = (f.typology or "document").lower()
        is_image = typology == "image" or (f.mime_type and f.mime_type.startswith("image/"))
        img_url = f"/cases/{f.case_id}/files/{f.id}/download" if is_image else None

        add_node(
            file_node_id,
            label=f.original_filename,
            n_type=typology,
            image=img_url,
            details={
                "id": str(f.id),
                "filename": f.original_filename,
                "typology": f.typology,
                "size": f.file_size,
                "mime": f.mime_type,
                "source_url": f.source_url,
                "image": img_url,
            },
        )
        case_node_id = f"case:{f.case_id}"
        parent_node = None
        if f.source_url and f.source_url.startswith("node:"):
            cand = f.source_url[5:]
            if cand in node_ids_set:
                parent_node = cand
                if is_image:
                    for existing in nodes:
                        if existing["id"] == cand and not existing.get("image"):
                            existing["image"] = img_url
                            break
        if not parent_node:
            parent_node = case_node_id

        if parent_node in node_ids_set:
            add_edge(parent_node, file_node_id, rel_type="attached_file", confidence=1.0)

    # Connect Audit Log Evidence, Secrets, Biometrics, and Manual Knots
    for entry in audit_logs:
        prefix = f"[{entry.case_id}] " if is_multi else ""
        case_node_id = f"case:{entry.case_id}"

        if entry.action == "evidence_saved":
            url = entry.payload.get("url", "")
            if url:
                ev_node_id = f"{prefix}evidence:{entry.id}"
                note = entry.payload.get("note") or ""
                ev_label = note if note else (url[:40] + "..." if len(url) > 40 else url)
                add_node(
                    ev_node_id,
                    label=ev_label,
                    n_type="evidence",
                    details={"url": url, "note": note, "preserved_at": entry.created_at.isoformat()},
                )
                if case_node_id in node_ids_set:
                    add_edge(case_node_id, ev_node_id, rel_type="evidence_saved", confidence=1.0)

        elif entry.action in ("secret_exposed", "secrets_detected", "leak_found"):
            rule = entry.payload.get("rule", "Credential Leak")
            sec_node_id = f"{prefix}secret:{entry.id}"
            add_node(
                sec_node_id,
                label=f"🔑 {rule}",
                n_type="secret",
                details=entry.payload,
            )
            if case_node_id in node_ids_set:
                add_edge(case_node_id, sec_node_id, rel_type="exposed_secret", confidence=1.0)

        elif entry.action in ("face_matched", "face_detected", "biometric_recon"):
            sim = entry.payload.get("similarity")
            bio_node_id = f"{prefix}biometric:{entry.id}"
            bio_label = f"👤 Face Match ({sim:.1f}%)" if sim is not None else "👤 Biometric Face"
            face_img = entry.payload.get("image_url") or entry.payload.get("thumbnail_url")
            add_node(
                bio_node_id,
                label=bio_label,
                n_type="biometric",
                image=face_img,
                details=entry.payload,
            )
            if case_node_id in node_ids_set:
                add_edge(case_node_id, bio_node_id, rel_type="biometric_match", confidence=1.0)

        elif entry.action == "geolocation_pinned":
            geo_id = entry.payload.get("id") or str(entry.id)
            geo_node_id = f"{prefix}geolocation:{geo_id}"
            if geo_node_id not in node_ids_set:
                lbl = entry.payload.get("label", "Pinned Coordinate")
                add_node(
                    geo_node_id,
                    label=f"📍 {lbl}",
                    n_type="geolocation",
                    details=entry.payload,
                )
                if case_node_id in node_ids_set:
                    add_edge(case_node_id, geo_node_id, rel_type="located_at", confidence=1.0)

        elif entry.action == "manual_edge_created":
            src = entry.payload.get("source")
            tgt = entry.payload.get("target")
            rel = entry.payload.get("relation_type", "connected_to")
            lbl = entry.payload.get("label") or rel
            if src and tgt:
                add_edge(src, tgt, rel_type=rel, label=lbl, confidence=1.5)

    # Cross-case matching
    if is_multi:
        val_map: dict[str, list[Identifier]] = {}
        for idx in identifiers:
            key = f"{idx.type.value}:{idx.value.strip().lower()}"
            if key not in val_map:
                val_map[key] = []
            val_map[key].append(idx)

        for key, copies in val_map.items():
            if len(copies) > 1:
                for i in range(len(copies) - 1):
                    s_node = f"[{copies[i].case_id}] {copies[i].type.value}:{copies[i].value}"
                    t_node = f"[{copies[i+1].case_id}] {copies[i+1].type.value}:{copies[i+1].value}"
                    add_edge(s_node, t_node, rel_type="cross_case_match", confidence=2.0)

    return nodes, edges

async def get_edges_for_case_list(db: AsyncSession, case_ids: list[uuid.UUID] | None = None):
    """Backward compatibility wrapper returning only correlation edges."""
    _, edges = await get_graph_elements_for_case_list(db, case_ids)
    return edges

