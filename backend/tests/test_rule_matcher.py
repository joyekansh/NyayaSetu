import pytest


def test_rule_matcher_passes_supported_criteria() -> None:
    from app.matching.rule_matcher import MatchOutcome, evaluate_criteria

    result = evaluate_criteria(
        {
            "income": {"lte": 300000},
            "category": {"in": ["woman", "child"]},
            "district": {"equals": "Lucknow"},
            "aadhaar": {"exists": True},
        },
        {"income": 250000, "category": "woman", "district": "Lucknow", "aadhaar": "1234"},
    )

    assert result.outcome is MatchOutcome.PASS
    assert result.confidence_multiplier == 1.0
    assert result.reasons == ()


def test_rule_matcher_fails_without_throwing_on_rule_mismatch() -> None:
    from app.matching.rule_matcher import MatchOutcome, evaluate_criteria

    result = evaluate_criteria({"income": {"lte": 100000}}, {"income": 250000})

    assert result.outcome is MatchOutcome.FAIL
    assert result.confidence_multiplier == 0.0
    assert "income" in result.reasons[0]


def test_rule_matcher_returns_unknown_for_missing_case_values() -> None:
    from app.matching.rule_matcher import MatchOutcome, evaluate_criteria

    result = evaluate_criteria({"income": {"lte": 300000}}, {})

    assert result.outcome is MatchOutcome.UNKNOWN
    assert 0 < result.confidence_multiplier < 1


@pytest.mark.parametrize(
    ("criteria", "expected"),
    [
        ({"all": [{"income": {"lte": 300000}}, {"category": {"equals": "woman"}}]}, "PASS"),
        ({"any": [{"income": {"lte": 100000}}, {"category": {"equals": "woman"}}]}, "PASS"),
        ({"all": [{"income": {"gte": 500000}}, {"category": {"equals": "woman"}}]}, "FAIL"),
        ({"any": [{"income": {"gte": 500000}}, {"category": {"equals": "child"}}]}, "FAIL"),
    ],
)
def test_rule_matcher_supports_all_and_any(criteria: dict[str, object], expected: str) -> None:
    from app.matching.rule_matcher import MatchOutcome, evaluate_criteria

    result = evaluate_criteria(criteria, {"income": 250000, "category": "woman"})

    assert result.outcome is MatchOutcome(expected)

