# Configs & Business Logic – Multi‑Tenant Chatbot

This document focuses on configuration and core business logic, based only on `backend/src` and `frontend`.

---

## 1. Configuration Overview

### 1.1 Backend config (`backend/src/config.py`)

- Uses `pydantic_settings.BaseSettings` to load env vars from:
  - The environment.
  - `.env` file in `backend` (configured via `Config.env_file = ".env"`).

Key settings:

- `DATABASE_URL`
  - Full PostgreSQL connection string.
  - Default: `postgresql://postgres:Postgres123!@172.23.178.103:32001/chatbot`.
- `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`
  - SQLAlchemy connection pool sizing.
- `REDIS_URL`, `CACHE_TTL_SECONDS`
  - Redis location for optional caching/rate limiting.
- `JWT_PUBLIC_KEY`
  - Used to verify JWT tokens (RS256) in production.
- `FERNET_KEY`
  - Symmetric key for encrypting sensitive data (e.g., LLM API keys).
- `ENVIRONMENT`
  - `development` or `production`.
  - Influences logging, debug mode, and auth bypass rules.
- `LOG_LEVEL`
  - Logging verbosity (`INFO`, `DEBUG`, etc.).
- `API_HOST`, `API_PORT`
  - Uvicorn bind address and port.
- `DISABLE_AUTH`
  - Dev‑only switch to bypass JWT validation.
  - Validator prevents `DISABLE_AUTH=True` when `ENVIRONMENT="production"`.
- `TEST_BEARER_TOKEN`
  - Used when calling external APIs in tools while auth is disabled.
- `CORS_ORIGINS`
  - Comma‑separated list of allowed origins; parsed by `cors_origins_list`.
- `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`
  - LLM provider defaults for OpenRouter.

Runtime resources:

- `engine` – SQLAlchemy engine using `DATABASE_URL` and pool settings.
- `SessionLocal` – session factory used by `get_db`.
- `get_db()` – FastAPI dependency that yields a DB session per request.
- `get_redis()` – async dependency that opens/closes a Redis connection per usage.

Business rules:

- If `ENVIRONMENT="production"` and `DISABLE_AUTH=True`, startup validation in `main.py` fails, preventing unsafe config.

### 1.2 Auth middleware and tenants (`backend/src/middleware/auth.py`)

Core dependencies:

- `get_current_user`
  - In dev (`DISABLE_AUTH=True`):
    - If token present, decodes without verifying signature (for convenience).
    - If no token, returns a mock payload with random `sub` and `roles=["admin"]`.
  - In production (`DISABLE_AUTH=False`):
    - Requires a Bearer token.
    - Validates using `decode_jwt` and `JWT_PUBLIC_KEY`.

- `get_current_tenant`
  - In dev:
    - Tries to parse `tenant_id` from URL path (`/api/{tenant_id}/...`).
    - If not found, attempts to decode tenant from token (if present, no signature).
    - Returns `""` if tenant cannot be determined (mainly for admin endpoints).
  - In production:
    - Requires Bearer token and extracts tenant from JWT claims.

- `verify_tenant_access`
  - In dev:
    - Always returns `True` (with safety check that `ENVIRONMENT` is not production).
  - In production:
    - Ensures tenant in JWT (`tenant_id_jwt`) matches path `tenant_id_path`.
    - Supports special mock tokens (`mock_jwt.user.tenant.role`) for testing.

Business rules:

- Dev mode is intentionally permissive to speed up local testing, but blocked in production by:
  - `Settings.validate_auth_bypass`
  - Startup checks in `main.py`.

### 1.3 Frontend config & base URLs

- `frontend/services/authService.ts`
  - Manages:
    - API base URL (e.g., `http://localhost:8000`).
    - Stored JWT tokens for admin/staff users.
    - Helper for injecting `Authorization` header.
- `frontend/services/tenantService.ts`
  - Stores `API_BASE_URL` by reading from `authService.getApiBaseUrl()` or defaulting to `http://localhost:8000`.
  - Exposes `setTenantApiBaseUrl(url)` to change base URL at runtime.
