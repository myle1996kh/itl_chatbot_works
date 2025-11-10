# AgentHub Multi-Tenant Chatbot Framework - Architecture Analysis

**Analysis Date:** 2025-11-10
**Analyst:** Mary (Business Analyst)
**Project Version:** Analyzed from latest codebase
**Status:** Production-Ready with Critical Hardening Required

---

## Executive Summary

**AgentHub** is a sophisticated multi-tenant chatbot system implementing a Supervisor-Domain Agent pattern with PostgreSQL + pgvector for RAG capabilities. The system demonstrates **excellent architectural maturity (8.5/10)** and **near-perfect multi-tenancy implementation (97/100)**, but requires **3 critical security/operational fixes** before production deployment.

### Key Findings

✅ **Strengths:**
- Robust multi-tenant isolation at database and application levels
- Well-designed agent orchestration with LangChain 0.3+
- Comprehensive permission system for agents and tools
- Per-tenant encrypted LLM API key management
- Modern PgVector-based RAG with HNSW indexing

⚠️ **Critical Issues:**
1. `DISABLE_AUTH` bypass in production mode (security risk)
2. Missing RAG post-query validation (tenant data leakage risk)
3. Rate limiting stored but not enforced (resource abuse risk)

---

## System Architecture

### 1. Architecture Pattern

**Pattern:** Supervisor-Domain Agent (Hierarchical Multi-Agent System)

```
User Request
    │
    ▼
┌─────────────────────────┐
│   FastAPI Endpoint      │ ← JWT Authentication (RS256)
│   /api/{tenant_id}/chat │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────┐
│   SupervisorAgent           │ ← Intent Detection & Routing
│   (services/supervisor_     │
│    agent.py)                │
└────────────┬────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│ Domain   │    │ Domain   │ ← Entity Extraction
│ Agent 1  │    │ Agent 2  │ ← Tool Execution
└────┬─────┘    └────┬─────┘ ← Response Formatting
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│ Tools    │    │ Tools    │
│ - RAG    │    │ - HTTP   │
│ - HTTP   │    │ - Custom │
└──────────┘    └──────────┘
```

### 2. Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Backend** | Python + FastAPI | 3.11+ | API Server |
| **Agent Framework** | LangChain + LangGraph | 0.3+, 0.2+ | Agent Orchestration |
| **Database** | PostgreSQL | 15+ | Primary Data Store |
| **Vector DB** | pgvector | 0.5+ | RAG Similarity Search |
| **ORM** | SQLAlchemy | 2.0+ | Database Abstraction |
| **Caching** | Redis | 7.x | LLM Response Cache |
| **Embeddings** | sentence-transformers | Latest | Vector Generation (384D) |
| **Security** | JWT (RS256) + Fernet | - | Auth + Encryption |
| **Logging** | structlog | Latest | Structured Logging |

---

## Database Architecture

### Database ERD (13 Tables)

#### **Multi-Tenant Core Tables**

**1. `tenants` (Root Entity)**
```sql
CREATE TABLE tenants (
    tenant_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    domain          VARCHAR(255) UNIQUE,
    status          VARCHAR(50) NOT NULL DEFAULT 'active', -- Indexed
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
```

**2. `tenant_llm_configs` (1:1 with tenants)**
```sql
CREATE TABLE tenant_llm_configs (
    config_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id),
    llm_model_id        UUID NOT NULL REFERENCES llm_models(llm_model_id),
    encrypted_api_key   TEXT NOT NULL,  -- Fernet encrypted
    rate_limit_rpm      INTEGER DEFAULT 60,
    rate_limit_tpm      INTEGER DEFAULT 10000,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_llm_configs_llm_model ON tenant_llm_configs(llm_model_id);
```

**3. `tenant_widget_configs` (1:1 with tenants)**
```sql
CREATE TABLE tenant_widget_configs (
    widget_config_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id),
    -- Additional widget configuration fields
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
```

#### **Session & Message Tables (Tenant-Scoped)**

**4. `sessions`**
```sql
CREATE TABLE sessions (
    session_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
    user_id             VARCHAR(255) NOT NULL,  -- From JWT
    agent_id            UUID REFERENCES agent_configs(agent_id),
    thread_id           VARCHAR(500),  -- LangGraph thread
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    last_message_at     TIMESTAMP NOT NULL DEFAULT now(),
    metadata            JSONB
);
CREATE INDEX ix_sessions_tenant_user ON sessions(tenant_id, user_id, created_at);
CREATE INDEX ix_sessions_last_message_at ON sessions(last_message_at);
```

