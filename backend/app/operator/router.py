import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit_ledger import AuditEventRepository
from app.auth.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models.case import CaseStatus, UrgencyTier, requires_human_review
from app.models.case_record import CaseRecord
from app.models.user import UserRole
from app.models.scheme_match import SchemeMatch, MatchStatus
from app.config import get_settings
from app.intake.storage import LocalDocumentStorage
import io
from reportlab.pdfgen import canvas
router = APIRouter(prefix="/operator", tags=["operator"])


class ReleaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=1)


def require_operator(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role not in {UserRole.CASEWORKER, UserRole.ADVOCATE, UserRole.ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="operator role required")
    return user


@router.get("/queue")
def get_queue(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_operator),
) -> dict[str, list[dict[str, object]]]:
    cases = db.scalars(
        select(CaseRecord)
        .where(CaseRecord.urgency_tier.in_([UrgencyTier.HIGH, UrgencyTier.CRITICAL]))
        .order_by(CaseRecord.created_at)
    ).all()
    return {
        "cases": [
            {
                "id": str(case.id),
                "status": case.status.value,
                "urgency_tier": case.urgency_tier.value if case.urgency_tier else None,
                "urgency_score": float(case.urgency_score) if case.urgency_score is not None else None,
            }
            for case in cases
        ]
    }


@router.post("/cases/{case_id}/release")
def release_case(
    case_id: uuid.UUID,
    body: ReleaseRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> dict[str, str]:
    case = db.get(CaseRecord, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="case not found")
    if case.urgency_tier is None or not requires_human_review(case.urgency_tier):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="case does not require release")

    case.status = CaseStatus.IN_REVIEW
    case.gate_release_operator = str(current_user.id)
    case.gate_release_reason = body.reason
    AuditEventRepository(db).append(
        case.id,
        "GATE_RELEASED",
        {"operator_id": str(current_user.id), "reason": body.reason},
    )
    db.commit()
    return {"status": case.status.value}


class ReferralRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(min_length=1)
    referred_schemes: str = Field(min_length=1)


@router.post("/cases/{case_id}/referral")
def create_referral(
    case_id: uuid.UUID,
    body: ReferralRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_operator),
) -> dict[str, str]:
    from app.models.referral import Referral
    case = db.get(CaseRecord, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="case not found")
    
    # Generate PDF Referral Artifact
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer)
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, 800, f"NyayaSetu Referral Document")
    p.setFont("Helvetica", 12)
    p.drawString(100, 770, f"Case ID: {case_id}")
    p.drawString(100, 750, f"Prepared By: {current_user.display_name} (ID: {current_user.id})")
    p.drawString(100, 720, "Summary:")
    # Text wrapping is manual in raw canvas, but we'll keep it simple for the artifact
    summary_lines = body.summary.split('\n')
    y = 700
    for line in summary_lines:
        p.drawString(100, y, line[:80]) # very naive wrap
        y -= 20
        
    p.drawString(100, y - 20, "Referred Schemes:")
    schemes_lines = body.referred_schemes.split('\n')
    y -= 40
    for line in schemes_lines:
        p.drawString(100, y, line[:80])
        y -= 20
        
    p.showPage()
    p.save()
    
    pdf_bytes = buffer.getvalue()
    settings = get_settings()
    storage = LocalDocumentStorage(settings.storage_dir)
    storage_key = storage.save(case_id=case_id, filename="referral.pdf", content=pdf_bytes)

    referral = Referral(
        case_id=case_id,
        operator_id=str(current_user.id),
        summary=body.summary,
        referred_schemes=body.referred_schemes,
        document_id=storage_key
    )
    db.add(referral)
    case.status = CaseStatus.REFERRED
    AuditEventRepository(db).append(
        case.id,
        "REFERRAL_CREATED",
        {"operator_id": str(current_user.id), "summary": body.summary, "referred_schemes": body.referred_schemes, "document_id": storage_key},
    )
    db.commit()
    return {"status": case.status.value, "document_id": storage_key}


@router.post('/cases/{case_id}/matches/{clause_id}/approve')
def approve_match(case_id: uuid.UUID, clause_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_operator)) -> dict[str, str]:
    case = db.get(CaseRecord, case_id)
    if case is None: raise HTTPException(status_code=404, detail='case not found')
    match = db.query(SchemeMatch).filter_by(case_id=case_id, clause_id=clause_id).first()
    if match:
        match.status = MatchStatus.APPROVED
    AuditEventRepository(db).append(case.id, 'MATCH_APPROVED', {'operator_id': str(current_user.id), 'clause_id': clause_id})
    db.commit()
    return {'status': 'approved'}

@router.post('/cases/{case_id}/matches/{clause_id}/reject')
def reject_match(case_id: uuid.UUID, clause_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(require_operator)) -> dict[str, str]:
    case = db.get(CaseRecord, case_id)
    if case is None: raise HTTPException(status_code=404, detail='case not found')
    match = db.query(SchemeMatch).filter_by(case_id=case_id, clause_id=clause_id).first()
    if match:
        match.status = MatchStatus.REJECTED
    AuditEventRepository(db).append(case.id, 'MATCH_REJECTED', {'operator_id': str(current_user.id), 'clause_id': clause_id})
    db.commit()
    return {'status': 'rejected'}
