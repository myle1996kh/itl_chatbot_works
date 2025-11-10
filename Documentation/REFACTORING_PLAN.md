# AgentHub Refactoring & Improvement Plan

**Version:** 1.0
**Date:** 2025-11-10
**Target Completion:** 2-3 Sprints
**Priority:** Critical fixes → Operational improvements → Future enhancements

---

## Executive Summary

This document outlines a prioritized refactoring plan for the AgentHub multi-tenant chatbot system. The plan addresses **3 critical security/operational issues** that must be fixed before production, followed by **6 near-term improvements** and **4 future enhancements**.

**Total Estimated Effort:** 40-50 hours (1-2 weeks for critical + near-term)

---

## Priority Matrix

| Priority | Issue | Impact | Effort | Risk if Not Fixed |
|----------|-------|--------|--------|-------------------|
| 🔴 **P0** | DISABLE_AUTH bypass | HIGH | 15 min | Critical security breach |
| 🔴 **P0** | RAG post-query validation | HIGH | 30 min | Cross-tenant data leakage |
| 🔴 **P0** | Rate limiting enforcement | HIGH | 2 hours | Resource abuse, cost overruns |
| 🟡 **P1** | LLM cache invalidation | MEDIUM | 1 hour | Stale credentials after key rotation |
| 🟡 **P1** | Knowledge base cleanup API | MEDIUM | 2 hours | GDPR compliance risk |
| 🟡 **P1** | SupervisorAgent caching | MEDIUM | 1 hour | N+1 query performance |
| 🟡 **P1** | Audit logging | MEDIUM | 3 hours | No compliance trail |
| 🟡 **P1** | Monitoring & metrics | MEDIUM | 4 hours | No visibility into issues |
| 🟡 **P1** | Error handling standardization | MEDIUM | 3 hours | Inconsistent error responses |
| 🟢 **P2** | Per-tenant embedding model | LOW | 8 hours | Limited customization |
| 🟢 **P2** | Tool config overrides | LOW | 6 hours | Limited flexibility |
| 🟢 **P2** | Agent prompt customization | LOW | 4 hours | Limited branding |
| 🟢 **P2** | Webhook support | LOW | 8 hours | No external integrations |

---

## Sprint 1: Critical Fixes (Must Do Before Production)

**Goal:** Eliminate critical security and operational risks
**Duration:** 2-3 days
**Total Effort:** 3 hours

### Issue #1: DISABLE_AUTH Production Bypass ⚠️ **CRITICAL**

**File:** `backend/src/middleware/auth.py`
**Lines:** 38-45
**Severity:** Critical (Security)
**Effort:** 15 minutes
**Risk:** Complete authentication bypass if `DISABLE_AUTH=true` in production

#### Current Code

```python
async def get_tenant_id_from_jwt(authorization: str = Header(None)):
    """Extract tenant_id from JWT token."""

    # TODO: Remove this bypass in production
    if settings.DISABLE_AUTH:
        logger.warning("Auth disabled - returning test tenant ID")
        return "2628802d-1dff-4a98-9325-704433c5d3ab"

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    # ... JWT validation logic
```

#### Problem

- No environment check before allowing auth bypass
- Silent security hole with just a warning log
- Could be accidentally deployed to production

#### Solution

**Step 1: Add environment validation to Settings**

```python
# backend/src/config.py
from pydantic import BaseSettings, validator

class Settings(BaseSettings):
    DISABLE_AUTH: bool = False
    ENVIRONMENT: str = "production"  # production, staging, development

    @validator("DISABLE_AUTH")
    def validate_auth_bypass(cls, v, values):
        """Prevent auth bypass in production."""
        environment = values.get("ENVIRONMENT", "production")

        if v and environment == "production":
            raise ValueError(
                "DISABLE_AUTH cannot be true in production environment. "
                "Set ENVIRONMENT=development or DISABLE_AUTH=false"
            )

        return v

    class Config:
        env_file = ".env"
```

