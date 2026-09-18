"""Speech-to-Text (STT) Strategy interface and implementations."""

from typing import Protocol


class SttStrategy(Protocol):
    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> str:
        """Transcribe raw audio bytes into text."""
        ...


class WebSpeechAdapterStrategy:
    """
    Adapter for when the frontend has already transcribed the audio via Web Speech API.
    In this case, the 'audio_bytes' might just be the raw text payload, or this is a no-op 
    if the text is directly passed in the JSON payload.
    """
    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> str:
        # Assuming the bytes are actually just UTF-8 text sent from the frontend
        return audio_bytes.decode("utf-8")


class ElevenLabsSttStrategy:
    """
    Placeholder for the ElevenLabs STT API integration.
    This would be used if the citizen uploads raw .wav or .mp3 files directly.
    """
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key
        
    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> str:
        if not self.api_key:
            # Fallback mock for local development without an API key
            return "[ElevenLabs STT Mock]: Transcribed audio narrative regarding a grievance."
            
        # In a real implementation, you would:
        # 1. Use httpx to POST the audio_bytes to ElevenLabs or Google Cloud Speech-to-Text API
        # 2. Parse the JSON response
        # 3. Return the transcribed text
        raise NotImplementedError("ElevenLabs STT API call not yet implemented")