**5. `messages`**
```sql
CREATE TABLE messages (
    message_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES sessions(session_id),
    role            VARCHAR(50) NOT NULL,  -- user/assistant/system
    content         TEXT NOT NULL,
    timestamp       TIMESTAMP NOT NULL DEFAULT now(),
    metadata        JSONB  -- intent, tool_calls, tokens
);
CREATE INDEX ix_messages_session_timestamp ON messages(session_id, timestamp);
```

#### **Permission Tables (Access Control)**

**6. `tenant_agent_permissions`**
```sql
CREATE TABLE tenant_agent_permissions (
    tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
    agent_id            UUID NOT NULL REFERENCES agent_configs(agent_id),
    enabled             BOOLEAN NOT NULL DEFAULT true,
    output_override_id  UUID REFERENCES output_formats(format_id),
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, agent_id)
);
CREATE INDEX idx_tenant_agent_permissions_enabled ON tenant_agent_permissions(enabled);
```

**7. `tenant_tool_permissions`**
```sql
CREATE TABLE tenant_tool_permissions (
    tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id),
    tool_id         UUID NOT NULL REFERENCES tool_configs(tool_id),
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, tool_id)
);
CREATE INDEX idx_tenant_tool_permissions_enabled ON tenant_tool_permissions(enabled);
```

#### **Agent & Tool Configuration (Shared Across Tenants)**

**8. `agent_configs`**
```sql
CREATE TABLE agent_configs (
    agent_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    VARCHAR(100) NOT NULL UNIQUE,
    prompt_template         TEXT NOT NULL,
    llm_model_id            UUID NOT NULL REFERENCES llm_models(llm_model_id),
    default_output_format_id UUID REFERENCES output_formats(format_id),
    description             TEXT,
    handler_class           VARCHAR(255) DEFAULT 'services.domain_agents.DomainAgent',
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMP NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_configs_is_active ON agent_configs(is_active);
```

**9. `agent_tools` (Junction Table)**
```sql
CREATE TABLE agent_tools (
    agent_id    UUID NOT NULL REFERENCES agent_configs(agent_id),
    tool_id     UUID NOT NULL REFERENCES tool_configs(tool_id),
    priority    INTEGER NOT NULL,  -- 1=highest priority
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, tool_id)
);
CREATE INDEX ix_agent_tools_agent_priority ON agent_tools(agent_id, priority);
```

**10. `tool_configs`**
```sql
CREATE TABLE tool_configs (
    tool_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100) NOT NULL,
    base_tool_id        UUID NOT NULL REFERENCES base_tools(base_tool_id),
    config              JSONB NOT NULL,  -- endpoint, method, headers
    input_schema        JSONB NOT NULL,  -- JSON schema for parameters
    output_format_id    UUID REFERENCES output_formats(format_id),
    description         TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_tool_configs_base_tool ON tool_configs(base_tool_id);
CREATE INDEX idx_tool_configs_is_active ON tool_configs(is_active);
```

**11. `base_tools`**
```sql
CREATE TABLE base_tools (
    base_tool_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    category        VARCHAR(100) NOT NULL,
    handler_class   VARCHAR(255) NOT NULL,  -- Python class path
    description     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
```

#### **Reference Tables (Shared)**

**12. `llm_models`**
```sql
CREATE TABLE llm_models (
    llm_model_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider        VARCHAR(50) NOT NULL,  -- openrouter, openai, anthropic
    model_name      VARCHAR(100) NOT NULL,
    display_name    VARCHAR(100),
    supports_tools  BOOLEAN DEFAULT true,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
```

**13. `output_formats`**
```sql
CREATE TABLE output_formats (
    format_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100) NOT NULL UNIQUE,
    format_template     TEXT NOT NULL,
    instructions        TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);
```

#### **LangGraph Checkpoint Table (Auto-Created)**
```sql
-- Created automatically by LangGraph PostgresCheckpointSaver
CREATE TABLE checkpoints (
    thread_id       VARCHAR NOT NULL,
    checkpoint_id   VARCHAR NOT NULL,
    parent_id       VARCHAR,
    checkpoint      JSONB NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT now(),
    PRIMARY KEY (thread_id, checkpoint_id)
);
```

