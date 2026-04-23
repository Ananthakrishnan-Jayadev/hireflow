import secrets
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/shyfthatch"

    # ── OpenAI ────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""

    # ── Server ────────────────────────────────────────────────────────────
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_DEBUG: bool = False
    UPLOAD_DIR: str = "uploads"

    # ── JWT / Auth ────────────────────────────────────────────────────────
    # Generate a secure default for local dev; MUST be overridden in production.
    JWT_SECRET: str = secrets.token_hex(32)
    JWT_ALGORITHM: str = "HS256"
    # Access token lifetime in minutes (15 min for production; 60 for convenience)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # Refresh token lifetime in days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ──────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins, e.g.:
    #   ALLOWED_ORIGINS=https://app.shyfthatch.com,https://shyfthatch.com
    # Leave as "*" only for local development — must be restricted in production.
    ALLOWED_ORIGINS: str = "http://localhost:8000,http://127.0.0.1:8000"

    # ── SMTP ──────────────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    # ── Redis (Copilot) ───────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Anthropic / Ollama (Copilot providers) ───────────────────────────
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ── Copilot Settings ──────────────────────────────────────────────────
    COPILOT_TRIGGER_SILENCE_MS: int = 1500
    COPILOT_TRIGGER_MAX_WAIT_MS: int = 5000
    COPILOT_WS_TICKET_EXPIRY_SEC: int = 60
    COPILOT_SESSION_MAX_AGE_SEC: int = 7200
    COPILOT_SESSION_TTL_MINUTES: int = 60
    COPILOT_MAX_QUESTION_CHARS: int = 4000
    COPILOT_DEFAULT_PROVIDER: str = "openai"
    COPILOT_MODEL_OPENAI: str = "gpt-4o"
    COPILOT_MODEL_ANTHROPIC: str = "claude-sonnet-4-20250514"
    COPILOT_MODEL_OLLAMA: str = "kimi-k2.5:cloud"
    COPILOT_OLLAMA_TIMEOUT_SEC: int = 120

    # Transcript source configuration
    COPILOT_TRANSCRIPT_SOURCE: str = "local"  # "local" or "meetstream"
    COPILOT_OVERLAP_STRATEGY: str = "cancel_restart"  # "queue" or "cancel_restart"
    COPILOT_CONTEXT_WINDOW_SIZE: int = 5  # Number of recent Q&A pairs to maintain
    COPILOT_MAX_QUEUED_TRIGGERS: int = 3  # Max triggers to queue when using "queue" strategy

    # MeetStream adapter configuration
    MEETSTREAM_WEBSOCKET_URL: Optional[str] = None
    MEETSTREAM_WEBHOOK_ENDPOINT: Optional[str] = None
    MEETSTREAM_WEBHOOK_BASE_URL: Optional[str] = None
    MEETSTREAM_API_KEY: Optional[str] = None
    MEETSTREAM_API_URL: str = "https://api.meetstream.ai/api/v1"
    MEETSTREAM_CONFIDENCE_THRESHOLD: float = 0.3

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        return v

    def get_allowed_origins(self) -> List[str]:
        """Return ALLOWED_ORIGINS as a list, stripping whitespace."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
