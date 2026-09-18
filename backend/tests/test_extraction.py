import pytest
from pydantic import ValidationError


def _field_values(result: object) -> dict[str, object]:
    return {field.name: field.value for field in result.fields}


def test_fake_ocr_strategy_returns_configured_text() -> None:
    from app.extraction.ocr_engine import FakeOcrStrategy

    assert FakeOcrStrategy("Income Certificate No: INC-42").extract_text(b"bytes") == "Income Certificate No: INC-42"


def test_parser_factory_selects_income_parser() -> None:
    from app.extraction.parser_factory import parser_for
    from app.extraction.parsers.income_cert import IncomeCertificateParser

    assert isinstance(parser_for("income_certificate"), IncomeCertificateParser)


@pytest.mark.parametrize("declared_type", [None, "OTHER", "AADHAAR", "unrecognised"])
def test_parser_factory_rejects_unknown_types(declared_type: object) -> None:
    from app.extraction.parser_factory import UnsupportedDocumentTypeError, parser_for

    with pytest.raises(UnsupportedDocumentTypeError):
        parser_for(declared_type)


def test_income_certificate_parser_normalizes_amount_and_date() -> None:
    from app.extraction.parser_factory import parser_for

    result = parser_for("INCOME_CERTIFICATE").parse(
        "Income Certificate No: inc-42\nName: Asha Devi\nAnnual Income: Rs. 2,50,000\nDate of Issue: 01/02/2026"
    )

    assert _field_values(result) == {"certificate_number": "INC-42", "holder_name": "Asha Devi", "annual_income": 250000, "issue_date": "2026-02-01"}


def test_income_certificate_parser_omits_malformed_or_ambiguous_values() -> None:
    from app.extraction.parser_factory import parser_for

    result = parser_for("INCOME_CERTIFICATE").parse("Annual Income: Rs. two lakh\nAnnual Income: Rs. 250000\nDate of Issue: 31/02/2026\nName:")

    assert result.fields == ()


def test_income_certificate_parser_keeps_identical_duplicate_field() -> None:
    from app.extraction.parser_factory import parser_for

    result = parser_for("INCOME_CERTIFICATE").parse("Annual Income: Rs. 2,50,000\nAnnual Income: 250000")

    assert _field_values(result) == {"annual_income": 250000}
    assert len(result.fields) == 1


def test_eviction_notice_parser_normalizes_labels() -> None:
    from app.extraction.parser_factory import parser_for

    result = parser_for("EVICTION_NOTICE").parse(
        "Eviction Notice No: ev-77\nTenant Name: Ravi Kumar\nEviction Date: 2026-09-30\nProperty Address: 12 Civil Lines"
    )

    assert _field_values(result) == {"notice_number": "EV-77", "tenant_name": "Ravi Kumar", "eviction_date": "2026-09-30", "property_address": "12 Civil Lines"}


def test_eviction_notice_parser_omits_conflicting_duplicate_dates() -> None:
    from app.extraction.parser_factory import parser_for

    assert parser_for("EVICTION_NOTICE").parse("Eviction Date: 30/09/2026\nEviction Date: 01/10/2026").fields == ()


@pytest.mark.parametrize("confidence", [-0.01, 1.01, float("inf"), float("nan")])
def test_normalized_field_rejects_invalid_confidence(confidence: float) -> None:
    from app.extraction.schemas import NormalizedField

    with pytest.raises(ValidationError):
        NormalizedField(name="holder_name", value="Asha Devi", confidence=confidence)

