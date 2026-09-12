import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.case import Case, CaseFile, CaseGeolocation, AuditLogEntry
from app.models.identifier import Identifier, Account

async def get_graph_elements_for_case(db: AsyncSession, case_id: uuid.UUID | None = None) -> tuple[list[dict], list[dict]]:
    """Returns all graph nodes and correlation edges for a specific case (or all cases).
    Unifies Cases, Identifiers, Discovered Accounts, Geolocations, Files/Documents,
    Preserved Evidence, Leaked Credentials/Secrets, and Biometric Faces in Maltego style.
    """
    nodes: list[dict] = []
    edges: list[dict] = []
    node_ids_set: set[str] = set()

    def add_node(n_id: str, label: str, n_type: str = "default", details: dict | None = None):
        if n_id not in node_ids_set:
            node_ids_set.add(n_id)
            nodes.append({
                "id": n_id,
                "label": label,
                "type": n_type,
                "details": details or {},
            })

    def add_edge(source: str, target: str, rel_type: str = "related", confidence: float = 1.0):
        edges.append({
            "source_id": source,
            "target_id": target,
            "relation_type": rel_type,
            "confidence": confidence,
        })

    # 1. Cases
    if case_id:
        res_cases = await db.execute(select(Case).where(Case.id == case_id))
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

    # 2. Identifiers & Accounts
    if case_id:
        res_id = await db.execute(select(Identifier).where(Identifier.case_id == case_id))
    else:
        res_id = await db.execute(select(Identifier))
    identifiers = res_id.scalars().all()
    ident_map = {i.id: i for i in identifiers}

    if case_id:
        res_acc = await db.execute(select(Account).join(Identifier).where(Identifier.case_id == case_id))
    else:
        res_acc = await db.execute(select(Account))
    accounts = res_acc.scalars().all()

    # 3. Case Geolocations
    if case_id:
        res_geo = await db.execute(select(CaseGeolocation).where(CaseGeolocation.case_id == case_id))
    else:
        res_geo = await db.execute(select(CaseGeolocation))
    geolocations = res_geo.scalars().all()

    # 4. Case Files / Databank Storage
    if case_id:
        res_files = await db.execute(select(CaseFile).where(CaseFile.case_id == case_id))
    else:
        res_files = await db.execute(select(CaseFile))
    case_files = res_files.scalars().all()

    # 5. Audit Log Entries (Evidence, Secrets, Biometrics, Pins)
    if case_id:
        res_audit = await db.execute(
            select(AuditLogEntry).where(
                AuditLogEntry.case_id == case_id,
                AuditLogEntry.action.in_([
                    "evidence_saved",
                    "secret_exposed",
                    "secrets_detected",
                    "leak_found",
                    "face_matched",
                    "face_detected",
                    "biometric_recon",
                    "geolocation_pinned",
                ])
            )
        )
    else:
        res_audit = await db.execute(
            select(AuditLogEntry).where(
                AuditLogEntry.action.in_([
                    "evidence_saved",
                    "secret_exposed",
                    "secrets_detected",
                    "leak_found",
                    "face_matched",
                    "face_detected",
                    "biometric_recon",
                    "geolocation_pinned",
                ])
            )
        )
    audit_logs = res_audit.scalars().all()

    is_multi = case_id is None

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
        add_node(
            file_node_id,
            label=f.original_filename,
            n_type=typology,
            details={
                "id": str(f.id),
                "filename": f.original_filename,
                "typology": f.typology,
                "size": f.file_size,
                "mime": f.mime_type,
                "source_url": f.source_url,
            },
        )
        case_node_id = f"case:{f.case_id}"
        parent_node = None
        if f.source_url and f.source_url.startswith("node:"):
            cand = f.source_url[5:]
            if cand in node_ids_set:
                parent_node = cand
        if not parent_node:
            parent_node = case_node_id

        if parent_node in node_ids_set:
            add_edge(parent_node, file_node_id, rel_type="attached_file", confidence=1.0)

    # Connect Audit Log Evidence, Secrets, Biometrics
    for entry in audit_logs:
        prefix = f"[{entry.case_id}] " if is_multi else ""
        case_node_id = f"case:{entry.case_id}"

        if entry.action == "evidence_saved":
            url = entry.payload.get("url", "")
            if url:
                ev_node_id = f"{prefix}evidence:{entry.id}"
                note = entry.payload.get("note") or ""
                title = entry.payload.get("title") or ""
                target_node = entry.payload.get("target_node_id")

                if title:
                    ev_label = title
                elif note:
                    ev_label = note
                else:
                    ev_label = url[:35] + "..." if len(url) > 35 else url

                is_doc = any(url.lower().endswith(ext) for ext in [".pdf", ".doc", ".docx", ".txt", ".xlsx", ".csv"]) or "dork" in note.lower()

                add_node(
                    ev_node_id,
                    label=ev_label,
                    n_type="document" if is_doc else "evidence",
                    details={"url": url, "note": note, "title": title, "target_node_id": target_node, "preserved_at": entry.created_at.isoformat()},
                )

                parent_node = target_node if (target_node and target_node in node_ids_set) else case_node_id
                if parent_node in node_ids_set:
                    add_edge(parent_node, ev_node_id, rel_type="attached_link" if target_node else "evidence_saved", confidence=1.0)

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
            add_node(
                bio_node_id,
                label=bio_label,
                n_type="biometric",
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

    # Cross-case matching across identical identifiers when viewing all cases
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

async def get_edges_for_case(db: AsyncSession, case_id: uuid.UUID | None = None):
    """Backward compatibility wrapper returning only correlation edges."""
    _, edges = await get_graph_elements_for_case(db, case_id)
    return edges

