from functools import lru_cache

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: PostgresDsn = Field(validation_alias="DATABASE_URL")
    secret_key: str = Field(min_length=32, validation_alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", validation_alias="ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, gt=0, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    # Comma-separated list of frontend origins allowed to call the API.
    # Defaults to local dev; set to the real Vercel URL(s) in production.
    allowed_origins: str = Field(
        default="http://localhost:5174,http://127.0.0.1:5174",
        validation_alias="ALLOWED_ORIGINS",
    )
    # Fernet key (44-char urlsafe-base64) for encrypting Whistleblow/Harassment
    # complaint descriptions at rest. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = Field(min_length=44, max_length=44, validation_alias="ENCRYPTION_KEY")
    # Optional SMTP — if SMTP_HOST is unset, complaint-ID emails are skipped
    # (submission still succeeds; the ID is always shown on screen).
    smtp_host: str | None = Field(default=None, validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, validation_alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, validation_alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, validation_alias="SMTP_PASSWORD")
    smtp_from: str | None = Field(default=None, validation_alias="SMTP_FROM")
    smtp_use_tls: bool = Field(default=True, validation_alias="SMTP_USE_TLS")
    frontend_url: str = Field(
        default="http://localhost:5174",
        validation_alias="FRONTEND_URL",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
