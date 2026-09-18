import hashlib
import uuid

import pytest
from pydantic import ValidationError

from app.intake.schemas import DocumentUploadInput, UploadValidationError, validate_upload
from app.models.document import DocumentType


@pytest.mark.parametrize(
    ("filename", "content", "content_type"),
    [
        ("identity.jpg", b"\xff\xd8\xff\xe0jpeg-data", "image/jpeg"),
        ("identity.png", b"\x89PNG\r\n\x1a\nimage-data", "image/png"),
        ("notice.pdf", b"%PDF-1.7\nbody", "application/pdf"),
    ],
)
def test_upload_input_accepts_supported_bytes(filename: str, content: bytes, content_type: str) -> None:
    upload = DocumentUploadInput(filename=filename, content=content, document_type=DocumentType.OTHER, uploaded_by_user_id=uuid.uuid4())

    assert upload.content_type == content_type
    assert upload.checksum == hashlib.sha256(content).hexdigest()


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("report.pdf", b"not a pdf"),
        ("report.pdf", b"\xff\xd8\xff\xe0jpeg-data"),
        ("../report.pdf", b"%PDF-1.7\nbody"),
        ("C:\\report.pdf", b"%PDF-1.7\nbody"),
        ("report.pdf\x00.jpg", b"%PDF-1.7\nbody"),
        ("", b"%PDF-1.7\nbody"),
        ("notice.pdf", b""),
    ],
)
def test_upload_input_rejects_disguised_or_unsafe_files(filename: str, content: bytes) -> None:
    with pytest.raises((ValidationError, UploadValidationError)):
        DocumentUploadInput(filename=filename, content=content, document_type=DocumentType.OTHER, uploaded_by_user_id=uuid.uuid4())


def test_validate_upload_rejects_content_over_limit() -> None:
    with pytest.raises(UploadValidationError, match="size limit"):
        validate_upload(filename="notice.pdf", content=b"%PDF-1.7\nbody", max_bytes=5)

