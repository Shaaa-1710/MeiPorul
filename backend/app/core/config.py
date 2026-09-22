"""Backend configuration settings using Pydantic."""

from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application runtime configuration settings."""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "MeiPorul Claim Auditor API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Input validation constraints
    MAX_ANSWER_LENGTH: int = 50_000
    MIN_ANSWER_LENGTH: int = 1
    MAX_EVIDENCE_COUNT: int = 100
    MAX_EVIDENCE_TEXT_LENGTH: int = 50_000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
