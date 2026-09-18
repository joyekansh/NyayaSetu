import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import get_db
from app.main import create_app
from app.models.base import Base
from app.models.case import UrgencyTier
from app.models.case_record import CaseRecord


@pytest.fixture
def client() -> tuple[TestClient, sessionmaker[Session], MagicMock]:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    matcher = MagicMock(return_value=[{"citation": "Act, Section 12", "final_confidence": 0.8}])

    def override_db():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app = create_app(Settings())
    app.dependency_overrides[get_db] = override_db
    from app.matching.router import get_matcher

    app.dependency_overrides[get_matcher] = lambda: matcher
    return TestClient(app), factory, matcher


def test_matches_route_blocks_high_risk_case_before_matcher_call(client: tuple[TestClient, sessionmaker[Session], MagicMock]) -> None:
    test_client, factory, matcher = client
    with factory() as session:
        case = CaseRecord(urgency_tier=UrgencyTier.CRITICAL, urgency_score=40)
        session.add(case)
        session.commit()
        case_id = case.id

    response = test_client.get(f"/api/v1/cases/{case_id}/matches")

    assert response.status_code == 403
    assert response.json()["detail"] == "OPERATOR_RELEASE_REQUIRED"
    matcher.assert_not_called()


def test_matches_route_returns_matches_for_standard_case(client: tuple[TestClient, sessionmaker[Session], MagicMock]) -> None:
    test_client, factory, matcher = client
    with factory() as session:
        case = CaseRecord(urgency_tier=UrgencyTier.STANDARD, urgency_score=0)
        session.add(case)
        session.commit()
        case_id = case.id

    response = test_client.get(f"/api/v1/cases/{case_id}/matches")

    assert response.status_code == 200
    assert response.json()["matches"][0]["citation"] == "Act, Section 12"
    matcher.assert_called_once()


def test_matches_route_returns_404_for_unknown_case(client: tuple[TestClient, sessionmaker[Session], MagicMock]) -> None:
    test_client, _, matcher = client

    response = test_client.get(f"/api/v1/cases/{uuid.uuid4()}/matches")

    assert response.status_code == 404
    matcher.assert_not_called()

