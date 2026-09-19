import hashlib
import re
import uuid
from pathlib import PurePath, PureWindowsPath

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.document import DocumentType

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
SUPPORTED_SIGNATURES = (
    ("application/pdf", b"%PDF-"),
    ("image/png", b"\x89PNG\r\n\x1a\n"),
    ("image/jpeg", b"\xff\xd8\xff"),
    ("audio/mpeg", b"ID3"),
    ("audio/mpeg", b"\xff\xfb"),
    ("audio/webm", b"\x1a\x45\xdf\xa3"),
)
EXTENSIONS_BY_CONTENT_TYPE = {
    "application/pdf": {".pdf"},
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
    "audio/mpeg": {".mp3"},
    "audio/webm": {".webm"},
}
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ -]{0,254}$")


class UploadValidationError(ValueError):
    pass


def _safe_filename(filename: str) -> str:
    cleaned = filename.strip()
    if (
        not SAFE_FILENAME.fullmatch(cleaned)
        or "\x00" in cleaned
        or PurePath(cleaned).name != cleaned
        or PureWindowsPath(cleaned).name != cleaned
    ):
        raise UploadValidationError("unsafe filename")
    return cleaned


def detect_content_type(content: bytes) -> str:
    for content_type, signature in SUPPORTED_SIGNATURES:
        if content.startswith(signature):
            return content_type
    raise UploadValidationError("unsupported or disguised file content")


def validate_upload(*, filename: str, content: bytes, max_bytes: int = MAX_UPLOAD_BYTES) -> tuple[str, str]:
    safe_filename = _safe_filename(filename)
    if not content:
        raise UploadValidationError("empty upload")
    if len(content) > max_bytes:
        raise UploadValidationError("upload exceeds size limit")
    content_type = detect_content_type(content)
    extension = PurePath(safe_filename).suffix.lower()
    if extension not in EXTENSIONS_BY_CONTENT_TYPE[content_type]:
        raise UploadValidationError("filename extension does not match file content")
    return content_type, hashlib.sha256(content).hexdigest()


class DocumentUploadInput(BaseModel):
    model_config = ConfigDict(frozen=True)

    filename: str = Field(min_length=1, max_length=255)
    content: bytes = Field(min_length=1)
    document_type: DocumentType
    uploaded_by_user_id: uuid.UUID
    max_bytes: int = MAX_UPLOAD_BYTES
    content_type: str | None = None
    checksum: str | None = None

    @field_validator("filename")
    @classmethod
    def filename_is_safe(cls, filename: str) -> str:
        return _safe_filename(filename)

    @model_validator(mode="after")
    def populate_derived_fields(self) -> "DocumentUploadInput":
        content_type, checksum = validate_upload(filename=self.filename, content=self.content, max_bytes=self.max_bytes)
        object.__setattr__(self, "content_type", content_type)
        object.__setattr__(self, "checksum", checksum)
        return self
