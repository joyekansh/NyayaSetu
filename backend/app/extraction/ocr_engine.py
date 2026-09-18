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


class TesseractOcrStrategy:
    def extract_text(self, document_bytes: bytes) -> str:
        import io
        from PIL import Image, UnidentifiedImageError
        import pytesseract

        try:
            image = Image.open(io.BytesIO(document_bytes))
            return pytesseract.image_to_string(image)
        except UnidentifiedImageError:
            # Fallback for plain text or PDFs if needed. 
            # In a real app, PDFs would need ghostscript or pdf2image.
            # For now, we attempt to decode as UTF-8 as a fallback.
            try:
                return document_bytes.decode("utf-8")
            except UnicodeDecodeError:
                return ""
