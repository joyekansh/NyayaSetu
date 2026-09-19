from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_v1_prefix: str = "/api/v1"
    app_name: str = "NyayaSetu API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://nyayasetu:nyayasetu@postgres:5432/nyayasetu"
    redis_url: str = "redis://redis:6379/0"
    document_storage_root: str = "/tmp/nyayasetu-documents"
    chroma_host: str = "chroma"
    chroma_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]
    jwt_secret_key: str = "supersecretkey"  # Override in production via env
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7 # 1 week
    gemini_api_key: str = ""  # Set via GEMINI_API_KEY env var or .env
    gemini_model: str = "gemini-3.6-flash"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
