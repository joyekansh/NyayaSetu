from enum import StrEnum


class CaseStatus(StrEnum):
    RECEIVED = "RECEIVED"
    EXTRACTED = "EXTRACTED"
    TRIAGED = "TRIAGED"
    MATCHED = "MATCHED"
    IN_REVIEW = "IN_REVIEW"
    REFERRED = "REFERRED"
    CLOSED = "CLOSED"


class UrgencyTier(StrEnum):
    STANDARD = "STANDARD"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


def requires_human_review(tier: UrgencyTier) -> bool:
    return tier in {UrgencyTier.HIGH, UrgencyTier.CRITICAL}
