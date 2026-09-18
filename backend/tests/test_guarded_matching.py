from dataclasses import dataclass

import pytest


@dataclass
class SpyMatcher:
    calls: int = 0

    def match(self, case_id: str) -> list[dict[str, object]]:
        self.calls += 1
        return [
            {
                "scheme_id": "nalsa-free-legal-aid",
                "clause_id": "lsa-1987-s12-c",
                "citation": "Legal Services Authorities Act, 1987, Section 12(c)",
                "confidence": 0.91,
            }
        ]


def test_guarded_matcher_blocks_high_risk_case_before_matcher_call() -> None:
    from app.models.case import UrgencyTier
    from app.matching.hybrid_matcher import GuardedMatcher, MatchAccessDenied
    from app.triage.schemas import TriageResult

    matcher = SpyMatcher()
    guarded = GuardedMatcher(matcher=matcher)

    with pytest.raises(MatchAccessDenied, match="OPERATOR_RELEASE_REQUIRED"):
        guarded.match(case_id="case-1", triage_result=TriageResult(score=40, tier=UrgencyTier.CRITICAL, signals=()))

    assert matcher.calls == 0


def test_guarded_matcher_allows_standard_case_and_returns_provenance() -> None:
    from app.models.case import UrgencyTier
    from app.matching.hybrid_matcher import GuardedMatcher
    from app.triage.schemas import TriageResult

    matcher = SpyMatcher()
    result = GuardedMatcher(matcher=matcher).match(
        case_id="case-2",
        triage_result=TriageResult(score=0, tier=UrgencyTier.STANDARD, signals=()),
    )

    assert matcher.calls == 1
    assert result[0]["citation"] == "Legal Services Authorities Act, 1987, Section 12(c)"
    assert 0 <= result[0]["confidence"] <= 1

