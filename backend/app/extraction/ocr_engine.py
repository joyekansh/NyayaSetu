from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@runtime_checkable
class OcrStrategy(Protocol):
    def extract_text(self, document_bytes: bytes) -> str:
        """Return raw OCR text for a single document."""


@dataclass(frozen=True)
class FakeOcrStrategy:
    text: str = ""

    def extract_text(self, document_bytes: bytes) -> str:
        del document_bytes
        return self.text

