from app.extraction.parsers.base import RegexDocumentParser, normalise_date, normalise_identifier, normalise_text


class EvictionNoticeParser(RegexDocumentParser):
    document_type = "EVICTION_NOTICE"
    field_patterns = (
        ("notice_number", r"Eviction Notice No|Notice No", normalise_identifier),
        ("tenant_name", r"Tenant Name|Name", normalise_text),
        ("eviction_date", r"Eviction Date|Vacate By|Notice Date", normalise_date),
        ("property_address", r"Property Address|Address", normalise_text),
    )

