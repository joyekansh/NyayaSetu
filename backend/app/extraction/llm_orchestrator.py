"""LLM-powered document analysis and grievance understanding.

Uses Google Gemini to replace brittle regex parsing with intelligent,
context-aware extraction. This module provides three core capabilities:

1. parse_document_text  — Extract structured fields from raw OCR text
2. analyse_grievance    — Detect urgency flags from citizen's grievance
3. build_search_query   — Generate a semantic search query for ChromaDB
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from google import genai
from google.genai import types

from app.config import get_settings
from app.extraction.schemas import NormalizedField, ParsedDocument

logger = logging.getLogger(__name__)


# ── Schemas for LLM output ──────────────────────────────────────────────

@dataclass(frozen=True)
class GrievanceAnalysis:
    """Structured output from the grievance analysis LLM call.

    Each boolean flag maps directly to a field in CaseUrgencyInput
    so the triage scorer can consume it without transformation.
    """

    intent: str = ""
    summary: str = ""
    physical_violence_keywords_detected: bool = False
    criminal_detention_no_counsel_flag: bool = False
    minor_or_dependent_at_risk: bool = False
    medical_emergency_flag: bool = False
    sudden_income_loss_flag: bool = False
    vulnerability_flags: list[str] = field(default_factory=list)
    detected_language: str = "en"

    def to_urgency_dict(self) -> dict[str, object]:
        """Return dict compatible with CaseUrgencyInput.from_data()."""
        return {
            "physical_violence_keywords_detected": self.physical_violence_keywords_detected,
            "criminal_detention_no_counsel_flag": self.criminal_detention_no_counsel_flag,
            "minor_or_dependent_at_risk": self.minor_or_dependent_at_risk,
            "medical_emergency_flag": self.medical_emergency_flag,
            "sudden_income_loss_flag": self.sudden_income_loss_flag,
        }


# ── Client singleton ────────────────────────────────────────────────────

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to backend/.env or set the environment variable."
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _model_name() -> str:
    return get_settings().gemini_model


# ── 1. Document Parsing ─────────────────────────────────────────────────

_PARSE_SYSTEM_INSTRUCTION = """You are a document analysis engine for the Indian legal aid system NyayaSetu.

Given raw OCR text from a scanned document, extract ALL structured fields you can find.
Return ONLY a valid JSON object with this exact structure:
{
  "document_type": "string — one of: INCOME_CERTIFICATE, EVICTION_NOTICE, AADHAAR, FIR_COPY, COURT_ORDER, OTHER",
  "fields": [
    {
      "name": "field_name_in_snake_case",
      "value": "the extracted value as a string or integer",
      "confidence": 0.95
    }
  ]
}

Rules:
- For dates, normalise to ISO 8601 format (YYYY-MM-DD).
- For monetary amounts, return the numeric value in INR as an integer.
- For Aadhaar numbers, format as "XXXX XXXX XXXX".
- Set confidence between 0.0 and 1.0 based on OCR quality.
- If the OCR text is garbled or unreadable for a field, omit that field entirely.
- Do NOT invent or hallucinate data that is not present in the text.
- Return ONLY the JSON, no markdown fencing, no explanation."""


def parse_document_text(raw_ocr_text: str) -> ParsedDocument:
    """Send raw OCR text to Gemini and return a ParsedDocument."""
    if not raw_ocr_text or not raw_ocr_text.strip():
        return ParsedDocument(document_type="UNKNOWN")

    client = _get_client()

    response = client.models.generate_content(
        model=_model_name(),
        contents=f"Extract structured fields from this OCR text:\n\n{raw_ocr_text}",
        config=types.GenerateContentConfig(
            system_instruction=_PARSE_SYSTEM_INSTRUCTION,
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )

    return _parse_document_response(response.text or "")


def _parse_document_response(raw_json: str) -> ParsedDocument:
    """Safely parse the LLM's JSON response into a ParsedDocument."""
    try:
        # Strip markdown fencing if the model adds it despite instructions
        cleaned = raw_json.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        data = json.loads(cleaned)
        doc_type = data.get("document_type", "UNKNOWN")
        fields = []
        for f in data.get("fields", []):
            try:
                fields.append(
                    NormalizedField(
                        name=f["name"],
                        value=f["value"],
                        confidence=float(f.get("confidence", 0.9)),
                    )
                )
            except (KeyError, ValueError, TypeError) as field_err:
                logger.warning("Skipping malformed field %s: %s", f, field_err)
                continue

        return ParsedDocument(document_type=doc_type, fields=tuple(fields))

    except (json.JSONDecodeError, KeyError, TypeError) as err:
        logger.error("Failed to parse LLM document response: %s — raw: %s", err, raw_json[:500])
        return ParsedDocument(document_type="UNKNOWN")


# ── 2. Grievance Analysis ───────────────────────────────────────────────

