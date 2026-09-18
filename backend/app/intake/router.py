import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy.orm import Session

from app.auth.deps import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.intake.schemas import DocumentUploadInput, UploadValidationError
from app.intake.service import IntakeService
from app.intake.storage import LocalDocumentStorage
from app.models.case_record import CaseRecord
from app.models.document import Document, DocumentType, OcrStatus

router = APIRouter(prefix="/cases", tags=["cases"])

DOC_TYPE_ALIASES = {
    "income_cert": DocumentType.INCOME_CERTIFICATE,
    "income_certificate": DocumentType.INCOME_CERTIFICATE,
    "eviction_notice": DocumentType.EVICTION_NOTICE,
    "aadhaar": DocumentType.AADHAAR,
}


class CreateCaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: str = Field(default="hi", min_length=2, max_length=5)
    consent_given: bool
    district: str | None = None
    intake_answers: dict[str, object] = Field(default_factory=dict)


class CaseSummaryResponse(BaseModel):
    id: uuid.UUID
    status: str
    urgency_tier: str | None
    urgency_score: float | None
    language: str


class DocumentResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    document_type: str
    ocr_status: str
    checksum: str


def _storage(settings: Settings = Depends(get_settings)) -> LocalDocumentStorage:
    return LocalDocumentStorage(settings.document_storage_root)


def _map_doc_type(raw: str) -> DocumentType:
    normalized = raw.strip().lower()
    if normalized in DOC_TYPE_ALIASES:
        return DOC_TYPE_ALIASES[normalized]
    try:
        return DocumentType(normalized.upper())
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unsupported document type") from error


@router.post("", response_model=CaseSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    body: CreateCaseRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> CaseSummaryResponse:
    if not body.consent_given:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="consent required")
    case = CaseRecord(language=body.language)
    db.add(case)
    db.commit()
    db.refresh(case)
    return CaseSummaryResponse(
        id=case.id,
        status=case.status.value,
        urgency_tier=case.urgency_tier.value if case.urgency_tier else None,
        urgency_score=float(case.urgency_score) if case.urgency_score is not None else None,
        language=case.language,
    )


@router.post("/{case_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    case_id: uuid.UUID,
    file: Annotated[UploadFile, File()],
    doc_type: Annotated[str, Form()],
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    storage: LocalDocumentStorage = Depends(_storage),
) -> DocumentResponse:
    if db.get(CaseRecord, case_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="case not found")
    content = file.file.read()
    filename = file.filename or "upload.bin"
    try:
        upload = DocumentUploadInput(
            filename=filename,
            content=content,
            document_type=_map_doc_type(doc_type),
            uploaded_by_user_id=current_user.id,
        )
    except (UploadValidationError, ValidationError) as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    service = IntakeService(session=db, storage=storage)
    try:
        document = service.attach_document(case_id=case_id, upload=upload)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="case not found") from error
    db.commit()

    from app.extraction.tasks import process_document_extraction

    process_document_extraction.delay(str(document.id))

    return DocumentResponse(
        id=document.id,
        case_id=document.case_id,
        document_type=document.document_type.value,
        ocr_status=document.ocr_status.value,
        checksum=document.checksum,
    )
