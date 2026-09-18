from app.extraction.parsers.base import RegexDocumentParser, normalise_amount, normalise_date, normalise_identifier, normalise_text


class IncomeCertificateParser(RegexDocumentParser):
    document_type = "INCOME_CERTIFICATE"
    field_patterns = (
        ("certificate_number", r"Income Certificate No|Certificate No", normalise_identifier),
        ("holder_name", r"Name|Applicant Name", normalise_text),
        ("annual_income", r"Annual Income|Income", normalise_amount),
        ("issue_date", r"Date of Issue|Issue Date", normalise_date),
    )

