from app.checkers.google_account import _gen_sapisidhash


def test_sapisidhash_format():
    """Formato documentado pelo Google: {timestamp}_{sha1(f'{timestamp} {SAPISID} {origin}')}."""
    result = _gen_sapisidhash("fakesapisidvalue", "https://photos.google.com", timestamp="1700000000")
    assert result.startswith("1700000000_")
    digest = result.split("_")[1]
    assert len(digest) == 40  # sha1 hexdigest
    assert all(c in "0123456789abcdef" for c in digest)


def test_sapisidhash_deterministic():
    a = _gen_sapisidhash("x", "https://photos.google.com", timestamp="123")
    b = _gen_sapisidhash("x", "https://photos.google.com", timestamp="123")
    assert a == b


def test_sapisidhash_changes_with_sapisid():
    a = _gen_sapisidhash("x", "https://photos.google.com", timestamp="123")
    b = _gen_sapisidhash("y", "https://photos.google.com", timestamp="123")
    assert a != b