**Step 2: Update middleware with runtime check**

```python
# backend/src/middleware/auth.py
async def get_tenant_id_from_jwt(authorization: str = Header(None)):
    """Extract tenant_id from JWT token."""

    # ✅ Only allow auth bypass in development
    if settings.DISABLE_AUTH:
        if settings.ENVIRONMENT == "production":
            logger.critical(
                "DISABLE_AUTH is true in production - REJECTING REQUEST",
                extra={"environment": settings.ENVIRONMENT}
            )
            raise HTTPException(
                status_code=500,
                detail="Authentication bypass not allowed in production"
            )

        logger.warning(
            "Auth disabled (development mode) - returning test tenant ID",
            extra={
                "environment": settings.ENVIRONMENT,
                "test_tenant_id": "2628802d-1dff-4a98-9325-704433c5d3ab"
            }
        )
        return "2628802d-1dff-4a98-9325-704433c5d3ab"

    # ... rest of JWT validation
```

**Step 3: Add startup validation**

```python
# backend/src/main.py
@app.on_event("startup")
async def validate_production_settings():
    """Validate critical settings at startup."""
    from src.config import settings

    if settings.ENVIRONMENT == "production":
        # Check for unsafe production settings
        unsafe_settings = []

        if settings.DISABLE_AUTH:
            unsafe_settings.append("DISABLE_AUTH=true")

        if not settings.JWT_PUBLIC_KEY:
            unsafe_settings.append("JWT_PUBLIC_KEY not set")

        if unsafe_settings:
            logger.critical(
                "Unsafe production configuration detected - SHUTTING DOWN",
                extra={"unsafe_settings": unsafe_settings}
            )
            raise RuntimeError(
                f"Unsafe production settings: {', '.join(unsafe_settings)}"
            )

    logger.info(
        "Settings validated",
        extra={
            "environment": settings.ENVIRONMENT,
            "auth_enabled": not settings.DISABLE_AUTH
        }
    )
```

#### Testing

```python
# tests/unit/test_auth_bypass.py
import pytest
from src.config import Settings

def test_auth_bypass_blocked_in_production():
    """Test that DISABLE_AUTH cannot be true in production."""
    with pytest.raises(ValueError, match="cannot be true in production"):
        Settings(
            DISABLE_AUTH=True,
            ENVIRONMENT="production"
        )

def test_auth_bypass_allowed_in_development():
    """Test that DISABLE_AUTH is allowed in development."""
    settings = Settings(
        DISABLE_AUTH=True,
        ENVIRONMENT="development"
    )
    assert settings.DISABLE_AUTH is True

def test_production_defaults_secure():
    """Test that production defaults are secure."""
    settings = Settings(ENVIRONMENT="production")
    assert settings.DISABLE_AUTH is False
```

#### Deployment Checklist

- [ ] Update `.env.example` with `ENVIRONMENT=production`
- [ ] Update deployment docs to require `ENVIRONMENT` variable
- [ ] Add pre-deployment checklist verifying `DISABLE_AUTH=false`
- [ ] Add monitoring alert for `DISABLE_AUTH` warnings in logs

---

### Issue #2: RAG Post-Query Validation ⚠️ **CRITICAL**

**File:** `backend/src/services/rag_service.py`
**Lines:** 312-317
**Severity:** Critical (Data Leakage)
**Effort:** 30 minutes
**Risk:** Cross-tenant document leakage if PgVector filtering fails

#### Current Code

```python
def retrieve_documents(self, query: str, tenant_id: UUID, top_k: int = 5):
    """Retrieve relevant documents for a query."""

    metadata_filter = {"tenant_id": str(tenant_id)}

    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k,
        filter=metadata_filter
    )

    return results  # ⚠️ No validation that results match tenant_id
```

#### Problem

- Trusts PgVector metadata filtering without verification
- If filtering fails → silent cross-tenant data breach
- No defense-in-depth

#### Solution

**Step 1: Add post-query validation with monitoring**

