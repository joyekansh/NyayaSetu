import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SchemeClause(Base):
    __tablename__ = "scheme_clauses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scheme_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    scheme_name: Mapped[str] = mapped_column(String(255), nullable=False)
    clause_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    criteria: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict
    )
    benefit_description: Mapped[str] = mapped_column(Text, nullable=False)
    authority: Mapped[str] = mapped_column(String(255), nullable=False)
    act_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("scheme_id", "clause_id", "version", name="uq_scheme_clause_version"),
    )
