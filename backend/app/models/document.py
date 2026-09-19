import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User


class DocumentType(StrEnum):
    IDENTITY_DOCUMENT = "IDENTITY_DOCUMENT"
    AADHAAR = "AADHAAR"
    INCOME_CERTIFICATE = "INCOME_CERTIFICATE"
    EVICTION_NOTICE = "EVICTION_NOTICE"
    SPEECH_RECORDING = "SPEECH_RECORDING"
    OTHER = "OTHER"


class OcrStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint("length(storage_key) > 0", name="ck_documents_storage_key_not_blank"),
        CheckConstraint("length(checksum) = 64", name="ck_documents_checksum_sha256_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="RESTRICT"), index=True, nullable=False)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type", native_enum=False, create_constraint=True, validate_strings=True),
        nullable=False,
    )
    ocr_status: Mapped[OcrStatus] = mapped_column(
        Enum(OcrStatus, name="ocr_status", native_enum=False, create_constraint=True, validate_strings=True),
        default=OcrStatus.PENDING,
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    case: Mapped["CaseRecord"] = relationship("CaseRecord")
    uploaded_by: Mapped["User"] = relationship("User")
