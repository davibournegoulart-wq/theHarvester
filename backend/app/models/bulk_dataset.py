import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class BulkDataset(Base):
    """Metadado de um dump/vazamento importado. Ver [[Tools - Correlation and Case Management#Datasette]].

    As linhas em si não viram uma tabela SQL nova por dataset (isso explodiria o
    schema) — ficam serializadas em `rows_preview` pra amostra rápida, e o
    arquivo original fica em disco/object storage referenciado por `source_path`.
    `bulk/explorer.py` é quem sabe ler e filtrar isso sob demanda.
    """

    __tablename__ = "bulk_datasets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    source_path: Mapped[str] = mapped_column(String(1024))
    columns: Mapped[list] = mapped_column(JSON, default=list)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