```python
# backend/src/services/rag_service.py
from src.utils.exceptions import SecurityError
from src.utils.metrics import rag_cross_tenant_leak_counter
import structlog

logger = structlog.get_logger(__name__)

class RAGService:
    def retrieve_documents(
        self,
        query: str,
        tenant_id: UUID,
        top_k: int = 5,
        enforce_validation: bool = True
    ) -> list[tuple[Document, float]]:
        """Retrieve relevant documents with cross-tenant validation.

        Args:
            query: Search query
            tenant_id: Requesting tenant ID
            top_k: Number of results to return
            enforce_validation: If True, raise error on validation failure.
                               If False, filter out invalid documents.

        Returns:
            List of (document, score) tuples

        Raises:
            SecurityError: If enforce_validation=True and cross-tenant leak detected
        """
        metadata_filter = {"tenant_id": str(tenant_id)}

        # Query PgVector
        raw_results = self.vector_store.similarity_search_with_score(
            query=query,
            k=top_k,
            filter=metadata_filter
        )

        # ✅ Post-query validation (defense in depth)
        validated_results = []
        for doc, score in raw_results:
            doc_tenant_id = doc.metadata.get("tenant_id")

            # Validate tenant_id match
            if doc_tenant_id != str(tenant_id):
                # Log security event
                logger.error(
                    "rag_cross_tenant_leak_detected",
                    extra={
                        "expected_tenant_id": str(tenant_id),
                        "actual_tenant_id": doc_tenant_id,
                        "document_id": doc.metadata.get("id"),
                        "query_preview": query[:100],
                        "score": score
                    }
                )

                # Increment monitoring counter
                rag_cross_tenant_leak_counter.labels(
                    tenant_id=str(tenant_id),
                    leak_source="pgvector"
                ).inc()

                # Enforce validation policy
                if enforce_validation:
                    raise SecurityError(
                        "Cross-tenant document leak detected in RAG query. "
                        f"Expected tenant {tenant_id}, got {doc_tenant_id}. "
                        "This incident has been logged."
                    )
                else:
                    # Skip invalid document (fail-open mode)
                    logger.warning(
                        "rag_skipping_invalid_document",
                        extra={
                            "tenant_id": str(tenant_id),
                            "invalid_tenant_id": doc_tenant_id
                        }
                    )
                    continue

            validated_results.append((doc, score))

        # Log successful retrieval
        logger.info(
            "rag_documents_retrieved",
            extra={
                "tenant_id": str(tenant_id),
                "query_length": len(query),
                "results_count": len(validated_results),
                "top_score": validated_results[0][1] if validated_results else None
            }
        )

        return validated_results
```

**Step 2: Add monitoring metrics**

```python
# backend/src/utils/metrics.py
from prometheus_client import Counter, Histogram

# Cross-tenant leak detection
rag_cross_tenant_leak_counter = Counter(
    'rag_cross_tenant_leak_total',
    'Total cross-tenant document leaks detected in RAG',
    ['tenant_id', 'leak_source']
)

# RAG query performance
rag_query_duration_seconds = Histogram(
    'rag_query_duration_seconds',
    'RAG query latency in seconds',
    ['tenant_id'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

rag_documents_retrieved = Histogram(
    'rag_documents_retrieved',
    'Number of documents retrieved per RAG query',
    ['tenant_id'],
    buckets=[0, 1, 3, 5, 10, 20, 50]
)
```

**Step 3: Add custom exception**

```python
# backend/src/utils/exceptions.py
class SecurityError(Exception):
    """Raised when a security violation is detected."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.details = details or {}
```

**Step 4: Update API error handler**

```python
# backend/src/main.py
from src.utils.exceptions import SecurityError

@app.exception_handler(SecurityError)
async def security_error_handler(request: Request, exc: SecurityError):
    """Handle security violations with appropriate logging and response."""

    logger.critical(
        "security_violation",
        extra={
            "error": str(exc),
            "details": exc.details,
            "path": request.url.path,
            "method": request.method
        }
    )

    # Return generic error to client (don't leak details)
    return JSONResponse(
        status_code=500,
        content={
            "error": "A security policy violation occurred. This incident has been logged.",
            "incident_id": str(uuid.uuid4())
        }
    )
```

