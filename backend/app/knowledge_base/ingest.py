import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.db import create_session_factory
from app.knowledge_base.schemas import SchemeFixture
from app.matching.vector_store import ChromaAdapter
from app.models.scheme_clause import SchemeClause

logger = logging.getLogger(__name__)


def load_scheme_fixture(path: str | Path) -> SchemeFixture:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return SchemeFixture.model_validate(data)


def flatten_active_clauses(fixture: SchemeFixture) -> list[dict[str, Any]]:
    clauses: list[dict[str, Any]] = []
    for clause in fixture.clauses:
        if not clause.active:
            continue
        clauses.append(
            {
                "scheme_id": fixture.scheme_id,
                "scheme_name": fixture.scheme_name,
                "jurisdiction": fixture.jurisdiction,
                "version": fixture.version,
                "clause_id": clause.clause_id,
                "act_name": clause.act_name,
                "section": clause.section,
                "citation": clause.citation,
                "text": clause.text,
                "eligibility_criteria": clause.eligibility_criteria,
            }
        )
    return clauses


def ingest_fixture_to_db(session: Session, fixture_path: str | Path) -> list[dict[str, Any]]:
    """Load fixture, upsert into DB, and return flattened clauses for Chroma."""
    fixture = load_scheme_fixture(fixture_path)
    clauses = flatten_active_clauses(fixture)

    for clause in clauses:
        existing = (
            session.query(SchemeClause)
            .filter_by(scheme_id=clause["scheme_id"], clause_id=clause["clause_id"])
            .first()
        )
        if existing:
            existing.title = clause["citation"]
            existing.text = clause["text"]
            existing.criteria = clause["eligibility_criteria"]
            existing.act_reference = clause["act_name"]
            existing.version = int(clause["version"].split("-")[0]) if "-" in clause["version"] else 1
        else:
            new_clause = SchemeClause(
                scheme_id=clause["scheme_id"],
                scheme_name=clause["scheme_name"],
                clause_id=clause["clause_id"],
                title=clause["citation"],
                text=clause["text"],
                criteria=clause["eligibility_criteria"],
                benefit_description="Free Legal Services",
                authority="NALSA",
                act_reference=clause["act_name"],
                version=int(clause["version"].split("-")[0]) if "-" in clause["version"] else 1,
            )
            session.add(new_clause)

    session.commit()
    logger.info(f"Ingested {len(clauses)} clauses from {fixture_path} into Postgres.")
    return clauses


def ingest_all(fixtures_dir: Path) -> None:
    """Ingest all JSON fixtures in directory into DB and Chroma."""
    session_factory = create_session_factory()
    adapter = ChromaAdapter()
    
    with session_factory() as session:
        for fixture_file in fixtures_dir.glob("*.json"):
            clauses = ingest_fixture_to_db(session, fixture_file)
            adapter.ingest_clauses(clauses)
            logger.info(f"Ingested {len(clauses)} clauses from {fixture_file.name} into Chroma.")


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    ingest_all(Path(__file__).parent / 'fixtures')