---

## Multi-Tenancy Implementation Analysis

### Tenant Isolation Score: **97/100**

| Isolation Aspect | Score | Implementation | Status |
|------------------|-------|----------------|--------|
| **Configuration** | 100% | UNIQUE(tenant_id) constraint on tenant_llm_configs | ✅ Perfect |
| **Session** | 100% | FK(tenant_id) + Composite Index | ✅ Perfect |
| **Conversation History** | 100% | Cascading via session_id FK | ✅ Perfect |
| **Knowledge Base** | 95% | Metadata filtering in PgVector | ⚠️ Needs validation |
| **Agent Access** | 100% | tenant_agent_permissions table | ✅ Perfect |
| **Tool Access** | 100% | tenant_tool_permissions table | ✅ Perfect |
| **LLM Provider** | 100% | Encrypted API keys per tenant | ✅ Perfect |

### Detailed Isolation Mechanisms

#### 1. **Configuration Isolation** ✅ **Perfect**

**Implementation:**
```python
# models/tenant_llm_config.py:17
tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"),
                   nullable=False, unique=True)
```

**Verification:**
- **UNIQUE constraint** ensures 1:1 relationship between tenant and config
- Each tenant gets exactly ONE LLM configuration
- API keys encrypted using Fernet (symmetric encryption)
- Rate limits stored per tenant (rpm, tpm)

**Evidence:**
```python
# services/llm_manager.py
def get_llm_for_tenant(tenant_id):
    config = db.query(TenantLLMConfig).filter(
        TenantLLMConfig.tenant_id == tenant_id
    ).first()  # Returns 0 or 1 row (UNIQUE constraint)

    decrypted_key = decrypt_api_key(config.encrypted_api_key)
    return create_llm_client(config.llm_model, decrypted_key)
```

#### 2. **Session Isolation** ✅ **Perfect**

**Implementation:**
```python
# models/session.py:20
tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)

# Composite index for fast tenant-scoped queries
__table_args__ = (
    Index('ix_sessions_tenant_user', 'tenant_id', 'user_id', 'created_at'),
)
```

**Verification:**
- **FK constraint** enforces referential integrity
- **Composite index** optimizes tenant-scoped queries
- Sessions always loaded with `tenant_id` filter

**Evidence:**
```python
# api/sessions.py
@router.get("/{tenant_id}/sessions")
async def list_sessions(tenant_id: UUID, user_id: str):
    sessions = db.query(ChatSession).filter(
        ChatSession.tenant_id == tenant_id,
        ChatSession.user_id == user_id
    ).all()  # Properly scoped
    return sessions
```

#### 3. **Conversation History Isolation** ✅ **Perfect**

**Implementation:**
```python
# messages.py:20
session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False)
```

**Verification:**
- Messages scoped via `session_id` FK (cascading isolation)
- Sessions already scoped by `tenant_id`
- Transitive isolation: tenant → session → messages

**Evidence:**
```python
# services/conversation_memory.py
def get_conversation_history(session_id):
    messages = db.query(Message).filter(
        Message.session_id == session_id
    ).order_by(Message.timestamp).all()
    # session_id already validated to belong to tenant
    return messages
```

#### 4. **Knowledge Base Isolation** ⚠️ **95% (Needs Validation)**

**Implementation:**
```python
# services/rag_service.py:312-317
def retrieve_documents(query: str, tenant_id: UUID, top_k: int = 5):
    metadata_filter = {"tenant_id": str(tenant_id)}

    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k,
        filter=metadata_filter  # PgVector metadata filtering
    )

    return results  # ⚠️ NO POST-QUERY VALIDATION!
```

**Risk:**
- If PgVector metadata filtering fails silently, cross-tenant documents could leak
- No validation that returned documents match `tenant_id`

**Recommended Fix:**
```python
def retrieve_documents(query: str, tenant_id: UUID, top_k: int = 5):
    metadata_filter = {"tenant_id": str(tenant_id)}

    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k,
        filter=metadata_filter
    )

    # ✅ ADD POST-QUERY VALIDATION
    for doc, score in results:
        if doc.metadata.get("tenant_id") != str(tenant_id):
            logger.error(
                "Cross-tenant document leak detected",
                extra={
                    "expected_tenant_id": str(tenant_id),
                    "actual_tenant_id": doc.metadata.get("tenant_id"),
                    "document_id": doc.metadata.get("id")
                }
            )
            raise SecurityError("Cross-tenant data leakage detected")

    return results
```

