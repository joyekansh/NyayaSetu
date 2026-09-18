import uuid
from datetime import date

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.base import Base
from app.models.case import CaseStatus, UrgencyTier
from app.models.case_record import CaseRecord
from app.models.document import Document, DocumentType, OcrStatus
from app.models.extracted_field import ExtractedField
from app.models.user import User, UserRole


class MemoryStorage:
    def __init__(self) -> None:
        self.saved: dict[str, bytes] = {}

    def save(self, *, case_id: uuid.UUID, filename: str, content: bytes) -> str:
        key = f"cases/{case_id}/{filename}"
        self.saved[key] = content
        return key

    def load(self, *, storage_key: str) -> bytes:
        return self.saved[storage_key]


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_pending_document_becomes_completed_with_fields_audit_and_triage() -> None:
    from app.extraction.ocr_engine import FakeOcrStrategy
    from app.extraction.tasks import DocumentExtractionProcessor
    from app.intake.schemas import DocumentUploadInput
    from app.intake.service import IntakeService

    session = _session()
    user = User(email="citizen@example.test", display_name="Citizen", role=UserRole.CITIZEN)
    session.add(user)
    session.flush()
    storage = MemoryStorage()
    upload = DocumentUploadInput(
        filename="cert.pdf",
        content=b"%PDF-1.7\nIncome Certificate No: INC-42\nName: Asha Devi\nAnnual Income: Rs. 2,50,000\nDate of Issue: 01/02/2026",
        document_type=DocumentType.INCOME_CERTIFICATE,
        uploaded_by_user_id=user.id,
    )
    case, document = IntakeService(session=session, storage=storage).create_case_with_document(upload=upload)
    session.commit()

    DocumentExtractionProcessor(
        session=session,
        storage=storage,
        ocr=FakeOcrStrategy(upload.content.decode("latin-1")),
        reference_date=date(2026, 2, 1),
    ).process(document.id)
    session.commit()

    refreshed = session.get(Document, document.id)
    assert refreshed is not None
    assert refreshed.ocr_status is OcrStatus.COMPLETED
    fields = session.scalars(select(ExtractedField).where(ExtractedField.document_id == document.id)).all()
    assert {field.field_name for field in fields} == {"certificate_number", "holder_name", "annual_income", "issue_date"}
    case_row = session.get(CaseRecord, case.id)
    assert case_row is not None
    assert case_row.status is CaseStatus.TRIAGED
    assert case_row.urgency_tier is UrgencyTier.STANDARD
    event_types = [event.event_type for event in session.scalars(select(AuditEvent).order_by(AuditEvent.sequence))]
    assert event_types == [
        "CASE_CREATED",
        "DOCUMENT_UPLOADED",
        "OCR_STARTED",
        "EXTRACTION_COMPLETED",
        "URGENCY_SCORED",
    ]


def test_extraction_failure_marks_document_failed_and_audits() -> None:
    from app.extraction.tasks import DocumentExtractionProcessor
    from app.intake.schemas import DocumentUploadInput
    from app.intake.service import IntakeService

    session = _session()
    user = User(email="citizen2@example.test", display_name="Citizen", role=UserRole.CITIZEN)
    session.add(user)
    session.flush()
    storage = MemoryStorage()
    upload = DocumentUploadInput(
        filename="other.pdf",
        content=b"%PDF-1.7\nunknown",
        document_type=DocumentType.OTHER,
        uploaded_by_user_id=user.id,
    )
    _, document = IntakeService(session=session, storage=storage).create_case_with_document(upload=upload)
    session.commit()

    from app.extraction.ocr_engine import FakeOcrStrategy

    with pytest.raises(Exception):
        DocumentExtractionProcessor(session=session, storage=storage, ocr=FakeOcrStrategy("text")).process(document.id)
    session.commit()

    assert session.get(Document, document.id).ocr_status is OcrStatus.FAILED
    assert "EXTRACTION_FAILED" in [
        event.event_type for event in session.scalars(select(AuditEvent).order_by(AuditEvent.sequence))
    ]

def test_speech_recording_routes_to_gemini_and_skips_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.extraction.tasks import DocumentExtractionProcessor
    from app.intake.schemas import DocumentUploadInput
    from app.intake.service import IntakeService
    from app.extraction.schemas import ParsedDocument, NormalizedField

    session = _session()
    user = User(email="citizen3@example.test", display_name="Citizen", role=UserRole.CITIZEN)
    session.add(user)
    session.flush()
    storage = MemoryStorage()
    upload = DocumentUploadInput(
        filename="speech.mp3",
        content=b"ID3fake audio data",
        document_type=DocumentType.SPEECH_RECORDING,
        uploaded_by_user_id=user.id,
    )
    case, document = IntakeService(session=session, storage=storage).create_case_with_document(upload=upload)
    session.commit()

    class FakeGeminiParser:
        def parse_audio(self, raw_bytes: bytes, mime_type: str | None = None) -> ParsedDocument:
            assert raw_bytes == b"ID3fake audio data"
            return ParsedDocument(document_type="SPEECH_RECORDING", fields=(
                NormalizedField(name="Summary", value="User needs help", confidence=0.9),
                NormalizedField(name="Intent", value="Legal Help", confidence=0.9),
            ))

    import app.extraction.parsers.gemini_audio_parser
    monkeypatch.setattr(app.extraction.parsers.gemini_audio_parser, "GeminiAudioParser", lambda: FakeGeminiParser())

    class CrashingOcrStrategy:
        def extract_text(self, document_bytes: bytes) -> str:
            raise RuntimeError("OCR should not be called for audio")

    DocumentExtractionProcessor(
        session=session,
        storage=storage,
        ocr=CrashingOcrStrategy(),
        reference_date=date(2026, 2, 1),
    ).process(document.id)
    session.commit()

    refreshed = session.get(Document, document.id)
    assert refreshed is not None
    assert refreshed.ocr_status is OcrStatus.COMPLETED
    fields = session.scalars(select(ExtractedField).where(ExtractedField.document_id == document.id)).all()
    assert {field.field_name for field in fields} == {"Summary", "Intent"}
