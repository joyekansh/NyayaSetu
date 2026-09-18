"""Pure match-access decision for the human-in-the-loop urgency gate."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from app.models.case import UrgencyTier
from app.triage.schemas import TriageResult


@dataclass(frozen=True)
class GateRelease:
    """Explicit, validated operator attestation required for urgent matches.

    Authentication, authorisation, and audit persistence intentionally belong to
    the future operator workflow; this pure object makes their output explicit
    at the policy boundary now.
    """

    operator_id: str
    reason: str

    @classmethod
    def from_data(cls, data: object) -> "GateRelease":
        if not isinstance(data, Mapping):
            return cls(operator_id="", reason="")
        operator_id = data.get("operator_id")
        reason = data.get("reason")
        return cls(
            operator_id=operator_id.strip() if isinstance(operator_id, str) else "",
            reason=reason.strip() if isinstance(reason, str) else "",
        )

    @property
    def is_valid(self) -> bool:
        return bool(self.operator_id and self.reason)


@dataclass(frozen=True)
class GateDecision:
    allowed: bool
    reason: str


def require_match_access(result: TriageResult, release: GateRelease | None = None) -> GateDecision:
    """Deny HIGH/CRITICAL matching unless a validated, explicit release exists."""

    if result.tier in {UrgencyTier.HIGH, UrgencyTier.CRITICAL}:
        if release is None or not release.is_valid:
            return GateDecision(allowed=False, reason="OPERATOR_RELEASE_REQUIRED")
        return GateDecision(allowed=True, reason="OPERATOR_RELEASED")
    return GateDecision(allowed=True, reason="STANDARD_CASE")
