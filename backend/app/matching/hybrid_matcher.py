from typing import Protocol

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

