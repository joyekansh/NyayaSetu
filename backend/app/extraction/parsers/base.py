import re
from collections.abc import Callable
from datetime import datetime
from typing import Protocol

from app.extraction.schemas import NormalizedField, ParsedDocument

NORMAL_CONFIDENCE = 0.95
DUPLICATE_CONFIDENCE = 0.98
MAX_AMOUNT = 100_000_000_000


class DocumentParser(Protocol):
    document_type: str

    def parse(self, raw_text: object) -> ParsedDocument:
        """Parse untrusted OCR text without raising on bad labels."""


class RegexDocumentParser:
    document_type: str
    field_patterns: tuple[tuple[str, str, Callable[[str], str | int | None]], ...] = ()

    def parse(self, raw_text: object) -> ParsedDocument:
        if not isinstance(raw_text, str):
            return ParsedDocument(document_type=self.document_type)

        fields: list[NormalizedField] = []
        for name, label_pattern, normalizer in self.field_patterns:
            values = [normalizer(match.group("value")) for match in _labelled_values(raw_text, label_pattern)]
            resolved = _resolve(values)
            if resolved is not None:
                value, had_duplicates = resolved
                fields.append(
                    NormalizedField(name=name, value=value, confidence=DUPLICATE_CONFIDENCE if had_duplicates else NORMAL_CONFIDENCE)
                )
        return ParsedDocument(document_type=self.document_type, fields=tuple(fields))


def _labelled_values(raw_text: str, label_pattern: str) -> list[re.Match[str]]:
    pattern = re.compile(rf"^\s*(?:{label_pattern})\s*[:]\s*(?P<value>[^\r\n]+?)\s*$", re.IGNORECASE | re.MULTILINE)
    return list(pattern.finditer(raw_text))


def _resolve(values: list[str | int | None]) -> tuple[str | int, bool] | None:
    if not values or any(value is None for value in values):
        return None
    distinct = set(values)
    if len(distinct) != 1:
        return None
    return next(iter(distinct)), len(values) > 1


def normalise_text(value: str) -> str | None:
    cleaned = " ".join(value.split())
    return cleaned or None


def normalise_identifier(value: str) -> str | None:
    cleaned = normalise_text(value)
    return cleaned.upper() if cleaned else None


def normalise_amount(value: str) -> int | None:
    match = re.fullmatch(r"(?:Rs\.?\s*|INR\s*)?(\d[\d,\s]*)", value.strip(), re.IGNORECASE)
    if match is None:
        return None
    amount = int(re.sub(r"[\s,]", "", match.group(1)))
    return amount if 0 <= amount <= MAX_AMOUNT else None


def normalise_date(value: str) -> str | None:
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value.strip(), date_format).date().isoformat()
        except ValueError:
            continue
    return None

