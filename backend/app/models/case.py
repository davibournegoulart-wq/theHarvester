import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class CaseStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    COLD = "COLD"
    ARCHIVED = "ARCHIVED"


class Case(Base):
    """Investigação/caso. Ver [[Tools - Correlation and Case Management#Atlos]] no vault."""

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[CaseStatus] = mapped_column(default=CaseStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    audit_log: Mapped[list["AuditLogEntry"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    files: Mapped[list["CaseFile"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    geolocations: Mapped[list["CaseGeolocation"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    monitors: Mapped[list["CaseTargetMonitor"]] = relationship(back_populates="case", cascade="all, delete-orphan")


class AuditLogEntry(Base):
    """Trilha de auditoria imutável — nenhuma linha é atualizada ou deletada, só inserida."""

    __tablename__ = "audit_log_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"))
    actor: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(255))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    case: Mapped["Case"] = relationship(back_populates="audit_log")


class CaseFile(Base):
    """Local databank storage for case files, downloaded web documents, and forensic assets."""

    __tablename__ = "case_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"))
    filename: Mapped[str] = mapped_column(String(512))
    original_filename: Mapped[str] = mapped_column(String(512))
    typology: Mapped[str] = mapped_column(String(100), default="document")  # document, dork_dump, image, evidence, corporate, audio, video
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    file_size: Mapped[int] = mapped_column(default=0)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    case: Mapped["Case"] = relationship(back_populates="files")
    geolocations: Mapped[list["CaseGeolocation"]] = relationship(back_populates="attached_file")


class CaseGeolocation(Base):
    """Geolocations linked to a case (from photo EXIF, corporate address, or manual mapping).
    Allows pinning exact coordinates, linking evidence URLs and attaching case databank files.
    """

    __tablename__ = "case_geolocations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    label: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(255), default="manual")
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    attached_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("case_files.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    case: Mapped["Case"] = relationship(back_populates="geolocations")
    attached_file: Mapped["CaseFile | None"] = relationship(back_populates="geolocations")


class AlertWebhook(Base):
    """Webhook endpoints for dispatching real-time notifications to Discord, Telegram, Slack, or generic HTTP endpoints."""

    __tablename__ = "alert_webhooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(2048))
    platform: Mapped[str] = mapped_column(String(50), default="generic")  # discord, telegram, slack, generic
    events: Mapped[list] = mapped_column(JSON, default=lambda: ["evidence_added", "target_alert", "spider_match", "case_created"])
    secret_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    last_status: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)


class CaseTargetMonitor(Base):
    """Scheduled background watchdog for periodically re-scraping targets and detecting new findings."""

    __tablename__ = "case_target_monitors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    target_type: Mapped[str] = mapped_column(String(50))  # username, domain, crypto, onion, social
    target_value: Mapped[str] = mapped_column(String(1024))
    interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")  # ACTIVE, PAUSED, ERROR
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    last_findings_summary: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    case: Mapped["Case"] = relationship(back_populates="monitors")


