from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session


def test_cases_table_has_required_tier_and_status_constraints() -> None:
    from app.models.base import Base
    from app.models.case_record import CaseRecord

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    columns = {column["name"] for column in inspect(engine).get_columns(CaseRecord.__tablename__)}

    assert {"id", "status", "urgency_tier", "urgency_score", "language"} <= columns


def test_persisted_case_defaults_to_received_status() -> None:
    from app.models.base import Base
    from app.models.case import CaseStatus
    from app.models.case_record import CaseRecord

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        case = CaseRecord()
        session.add(case)
        session.flush()

        assert case.status == CaseStatus.RECEIVED
