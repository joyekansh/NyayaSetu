import json
import os
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.extraction.schemas import ParsedDocument, NormalizedField


class GeminiAudioParser:
    """Parser that uses Google Gemini to extract data from audio recordings."""

    def __init__(self, model: str = "gemini-1.5-pro"):
        # The client will automatically pick up GEMINI_API_KEY from the environment
        self.client = genai.Client()
        self.model = model

    def parse_audio(self, raw_bytes: bytes, mime_type: str | None = None) -> ParsedDocument:
        """Parse raw audio bytes using Gemini 1.5 and extract structured JSON."""
        actual_mime_type = mime_type or "audio/mp3"

        prompt = """
        You are a highly capable legal intake assistant. 
        Please listen to the following audio recording and extract key fields for our case management system.
        Return the result as a JSON object with EXACTLY the following keys:
        - "Summary": A concise summary of the speech.
        - "Incident Date": The date or timeframe of the incident discussed. If unknown, return "Unknown".
        - "People / Entities Involved": Names of people, companies, or entities involved.
        - "Location": The location where the incident took place.
        - "Urgency Markers": Any signs of immediate threat, violence, or pressing deadlines.
        - "Intent / Core Request": What the user is ultimately asking for.

        Make sure the output is strictly valid JSON.
        """

        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                types.Part.from_bytes(data=raw_bytes, mime_type=actual_mime_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        try:
            # The response text should be a JSON string since we requested response_mime_type="application/json"
            data = json.loads(response.text)
            fields = []
            for key, value in data.items():
                fields.append(NormalizedField(name=key, value=str(value), confidence=0.95))
            return ParsedDocument(document_type="SPEECH_RECORDING", fields=tuple(fields))
        except json.JSONDecodeError:
            # Fallback if the LLM didn't return valid JSON for some reason
            return ParsedDocument(document_type="SPEECH_RECORDING", fields=(
                NormalizedField(name="Summary", value=response.text, confidence=0.5),
            ))
