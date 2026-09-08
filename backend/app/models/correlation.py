import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Correlation(Base):
    """Aresta do grafo: liga duas Account (ou Account<->Identifier) com a fonte que correlacionou.

    Ver [[Architecture Roadmap#Fase 1]] no vault — isso é o dado que alimenta o
    `graph/engine.py` (networkx), nunca um grafo de terceiro embutido.
    """

    __tablename__ = "correlations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    target_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    relation_type: Mapped[str] = mapped_column(String(255))
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    discovered_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
