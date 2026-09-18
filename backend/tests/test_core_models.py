import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


@pytest.fixture()
def session() -> Session:
    from app.models.base import Base
    from app.models.case_record import CaseRecord
    from app.models.document import Document
    from app.models.extracted_field import ExtractedField
    from app.models.user import User

    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    Base.metadata.drop_all(engine)


def test_user_role_rejects_unknown_value() -> None:
    from app.models.user import UserRole

    with pytest.raises(ValueError):
        UserRole("UNTRUSTED")


def test_document_type_and_ocr_status_reject_unknown_values() -> None:
    from app.models.document import DocumentType, OcrStatus

    with pytest.raises(ValueError):
        DocumentType("EXECUTABLE")
    with pytest.raises(ValueError):
        OcrStatus("UNVERIFIED")


def test_document_relationships_link_user_and_case(session: Session) -> None:
    from app.models.case_record import CaseRecord
    from app.models.document import Document, DocumentType
    from app.models.extracted_field import ExtractedField
    from app.models.user import User, UserRole

    user = User(email="advocate@example.org", display_name="Asha Sharma", role=UserRole.ADVOCATE)
    case = CaseRecord()
    session.add_all((user, case))
    session.flush()
    document = Document(
        case_id=case.id,
        uploaded_by_user_id=user.id,
        document_type=DocumentType.INCOME_CERTIFICATE,
        storage_key="documents/2026/secure-object",
        checksum="a" * 64,
    )
    session.add(document)
    session.flush()
    field = ExtractedField(document_id=document.id, field_name="annual_income", value="120000", confidence=0.98)
    session.add(field)
    session.commit()

    assert document.case.id == case.id
    assert document.uploaded_by.id == user.id
    assert field.document.id == document.id


@pytest.mark.parametrize(
    ("storage_key", "checksum"),
    [
        ("", "a" * 64),
        ("documents/secure-object", "a" * 63),
    ],
)
def test_document_rejects_unsafe_storage_metadata(session: Session, storage_key: str, checksum: str) -> None:
    from app.models.case_record import CaseRecord
    from app.models.document import Document, DocumentType
    from app.models.user import User

    user = User(email=f"user-{uuid.uuid4()}@example.org", display_name="Test User")
    case = CaseRecord()
    session.add_all((user, case))
    session.flush()
    session.add(
        Document(
            case_id=case.id,
            uploaded_by_user_id=user.id,
            document_type=DocumentType.OTHER,
            storage_key=storage_key,
            checksum=checksum,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("confidence", [-0.01, 1.01])
def test_extracted_field_rejects_out_of_bounds_confidence(session: Session, confidence: float) -> None:
    from app.models.case_record import CaseRecord
    from app.models.document import Document, DocumentType
    from app.models.extracted_field import ExtractedField
    from app.models.user import User

    user = User(email=f"user-{uuid.uuid4()}@example.org", display_name="Test User")
    case = CaseRecord()
    session.add_all((user, case))
    session.flush()
    document = Document(
        case_id=case.id,
        uploaded_by_user_id=user.id,
        document_type=DocumentType.OTHER,
        storage_key="documents/secure-object",
        checksum="b" * 64,
    )
    session.add(document)
    session.flush()
    session.add(ExtractedField(document_id=document.id, field_name="income", value="120000", confidence=confidence))

    with pytest.raises(IntegrityError):
        session.commit()


def test_document_rejects_missing_case_relationship(session: Session) -> None:
    from app.models.document import Document, DocumentType
    from app.models.user import User

    user = User(email="user@example.org", display_name="Test User")
    session.add(user)
    session.flush()
    session.add(
        Document(
            case_id=uuid.uuid4(),
            uploaded_by_user_id=user.id,
            document_type=DocumentType.OTHER,
            storage_key="documents/secure-object",
            checksum="c" * 64,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()


def test_scheme_clause_creation(session: Session) -> None:
    from app.models.scheme_clause import SchemeClause

    clause = SchemeClause(
        scheme_id="nalsa_free_legal_aid",
        scheme_name="NALSA Free Legal Aid",
        clause_id="sec_12_a",
        title="Scheduled Caste or Scheduled Tribe Eligibility",
        text="A person who is a member of a Scheduled Caste or Scheduled Tribe...",
        criteria={"field": "social_category", "operator": "in", "value": ["SC", "ST"]},
        benefit_description="Free legal services for court proceedings",
        authority="NALSA",
        act_reference="Legal Services Authorities Act, 1987 Section 12(a)",
        is_active=True,
        version=1,
    )
    session.add(clause)
    session.commit()

    retrieved = session.query(SchemeClause).filter_by(clause_id="sec_12_a").first()
    assert retrieved is not None
    assert retrieved.scheme_id == "nalsa_free_legal_aid"
    assert retrieved.criteria["operator"] == "in"

