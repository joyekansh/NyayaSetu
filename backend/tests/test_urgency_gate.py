import pytest


def test_empty_or_malformed_input_is_standard_without_signals() -> None:
    from app.models.case import UrgencyTier
    from app.triage.scorer import score_case

    assert score_case(None).tier is UrgencyTier.STANDARD
    assert score_case("not a case").score == 0
    result = score_case({"eviction_notice_days_remaining": "5; DROP TABLE cases"})
    assert result.score == 0
    assert result.signals == ()


@pytest.mark.parametrize(
    ("case_data", "expected_signal", "expected_score", "expected_tier"),
    [
        ({"physical_violence_keywords_detected": True}, "VIOLENCE", 40, "CRITICAL"),
        ({"eviction_notice_days_remaining": 6}, "EVICTION_UNDER_SEVEN_DAYS", 35, "HIGH"),
        ({"criminal_detention_no_counsel_flag": True}, "DETENTION_WITHOUT_COUNSEL", 40, "CRITICAL"),
        ({"minor_or_dependent_at_risk": True}, "DEPENDENT_AT_RISK", 20, "HIGH"),
        ({"repeat_case_escalation": True}, "REPEAT_ESCALATION", 15, "STANDARD"),
    ],
)
def test_score_case_applies_each_design_report_signal_once(
    case_data: dict[str, object],
    expected_signal: str,
    expected_score: int,
    expected_tier: str,
) -> None:
    from app.triage.scorer import score_case

    result = score_case(case_data)

    assert result.score == expected_score
    assert result.tier.value == expected_tier
    assert tuple(signal.name for signal in result.signals) == (expected_signal,)


def test_evicting_in_seven_days_or_more_does_not_trigger_the_under_seven_day_signal() -> None:
    from app.models.case import UrgencyTier
    from app.triage.scorer import score_case

    result = score_case({"eviction_notice_days_remaining": 7})

    assert result.score == 0
    assert result.tier is UrgencyTier.STANDARD
    assert result.signals == ()


def test_duplicate_signal_entries_cannot_inflate_the_score() -> None:
    from app.triage.schemas import UrgencySignal
    from app.triage.scorer import UrgencyScorer

    class DuplicateViolenceCheck:
        def evaluate(self, case: object) -> UrgencySignal:
            return UrgencySignal(name="VIOLENCE", weight=40)

    result = UrgencyScorer(checks=(DuplicateViolenceCheck(), DuplicateViolenceCheck())).score({})

    assert result.score == 40
    assert tuple(signal.name for signal in result.signals) == ("VIOLENCE",)


@pytest.mark.parametrize(
    ("score", "expected_tier"),
    [
        (0, "STANDARD"),
        (19.99, "STANDARD"),
        (20, "HIGH"),
        (39.99, "HIGH"),
        (40, "CRITICAL"),
    ],
)
def test_tier_boundaries_match_the_design_report(score: float, expected_tier: str) -> None:
    from app.triage.scorer import tier_for_score

    assert tier_for_score(score).value == expected_tier


def test_standard_result_allows_matching_without_an_operator_release() -> None:
    from app.triage.scorer import score_case
    from app.triage.gate import require_match_access

    decision = require_match_access(score_case({}))

    assert decision.allowed is True
    assert decision.reason == "STANDARD_CASE"


@pytest.mark.parametrize(
    "case_data",
    [
        {"minor_or_dependent_at_risk": True},
        {"physical_violence_keywords_detected": True},
    ],
)
def test_high_and_critical_results_are_denied_without_an_explicit_release(case_data: dict[str, object]) -> None:
    from app.triage.scorer import score_case
    from app.triage.gate import require_match_access

    decision = require_match_access(score_case(case_data))

    assert decision.allowed is False
    assert decision.reason == "OPERATOR_RELEASE_REQUIRED"


@pytest.mark.parametrize(
    "release_data",
    [
        None,
        {"operator_id": "", "reason": "reviewed"},
        {"operator_id": "operator-7", "reason": "   "},
        {"operator_id": 7, "reason": "reviewed"},
    ],
)
def test_release_must_be_explicit_and_validated(release_data: object) -> None:
    from app.triage.scorer import score_case
    from app.triage.gate import GateRelease, require_match_access

    release = GateRelease.from_data(release_data)
    decision = require_match_access(score_case({"physical_violence_keywords_detected": True}), release)

    assert decision.allowed is False
    assert decision.reason == "OPERATOR_RELEASE_REQUIRED"


def test_valid_explicit_operator_release_allows_a_high_or_critical_case_to_match() -> None:
    from app.triage.scorer import score_case
    from app.triage.gate import GateRelease, require_match_access

    release = GateRelease.from_data({"operator_id": "operator-7", "reason": "Reviewed evidence"})
    decision = require_match_access(score_case({"physical_violence_keywords_detected": True}), release)

    assert decision.allowed is True
    assert decision.reason == "OPERATOR_RELEASED"
