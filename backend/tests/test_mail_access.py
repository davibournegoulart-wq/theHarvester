import pytest
from app.recon.mail_access import (
    extract_localpart_name,
    compute_name_consensus,
    generate_defenders_brief,
    harvest_domain_emails,
    run_mail_access_deep_recon,
    HudsonRockIntel,
    XposedOrNotIntel,
    EmailRepIntel,
    M365TenantIntel,
    GoogleAccountIntel,
    NameConsensusResult,
)


def test_extract_localpart_name():
    assert extract_localpart_name("john.doe") == "John Doe"
    assert extract_localpart_name("katriel_moses") == "Katriel Moses"
    assert extract_localpart_name("alice.m.smith") == "Alice M Smith"
    assert extract_localpart_name("root") is None
    assert extract_localpart_name("admin123") is None


def test_compute_name_consensus_confirmed():
    candidates = [
        ("Katriel Moses", "PGP Keyserver", 1.0),
        ("Katriel Moses", "Gravatar Profile", 0.8),
        ("Katriel Moses", "Email Localpart Heuristic", 0.45),
    ]
    res = compute_name_consensus(candidates, "katriel.moses@example.com")
    assert res.confirmed_name == "Katriel Moses"
    assert res.name_confidence == "CONFIRMED"
    assert res.confidence_score >= 0.9
    assert "PGP Keyserver" in res.name_sources
    assert "Gravatar Profile" in res.name_sources
    assert "independent sources" in res.name_reasoning


def test_compute_name_consensus_probable():
    candidates = [
        ("Alice Wonderland", "Gravatar Profile", 0.8),
    ]
    res = compute_name_consensus(candidates, "alice@example.com")
    assert res.confirmed_name == "Alice Wonderland"
    assert res.name_confidence == "PROBABLE"


def test_compute_name_consensus_empty():
    res = compute_name_consensus([], "test@example.com")
    assert res.confirmed_name is None
    assert res.name_confidence == "UNKNOWN"


def test_generate_defenders_brief_critical():
    hr = HudsonRockIntel(
        is_compromised=True,
        total_infections=2,
        stealer_families=["Lumma", "Redline"],
        compromised_domains=["corp.internal"],
    )
    xposed = XposedOrNotIntel(breach_count=4, breaches=["Breach1", "Breach2"])
    rep = EmailRepIntel(suspicious=True)
    m365 = M365TenantIntel(is_m365=True, name_space_type="Managed")
    google = GoogleAccountIntel()
    name_res = NameConsensusResult(confirmed_name="Target Subject", name_confidence="CONFIRMED")

    brief = generate_defenders_brief(
        email="target@corp.com",
        domain="corp.com",
        hudson_rock=hr,
        xposed=xposed,
        emailrep=rep,
        m365=m365,
        google=google,
        name_consensus=name_res,
        mx_records=["mail.corp.com"],
    )

    assert brief.risk_level == "CRITICAL"
    assert "CRITICAL RISK" in brief.risk_summary
    assert any(f.severity == "CRITICAL" for f in brief.top_findings)
    assert "revoke all active M365/Google session tokens" in brief.next_action


def test_generate_defenders_brief_clean():
    hr = HudsonRockIntel(is_compromised=False)
    xposed = XposedOrNotIntel(breach_count=0)
    rep = EmailRepIntel(suspicious=False)
    m365 = M365TenantIntel(is_m365=False)
    google = GoogleAccountIntel(is_google=True, hosting_kind="workspace")
    name_res = NameConsensusResult()

    brief = generate_defenders_brief(
        email="clean@enterprise.com",
        domain="enterprise.com",
        hudson_rock=hr,
        xposed=xposed,
        emailrep=rep,
        m365=m365,
        google=google,
        name_consensus=name_res,
        mx_records=["aspmx.l.google.com"],
    )

    assert brief.risk_level == "CLEAN"
    assert "CLEAN POSTURE" in brief.risk_summary


@pytest.mark.asyncio
async def test_harvest_domain_emails():
    res = await harvest_domain_emails("example.com")
    assert res.domain == "example.com"
    assert len(res.harvested_emails) >= 10
    assert any(e.email == "security@example.com" for e in res.harvested_emails)
    assert any(e.email == "abuse@example.com" for e in res.harvested_emails)
    assert len(res.patterns) >= 3


@pytest.mark.asyncio
async def test_run_mail_access_deep_recon_invalid_email():
    res = await run_mail_access_deep_recon("invalid-email-no-at")
    assert not res.is_valid_format
    assert res.error == "Email address must contain '@'"
    assert res.defenders_brief.risk_level == "CLEAN"
