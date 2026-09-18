from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class MatchOutcome(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class RuleMatchResult:
    outcome: MatchOutcome
    reasons: tuple[str, ...] = ()

    @property
    def confidence_multiplier(self) -> float:
        if self.outcome is MatchOutcome.PASS:
            return 1.0
        if self.outcome is MatchOutcome.FAIL:
            return 0.0
        return 0.5


def evaluate_criteria(criteria: dict[str, Any], case_fields: dict[str, Any]) -> RuleMatchResult:
    return _evaluate(criteria, case_fields)


def _evaluate(criteria: Any, case_fields: dict[str, Any]) -> RuleMatchResult:
    if not isinstance(criteria, dict) or not criteria:
        return RuleMatchResult(MatchOutcome.PASS)

    if "all" in criteria:
        return _combine_all(criteria["all"], case_fields)
    if "any" in criteria:
        return _combine_any(criteria["any"], case_fields)

    outcomes = [_evaluate_field(field, rule, case_fields) for field, rule in criteria.items()]
    return _combine_all_results(outcomes)


def _combine_all(items: Any, case_fields: dict[str, Any]) -> RuleMatchResult:
    if not isinstance(items, list):
        return RuleMatchResult(MatchOutcome.FAIL, ("all must be a list",))
    return _combine_all_results([_evaluate(item, case_fields) for item in items])


def _combine_any(items: Any, case_fields: dict[str, Any]) -> RuleMatchResult:
    if not isinstance(items, list):
        return RuleMatchResult(MatchOutcome.FAIL, ("any must be a list",))
    results = [_evaluate(item, case_fields) for item in items]
    if any(result.outcome is MatchOutcome.PASS for result in results):
        return RuleMatchResult(MatchOutcome.PASS)
    reasons = tuple(reason for result in results for reason in result.reasons)
    if any(result.outcome is MatchOutcome.UNKNOWN for result in results):
        return RuleMatchResult(MatchOutcome.UNKNOWN, reasons)
    return RuleMatchResult(MatchOutcome.FAIL, reasons)


def _combine_all_results(results: list[RuleMatchResult]) -> RuleMatchResult:
    reasons = tuple(reason for result in results for reason in result.reasons)
    if any(result.outcome is MatchOutcome.FAIL for result in results):
        return RuleMatchResult(MatchOutcome.FAIL, reasons)
    if any(result.outcome is MatchOutcome.UNKNOWN for result in results):
        return RuleMatchResult(MatchOutcome.UNKNOWN, reasons)
    return RuleMatchResult(MatchOutcome.PASS)


def _evaluate_field(field: str, rule: Any, case_fields: dict[str, Any]) -> RuleMatchResult:
    if not isinstance(rule, dict):
        return RuleMatchResult(MatchOutcome.FAIL, (f"{field}: rule must be an object",))
    exists_rule = rule.get("exists")
    if exists_rule is True:
        return RuleMatchResult(MatchOutcome.PASS if field in case_fields else MatchOutcome.UNKNOWN, () if field in case_fields else (f"{field}: missing",))
    if exists_rule is False and field in case_fields:
        return RuleMatchResult(MatchOutcome.FAIL, (f"{field}: unexpectedly present",))

    if field not in case_fields:
        return RuleMatchResult(MatchOutcome.UNKNOWN, (f"{field}: missing",))
    value = case_fields[field]

    checks = [
        _equals(field, value, rule["equals"]) if "equals" in rule else None,
        _in(field, value, rule["in"]) if "in" in rule else None,
        _compare(field, value, rule["lte"], lambda actual, expected: actual <= expected, "lte") if "lte" in rule else None,
        _compare(field, value, rule["gte"], lambda actual, expected: actual >= expected, "gte") if "gte" in rule else None,
    ]
    return _combine_all_results([check for check in checks if check is not None])


def _equals(field: str, value: Any, expected: Any) -> RuleMatchResult:
    return RuleMatchResult(MatchOutcome.PASS if value == expected else MatchOutcome.FAIL, () if value == expected else (f"{field}: expected {expected}",))


def _in(field: str, value: Any, expected: Any) -> RuleMatchResult:
    if not isinstance(expected, list):
        return RuleMatchResult(MatchOutcome.FAIL, (f"{field}: in must be a list",))
    return RuleMatchResult(MatchOutcome.PASS if value in expected else MatchOutcome.FAIL, () if value in expected else (f"{field}: not eligible",))


def _compare(field: str, value: Any, expected: Any, predicate: Any, op: str) -> RuleMatchResult:
    if isinstance(value, bool) or isinstance(expected, bool) or not isinstance(value, (int, float)) or not isinstance(expected, (int, float)):
        return RuleMatchResult(MatchOutcome.UNKNOWN, (f"{field}: cannot evaluate {op}",))
    return RuleMatchResult(MatchOutcome.PASS if predicate(value, expected) else MatchOutcome.FAIL, () if predicate(value, expected) else (f"{field}: failed {op}",))