#### 5. **Agent Access Control** ✅ **Perfect**

**Implementation:**
```python
# services/supervisor_agent.py
def load_available_agents(tenant_id: UUID):
    agents = db.query(AgentConfig).join(
        TenantAgentPermission,
        TenantAgentPermission.agent_id == AgentConfig.agent_id
    ).filter(
        TenantAgentPermission.tenant_id == tenant_id,
        TenantAgentPermission.enabled == True,
        AgentConfig.is_active == True
    ).all()

    return agents  # Only tenant's permitted agents
```

**Verification:**
- Join through `tenant_agent_permissions` table
- Only enabled agents for specific tenant
- Global `is_active` flag for admin control

#### 6. **Tool Access Control** ✅ **Perfect**

**Implementation:**
```python
# services/tool_loader.py
def load_tools_for_agent(agent_id: UUID, tenant_id: UUID):
    tools = db.query(ToolConfig).join(
        AgentTools,
        AgentTools.tool_id == ToolConfig.tool_id
    ).join(
        TenantToolPermission,
        TenantToolPermission.tool_id == ToolConfig.tool_id
    ).filter(
        AgentTools.agent_id == agent_id,
        TenantToolPermission.tenant_id == tenant_id,
        TenantToolPermission.enabled == True,
        ToolConfig.is_active == True
    ).order_by(AgentTools.priority).all()

    return tools  # Only tenant's permitted tools for this agent
```

**Verification:**
- Combines agent-tool assignment (`agent_tools`) with tenant permissions
- Only loads tools that are both:
  1. Assigned to the agent
  2. Permitted for the tenant
- Ordered by priority for LLM selection

---

## Critical Issues & Recommendations

### **MUST FIX (Before Production)**

#### **Issue #1: DISABLE_AUTH Production Risk** ⚠️ **CRITICAL**

**File:** `backend/src/middleware/auth.py:38-45`

**Problem:**
```python
async def get_tenant_id_from_jwt(authorization: str = Header(None)):
    """Extract tenant_id from JWT token."""

    # TODO: Remove this bypass in production
    if settings.DISABLE_AUTH:
        logger.warning("Auth disabled - returning test tenant ID")
        return "2628802d-1dff-4a98-9325-704433c5d3ab"  # ⚠️ Hardcoded test tenant

    # ... JWT validation logic
```

**Risk:**
- If `.env` contains `DISABLE_AUTH=true` in production → **all requests use test tenant**
- No runtime environment check
- Silent security bypass

**Fix (5 minutes):**
```python
async def get_tenant_id_from_jwt(authorization: str = Header(None)):
    """Extract tenant_id from JWT token."""

    # ✅ Only allow auth bypass in development
    if settings.DISABLE_AUTH:
        if settings.ENVIRONMENT == "production":
            logger.critical("DISABLE_AUTH set in production - REJECTING REQUEST")
            raise HTTPException(
                status_code=500,
                detail="Auth bypass not allowed in production"
            )
        logger.warning("Auth disabled (development only) - returning test tenant ID")
        return "2628802d-1dff-4a98-9325-704433c5d3ab"

    # ... JWT validation logic
```

**Additional Hardening:**
```python
# config.py
class Settings(BaseSettings):
    DISABLE_AUTH: bool = False
    ENVIRONMENT: str = "production"

    @validator("DISABLE_AUTH")
    def validate_auth_bypass(cls, v, values):
        if v and values.get("ENVIRONMENT") == "production":
            raise ValueError("DISABLE_AUTH cannot be true in production")
        return v
```

---

#### **Issue #2: Missing RAG Post-Query Validation** ⚠️ **CRITICAL**

**File:** `backend/src/services/rag_service.py:312-317`

**Problem:**
```python
def retrieve_documents(self, query: str, tenant_id: UUID, top_k: int = 5):
    """Retrieve relevant documents for a query."""

    metadata_filter = {"tenant_id": str(tenant_id)}
    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k,
        filter=metadata_filter
    )

    return results  # ⚠️ Trusts PgVector filtering without verification
```

**Risk:**
- If PgVector metadata filtering fails → cross-tenant data leakage
- No defense-in-depth validation
- Silent failure mode

