"""LLM Manager for loading and managing language model clients."""

from typing import Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy.orm import Session
from src.models.llm_model import LLMModel
from src.models.tenant_llm_config import TenantLLMConfig
from src.utils.encryption import decrypt_api_key
from src.utils.logging import get_logger
from src.config import settings
from src.utils.rate_limiter import RateLimiter
from src.utils.token_counter import estimate_tokens
from fastapi import HTTPException
import redis

logger = get_logger(__name__)


class LLMManager:
    """Manager for instantiating and caching LLM clients."""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        """Initialize LLM manager."""
        self._cache: Dict[str, Any] = {}
        self.rate_limiter = RateLimiter(redis_client) if redis_client else None

    def get_llm_for_tenant(
        self, db: Session, tenant_id: str, llm_model_id: Optional[str] = None
    ) -> Any:
        """
        Get LLM client for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant UUID
            llm_model_id: Optional specific model ID, otherwise uses tenant's default

        Returns:
            LangChain LLM client instance

        Raises:
            ValueError: If tenant LLM config not found or model not supported
        """
        cache_key = f"llm:{tenant_id}:{llm_model_id or 'default'}"

        # Check cache
        if cache_key in self._cache:
            logger.debug("llm_cache_hit", tenant_id=tenant_id)
            return self._cache[cache_key]

        # Load tenant LLM config
        tenant_config = (
            db.query(TenantLLMConfig).filter(TenantLLMConfig.tenant_id == tenant_id).first()
        )

        if not tenant_config:
            raise ValueError(f"No LLM configuration found for tenant {tenant_id}")

        # Use specified model or tenant's default
        model_id = llm_model_id or tenant_config.llm_model_id

        # Load LLM model details
        llm_model = db.query(LLMModel).filter(LLMModel.llm_model_id == model_id).first()

        if not llm_model:
            raise ValueError(f"LLM model {model_id} not found")

        if not llm_model.is_active:
            raise ValueError(f"LLM model {llm_model.model_name} is not active")

        # Decrypt API key
        api_key = decrypt_api_key(tenant_config.encrypted_api_key)

        # Instantiate LLM client based on provider
        llm_client = self._create_llm_client(llm_model, api_key)

        # Cache the client
        self._cache[cache_key] = llm_client

        logger.info(
            "llm_client_created",
            tenant_id=tenant_id,
            provider=llm_model.provider,
            model_name=llm_model.model_name,
        )

        return llm_client

    def _create_llm_client(self, llm_model: LLMModel, api_key: str) -> Any:
        """
        Create LLM client instance based on provider.

        Args:
            llm_model: LLM model configuration
            api_key: Decrypted API key

        Returns:
            LangChain LLM client

        Raises:
            ValueError: If provider not supported
        """
        provider = llm_model.provider.lower()
        model_name = llm_model.model_name

        # OpenRouter (unified API for multiple providers)
        if provider == "openrouter":
            return ChatOpenAI(
                model=model_name,
                openai_api_key=api_key,
                openai_api_base=settings.OPENROUTER_BASE_URL,
                temperature=0.7,
                max_tokens=4096,
                model_kwargs={
                    "extra_headers": {
                        "HTTP-Referer": "https://agenthub.local",
                        "X-Title": "AgentHub",
                    }
                },
            )

        # Direct OpenAI
        elif provider == "openai":
            return ChatOpenAI(
                model=model_name, openai_api_key=api_key, temperature=0.0, max_tokens=4096
            )

        # Google Gemini
        elif provider == "gemini":
            return ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key,
                temperature=0.0,
                max_output_tokens=4096,
                convert_system_message_to_human=True,  # Better compatibility with system messages
            )

        # Anthropic Claude
        elif provider == "anthropic":
            return ChatAnthropic(
                model=model_name, anthropic_api_key=api_key, temperature=0.0, max_tokens=4096
            )

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    def clear_cache(self, tenant_id: Optional[str] = None):
        """
        Clear LLM client cache.

        Args:
            tenant_id: Optional tenant ID to clear specific tenant cache
        """
        if tenant_id:
            # Clear specific tenant's cache
            keys_to_remove = [k for k in self._cache.keys() if k.startswith(f"llm:{tenant_id}:")]
            for key in keys_to_remove:
                del self._cache[key]
            logger.info("llm_cache_cleared", tenant_id=tenant_id)
        else:
            # Clear all cache
            self._cache.clear()
            logger.info("llm_cache_cleared_all")

    def set_rate_limiter(self, redis_client: redis.Redis):
        """
        Set the rate limiter with a Redis client.

        Args:
            redis_client: Redis client instance
        """
        self.rate_limiter = RateLimiter(redis_client)

    def invoke_llm(
        self, db: Session, tenant_id: str, messages: list, model_kwargs: Optional[Dict] = None
    ):
        """
        Invoke LLM with rate limiting.

        Args:
            db: Database session
            tenant_id: Tenant UUID
            messages: List of message dictionaries
            model_kwargs: Optional model arguments

        Returns:
            LLM response

        Raises:
            HTTPException: If rate limits are exceeded
        """
        if not self.rate_limiter:
            # If no rate limiter is set, just invoke LLM without rate limiting
            # This allows backward compatibility
            llm = self.get_llm_for_tenant(db, tenant_id)
            response = llm.invoke(messages, **(model_kwargs or {}))
            return response

        # Get tenant config
        tenant_config = (
            db.query(TenantLLMConfig).filter(TenantLLMConfig.tenant_id == tenant_id).first()
        )

        if not tenant_config:
            raise HTTPException(404, "Tenant LLM config not found")

        # Estimate tokens
        estimated_tokens = estimate_tokens(messages)

        # Enforce rate limits
        is_allowed, error_msg, limits_info = self.rate_limiter.check_rate_limit(
            tenant_id=str(tenant_id),
            rpm_limit=tenant_config.rate_limit_rpm,
            tpm_limit=tenant_config.rate_limit_tpm,
            tokens_requested=estimated_tokens,
        )

        if not is_allowed:
            raise HTTPException(
                status_code=429,
                detail=error_msg,
                headers={
                    "X-RateLimit-Limit-RPM": str(limits_info["limit_rpm"]),
                    "X-RateLimit-Limit-TPM": str(limits_info["limit_tpm"]),
                    "Retry-After": "60",
                },
            )

        # Invoke LLM
        llm = self.get_llm_for_tenant(db, tenant_id)
        response = llm.invoke(messages, **(model_kwargs or {}))

        return response


# Global LLM manager instance (without Redis client for now)
llm_manager = LLMManager()
