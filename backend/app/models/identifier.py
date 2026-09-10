import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class IdentifierType(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    USERNAME = "username"
    DOMAIN = "domain"
    CORPORATE = "corporate"
    PERSON = "person"
    CRYPTO = "crypto"


class Identifier(Base):
    """O ponto de entrada de uma investigação: e-mail, telefone, username ou domínio."""

    __tablename__ = "identifiers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cases.id"), nullable=True)
    type: Mapped[IdentifierType]
    value: Mapped[str] = mapped_column(String(512), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    accounts: Mapped[list["Account"]] = relationship(back_populates="identifier")


class Account(Base):
    """Uma conta/plataforma encontrada como associada a um Identifier.

    `discovered_by` guarda qual checker nativo achou (ex: "checkers.username",
    "checkers.email") — nunca o nome de uma ferramenta de terceiro rodando externamente.
    """

    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("identifiers.id"))
    platform: Mapped[str] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    exists: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    discovered_by: Mapped[str] = mapped_column(String(255))
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    identifier: Mapped["Identifier"] = relationship(back_populates="accounts")
