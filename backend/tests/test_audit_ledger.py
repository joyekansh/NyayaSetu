import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session


def test_event_hash_is_deterministic_for_reordered_json_payloads() -> None:
    from app.audit_ledger import compute_event_hash

    case_id = uuid.UUID("12345678-1234-5678-1234-567812345678")

    first_hash = compute_event_hash(
        case_id=case_id,
        event_type="CASE_RECEIVED",
        payload={"source": "helpline", "details": {"language": "hi", "priority": 3}},
        previous_hash=None,
    )
    reordered_hash = compute_event_hash(
        case_id=case_id,
        event_type="CASE_RECEIVED",
        payload={"details": {"priority": 3, "language": "hi"}, "source": "helpline"},
        previous_hash=None,
    )

    assert reordered_hash == first_hash
    assert len(first_hash) == 64


def test_append_links_each_event_to_the_previous_hash() -> None:
    from app.audit_ledger import AuditEventRepository
    from app.models.base import Base
    from app.models.audit_event import AuditEvent

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    case_id = uuid.uuid4()

    with Session(engine) as session:
        repository = AuditEventRepository(session)
        first_event = repository.append(case_id, "CASE_RECEIVED", {"source": "helpline"})
        second_event = repository.append(case_id, "CASE_TRIAGED", {"urgency": "HIGH"})

        assert first_event.previous_hash is None
        assert second_event.previous_hash == first_event.event_hash
        assert second_event.sequence == 2
        assert repository.list_for_case(case_id) == [first_event, second_event]

def test_repository_exposes_append_and_read_operations_only() -> None:
    from app.audit_ledger import AuditEventRepository

    public_methods = {
        name
        for name, value in vars(AuditEventRepository).items()
        if callable(value) and not name.startswith("_")
    }

    assert public_methods == {"append", "list_for_case"}
