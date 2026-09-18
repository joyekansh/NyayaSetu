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
    AuditEventRepository(db).append(
        case.id,
        "GATE_RELEASED",
        {"operator_id": str(current_user.id), "reason": body.reason},
    )
    db.commit()
    return {"status": case.status.value}

