import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import engine


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    """asyncpg amarra conexões ao event loop em que nasceram; pytest-asyncio cria um
    loop novo por teste (modo auto, escopo função) — sem isso, o 2º teste que toca o
    banco reusa uma conexão do loop anterior (já fechado) e explode com
    'another operation is in progress'. Descartar o pool força reconectar no loop atual.
    """
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def require_db():
    """Testes que tocam Postgres de verdade (case/incident.py, rotas /cases/*)
    usam essa fixture. Na CI o serviço postgres sempe está de pé (ver ci.yml);
    localmente, sem NETSCRAPER_DATABASE_URL apontando pra um Postgres real
    (ex: o do docker-compose, porta 5433, com `alembic upgrade head` aplicado),
    o teste pula em vez de falhar — não é falha de código, é ambiente sem banco.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as e:
        pytest.skip(f"Postgres indisponível para teste de integração: {e}")