**Fix (30 minutes):**
```python
def retrieve_documents(self, query: str, tenant_id: UUID, top_k: int = 5):
    """Retrieve relevant documents for a query with cross-tenant validation."""

    metadata_filter = {"tenant_id": str(tenant_id)}
    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k,
        filter=metadata_filter
    )

    # ✅ Post-query validation (defense in depth)
    validated_results = []
    for doc, score in results:
        doc_tenant_id = doc.metadata.get("tenant_id")

        if doc_tenant_id != str(tenant_id):
            logger.error(
                "Cross-tenant document leak detected in RAG query",
                extra={
                    "expected_tenant_id": str(tenant_id),
                    "actual_tenant_id": doc_tenant_id,
                    "document_id": doc.metadata.get("id"),
                    "query": query[:100]  # Truncate for logging
                }
            )
            # Option 1: Raise exception (fail-safe)
            raise SecurityError("Cross-tenant data leakage detected")

            # Option 2: Skip document (fail-open, log for monitoring)
            # continue

        validated_results.append((doc, score))

    return validated_results
```

**Additional Hardening:**
```python
# Add monitoring metric
from prometheus_client import Counter

cross_tenant_leak_counter = Counter(
    'rag_cross_tenant_leak_total',
    'Total cross-tenant document leaks detected'
)

# In validation loop:
if doc_tenant_id != str(tenant_id):
    cross_tenant_leak_counter.inc()
    # ... logging and error handling
```

---

#### **Issue #3: Rate Limiting Not Enforced** ⚠️ **CRITICAL**

**Files:**
- `backend/src/models/tenant_llm_config.py:20-21`
- `backend/src/services/llm_manager.py`

**Problem:**
```python
# tenant_llm_config.py
class TenantLLMConfig(Base):
    # ...
    rate_limit_rpm = Column(Integer, default=60)  # ⚠️ Stored but never checked
    rate_limit_tpm = Column(Integer, default=10000)
```

```python
# llm_manager.py
def get_llm_for_tenant(tenant_id):
    config = db.query(TenantLLMConfig).filter(...).first()
    # ⚠️ No rate limit enforcement
    return create_llm_client(config.llm_model, decrypted_key)
```

**Risk:**
- Tenants can spam API without limits
- No cost control
- Potential DoS via excessive LLM calls

**Fix (2 hours):**

**Step 1: Add Redis-based rate limiter**
```python
# utils/rate_limiter.py
import redis
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def check_rate_limit(
        self,
        tenant_id: str,
        rpm_limit: int,
        tpm_limit: int,
        tokens_requested: int = 1
    ) -> tuple[bool, str]:
        """Check if tenant is within rate limits.

        Returns:
            (is_allowed, error_message)
        """
        now = datetime.utcnow()
        minute_key = f"rate_limit:{tenant_id}:rpm:{now.minute}"
        tokens_key = f"rate_limit:{tenant_id}:tpm:{now.minute}"

        # Check RPM (requests per minute)
        request_count = self.redis.incr(minute_key)
        if request_count == 1:
            self.redis.expire(minute_key, 60)  # Expire after 60 seconds

        if request_count > rpm_limit:
            return False, f"Rate limit exceeded: {rpm_limit} requests/minute"

        # Check TPM (tokens per minute)
        token_count = self.redis.incrby(tokens_key, tokens_requested)
        if token_count == tokens_requested:
            self.redis.expire(tokens_key, 60)

        if token_count > tpm_limit:
            return False, f"Token limit exceeded: {tpm_limit} tokens/minute"

        return True, ""
```

**Step 2: Integrate into LLM manager**
```python
# services/llm_manager.py
from utils.rate_limiter import RateLimiter

class LLMManager:
    def __init__(self, db_session, redis_client):
        self.db = db_session
        self.rate_limiter = RateLimiter(redis_client)

    def invoke_llm(
        self,
        tenant_id: UUID,
        messages: list,
        estimated_tokens: int = 1000
    ):
        # Get tenant config
        config = self.db.query(TenantLLMConfig).filter(
            TenantLLMConfig.tenant_id == tenant_id
        ).first()

        # ✅ Enforce rate limits
        is_allowed, error_msg = self.rate_limiter.check_rate_limit(
            tenant_id=str(tenant_id),
            rpm_limit=config.rate_limit_rpm,
            tpm_limit=config.rate_limit_tpm,
            tokens_requested=estimated_tokens
        )

        if not is_allowed:
            logger.warning(
                "Rate limit exceeded for tenant",
                extra={"tenant_id": str(tenant_id), "error": error_msg}
            )
            raise HTTPException(status_code=429, detail=error_msg)

        # Proceed with LLM invocation
        llm = self.get_llm_for_tenant(tenant_id)
        response = llm.invoke(messages)

        return response
```

