import json


def test_load_scheme_fixture_from_json_file(tmp_path) -> None:
    from app.knowledge_base.ingest import flatten_active_clauses, load_scheme_fixture

    path = tmp_path / "scheme.json"
    path.write_text(
        json.dumps(
            {
                "scheme_id": "nalsa",
                "scheme_name": "NALSA Legal Aid",
                "jurisdiction": "IN",
                "version": "2026-09-18",
                "clauses": [
                    {
                        "clause_id": "active",
                        "act_name": "Legal Services Authorities Act, 1987",
                        "section": "12(c)",
                        "text": "Women and children are eligible.",
                        "eligibility_criteria": {"category": {"in": ["woman", "child"]}},
                        "active": True,
                    },
                    {
                        "clause_id": "inactive",
                        "act_name": "Act",
                        "section": "1",
                        "text": "Old clause",
                        "eligibility_criteria": {},
                        "active": False,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )

    fixture = load_scheme_fixture(path)
    clauses = flatten_active_clauses(fixture)

    assert len(clauses) == 1
    assert clauses[0]["clause_id"] == "active"
    assert clauses[0]["citation"] == "Legal Services Authorities Act, 1987, Section 12(c)"

