"""Document extraction pipeline: OCR, parse, persist fields, triage, audit."""

from __future__ import annotations

import uuid
from datetime import date
from sqlalchemy.orm import Session

from app.audit_ledger import AuditEventRepository
from app.celery_app import celery_app
from app.db import create_session_factory
from app.document_processing import classify_processing_error
from app.extraction.ocr_engine import OcrStrategy
from app.extraction.parser_factory import UnsupportedDocumentTypeError, parser_for
from app.intake.storage import DocumentStorage
from app.models.case import CaseStatus
from app.models.case_record import CaseRecord
from app.models.document import Document, OcrStatus
from app.models.extracted_field import ExtractedField
from app.triage.scorer import score_case
from app.triage.urgency_context import build_urgency_case_data

_OCR_TRANSITIONS = {
    OcrStatus.PENDING: {OcrStatus.PROCESSING},
    OcrStatus.PROCESSING: {OcrStatus.COMPLETED, OcrStatus.FAILED},
    OcrStatus.COMPLETED: {OcrStatus.COMPLETED},
    OcrStatus.FAILED: {OcrStatus.FAILED},
}


class InvalidOcrTransition(ValueError):
    pass


def transition_ocr_status(current: OcrStatus, next_state: OcrStatus) -> OcrStatus:
    if next_state not in _OCR_TRANSITIONS[current]:
        raise InvalidOcrTransition(f"cannot transition {current} to {next_state}")
    return next_state


class DocumentExtractionProcessor:
    def __init__(
        self,
        *,
        session: Session,
        storage: DocumentStorage,
        ocr: OcrStrategy,
        reference_date: date | None = None,
    ) -> None:
        self._session = session
        self._storage = storage
        self._ocr = ocr
        self._reference_date = reference_date
        self._audit = AuditEventRepository(session)

    def process(self, document_id: uuid.UUID) -> None:
        document = self._session.get(Document, document_id)
        if document is None:
            raise LookupError(f"document {document_id} not found")
        if document.ocr_status not in {OcrStatus.PENDING, OcrStatus.PROCESSING}:
            return

        case = self._session.get(CaseRecord, document.case_id)
        if case is None:
            raise LookupError(f"case {document.case_id} not found")

        document.ocr_status = transition_ocr_status(document.ocr_status, OcrStatus.PROCESSING)
        self._session.flush()
        self._audit.append(
            case.id,
            "OCR_STARTED",
            {"document_id": str(document.id), "document_type": document.document_type.value},
        )

        try:
            raw_bytes = self._storage.load(storage_key=document.storage_key)
            text = self._ocr.extract_text(raw_bytes)
            parsed = parser_for(document.document_type).parse(text)
            for field in parsed.fields:
                self._session.add(
                    ExtractedField(
                        document_id=document.id,
                        field_name=field.name,
                        value=field.value,
                        confidence=field.confidence,
                    )
                )
            document.ocr_status = transition_ocr_status(document.ocr_status, OcrStatus.COMPLETED)
            case.status = CaseStatus.EXTRACTED
            self._session.flush()
            self._audit.append(
                case.id,
                "EXTRACTION_COMPLETED",
                {
                    "document_id": str(document.id),
                    "field_names": [field.name for field in parsed.fields],
                },
            )

            extracted = {field.name: field.value for field in parsed.fields}
            triage_input = build_urgency_case_data(extracted, reference_date=self._reference_date)
            triage = score_case(triage_input)
            case.urgency_score = float(triage.score)
            case.urgency_tier = triage.tier
            case.status = CaseStatus.TRIAGED
            self._session.flush()
            self._audit.append(
                case.id,
                "URGENCY_SCORED",
                {
                    "score": triage.score,
                    "tier": triage.tier.value,
                    "signals": [{"name": signal.name, "weight": signal.weight} for signal in triage.signals],
                },
            )
        except Exception as error:
            document.ocr_status = transition_ocr_status(document.ocr_status, OcrStatus.FAILED)
            disposition = classify_processing_error(error)
            self._audit.append(
                case.id,
                "EXTRACTION_FAILED",
                {
                    "document_id": str(document.id),
                    "error_type": type(error).__name__,
                    "disposition": disposition.value,
                },
            )
            raise


def _default_processor_factory(session: Session) -> DocumentExtractionProcessor:
    from app.config import get_settings
    from app.extraction.ocr_engine import TesseractOcrStrategy
    from app.intake.storage import LocalDocumentStorage

    settings = get_settings()
    storage_root = getattr(settings, "document_storage_root", "/tmp/nyayasetu-documents")
    return DocumentExtractionProcessor(
        session=session,
        storage=LocalDocumentStorage(storage_root),
        ocr=TesseractOcrStrategy(),
    )


@celery_app.task(name="process_document_extraction")
def process_document_extraction(document_id: str) -> None:
    session_factory = create_session_factory()
    session = session_factory()
    try:
        with session.begin():
            _default_processor_factory(session).process(uuid.UUID(document_id))
    finally:
        session.close()


celery_app.conf.task_routes = {"process_document_extraction": {"queue": "documents"}}
