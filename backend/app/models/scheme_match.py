import enum
import uuid

from sqlalchemy import Column, Float, String, UniqueConstraint, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import DateTime, func

from app.models.base import Base


class MatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class SchemeMatch(Base):
    __tablename__ = "scheme_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    scheme_id = Column(String, nullable=False)
    clause_id = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)
    status = Column(Enum(MatchStatus), nullable=False, default=MatchStatus.PENDING)
    operator_reason = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("case_id", "scheme_id", "clause_id", name="uq_case_scheme_clause"),
    )
