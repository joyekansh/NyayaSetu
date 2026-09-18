from typing import Protocol

from app.matching.rule_matcher import evaluate_criteria
from app.matching.semantic_matcher import SemanticMatcher
from app.triage.gate import GateRelease, require_match_access
from app.triage.schemas import TriageResult


class MatchAccessDenied(PermissionError):
    pass


class Matcher(Protocol):
    def match(self, case_id: str) -> list[dict[str, object]]:
        """Return provenance-bearing statutory match cards."""


class GuardedMatcher:
    def __init__(self, *, matcher: Matcher) -> None:
        self._matcher = matcher

    def match(
        self,
        *,
        case_id: str,
        triage_result: TriageResult,
        release: GateRelease | None = None,
    ) -> list[dict[str, object]]:
        decision = require_match_access(triage_result, release)
        if not decision.allowed:
            raise MatchAccessDenied(decision.reason)
        return self._matcher.match(case_id)


class HybridMatcher:
    def __init__(self, *, semantic_matcher: SemanticMatcher) -> None:
        self._semantic_matcher = semantic_matcher

    def match(self, *, case_fields: dict[str, object], limit: int = 5) -> list[dict[str, object]]:
        matches: list[dict[str, object]] = []
        for clause in self._semantic_matcher.match(case_fields, limit=limit):
            rule_result = evaluate_criteria(clause.eligibility_criteria, case_fields)
            final_confidence = round(clause.semantic_score * rule_result.confidence_multiplier, 4)
            matches.append(
                {
                    "scheme_id": clause.scheme_id,
                    "clause_id": clause.clause_id,
                    "citation": clause.citation,
                    "clause_text": clause.text,
                    "semantic_score": clause.semantic_score,
                    "rule_outcome": rule_result.outcome.value,
                    "rule_reasons": list(rule_result.reasons),
                    "final_confidence": final_confidence,
                }
            )
        return matches