- `frontend/src/config/topic-agent-mapping.ts`
  - Encodes mapping between:
    - Business topics: `GUIDELINE`, `SHIPMENT`, `DEBT`.
    - Agent names used by backend agents.
  - Business behavior:
    - `getAgentNameFromMessage(message)` inspects keywords and returns agent names to route messages directly to a specific agent (instead of the supervisor).

---

## 2. Core Business Logic – Backend

### 2.1 LLM orchestration (`backend/src/services/llm_manager.py`)

Responsibilities:

- Resolve tenant‑specific LLM settings:
  - Uses `TenantLLMConfig` to find default model for a tenant.
  - Uses `LLMModel` to load provider, base URL, model name.
- Decrypt sensitive credentials:
  - Calls `decrypt_api_key` (from `utils.encryption`) on stored API keys.
- Instantiate provider clients:
  - OpenRouter via `ChatOpenAI` with `OPENROUTER_BASE_URL`.
  - Direct OpenAI, Anthropic, Google Generative AI, etc.
- Cache LLM clients by `(tenant_id, model_id)` to avoid re‑instantiation.
- Rate limiting:
  - Uses `RateLimiter` with Redis (if configured) to throttle calls per tenant and model.
- Token estimation:
  - Uses `estimate_tokens` to log/estimate token usage pre‑call or post‑call.

Business rules:

- If no `TenantLLMConfig` or LLM model exists, a `ValueError` is raised (handled by higher layers as an error response).
- Only active models (`is_active=True`) are allowed.

### 2.2 Supervisor agent (`backend/src/services/supervisor_agent.py`)

Responsibilities:

- Entry point for complex routing logic in chat flow.
- Given a tenant and session, determines which domain agent(s) and tools to use:
  - Reads a supervisor configuration (`AgentConfig`) dedicated to supervision.
  - Uses LLM to perform:
    - Intent classification.
    - Tool/agent selection.
    - High‑level orchestration of multiple steps.
- Interacts with:
  - `conversation_memory` for multi‑turn persistence.
  - `rag_service` and `tool_loader` as needed.

Business rules:

- The supervisor:
  - Ensures that tenant‑specific agent and tool permissions are respected.
  - Can perform fallback behavior when tools fail or produce errors (e.g., return a helpful explanation instead of raw error).
- It returns a structured `agent_response` dict with:
  - `data` (primary payload).
  - `metadata` (model, tool calls, entities, tenant_id, agent_id).
  - `status`, `renderer_hint` for UI rendering decisions.

### 2.3 Domain agents (`backend/src/services/domain_agents.py`)

Responsibilities:

- Provide focused, domain‑specific behavior (e.g., guideline, shipment, debt).
- For a given `AgentConfig`:
  - Load the correct LLM client via `llm_manager`.
  - Load tools via `tool_registry.load_agent_tools`.
  - Build prompts that:
    - Include system prompt from `AgentConfig.prompt_template`.
    - Use tool metadata to construct entity extraction or tool invocation instructions.
- After LLM execution:
  - Normalize responses into a structured format via `format_agent_response` / `format_error_response`.

Business rules:

- Tools define required entities via JSON Schema (`input_schema`).
- `DomainAgent` builds prompts that explicitly ask the LLM to extract these entities from user input.
- If no specific entities are defined by tools, it falls back to a generic entity set (e.g., tax code, amount, shipment_id).

### 2.4 RAG and document processing

- `document_processor.py`
  - Handles ingestion of raw files (PDF, DOCX, etc.).
  - Splits documents into chunks with overlap.
  - Normalizes text (removing headers/footers, etc.).
- `embedding_service.py`
  - Generates embeddings for document chunks using a chosen embedding model/provider.
- `rag_service.py`
  - Stores and retrieves vectorized documents.
  - Combines retrieved context with user queries and agent prompts.

Business rules:

- RAG is tenant‑aware: documents are scoped by tenant.
- Retrieval parameters (e.g., top‑k, similarity thresholds) are configurable to balance recall vs. precision.

