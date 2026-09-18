import json
from pathlib import Path
from typing import Any

from app.knowledge_base.schemas import SchemeFixture


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

