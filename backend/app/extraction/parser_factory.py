from app.extraction.parsers.aadhaar import AadhaarParser
from app.extraction.parsers.base import DocumentParser
from app.extraction.parsers.eviction_notice import EvictionNoticeParser
from app.extraction.parsers.income_cert import IncomeCertificateParser
from app.models.document import DocumentType


class UnsupportedDocumentTypeError(ValueError):
    pass


def parser_for(document_type: object) -> DocumentParser:
    if isinstance(document_type, str):
        normalized = document_type.upper()
    elif isinstance(document_type, DocumentType):
        normalized = document_type.value
    else:
        raise UnsupportedDocumentTypeError("unsupported document type")

    if normalized == DocumentType.INCOME_CERTIFICATE.value:
        return IncomeCertificateParser()
    if normalized == DocumentType.EVICTION_NOTICE.value:
        return EvictionNoticeParser()
    if normalized == DocumentType.AADHAAR.value:
        return AadhaarParser()

    raise UnsupportedDocumentTypeError("unsupported document type")


