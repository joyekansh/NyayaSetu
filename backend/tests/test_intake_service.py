import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.base import Base
from app.models.case_record import CaseRecord
from app.models.document import Document, DocumentType, OcrStatus
from app.models.user import User, UserRole


class MemoryStorage:
    def __init__(self) -> None:
        self.saved: dict[str, bytes] = {}

    def save(self, *, case_id: uuid.UUID, filename: str, content: bytes) -> str:
        key = f"cases/{case_id}/{filename}"
        self.saved[key] = content
        return key


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_create_case_with_document_persists_case_document_and_audit_events() -> None:
    from app.intake.schemas import DocumentUploadInput
    from app.intake.service import IntakeService

    session = _session()
    user = User(email="citizen@example.test", display_name="Citizen", role=UserRole.CITIZEN)
    session.add(user)
    session.flush()
    storage = MemoryStorage()
    upload = DocumentUploadInput(
        filename="notice.pdf",
        content=b"%PDF-1.7\nbody",
        document_type=DocumentType.EVICTION_NOTICE,
        uploaded_by_user_id=user.id,
    )

    case, document = IntakeService(session=session, storage=storage).create_case_with_document(upload=upload, language="en")

    assert session.get(CaseRecord, case.id) is not None
    assert session.get(Document, document.id) is not None
    assert document.case_id == case.id
    assert document.uploaded_by_user_id == user.id
    assert document.ocr_status is OcrStatus.PENDING
    assert storage.saved[document.storage_key] == upload.content
    assert [event.event_type for event in session.scalars(select(AuditEvent).order_by(AuditEvent.sequence))] == [
        "CASE_CREATED",
        "DOCUMENT_UPLOADED",
    ]

