"""Ordered, side-effect-free urgency checks from the system design report."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.triage.schemas import CaseUrgencyInput, UrgencySignal


class UrgencyCheck(ABC):
    @abstractmethod
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        """Return one signal when this check is present, otherwise no signal."""


class ViolenceCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.physical_violence_keywords_detected:
            return UrgencySignal(name="VIOLENCE", weight=40)
        return None


class EvictionTimelineCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.eviction_notice_days_remaining is not None and case.eviction_notice_days_remaining < 7:
            return UrgencySignal(name="EVICTION_UNDER_SEVEN_DAYS", weight=35)
        return None


class DetentionCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.criminal_detention_no_counsel_flag:
            return UrgencySignal(name="DETENTION_WITHOUT_COUNSEL", weight=40)
        return None


class DependentRiskCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.minor_or_dependent_at_risk:
            return UrgencySignal(name="DEPENDENT_AT_RISK", weight=20)
        return None


class RepeatEscalationCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.repeat_case_escalation:
            return UrgencySignal(name="REPEAT_ESCALATION", weight=15)
        return None


class MedicalEmergencyCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.medical_emergency_flag:
            return UrgencySignal(name="MEDICAL_EMERGENCY", weight=30)
        return None


class IncomeLossCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.sudden_income_loss_flag:
            return UrgencySignal(name="SUDDEN_INCOME_LOSS", weight=15)
        return None


class UncertaintyCheck(UrgencyCheck):
    def evaluate(self, case: CaseUrgencyInput) -> UrgencySignal | None:
        if case.high_uncertainty_flag:
            return UrgencySignal(name="HIGH_UNCERTAINTY_PENALTY", weight=20)
        return None


DEFAULT_URGENCY_CHECKS: tuple[UrgencyCheck, ...] = (
    ViolenceCheck(),
    EvictionTimelineCheck(),
    DetentionCheck(),
    MedicalEmergencyCheck(),
    DependentRiskCheck(),
    RepeatEscalationCheck(),
    IncomeLossCheck(),
    UncertaintyCheck(),
)
