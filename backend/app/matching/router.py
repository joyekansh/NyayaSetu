import uuid
from typing import Protocol

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.matching.hybrid_matcher import HybridMatcher
from app.matching.semantic_matcher import SemanticMatcher
from app.matching.vector_store import ChromaAdapter
from app.models.case import UrgencyTier
from app.models.case_record import CaseRecord
from app.models.document import Document
from app.models.extracted_field import ExtractedField
from app.triage.gate import require_match_access
from app.triage.schemas import TriageResult

router = APIRouter(prefix="/cases", tags=["matches"])


class CaseMatcher(Protocol):
    def __call__(self, *, case_id: uuid.UUID, case_fields: dict[str, object]) -> list[dict[str, object]]:
        """Return already-guarded, provenance-bearing match cards."""


def get_matcher(db: Session = Depends(get_db)) -> CaseMatcher:
    def _match(*, case_id: uuid.UUID, case_fields: dict[str, object]) -> list[dict[str, object]]:
        # If case_fields is empty, populate from DB
        if not case_fields:
            fields = (
                db.query(ExtractedField)
                .join(Document)
                .filter(Document.case_id == case_id)
                .all()
            )
            for f in fields:
                case_fields[f.field_name] = f.value

        adapter = ChromaAdapter()
        semantic_matcher = SemanticMatcher(vector_store=adapter)
        hybrid_matcher = HybridMatcher(semantic_matcher=semantic_matcher)
        return hybrid_matcher.match(case_fields=case_fields)

    return _match


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

    matches = matcher(case_id=case.id, case_fields={})
    
    from app.models.scheme_match import SchemeMatch, MatchStatus
    from sqlalchemy.dialects.postgresql import insert
    
    if matches:
        # Bulk upsert the matches to the database
        stmt = insert(SchemeMatch).values([
            {
                "case_id": case.id,
                "scheme_id": match["scheme_id"],
                "clause_id": match["clause_id"],
                "confidence_score": match["final_confidence"],
                "status": MatchStatus.PENDING
            } for match in matches
        ])
        stmt = stmt.on_conflict_do_update(
            index_elements=["case_id", "scheme_id", "clause_id"],
            set_={"confidence_score": stmt.excluded.confidence_score}
        )
        db.execute(stmt)
        db.commit()

    return {"matches": matches}

