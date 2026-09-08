import pytest

from app.recon.email_pattern import verify_via_smtp


def test_accepts_guaranteed_existing_mailbox():
    """postmaster@ é obrigatório por RFC 5321 — todo domínio de e-mail sério aceita.
    Se vier None, a rede daqui bloqueia a porta 25 de saída (comum em runner de CI
    hospedado) — não é falha do código, é ambiente sem esse protocolo liberado."""
    result = verify_via_smtp("postmaster@gmail.com")
    if result is None:
        pytest.skip("Porta 25 de saída bloqueada nesta rede — handshake SMTP não é possível daqui.")
    assert result is True


def test_rejects_definitely_nonexistent_mailbox():
    result = verify_via_smtp("xyzabc123nonexistent999test@gmail.com")
    if result is None:
        pytest.skip("Porta 25 de saída bloqueada nesta rede — handshake SMTP não é possível daqui.")
    assert result is False


def test_returns_none_for_domain_without_mx():
    assert verify_via_smtp("a@dominio-que-nao-existe-9x8z7.com") is None
