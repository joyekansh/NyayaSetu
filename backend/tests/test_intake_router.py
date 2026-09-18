import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.db import get_db
from app.main import create_app
from app.models.audit_event import AuditEvent
from app.models.base import Base
from app.models.case_record import CaseRecord
from app.models.document import Document
from app.models.user import User, UserRole
import jwt
from datetime import datetime, timedelta, timezone


@pytest.fixture
def client(tmp_path) -> tuple[TestClient, sessionmaker[Session], list[str]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    enqueued: list[str] = []

    def override_db():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    settings = Settings(document_storage_root=str(tmp_path))
    app = create_app(settings)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = lambda: settings

    import app.extraction.tasks as extraction_tasks

    extraction_tasks.process_document_extraction.delay = MagicMock(side_effect=lambda doc_id: enqueued.append(doc_id))

    with factory() as session:
        user = User(email="citizen@example.test", display_name="Citizen", role=UserRole.CITIZEN)
        session.add(user)
        session.commit()
        user_id = str(user.id)

    test_client = TestClient(app)
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {"sub": user_id, "exp": expire}
    token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    test_client.headers.update({"Authorization": f"Bearer {token}"})
    return test_client, factory, enqueued


def test_upload_route_rejects_disguised_file(client: tuple[TestClient, sessionmaker[Session], list[str]]) -> None:
    test_client, factory, _ = client
    with factory() as session:
        case = CaseRecord(language="en")
        session.add(case)
        session.commit()
        case_id = str(case.id)

    response = test_client.post(
        f"/api/v1/cases/{case_id}/documents",
        data={"doc_type": "eviction_notice"},
        files={"file": ("report.pdf", b"\xff\xd8\xff\xe0jpeg-bytes", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "disguised" in response.json()["detail"].lower() or "extension" in response.json()["detail"].lower()


def test_upload_route_creates_document_and_enqueues_after_commit(
    client: tuple[TestClient, sessionmaker[Session], list[str]],
) -> None:
    test_client, factory, enqueued = client
    with factory() as session:
        case = CaseRecord(language="en")
        session.add(case)
        session.commit()
        case_id = case.id

    response = test_client.post(
        f"/api/v1/cases/{case_id}/documents",
        data={"doc_type": "income_cert"},
        files={"file": ("cert.pdf", b"%PDF-1.7\nbody", "application/pdf")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["ocr_status"] == "PENDING"
    with factory() as session:
        document = session.get(Document, uuid.UUID(body["id"]))
        assert document is not None
        assert document.case_id == case_id
        events = session.scalars(select(AuditEvent).order_by(AuditEvent.sequence)).all()
        assert [event.event_type for event in events] == ["DOCUMENT_UPLOADED"]
    assert enqueued == [body["id"]]


def test_create_case_requires_consent(client: tuple[TestClient, sessionmaker[Session], list[str]]) -> None:
    test_client, _, _ = client
    denied = test_client.post("/api/v1/cases", json={"consent_given": False, "language": "en"})
    assert denied.status_code == 422
    created = test_client.post("/api/v1/cases", json={"consent_given": True, "language": "en"})
    assert created.status_code == 201
    assert created.json()["status"] == "RECEIVED"