#### Testing

```python
# tests/integration/test_rag_validation.py
import pytest
from src.services.rag_service import RAGService
from src.utils.exceptions import SecurityError

def test_rag_blocks_cross_tenant_documents(rag_service, mock_vector_store):
    """Test that RAG validation blocks cross-tenant documents."""

    # Mock PgVector returning wrong tenant's document
    mock_vector_store.similarity_search_with_score.return_value = [
        (Document(metadata={"tenant_id": "other-tenant"}), 0.95)
    ]

    with pytest.raises(SecurityError, match="Cross-tenant document leak"):
        rag_service.retrieve_documents(
            query="test query",
            tenant_id=UUID("correct-tenant"),
            enforce_validation=True
        )

def test_rag_filters_cross_tenant_documents_in_fail_open_mode(rag_service, mock_vector_store):
    """Test that RAG filters invalid documents in fail-open mode."""

    mock_vector_store.similarity_search_with_score.return_value = [
        (Document(metadata={"tenant_id": "correct-tenant"}), 0.95),
        (Document(metadata={"tenant_id": "wrong-tenant"}), 0.90),
        (Document(metadata={"tenant_id": "correct-tenant"}), 0.85)
    ]

    results = rag_service.retrieve_documents(
        query="test query",
        tenant_id=UUID("correct-tenant"),
        enforce_validation=False  # Fail-open mode
    )

    # Should return only 2 valid documents
    assert len(results) == 2
    assert all(doc.metadata["tenant_id"] == "correct-tenant" for doc, _ in results)
```

#### Deployment Checklist

- [ ] Deploy monitoring metrics endpoint
- [ ] Set up alerting for `rag_cross_tenant_leak_total > 0`
- [ ] Test validation with staging tenant data
- [ ] Document incident response for cross-tenant leaks

---

### Issue #3: Rate Limiting Enforcement ⚠️ **CRITICAL**

**Files:**
- `backend/src/models/tenant_llm_config.py` (lines 20-21)
- `backend/src/services/llm_manager.py`

**Severity:** Critical (Cost/Abuse)
**Effort:** 2 hours
**Risk:** Unlimited LLM API usage, cost overruns, potential DoS

#### Current Code

```python
# models/tenant_llm_config.py
class TenantLLMConfig(Base):
    # ...
    rate_limit_rpm = Column(Integer, default=60)  # ⚠️ Stored but never enforced
    rate_limit_tpm = Column(Integer, default=10000)
```

```python
# services/llm_manager.py
def get_llm_for_tenant(tenant_id):
    config = db.query(TenantLLMConfig).filter(...).first()
    # ⚠️ No rate limit check
    return create_llm_client(config.llm_model, decrypted_key)
```

#### Problem

- Rate limits stored in DB but never checked
- Tenants can spam API without restrictions
- No cost control or abuse prevention

#### Solution

**Step 1: Implement Redis-based rate limiter**

