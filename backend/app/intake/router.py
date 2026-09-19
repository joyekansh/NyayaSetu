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


def _map_doc_type(raw: str | None) -> DocumentType:
    if not raw:
        return DocumentType.OTHER
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
    case = CaseRecord(language=body.language, intake_answers=body.intake_answers)
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
    doc_type: Annotated[str | None, Form()] = None,
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


@router.get("/{case_id}")
def get_case_detail(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    print(f"DEBUG: getting case {case_id}")
    case = db.get(CaseRecord, case_id)
    if case is None:
        print("DEBUG: case is None")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="case not found")
    print(f"DEBUG: found case {case.id}")

    from app.triage.gate import require_match_access, GateRelease
    from app.triage.schemas import TriageResult
    from app.models.case import UrgencyTier
    from app.models.scheme_match import SchemeMatch

    tier = case.urgency_tier or UrgencyTier.STANDARD
    score = int(case.urgency_score or 0)
    
    release = None
    if case.gate_release_operator and case.gate_release_reason:
        release = GateRelease(
            operator_id=case.gate_release_operator,
            reason=case.gate_release_reason
        )
        
    decision = require_match_access(TriageResult(score=score, tier=tier, signals=()), release=release)
    
    docs = db.query(Document).filter(Document.case_id == case_id).all()
    documents_data = []
    for d in docs:
        documents_data.append({
            "id": str(d.id),
            "case_id": str(d.case_id),
            "doc_type": d.document_type.value,
            "ocr_status": d.ocr_status.value,
            "ocr_engine": None,
            "ocr_confidence": None,
            "uploaded_at": d.created_at.isoformat(),
            "preview_url": None,
            "extracted_fields": []
        })

    matches_data = None
    if decision.allowed:
        matches = db.query(SchemeMatch).filter(SchemeMatch.case_id == case_id).all()
        matches_data = []
        for m in matches:
            matches_data.append({
                "id": str(m.id) if hasattr(m, "id") else str(uuid.uuid4()),
                "case_id": str(m.case_id),
                "scheme_name": m.scheme_id, # Simplified for demo
                "act_name": None,
                "section_number": None,
                "clause_text": m.clause_id,
                "semantic_score": float(m.confidence_score),
                "rule_eligibility_pass": True,
                "final_confidence": float(m.confidence_score),
                "operator_decision": m.status.value.lower() if hasattr(m, 'status') and m.status else "pending",
                "decision_reason": None,
                "decided_at": None,
            })

    return {
        "id": str(case.id),
        "status": case.status.value,
        "urgency_tier": case.urgency_tier.value if case.urgency_tier else None,
        "urgency_score": float(case.urgency_score) if case.urgency_score is not None else None,
        "district": case.intake_answers.get('district'),
        "language": case.language,
        "created_at": case.created_at.isoformat(),
        "updated_at": case.updated_at.isoformat(),
        "citizen_id": str(current_user.id),
        "created_by_operator_id": None,
        "documents": documents_data,
        "matches": matches_data,
        "gated": not decision.allowed,
        "gate_notice": decision.reason if not decision.allowed else None,
        "triage_signals": None,
        "triage_reasoning": case.triage_reasoning
    }

