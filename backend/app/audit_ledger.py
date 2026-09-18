import hashlib
import json
import uuid
from collections.abc import Mapping
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


def compute_event_hash(
    *, case_id: uuid.UUID, event_type: str, payload: Mapping[str, Any], previous_hash: str | None
) -> str:
    canonical_event = {
        "case_id": str(case_id),
        "event_type": event_type,
        "payload": payload,
        "previous_hash": previous_hash,
    }
    serialized_event = json.dumps(
        canonical_event, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    return hashlib.sha256(serialized_event.encode("utf-8")).hexdigest()


class AuditEventRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def append(self, case_id: uuid.UUID, event_type: str, payload: Mapping[str, Any]) -> AuditEvent:
        latest_event = self._session.scalar(
            select(AuditEvent)
            .where(AuditEvent.case_id == case_id)
            .order_by(AuditEvent.sequence.desc())
            .limit(1)
        )
        previous_hash = latest_event.event_hash if latest_event else None
        event = AuditEvent(
            case_id=case_id,
            sequence=(latest_event.sequence if latest_event else 0) + 1,
            event_type=event_type,
            payload=dict(payload),
            previous_hash=previous_hash,
            event_hash=compute_event_hash(
                case_id=case_id,
                event_type=event_type,
                payload=payload,
                previous_hash=previous_hash,
            ),
        )
        self._session.add(event)
        self._session.flush()
        return event

    def list_for_case(self, case_id: uuid.UUID) -> list[AuditEvent]:
        return list(
            self._session.scalars(
                select(AuditEvent)
                .where(AuditEvent.case_id == case_id)
                .order_by(AuditEvent.sequence)
            )
        )