```python
# backend/src/utils/rate_limiter.py
import redis
from datetime import datetime
from typing import Tuple
import structlog

logger = structlog.get_logger(__name__)

class RateLimiter:
    """Redis-based rate limiter for tenant LLM requests."""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def check_rate_limit(
        self,
        tenant_id: str,
        rpm_limit: int,
        tpm_limit: int,
        tokens_requested: int = 1
    ) -> Tuple[bool, str, dict]:
        """Check if tenant is within rate limits.

        Args:
            tenant_id: Tenant UUID
            rpm_limit: Requests per minute limit
            tpm_limit: Tokens per minute limit
            tokens_requested: Estimated tokens for this request

        Returns:
            Tuple of (is_allowed, error_message, limits_info)
        """
        now = datetime.utcnow()
        current_minute = now.strftime("%Y%m%d%H%M")

        # Keys for current minute window
        rpm_key = f"rate_limit:{tenant_id}:rpm:{current_minute}"
        tpm_key = f"rate_limit:{tenant_id}:tpm:{current_minute}"

        # Increment request count
        request_count = self.redis.incr(rpm_key)
        if request_count == 1:
            self.redis.expire(rpm_key, 60)  # Expire after 60 seconds

        # Check RPM limit
        if request_count > rpm_limit:
            logger.warning(
                "rpm_limit_exceeded",
                extra={
                    "tenant_id": tenant_id,
                    "current_rpm": request_count,
                    "limit_rpm": rpm_limit
                }
            )
            return (
                False,
                f"Rate limit exceeded: {rpm_limit} requests/minute",
                {
                    "current_rpm": request_count,
                    "limit_rpm": rpm_limit,
                    "current_tpm": self.redis.get(tpm_key) or 0,
                    "limit_tpm": tpm_limit
                }
            )

        # Increment token count
        token_count = self.redis.incrby(tpm_key, tokens_requested)
        if token_count == tokens_requested:
            self.redis.expire(tpm_key, 60)

        # Check TPM limit
        if token_count > tpm_limit:
            logger.warning(
                "tpm_limit_exceeded",
                extra={
                    "tenant_id": tenant_id,
                    "current_tpm": token_count,
                    "limit_tpm": tpm_limit
                }
            )
            # Rollback token increment
            self.redis.decrby(tpm_key, tokens_requested)
            return (
                False,
                f"Token limit exceeded: {tpm_limit} tokens/minute",
                {
                    "current_rpm": request_count,
                    "limit_rpm": rpm_limit,
                    "current_tpm": token_count,
                    "limit_tpm": tpm_limit
                }
            )

        # Success
        return (
            True,
            "",
            {
                "current_rpm": request_count,
                "limit_rpm": rpm_limit,
                "current_tpm": token_count,
                "limit_tpm": tpm_limit
            }
        )

    def get_remaining_limits(self, tenant_id: str, rpm_limit: int, tpm_limit: int) -> dict:
        """Get remaining rate limits for tenant."""
        now = datetime.utcnow()
        current_minute = now.strftime("%Y%m%d%H%M")

        rpm_key = f"rate_limit:{tenant_id}:rpm:{current_minute}"
        tpm_key = f"rate_limit:{tenant_id}:tpm:{current_minute}"

        current_rpm = int(self.redis.get(rpm_key) or 0)
        current_tpm = int(self.redis.get(tpm_key) or 0)

        return {
            "rpm_remaining": max(0, rpm_limit - current_rpm),
            "tpm_remaining": max(0, tpm_limit - current_tpm),
            "rpm_limit": rpm_limit,
            "tpm_limit": tpm_limit
        }
```

**Step 2: Integrate into LLM manager**

