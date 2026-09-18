import uuid

from sqlalchemy.orm import Session

from app.audit_ledger import AuditEventRepository
from app.intake.schemas import DocumentUploadInput
from app.intake.storage import DocumentStorage
from app.models.case_record import CaseRecord
from app.models.document import Document, OcrStatus


class IntakeService:
    def __init__(self, *, session: Session, storage: DocumentStorage) -> None:
        self._session = session
        self._storage = storage
        self._audit = AuditEventRepository(session)

    def create_case_with_document(self, *, upload: DocumentUploadInput, language: str = "hi") -> tuple[CaseRecord, Document]:
        case = CaseRecord(language=language)
        self._session.add(case)
        self._session.flush()

        storage_key = self._storage.save(case_id=case.id, filename=upload.filename, content=upload.content)
        document = Document(
            case_id=case.id,
            uploaded_by_user_id=upload.uploaded_by_user_id,
            document_type=upload.document_type,
            ocr_status=OcrStatus.PENDING,
            storage_key=storage_key,
            checksum=upload.checksum or "",
            content_type=upload.content_type,
        )
        self._session.add(document)
        self._session.flush()

        self._audit.append(case.id, "CASE_CREATED", {"language": case.language})
        self._append_document_uploaded(case.id, document)
        return case, document

    def attach_document(self, *, case_id: uuid.UUID, upload: DocumentUploadInput) -> Document:
        case = self._session.get(CaseRecord, case_id)
        if case is None:
            raise LookupError(f"case {case_id} not found")

        storage_key = self._storage.save(case_id=case.id, filename=upload.filename, content=upload.content)
        document = Document(
            case_id=case.id,
            uploaded_by_user_id=upload.uploaded_by_user_id,
            document_type=upload.document_type,
            ocr_status=OcrStatus.PENDING,
            storage_key=storage_key,
            checksum=upload.checksum or "",
            content_type=upload.content_type,
        )
        self._session.add(document)
        self._session.flush()
        self._append_document_uploaded(case.id, document)
        return document

    def _append_document_uploaded(self, case_id: uuid.UUID, document: Document) -> None:
        self._audit.append(
            case_id,
            "DOCUMENT_UPLOADED",
            {
                "document_id": str(document.id),
                "document_type": document.document_type.value,
                "content_type": document.content_type,
                "checksum": document.checksum,
            },
        )

