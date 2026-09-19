"""Map extracted document fields and intake answers into urgency scorer input."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date


def build_urgency_case_data(
    extracted_fields: Mapping[str, object],
    *,
    intake_answers: Mapping[str, object] | None = None,
    reference_date: date | None = None,
) -> dict[str, object]:
    data: dict[str, object] = {}
    if intake_answers:
        for key in (
            "physical_violence_keywords_detected",
            "criminal_detention_no_counsel_flag",
            "minor_or_dependent_at_risk",
            "repeat_case_escalation",
            "medical_emergency_flag",
            "sudden_income_loss_flag",
            "high_uncertainty_flag",
            "eviction_notice_days_remaining",
        ):
            if key in intake_answers:
                # Use 'or' so explicit True values aren't overwritten by False
                data[key] = data.get(key, False) or intake_answers[key]
                
        # Additional explicit intake answer integrations
        age = intake_answers.get("age")
        if age is not None:
            try:
                if int(age) < 18:
                    data["minor_or_dependent_at_risk"] = True
            except (ValueError, TypeError):
                pass

    eviction_date = extracted_fields.get("eviction_date")
    if isinstance(eviction_date, str):
        ref = reference_date or date.today()
        try:
            remaining = (date.fromisoformat(eviction_date) - ref).days
            data["eviction_notice_days_remaining"] = remaining
        except ValueError:
            pass
    return data
