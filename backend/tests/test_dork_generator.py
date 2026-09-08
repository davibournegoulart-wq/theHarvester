from app.recon.dork_generator import DORK_TEMPLATES, generate_dorks


def test_generates_one_dork_per_template():
    dorks = generate_dorks("example.com")
    assert len(dorks) == len(DORK_TEMPLATES)


def test_domain_is_interpolated_into_every_query():
    dorks = generate_dorks("example.com")
    for dork in dorks:
        assert "example.com" in dork.query
        assert "{domain}" not in dork.query


def test_intent_keeps_the_original_template():
    dorks = generate_dorks("example.com")
    assert dorks[0].intent == DORK_TEMPLATES[0]
