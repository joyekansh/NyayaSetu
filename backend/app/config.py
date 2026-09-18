from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_v1_prefix: str = "/api/v1"
    app_name: str = "NyayaSetu API"
    environment: str = "development"
    cors_origins: list[str] = []

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
