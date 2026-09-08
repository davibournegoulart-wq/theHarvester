import pytest
from fastapi import HTTPException

from app.auth import require_api_key
from app.config import settings


def test_require_api_key_rejects_missing_key():
    with pytest.raises(HTTPException) as exc_info:
        require_api_key(x_api_key=None)
    assert exc_info.value.status_code == 401


def test_require_api_key_rejects_wrong_key():
    with pytest.raises(HTTPException) as exc_info:
        require_api_key(x_api_key="wrong-key")
    assert exc_info.value.status_code == 401


def test_require_api_key_accepts_correct_key():
    require_api_key(x_api_key=settings.api_key)  # não deve levantar exceção
