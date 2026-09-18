"""LLM-powered document parser that conforms to the DocumentParser protocol.

Replaces regex-based parsing with Google Gemini for higher accuracy,
while staying compatible with the existing extraction pipeline via
parser_factory.parser_for().
"""

from app.extraction.llm_orchestrator import parse_document_text
from app.extraction.schemas import ParsedDocument


class LLMDocumentParser:
    """Implements the DocumentParser protocol using Gemini.

    Falls back to an empty ParsedDocument on any LLM failure,
    ensuring the pipeline never crashes due to AI errors.
    """

    document_type: str

    def __init__(self, document_type: str = "UNKNOWN") -> None:
        self.document_type = document_type

    def parse(self, raw_text: object) -> ParsedDocument:
        if not isinstance(raw_text, str) or not raw_text.strip():
            return ParsedDocument(document_type=self.document_type)

        result = parse_document_text(raw_text)

        # If LLM detected a more specific type, use it; otherwise keep ours
        if result.document_type != "UNKNOWN":
            return result

        return ParsedDocument(document_type=self.document_type, fields=result.fields)