```python
# backend/src/services/llm_manager.py
from src.utils.rate_limiter import RateLimiter
from src.utils.token_counter import estimate_tokens
from fastapi import HTTPException

class LLMManager:
    def __init__(self, db_session, redis_client):
        self.db = db_session
        self.rate_limiter = RateLimiter(redis_client)

    def invoke_llm(
        self,
        tenant_id: UUID,
        messages: list,
        model_kwargs: dict = None
    ):
        """Invoke LLM with rate limiting."""

        # Get tenant LLM config
        config = self.db.query(TenantLLMConfig).filter(
            TenantLLMConfig.tenant_id == tenant_id
        ).first()

        if not config:
            raise HTTPException(
                status_code=404,
                detail="Tenant LLM configuration not found"
            )

        # Estimate tokens for this request
        estimated_tokens = estimate_tokens(messages)

        # ✅ Enforce rate limits
        is_allowed, error_msg, limits_info = self.rate_limiter.check_rate_limit(
            tenant_id=str(tenant_id),
            rpm_limit=config.rate_limit_rpm,
            tpm_limit=config.rate_limit_tpm,
            tokens_requested=estimated_tokens
        )

        if not is_allowed:
            logger.warning(
                "rate_limit_exceeded",
                extra={
                    "tenant_id": str(tenant_id),
                    "error": error_msg,
                    **limits_info
                }
            )

            raise HTTPException(
                status_code=429,
                detail=error_msg,
                headers={
                    "X-RateLimit-Limit-RPM": str(limits_info["limit_rpm"]),
                    "X-RateLimit-Limit-TPM": str(limits_info["limit_tpm"]),
                    "X-RateLimit-Remaining-RPM": str(limits_info.get("rpm_remaining", 0)),
                    "X-RateLimit-Remaining-TPM": str(limits_info.get("tpm_remaining", 0)),
                    "Retry-After": "60"
                }
            )

        # Get LLM client and invoke
        llm = self.get_llm_for_tenant(tenant_id)

        try:
            response = llm.invoke(messages, **(model_kwargs or {}))

            # Log actual token usage
            actual_tokens = response.usage_metadata.get("total_tokens", estimated_tokens)
            logger.info(
                "llm_invocation_success",
                extra={
                    "tenant_id": str(tenant_id),
                    "estimated_tokens": estimated_tokens,
                    "actual_tokens": actual_tokens,
                    **limits_info
                }
            )

            return response

        except Exception as e:
            logger.error(
                "llm_invocation_failed",
                extra={
                    "tenant_id": str(tenant_id),
                    "error": str(e)
                }
            )
            raise
```

**Step 3: Add token estimation utility**

```python
# backend/src/utils/token_counter.py
import tiktoken

def estimate_tokens(messages: list, model: str = "gpt-4") -> int:
    """Estimate token count for messages.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model name for encoding

    Returns:
        Estimated token count
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        # Fallback to cl100k_base for unknown models
        encoding = tiktoken.get_encoding("cl100k_base")

    # Rough estimation: 4 chars ≈ 1 token
    total_chars = sum(len(msg.get("content", "")) for msg in messages)
    tokens = encoding.encode("".join(msg.get("content", "") for msg in messages))

    # Add overhead for message structure
    tokens_per_message = 4  # <|start|>role content<|end|>
    total_tokens = len(tokens) + (len(messages) * tokens_per_message)

    return total_tokens
```

**Step 4: Add rate limit headers to all LLM responses**

```python
# backend/src/api/chat.py
@router.post("/{tenant_id}/chat")
async def chat_endpoint(
    tenant_id: UUID,
    message: ChatMessage,
    response: Response,
    db: Session = Depends(get_db),
    redis: redis.Redis = Depends(get_redis)
):
    """Chat endpoint with rate limit headers."""

    # Get tenant config
    config = db.query(TenantLLMConfig).filter(
        TenantLLMConfig.tenant_id == tenant_id
    ).first()

    # Get remaining limits
    rate_limiter = RateLimiter(redis)
    limits = rate_limiter.get_remaining_limits(
        str(tenant_id),
        config.rate_limit_rpm,
        config.rate_limit_tpm
    )

    # Add rate limit headers
    response.headers["X-RateLimit-Limit-RPM"] = str(limits["rpm_limit"])
    response.headers["X-RateLimit-Limit-TPM"] = str(limits["tpm_limit"])
    response.headers["X-RateLimit-Remaining-RPM"] = str(limits["rpm_remaining"])
    response.headers["X-RateLimit-Remaining-TPM"] = str(limits["tpm_remaining"])

    # Process chat
    # ...
```

#### Testing

