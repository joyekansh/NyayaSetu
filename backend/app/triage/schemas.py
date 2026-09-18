"""Immutable inputs and outputs for deterministic urgency assessment."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from math import isfinite
from typing import Any

from app.models.case import UrgencyTier


@dataclass(frozen=True)
class CaseUrgencyInput:
    """Normalised, untrusted case data used by the urgency checks.

    Only explicit booleans and finite numeric eviction timelines are accepted.
    Everything else is treated as missing rather than coerced into a risk signal.
    """

    physical_violence_keywords_detected: bool = False
    eviction_notice_days_remaining: float | None = None
    criminal_detention_no_counsel_flag: bool = False
    minor_or_dependent_at_risk: bool = False
    repeat_case_escalation: bool = False
    medical_emergency_flag: bool = False
    sudden_income_loss_flag: bool = False

    @classmethod
    def from_data(cls, data: object) -> "CaseUrgencyInput":
        if not isinstance(data, Mapping):
            return cls()

        return cls(
            physical_violence_keywords_detected=_strict_true(
                data.get("physical_violence_keywords_detected")
            ),
            eviction_notice_days_remaining=_finite_number(
                data.get("eviction_notice_days_remaining")
            ),
            criminal_detention_no_counsel_flag=_strict_true(
                data.get("criminal_detention_no_counsel_flag")
            ),
            minor_or_dependent_at_risk=_strict_true(data.get("minor_or_dependent_at_risk")),
            repeat_case_escalation=_strict_true(data.get("repeat_case_escalation")),
            medical_emergency_flag=_strict_true(data.get("medical_emergency_flag")),
            sudden_income_loss_flag=_strict_true(data.get("sudden_income_loss_flag")),
        )


def _strict_true(value: object) -> bool:
    return value is True


def _finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if isfinite(number) else None


@dataclass(frozen=True)
class UrgencySignal:
    """One deduplicated, explainable urgency trigger."""

    name: str
    weight: int


@dataclass(frozen=True)
class TriageResult:
    """Immutable score, tier, and ordered evidence used by the match gate."""

    score: int
    tier: UrgencyTier
    signals: tuple[UrgencySignal, ...]
