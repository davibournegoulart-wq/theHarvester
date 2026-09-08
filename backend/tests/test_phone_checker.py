from app.checkers.phone import lookup_phone_metadata


def test_lookup_known_valid_number():
    # Número de exemplo oficial do Google pra testes (não é número real de ninguém)
    result = lookup_phone_metadata("+14155552671")
    assert result.is_valid is True
    assert result.country is not None


def test_lookup_invalid_number():
    result = lookup_phone_metadata("+1123")
    assert result.is_valid is False
