"""Deterministic urgency-score aggregation with no external dependencies."""

from __future__ import annotations

from collections.abc import Iterable

from app.models.case import UrgencyTier
from app.triage.schemas import CaseUrgencyInput, TriageResult, UrgencySignal
from app.triage.urgency_checks import DEFAULT_URGENCY_CHECKS, UrgencyCheck


def tier_for_score(score: float) -> UrgencyTier:
    if score >= 40:
        return UrgencyTier.CRITICAL
    if score >= 20:
        return UrgencyTier.HIGH
    return UrgencyTier.STANDARD


class UrgencyScorer:
    """Aggregates each ordered trigger once to create an auditable result."""

    def __init__(self, checks: Iterable[UrgencyCheck] = DEFAULT_URGENCY_CHECKS) -> None:
        self._checks = tuple(checks)

    def score(self, data: object) -> TriageResult:
        case = CaseUrgencyInput.from_data(data)
        signals = _deduplicated_signals(check.evaluate(case) for check in self._checks)
        score = sum(signal.weight for signal in signals)
        return TriageResult(score=score, tier=tier_for_score(score), signals=signals)


def _deduplicated_signals(candidates: Iterable[UrgencySignal | None]) -> tuple[UrgencySignal, ...]:
    seen: set[str] = set()
    signals: list[UrgencySignal] = []
    for signal in candidates:
        if signal is not None and signal.name not in seen:
            seen.add(signal.name)
            signals.append(signal)
    return tuple(signals)


def score_case(data: object) -> TriageResult:
    return UrgencyScorer().score(data)