### 2.5 Escalation service (`backend/src/services/escalation_service.py`)

Responsibilities:

- Encapsulate escalation logic used by:
  - `api/supporter.py`
  - Admin/session views.
- Manages:
  - Escalation status transitions (`none` → `pending` → `assigned` → `resolved`).
  - Assignment of supporters (`User` with supporter roles).
  - Load balancing based on `max_concurrent_sessions` and `current_sessions_count`.

Business rules:

- Only eligible supporters (status `online` and below `max_concurrent_sessions`) can be assigned.
- Escalation metadata (reason, timestamps) is stored in `ChatSession`.
- Business logic ensures that once a session is assigned, other supporters see it as assigned to avoid conflicts.

---

## 3. Core Business Logic – Frontend

### 3.1 Auth service (`frontend/services/authService.ts`)

Responsibilities:

- Store and retrieve:
  - API base URL.
  - JWT access tokens and refresh tokens (if implemented).
- Provide helpers:
  - `getApiBaseUrl()`, `setApiBaseUrl(url)`.
  - `getAuthHeaders()` to attach `Authorization: Bearer <token>` for admin/staff calls.
- Manage logout:
  - Clear tokens and possibly redirect to login screen.

Business rules:

- Admin features in `AdminDashboard` require valid JWT; unauthenticated users should be limited to demo chat.

### 3.2 Chat service (`frontend/services/chatService.ts`)

Responsibilities:

- Provide `sendMessage` used by `ChatWidget`:
  - Wraps the POST call to `/api/{tenant_id}/chat`.
  - Marshals request shape and parses `ChatResponse`.

Business rules:

- Determines when to send `agent_name`:
  - Can consult `getAgentNameFromMessage` (topic mapping) to route directly to a domain agent when desired.

### 3.3 Topic/agent mapping (`frontend/src/config/topic-agent-mapping.ts`)

Responsibilities:

- Define:
  - `AGENT_NAMES` – canonical names for agents.
  - `Topic` enum (`GUIDELINE`, `SHIPMENT`, `DEBT`).
  - `TOPIC_KEYWORDS` – keywords per agent.
- Implement:
  - `detectTopic(message)` – pick a topic based on keywords.
  - `getAgentNameFromMessage(message)` – convert message → topic → agent name.

Business rules:

- If no keywords match:
  - Default to `GUIDELINE` agent to answer general policy questions.
- UI uses:
  - `AGENT_DESCRIPTIONS` and `AGENT_ICONS` to present agent choices.

### 3.4 Escalation service (`frontend/services/escalationService.ts`)

Responsibilities:

- Helpers to:
  - Inspect recent conversation history and decide if escalation should be suggested or triggered.
  - Call backend escalation endpoints.
- Provide status mapping for UI (e.g., color/label per escalation status).

Business rules:

- Escalation may be triggered:
  - Explicitly by the user.
  - Automatically by rules (e.g., repeated failure, certain keywords).
- Once escalated, the widget UI reflects:
  - Whether a supporter has been assigned.
  - Whether the issue is resolved.

---

## 4. Environment Profiles & Recommended Settings

### 4.1 Local development

- Backend:
  - `ENVIRONMENT=development`
  - `DISABLE_AUTH=true` (optional, for easier testing).
  - `DATABASE_URL` pointing to a local or shared dev DB.
  - `REDIS_URL` set if you want rate limiting.
- Frontend:
  - `API_BASE_URL=http://localhost:8000` in `authService` or via a small init script.

### 4.2 Staging/production

- Backend:
  - `ENVIRONMENT=production`
  - `DISABLE_AUTH=false`
  - `JWT_PUBLIC_KEY` set to the correct public key.
  - `DATABASE_URL` pointing to managed PostgreSQL.
  - `FERNET_KEY` set and stored securely (for LLM API key encryption).
  - `REDIS_URL` configured for reliable rate limiting.
- Frontend:
  - `API_BASE_URL` set to the public backend URL.
  - Admin users authenticate via login before accessing `/api/admin/...`.

These profiles help keep development simple while enforcing stricter security and robustness in higher environments.

---

