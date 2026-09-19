from app.triage.scorer import score_case
from app.triage.schemas import CaseUrgencyInput

def test_decision_log_reasoning() -> None:
    # 1. Test a CRITICAL case
    critical_case = {
        "physical_violence_keywords_detected": True,
        "eviction_notice_days_remaining": 5
    }
    result_critical = score_case(critical_case)
    
    assert "CRITICAL tier (Score: 75)" in result_critical.reasoning
    assert "VIOLENCE (+40)" in result_critical.reasoning
    assert "EVICTION_UNDER_SEVEN_DAYS (+35)" in result_critical.reasoning
    
    print("\n[TEST OUTPUT] Critical Reasoning Log:")
    print(result_critical.reasoning)

    # 2. Test a STANDARD case
    standard_case = {
        "sudden_income_loss_flag": True
    }
    result_standard = score_case(standard_case)
    
    assert "STANDARD tier (Score: 15)" in result_standard.reasoning
    assert "SUDDEN_INCOME_LOSS (+15)" in result_standard.reasoning
    
    print("\n[TEST OUTPUT] Standard Reasoning Log:")
    print(result_standard.reasoning)

    # 3. Test a SAFE case (No flags)
    safe_case = {}
    result_safe = score_case(safe_case)
    
    assert "No urgency signals detected" in result_safe.reasoning
    
    print("\n[TEST OUTPUT] Safe Reasoning Log:")
    print(result_safe.reasoning)