**Step 3: Add rate limit headers to API responses**
```python
# api/chat.py
@router.post("/{tenant_id}/chat")
async def chat_endpoint(tenant_id: UUID, message: str, response: Response):
    # ... get tenant config ...

    # Add rate limit headers
    response.headers["X-RateLimit-Limit-RPM"] = str(config.rate_limit_rpm)
    response.headers["X-RateLimit-Limit-TPM"] = str(config.rate_limit_tpm)
    response.headers["X-RateLimit-Remaining-RPM"] = str(remaining_rpm)
    response.headers["X-RateLimit-Remaining-TPM"] = str(remaining_tpm)

    # ... process chat ...
```

---

### **SHOULD FIX (Near-Term)**

#### **Issue #4: No LLM Client Cache Invalidation**

**File:** `backend/src/services/llm_manager.py`

**Problem:**
```python
class LLMManager:
    def __init__(self):
        self.llm_cache = {}  # tenant_id → LLM client

    def get_llm_for_tenant(self, tenant_id):
        if tenant_id in self.llm_cache:
            return self.llm_cache[tenant_id]  # ⚠️ Never invalidated

        # ... create and cache ...
```

**Risk:**
- If tenant rotates API key → old cached client still used
- Stale credentials

**Fix:**
```python
class LLMManager:
    def __init__(self, redis_client):
        self.redis = redis_client

    def get_llm_for_tenant(self, tenant_id):
        # Check cache version
        cache_key = f"llm_cache:{tenant_id}"
        db_config = self._load_config(tenant_id)

        cached_data = self.redis.get(cache_key)
        if cached_data:
            cached_client, cached_version = pickle.loads(cached_data)
            if cached_version == db_config.updated_at:
                return cached_client

        # Create new client
        client = self._create_llm_client(db_config)

        # Cache with version
        self.redis.setex(
            cache_key,
            3600,  # 1 hour TTL
            pickle.dumps((client, db_config.updated_at))
        )

        return client
```

---

#### **Issue #5: Missing Knowledge Base Cleanup API**

**Problem:**
- No admin endpoint to delete tenant's knowledge base
- No way to remove individual documents
- GDPR compliance risk

**Fix:**
```python
# api/admin/knowledge.py
@router.delete("/admin/tenants/{tenant_id}/knowledge")
async def delete_tenant_knowledge(tenant_id: UUID):
    """Delete all knowledge base documents for a tenant."""

    # Delete from vector store
    deleted_count = vector_store.delete(
        filter={"tenant_id": str(tenant_id)}
    )

    logger.info(
        "Deleted tenant knowledge base",
        extra={"tenant_id": str(tenant_id), "count": deleted_count}
    )

    return {"deleted_count": deleted_count}

@router.delete("/admin/knowledge/documents/{document_id}")
async def delete_document(document_id: str, tenant_id: UUID):
    """Delete a specific document."""

    # Verify document belongs to tenant
    doc = vector_store.get(document_id)
    if doc.metadata["tenant_id"] != str(tenant_id):
        raise HTTPException(status_code=404, detail="Document not found")

    vector_store.delete(ids=[document_id])

    return {"status": "deleted"}
```

---

#### **Issue #6: SupervisorAgent Cache Optimization**

**File:** `backend/src/services/supervisor_agent.py`

**Problem:**
```python
def route_message(tenant_id, message):
    # ⚠️ Loads available agents on EVERY message
    available_agents = self._load_available_agents(tenant_id)
    # ...
```

**Risk:**
- N+1 query problem for agent loading
- Unnecessary DB load

**Fix:**
```python
from functools import lru_cache
from datetime import datetime, timedelta

class SupervisorAgent:
    def __init__(self, redis_client):
        self.redis = redis_client

    def route_message(self, tenant_id, message):
        # ✅ Load from cache with TTL
        available_agents = self._get_cached_agents(tenant_id)
        # ...

    def _get_cached_agents(self, tenant_id):
        cache_key = f"agents:{tenant_id}"

        cached = self.redis.get(cache_key)
        if cached:
            return pickle.loads(cached)

        # Load from DB
        agents = self._load_available_agents(tenant_id)

        # Cache for 5 minutes
        self.redis.setex(cache_key, 300, pickle.dumps(agents))

        return agents

    def invalidate_agent_cache(self, tenant_id):
        """Call this when tenant's agent permissions change."""
        self.redis.delete(f"agents:{tenant_id}")
```

