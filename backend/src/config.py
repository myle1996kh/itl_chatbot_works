"""Application configuration using Pydantic Settings."""
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from redis import asyncio as aioredis
from pathlib import Path

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database Configuration
    # IMPORTANT: Set DATABASE_URL in .env file - no default password for security
    DATABASE_URL: str = Field(default="")
    DB_POOL_SIZE: int = Field(default=20)
    DB_MAX_OVERFLOW: int = Field(default=10)

    # Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379")
    CACHE_TTL_SECONDS: int = Field(default=3600)

    # JWT Authentication
    JWT_PUBLIC_KEY: str = Field(default="")

    # Fernet Encryption
    FERNET_KEY: str = Field(default="")

    # Application Settings
    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")
    API_HOST: str = Field(default="0.0.0.0")
    API_PORT: int = Field(default=8000)

    # Development Auth Toggle (Get User Token Bypass - Tạm thời False để test)
    # When true, JWT auth can be bypassed for specific dependencies
    # intended for local testing only.
    # SECURITY: Defaults to False (auth required). Set to True only in .env for development.
    DISABLE_AUTH: bool = Field(default=False)

    # Test Bearer Token for External API Calls
    # Used when DISABLE_AUTH=true for HTTP tool requests to external APIs
    TEST_BEARER_TOKEN: str = Field(default="")


    # CORS Settings
    CORS_ORIGINS: str = Field(default="http://localhost:3000,http://localhost:8080")

    # Rate Limiting
    DEFAULT_RATE_LIMIT_RPM: int = Field(default=60)
    DEFAULT_RATE_LIMIT_TPM: int = Field(default=10000)

    # OpenRouter Configuration
    OPENROUTER_API_KEY: str = Field(default="")
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1")

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @field_validator("DISABLE_AUTH")
    @classmethod
    def validate_auth_bypass(cls, v: bool, info) -> bool:
        """Prevent auth bypass in production environment."""
        # Get ENVIRONMENT value from the validation context
        environment = info.data.get("ENVIRONMENT", "production")

        if v and environment == "production":
            raise ValueError(
                "DISABLE_AUTH cannot be true in production environment. "
                "Set ENVIRONMENT=development or DISABLE_AUTH=false"
            )

        return v

    class Config:
        # .env file is in backend/ directory (one level up from src/)
        env_file = Path(__file__).parent.parent / ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from .env


# Global settings instance
settings = Settings()


# Database engine and session factory
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,  # Verify connections before using
    echo=settings.ENVIRONMENT == "development"
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Redis client factory
async def get_redis():
    """Get async Redis client."""
    redis = await aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )
    try:
        yield redis
    finally:
        await redis.close()