_GRIEVANCE_SYSTEM_INSTRUCTION = """You are a legal aid triage assistant for NyayaSetu, a Government of India platform.

A citizen has submitted a grievance describing their legal problem. Your job is to
understand the grievance and extract structured triage signals.

Return ONLY a valid JSON object with this exact structure:
{
  "intent": "string — what the citizen actually wants, e.g. 'stop eviction', 'get bail', 'claim wages'",
  "summary": "string — a 1-2 sentence professional summary of the grievance",
  "physical_violence_keywords_detected": false,
  "criminal_detention_no_counsel_flag": false,
  "minor_or_dependent_at_risk": false,
  "medical_emergency_flag": false,
  "sudden_income_loss_flag": false,
  "vulnerability_flags": ["list of flags like 'senior_citizen', 'below_poverty_line', 'woman', 'disabled', 'scheduled_caste', 'scheduled_tribe', 'victim_of_trafficking'"],
  "detected_language": "en or hi"
}

Rules:
- Set boolean flags to true ONLY if the grievance clearly indicates that condition.
- physical_violence_keywords_detected: true if there is mention of beating, assault, attack, domestic violence, or physical harm.
- criminal_detention_no_counsel_flag: true if the person or their family member is in jail/custody without a lawyer.
- minor_or_dependent_at_risk: true if a child, elderly, or dependent person is at risk.
- medical_emergency_flag: true if there is an active medical emergency or urgent health need.
- sudden_income_loss_flag: true if the person has recently lost their job, wages, or income source.
- Be conservative: when in doubt, set a flag to false. False negatives are safer than false positives.
- Return ONLY the JSON, no markdown fencing, no explanation."""


def analyse_grievance(grievance_text: str) -> GrievanceAnalysis:
    """Analyse a citizen's grievance text and return structured triage signals."""
    if not grievance_text or not grievance_text.strip():
        return GrievanceAnalysis()

    client = _get_client()

    try:
        response = client.models.generate_content(
            model=_model_name(),
            contents=f"Analyse this citizen grievance:\n\n{grievance_text}",
            config=types.GenerateContentConfig(
                system_instruction=_GRIEVANCE_SYSTEM_INSTRUCTION,
                temperature=0.1,
                max_output_tokens=1024,
            ),
        )
        return _parse_grievance_response(response.text or "")
    except Exception as e:
        logger.error(f"LLM API failed (503/overload): {e}. Returning safe default.")
        return GrievanceAnalysis(
            intent="Unknown due to server overload",
            summary="System could not process grievance text.",
        )


def _parse_grievance_response(raw_json: str) -> GrievanceAnalysis:
    """Safely parse the LLM's JSON response into a GrievanceAnalysis."""
    try:
        cleaned = raw_json.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return GrievanceAnalysis(
            intent=str(data.get("intent", "")),
            summary=str(data.get("summary", "")),
            physical_violence_keywords_detected=bool(data.get("physical_violence_keywords_detected", False)),
            criminal_detention_no_counsel_flag=bool(data.get("criminal_detention_no_counsel_flag", False)),
            minor_or_dependent_at_risk=bool(data.get("minor_or_dependent_at_risk", False)),
            medical_emergency_flag=bool(data.get("medical_emergency_flag", False)),
            sudden_income_loss_flag=bool(data.get("sudden_income_loss_flag", False)),
            vulnerability_flags=data.get("vulnerability_flags", []),
            detected_language=str(data.get("detected_language", "en")),
        )

    except (json.JSONDecodeError, KeyError, TypeError) as err:
        logger.error("Failed to parse LLM grievance response: %s — raw: %s", err, raw_json[:500])
        return GrievanceAnalysis()


# ── 3. Semantic Search Query Builder ────────────────────────────────────

def build_search_query(
    *,
    grievance_text: str,
    parsed_fields: dict[str, Any],
    analysis: GrievanceAnalysis,
) -> str:
    """Compose a rich semantic query for ChromaDB from all available context.

    Combines the citizen's own words, the LLM's intent summary, and
    extracted document fields into a single query string optimised
    for cosine-similarity retrieval against scheme clause embeddings.
    """
    parts: list[str] = []

    # The LLM's distilled intent is the most important signal
    if analysis.intent:
        parts.append(f"Legal intent: {analysis.intent}")
    if analysis.summary:
        parts.append(f"Situation: {analysis.summary}")

    # Vulnerability context improves matching to welfare schemes
    if analysis.vulnerability_flags:
        parts.append(f"Vulnerability: {', '.join(analysis.vulnerability_flags)}")

    # Extracted document fields add specificity
    for key, value in sorted(parsed_fields.items()):
        if value and key not in {"checksum", "storage_key", "aadhaar_number"}:
            parts.append(f"{key}: {value}")

    # Fall back to the raw grievance if we have nothing else
    if not parts:
        return grievance_text[:500]

    return " | ".join(parts)
