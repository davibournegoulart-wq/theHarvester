import pytest

from app.recon.dork_engine import DorkRequest, generate_dorks


def test_raises_when_no_field_given():
    with pytest.raises(ValueError):
        generate_dorks(DorkRequest())


def test_full_name_generates_general_and_filetype_dorks():
    dorks = generate_dorks(DorkRequest(full_name="Davi Goulart"))
    queries = [d.query for d in dorks]

    assert '"Davi Goulart"' in queries
    assert any("filetype:pdf" in q for q in queries)


def test_first_and_last_name_combine_when_full_name_missing():
    dorks = generate_dorks(DorkRequest(first_name="Davi", last_name="Goulart"))
    assert any('"Davi Goulart"' in d.query for d in dorks)


def test_full_name_takes_priority_over_first_last():
    dorks = generate_dorks(DorkRequest(full_name="Nome Completo", first_name="Outro", last_name="Nome"))
    queries = [d.query for d in dorks]
    assert any('"Nome Completo"' in q for q in queries)
    assert not any('"Outro Nome"' in q for q in queries)


def test_domain_scopes_every_query():
    dorks = generate_dorks(DorkRequest(email="davi@example.com", domain="example.com"))
    assert all(q.query.startswith("site:example.com ") for q in dorks)


def test_specific_file_extension_overrides_default_list():
    dorks = generate_dorks(DorkRequest(email="davi@example.com", file_extension="xlsx"))
    filetype_dork = next(d for d in dorks if "filetype:" in d.query)
    assert filetype_dork.query.count("filetype:") == 1
    assert "filetype:xlsx" in filetype_dork.query


def test_multiple_subjects_get_a_combined_dork():
    dorks = generate_dorks(DorkRequest(full_name="Davi Goulart", email="davi@example.com"))
    combined = [d for d in dorks if d.intent == "documento que menciona todos os campos juntos"]
    assert len(combined) == 1
    assert '"Davi Goulart"' in combined[0].query
    assert '"davi@example.com"' in combined[0].query


def test_domain_only_falls_back_to_pure_domain_dorks():
    dorks = generate_dorks(DorkRequest(domain="example.com"))
    queries = [d.query for d in dorks]
    assert any("inurl:admin" in q for q in queries)  # vem do dork_generator.py original


def test_name_gets_social_and_public_record_templates():
    dorks = generate_dorks(DorkRequest(full_name="Davi Goulart"))
    queries = [d.query for d in dorks]

    assert any("linkedin.com/in/" in q for q in queries)
    assert any("jusbrasil.com.br" in q for q in queries)
    assert any("escavador.com" in q for q in queries)
    assert any("reddit.com" in q for q in queries)
    assert any("inurl:forum" in q for q in queries)
    # templates de contato não devem vazar pra um subject de nome
    assert not any("pastebin.com" in q for q in queries)


def test_email_gets_leak_templates_not_name_templates():
    dorks = generate_dorks(DorkRequest(email="davi@example.com"))
    queries = [d.query for d in dorks]

    assert any("pastebin.com" in q for q in queries)
    assert any('intext:"senha"' in q for q in queries)
    assert not any("linkedin.com" in q for q in queries)


def test_username_field_is_treated_as_contact_subject():
    dorks = generate_dorks(DorkRequest(username="davibourne"))
    queries = [d.query for d in dorks]

    assert '"davibourne"' in queries
    assert any("pastebin.com" in q for q in queries)
