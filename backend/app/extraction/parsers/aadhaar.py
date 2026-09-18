from app.extraction.parsers.base import RegexDocumentParser, normalise_date, normalise_identifier, normalise_text
import re


def normalise_aadhaar_number(value: str) -> str | None:
    digits = re.sub(r"\s+", "", value)
    if re.fullmatch(r"\d{12}", digits):
        return f"{digits[:4]} {digits[4:8]} {digits[8:]}"
    return None


class AadhaarParser(RegexDocumentParser):
    document_type = "AADHAAR"
    field_patterns = (
        ("aadhaar_number", r"Aadhaar No|Aadhaar Number|UID", normalise_aadhaar_number),
        ("name", r"Name", normalise_text),
        ("dob", r"DOB|Date of Birth", normalise_date),
        ("gender", r"Gender|Sex", normalise_text),
    )