```python
# tests/unit/test_rate_limiter.py
import pytest
from src.utils.rate_limiter import RateLimiter

def test_rpm_limit_enforcement(redis_client):
    """Test that RPM limits are enforced."""
    limiter = RateLimiter(redis_client)

    tenant_id = "test-tenant"
    rpm_limit = 5
    tpm_limit = 1000

    # Make requests up to limit
    for i in range(rpm_limit):
        is_allowed, _, _ = limiter.check_rate_limit(tenant_id, rpm_limit, tpm_limit)
        assert is_allowed, f"Request {i+1} should be allowed"

    # Next request should be blocked
    is_allowed, error_msg, _ = limiter.check_rate_limit(tenant_id, rpm_limit, tpm_limit)
    assert not is_allowed
    assert "Rate limit exceeded" in error_msg

def test_tpm_limit_enforcement(redis_client):
    """Test that TPM limits are enforced."""
    limiter = RateLimiter(redis_client)

    tenant_id = "test-tenant"
    rpm_limit = 100
    tpm_limit = 1000

    # Make request with large token count
    is_allowed, error_msg, _ = limiter.check_rate_limit(
        tenant_id, rpm_limit, tpm_limit, tokens_requested=1001
    )

    assert not is_allowed
    assert "Token limit exceeded" in error_msg
```

#### Deployment Checklist

- [ ] Add `REDIS_URL` to environment variables
- [ ] Update `requirements.txt` with `redis` and `tiktoken`
- [ ] Set up Redis monitoring (memory, connections)
- [ ] Document rate limit headers in API docs
- [ ] Add admin endpoint to adjust tenant rate limits
- [ ] Monitor `429` responses per tenant

---

## Sprint 2: Near-Term Improvements (Should Fix)

**Goal:** Improve operational reliability and compliance
**Duration:** 1 week
**Total Effort:** 14 hours

### Issue #4: LLM Client Cache Invalidation

**File:** `backend/src/services/llm_manager.py`
**Severity:** Medium (Operational)
**Effort:** 1 hour

**Problem:** Cached LLM clients never invalidated when API keys rotate

**Solution:**
- Cache LLM clients in Redis with version key (tenant_llm_configs.updated_at)
- Check version on each retrieval
- Invalidate cache if version mismatch

*(Full implementation in ARCHITECTURE_ANALYSIS.md)*

---

### Issue #5: Knowledge Base Cleanup API

**Severity:** Medium (GDPR Compliance)
**Effort:** 2 hours

**Problem:** No way to delete tenant's knowledge base or individual documents

**Solution:**
- Add DELETE endpoint for tenant knowledge base
- Add DELETE endpoint for individual documents
- Verify tenant ownership before deletion
- Log all deletions

*(Full implementation in ARCHITECTURE_ANALYSIS.md)*

---

### Issue #6: SupervisorAgent Caching

**File:** `backend/src/services/supervisor_agent.py`
**Severity:** Medium (Performance)
**Effort:** 1 hour

**Problem:** Loads available agents from DB on every message (N+1 query)

**Solution:**
- Cache available agents in Redis with TTL (5 minutes)
- Invalidate cache when tenant agent permissions change
- Add cache hit/miss metrics

*(Full implementation in ARCHITECTURE_ANALYSIS.md)*

---

### Issue #7: Audit Logging

**Severity:** Medium (Compliance)
**Effort:** 3 hours

**Problem:** No audit trail for admin operations

**Solution:**

```python
# models/audit_log.py
class AuditLog(Base):
    __tablename__ = "audit_log"

    log_id = Column(UUID, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID, ForeignKey("tenants.tenant_id"))
    user_id = Column(String(255))
    action = Column(String(100), nullable=False)  # create, update, delete
    table_name = Column(String(100), nullable=False)
    record_id = Column(UUID)
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(String(50))
    timestamp = Column(TIMESTAMP, default=datetime.utcnow)
```

**Audit these operations:**
- Agent/tool permission changes
- LLM config updates
- Knowledge base uploads/deletions
- Tenant creation/deletion

---

### Issue #8: Monitoring & Metrics

**Severity:** Medium (Observability)
**Effort:** 4 hours

**Solution:**

