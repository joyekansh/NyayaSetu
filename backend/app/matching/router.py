import uuid
from typing import Protocol

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.case import UrgencyTier
from app.models.case_record import CaseRecord
from app.triage.gate import require_match_access
from app.triage.schemas import TriageResult

router = APIRouter(prefix="/cases", tags=["matches"])


class CaseMatcher(Protocol):
    def __call__(self, *, case_id: uuid.UUID, case_fields: dict[str, object]) -> list[dict[str, object]]:
        """Return already-guarded, provenance-bearing match cards."""


def get_matcher() -> CaseMatcher:
    def _not_configured(*, case_id: uuid.UUID, case_fields: dict[str, object]) -> list[dict[str, object]]:
        del case_id, case_fields
        return []

    return _not_configured


@router.get("/{case_id}/matches")
def list_matches(
    case_id: uuid.UUID,
    db: Session = Depends(get_db),
    matcher: CaseMatcher = Depends(get_matcher),
) -> dict[str, list[dict[str, object]]]:
    case = db.get(CaseRecord, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="case not found")

    tier = case.urgency_tier or UrgencyTier.STANDARD
    score = int(case.urgency_score or 0)
    decision = require_match_access(TriageResult(score=score, tier=tier, signals=()))
    if not decision.allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=decision.reason)

    return {"matches": matcher(case_id=case.id, case_fields={})}

