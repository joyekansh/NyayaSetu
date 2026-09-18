from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import get_db
from app.main import create_app
from app.models.audit_event import AuditEvent
from app.models.base import Base
from app.models.case import CaseStatus, UrgencyTier
from app.models.case_record import CaseRecord
from app.models.user import User, UserRole
import jwt
from datetime import datetime, timedelta, timezone


def _client() -> tuple[TestClient, sessionmaker[Session], User, User]:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    with factory() as session:
        citizen = User(email="citizen@example.test", display_name="Citizen", role=UserRole.CITIZEN)
        caseworker = User(email="worker@example.test", display_name="Worker", role=UserRole.CASEWORKER)
        session.add_all([citizen, caseworker])
        session.commit()
        session.refresh(citizen)
        session.refresh(caseworker)

    app = create_app(Settings())
    app.dependency_overrides[get_db] = override_db
    return TestClient(app), factory, citizen, caseworker

def _auth_header(user: User, settings: Settings) -> dict[str, str]:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {"sub": str(user.id), "exp": expire}
    token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return {"Authorization": f"Bearer {token}"}


def test_operator_queue_requires_caseworker_role() -> None:
    client, _, citizen, _ = _client()
    settings = Settings()
    response = client.get("/api/v1/operator/queue", headers=_auth_header(citizen, settings))
    assert response.status_code == 403


def test_operator_queue_returns_high_risk_cases() -> None:
    client, factory, _, caseworker = _client()
    with factory() as session:
        urgent = CaseRecord(status=CaseStatus.TRIAGED, urgency_tier=UrgencyTier.CRITICAL, urgency_score=40)
        standard = CaseRecord(status=CaseStatus.TRIAGED, urgency_tier=UrgencyTier.STANDARD, urgency_score=0)
        session.add_all([urgent, standard])
        session.commit()
        urgent_id = str(urgent.id)

    response = client.get("/api/v1/operator/queue", headers=_auth_header(caseworker, Settings()))

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["cases"]] == [urgent_id]


def test_operator_release_moves_case_to_review_and_audits() -> None:
    client, factory, _, caseworker = _client()
    with factory() as session:
        case = CaseRecord(status=CaseStatus.TRIAGED, urgency_tier=UrgencyTier.HIGH, urgency_score=35)
        session.add(case)
        session.commit()
        case_id = case.id

    response = client.post(
        f"/api/v1/operator/cases/{case_id}/release",
        json={"reason": "Reviewed urgency evidence"},
        headers=_auth_header(caseworker, Settings()),
    )

    assert response.status_code == 200
    with factory() as session:
        assert session.get(CaseRecord, case_id).status is CaseStatus.IN_REVIEW
        events = session.scalars(select(AuditEvent).where(AuditEvent.case_id == case_id)).all()
        assert [event.event_type for event in events] == ["GATE_RELEASED"]

