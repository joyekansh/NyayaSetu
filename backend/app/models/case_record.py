import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, Numeric, String, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.case import CaseStatus, UrgencyTier


class CaseRecord(Base):
    __tablename__ = "cases"
    __table_args__ = (
        CheckConstraint("urgency_score IS NULL OR (urgency_score >= 0 AND urgency_score <= 100)", name="ck_cases_urgency_score_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, name="case_status", native_enum=False, create_constraint=True),
        default=CaseStatus.RECEIVED,
        nullable=False,
    )
    urgency_tier: Mapped[UrgencyTier | None] = mapped_column(
        Enum(UrgencyTier, name="urgency_tier", native_enum=False, create_constraint=True),
        nullable=True,
    )
    urgency_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="hi", nullable=False)
    intake_answers: Mapped[dict[str, object]] = mapped_column(type_=JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