**Prometheus metrics to add:**
- `llm_requests_total{tenant_id, model, status}`
- `llm_latency_seconds{tenant_id, model}`
- `llm_tokens_used_total{tenant_id, model}`
- `rag_queries_total{tenant_id}`
- `rag_query_latency_seconds{tenant_id}`
- `cross_tenant_leak_total{tenant_id}` ⚠️ **Critical**
- `rate_limit_violations_total{tenant_id, limit_type}`

**Grafana dashboards:**
- Per-tenant usage metrics
- System health overview
- Cost tracking
- Security events

---

### Issue #9: Error Handling Standardization

**Severity:** Medium (Code Quality)
**Effort:** 3 hours

**Problem:** Inconsistent error responses across endpoints

**Solution:**

```python
# utils/exceptions.py
class BaseAPIException(Exception):
    status_code = 500
    error_code = "INTERNAL_ERROR"
    message = "An unexpected error occurred"

class TenantNotFoundError(BaseAPIException):
    status_code = 404
    error_code = "TENANT_NOT_FOUND"
    message = "Tenant not found"

class RateLimitExceededError(BaseAPIException):
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"

# main.py
@app.exception_handler(BaseAPIException)
async def api_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "incident_id": str(uuid.uuid4())
            }
        }
    )
```

---

## Sprint 3: Future Enhancements (Nice to Have)

**Goal:** Increase flexibility and customization
**Duration:** 2 weeks
**Total Effort:** 26 hours

### Enhancement #1: Per-Tenant Embedding Model

**Effort:** 8 hours

**Changes:**
- Add `embedding_model` to `tenant_llm_configs`
- Update RAG service to use tenant's embedding model
- Handle migration for existing documents

---

### Enhancement #2: Tool Config Overrides

**Effort:** 6 hours

**New table:**
```sql
CREATE TABLE tenant_tool_config_overrides (
    tenant_id UUID REFERENCES tenants(tenant_id),
    tool_id UUID REFERENCES tool_configs(tool_id),
    config_override JSONB NOT NULL,
    PRIMARY KEY (tenant_id, tool_id)
);
```

**Use case:** Tenant A uses different API endpoint than Tenant B for same tool

---

### Enhancement #3: Agent Prompt Customization

**Effort:** 4 hours

**Changes:**
- Add `prompt_override` to `tenant_agent_permissions`
- Update agent loading to use override if present

---

### Enhancement #4: Webhook Support

**Effort:** 8 hours

**New table:**
```sql
CREATE TABLE tenant_webhooks (
    webhook_id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id),
    event_type VARCHAR(100) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);
```

**Events:** `message.sent`, `session.started`, `session.ended`, `tool.executed`

---

## Implementation Timeline

### Week 1: Critical Fixes
- Day 1: Issue #1 (DISABLE_AUTH) + Issue #2 (RAG validation)
- Day 2-3: Issue #3 (Rate limiting)
- Day 4-5: Testing and deployment

### Week 2: Near-Term Improvements
- Day 1: Issues #4, #5, #6 (Caching improvements)
- Day 2-3: Issue #7 (Audit logging)
- Day 4-5: Issues #8, #9 (Monitoring + Error handling)

### Week 3-4: Future Enhancements (Optional)
- Enhancements #1-4 based on priority

---

## Success Metrics

### Pre-Production Checklist

**Security:**
- [ ] `DISABLE_AUTH` blocked in production
- [ ] RAG cross-tenant validation enabled
- [ ] No cross-tenant leaks detected in staging tests
- [ ] Audit logging for all admin operations

**Performance:**
- [ ] Rate limiting enforced (no 429 errors in normal usage)
- [ ] LLM cache hit rate > 50%
- [ ] Agent loading cached (< 10ms per request)

**Observability:**
- [ ] Prometheus metrics endpoint exposed
- [ ] Grafana dashboards deployed
- [ ] Alerts configured for critical metrics
- [ ] Log aggregation (ELK/Datadog) configured

**Compliance:**
- [ ] Audit logs retention policy defined
- [ ] GDPR data deletion endpoints tested
- [ ] Security incident response plan documented

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Owner:** Engineering Team
**Review Frequency:** After each sprint
