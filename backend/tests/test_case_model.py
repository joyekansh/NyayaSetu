import pytest


def test_case_status_rejects_unknown_value() -> None:
    from app.models.case import CaseStatus

    with pytest.raises(ValueError):
        CaseStatus("UNSAFE_SHORTCUT")


def test_high_and_critical_cases_require_review() -> None:
    from app.models.case import UrgencyTier, requires_human_review

    assert requires_human_review(UrgencyTier.HIGH) is True
    assert requires_human_review(UrgencyTier.CRITICAL) is True
    assert requires_human_review(UrgencyTier.STANDARD) is False