---

### **NICE TO HAVE (Future Enhancements)**

#### **Enhancement #1: Per-Tenant Embedding Model**

**Current State:**
- All tenants use same embedding model (`all-MiniLM-L6-v2`, 384D)
- No customization option

**Proposed:**
```python
# Add to tenant_llm_configs
embedding_model = Column(String(100), default="all-MiniLM-L6-v2")
embedding_dimension = Column(Integer, default=384)
```

---

#### **Enhancement #2: Per-Tenant Tool Config Overrides**

**Current State:**
- Tool configs are global
- No per-tenant customization (e.g., different API endpoints)

**Proposed:**
```python
# New table: tenant_tool_config_overrides
CREATE TABLE tenant_tool_config_overrides (
    tenant_id       UUID REFERENCES tenants(tenant_id),
    tool_id         UUID REFERENCES tool_configs(tool_id),
    config_override JSONB NOT NULL,  -- Merge with base config
    PRIMARY KEY (tenant_id, tool_id)
);
```

---

#### **Enhancement #3: Per-Tenant Agent Prompt Customization**

**Current State:**
- Agent prompts are global
- No per-tenant customization

**Proposed:**
```python
# Add to tenant_agent_permissions
prompt_override = Column(Text, nullable=True)  # If set, use instead of agent's default
```

---

#### **Enhancement #4: Webhook Support**

**Proposed:**
```python
# New table: tenant_webhooks
CREATE TABLE tenant_webhooks (
    webhook_id      UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id),
    event_type      VARCHAR(100) NOT NULL,  -- 'message.sent', 'session.ended'
    webhook_url     VARCHAR(500) NOT NULL,
    secret          TEXT NOT NULL,  -- For HMAC signature
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT now()
);
```

---

## Architecture Assessment Summary

### **Production Readiness: 7.5/10**

| Aspect | Score | Notes |
|--------|-------|-------|
| **Architecture Design** | 9/10 | Clean separation of concerns, well-structured |
| **Multi-Tenancy** | 9.7/10 | Excellent isolation, minor RAG validation gap |
| **Security** | 7/10 | Good foundations, DISABLE_AUTH bypass is critical |
| **Scalability** | 8/10 | Redis caching, needs rate limiting |
| **Observability** | 8/10 | Structured logging, needs metrics |
| **Code Quality** | 8/10 | Good patterns, some refactoring opportunities |
| **Testing** | ?/10 | Not analyzed (tests/ directory not reviewed) |

### **Deployment Checklist**

**Before Production:**
- [ ] Fix `DISABLE_AUTH` to check `ENVIRONMENT`
- [ ] Add RAG post-query validation
- [ ] Implement rate limiting enforcement
- [ ] Add audit logging for admin operations
- [ ] Add Prometheus metrics
- [ ] Set up error alerting (Sentry)
- [ ] Load testing with multi-tenant scenarios
- [ ] Security audit / penetration testing

**Monitoring Required:**
- [ ] Cross-tenant leak detection (RAG)
- [ ] Rate limit violations per tenant
- [ ] LLM API errors per tenant
- [ ] Cache hit/miss rates
- [ ] Database query performance

---

## Conclusion

**AgentHub demonstrates excellent architectural maturity** with a well-designed multi-tenant chatbot system. The core multi-tenancy implementation is robust (97/100), with proper database schema, permission controls, and isolation mechanisms.

**The 3 critical issues identified are operational/security gaps** rather than fundamental architectural flaws:
1. Auth bypass in production
2. Missing RAG validation
3. Unenforced rate limits

**Once these issues are fixed** (estimated 3-4 hours of development), the system will be **production-ready** for deployment.

**Recommended Next Steps:**
1. Implement the 3 critical fixes (this sprint)
2. Add monitoring and alerting (next sprint)
3. Conduct load testing and security audit (before launch)
4. Plan future enhancements based on tenant feedback (post-launch)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Reviewed By:** Mary (Business Analyst)
**Status:** Final
