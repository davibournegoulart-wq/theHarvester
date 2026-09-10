import uuid
from datetime import datetime, timezone

def generate_stix_bundle(case, identifiers, accounts, audit_log):
    now = datetime.now(timezone.utc).isoformat() + "Z"
    
    objects = []
    
    # 1. Indicator for the Case / Threat
    case_id = f"report--{uuid.uuid4()}"
    objects.append({
        "type": "report",
        "spec_version": "2.1",
        "id": case_id,
        "created": now,
        "modified": now,
        "name": f"Net Scraper OSINT Dossier: {case.name}",
        "published": now,
        "object_refs": []
    })
    
    # 2. Map Identifiers and Accounts
    id_map = {}
    for ident in identifiers:
        obs_id = None
        if ident.type == "email":
            obs_id = f"email-addr--{uuid.uuid4()}"
            objects.append({
                "type": "email-addr",
                "spec_version": "2.1",
                "id": obs_id,
                "value": ident.value
            })
        elif ident.type == "domain":
            obs_id = f"domain-name--{uuid.uuid4()}"
            objects.append({
                "type": "domain-name",
                "spec_version": "2.1",
                "id": obs_id,
                "value": ident.value
            })
        elif ident.type == "phone":
            obs_id = f"mac-addr--{uuid.uuid4()}" # Missing standard phone type, using placeholder or generic
            objects.append({
                "type": "identity", # Phone numbers often modeled as identity or custom
                "spec_version": "2.1",
                "id": f"identity--{uuid.uuid4()}",
                "name": ident.value,
                "identity_class": "unknown",
                "contact_information": ident.value
            })
            
        if obs_id:
            id_map[ident.id] = obs_id
            objects[0]["object_refs"].append(obs_id)
            
    for acc in accounts:
        acc_id = f"user-account--{uuid.uuid4()}"
        objects.append({
            "type": "user-account",
            "spec_version": "2.1",
            "id": acc_id,
            "account_login": f"{acc.platform} account",
            "account_type": acc.platform,
            "is_active": acc.exists
        })
        objects[0]["object_refs"].append(acc_id)
        
        # Link account to identifier if mapped
        if acc.identifier_id in id_map:
            objects.append({
                "type": "relationship",
                "spec_version": "2.1",
                "id": f"relationship--{uuid.uuid4()}",
                "created": now,
                "modified": now,
                "relationship_type": "related-to",
                "source_ref": id_map[acc.identifier_id],
                "target_ref": acc_id
            })

    return {
        "type": "bundle",
        "id": f"bundle--{uuid.uuid4()}",
        "objects": objects
    }
