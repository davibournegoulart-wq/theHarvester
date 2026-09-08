from app.recon.phone_mentions import PLATFORM_DOMAINS, generate_phone_mention_queries


def test_generates_both_full_and_local_variants():
    queries = generate_phone_mention_queries("+5531996421873")
    query_text = " ".join(q.query for q in queries)

    assert "+5531996421873" in query_text
    assert "31996421873" in query_text  # variante sem código de país


def test_covers_every_platform_domain():
    queries = generate_phone_mention_queries("+5531996421873")
    platforms_covered = {q.platform for q in queries}

    assert "Web (geral)" in platforms_covered
    for platform in PLATFORM_DOMAINS:
        assert platform in platforms_covered


def test_does_not_duplicate_variant_when_number_has_no_country_code():
    queries = generate_phone_mention_queries("31996421873")
    web_queries = [q.query for q in queries if q.platform == "Web (geral)"]

    assert web_queries == ['"31996421873"']  # só uma variante, número já é local
