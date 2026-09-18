import pytest
from pydantic import ValidationError


def test_scheme_fixture_requires_clause_level_statutory_provenance() -> None:
    from app.knowledge_base.schemas import SchemeFixture

    fixture = SchemeFixture.model_validate(
        {
            "scheme_id": "nalsa-free-legal-aid",
            "scheme_name": "NALSA Free Legal Aid",
            "jurisdiction": "IN",
            "version": "2026-09-18",
            "clauses": [
                {
                    "clause_id": "lsa-1987-s12-c",
                    "act_name": "Legal Services Authorities Act, 1987",
                    "section": "12(c)",
                    "text": "A woman or a child is entitled to legal services.",
                    "eligibility_criteria": {"applicant_category": {"in": ["woman", "child"]}},
                    "active": True,
                }
            ],
        }
    )

    assert fixture.clauses[0].citation == "Legal Services Authorities Act, 1987, Section 12(c)"


@pytest.mark.parametrize(
    "bad_clause",
    [
        {"clause_id": "", "act_name": "Act", "section": "1", "text": "x", "eligibility_criteria": {}, "active": True},
        {"clause_id": "x", "act_name": "", "section": "1", "text": "x", "eligibility_criteria": {}, "active": True},
        {"clause_id": "x", "act_name": "Act", "section": "", "text": "x", "eligibility_criteria": {}, "active": True},
        {"clause_id": "x", "act_name": "Act", "section": "1", "text": "", "eligibility_criteria": {}, "active": True},
    ],
)
def test_scheme_fixture_rejects_missing_provenance_or_text(bad_clause: dict[str, object]) -> None:
    from app.knowledge_base.schemas import SchemeFixture

    with pytest.raises(ValidationError):
        SchemeFixture.model_validate(
            {
                "scheme_id": "scheme",
                "scheme_name": "Scheme",
                "jurisdiction": "IN",
                "version": "2026-09-18",
                "clauses": [bad_clause],
            }
        )


def test_scheme_fixture_rejects_duplicate_clause_ids() -> None:
    from app.knowledge_base.schemas import SchemeFixture

    clause = {
        "clause_id": "duplicate",
        "act_name": "Act",
        "section": "1",
        "text": "Clause text",
        "eligibility_criteria": {},
        "active": True,
    }

    with pytest.raises(ValidationError, match="duplicate clause_id"):
        SchemeFixture.model_validate(
            {
                "scheme_id": "scheme",
                "scheme_name": "Scheme",
                "jurisdiction": "IN",
                "version": "2026-09-18",
                "clauses": [clause, clause],
            }
        )

