# Backend API Overview – Multi‑Tenant Chatbot

This document summarizes the main FastAPI endpoints exposed by `backend/src/api`. It is inferred from code; always refer to `backend/src` for exact request/response models.

Base URL (default development): `http://localhost:8000`

All paths below are relative to this base URL.

---

## 1. Public & Auth Endpoints (`src/api/auth.py`)

> Router prefix: typically `/api/auth`

- `GET /api/auth/tenants`
  - Description: List all active tenants (public, no auth).
  - Response: `{ total: number, tenants: Tenant[] }`
  - Used by: `frontend/services/tenantService.ts#getTenants`.

- `POST /api/auth/login`
  - Description: Login staff/admin user (tenant‑scoped).
  - Body: credentials (email/password, tenant domain or id).
  - Response: JWT access token and user info.

- `POST /api/auth/refresh`
  - Description: Refresh JWT token.

- `GET /api/auth/me`
  - Description: Get current authenticated user profile.
  - Auth: `Authorization: Bearer <token>`.

_Note: exact paths and models come from `auth.py`; this is a high‑level map._

---

## 2. Chat Endpoints (`src/api/chat.py`)

> Router prefix: `/api`

- `POST /api/{tenant_id}/chat`
  - Description: Main chat endpoint. Handles multi‑turn chat for a tenant.
  - Path params:
    - `tenant_id` – Tenant UUID.
  - Body (`ChatRequest`):
    - `message: string` – user message.
    - `session_id?: string` – existing session UUID, optional.
    - `user_id: string` – chat user UUID (from chat user create/session APIs).
    - `agent_name?: string` – if provided, routes directly to this agent.
    - `metadata?: object` – extra context (e.g., `jwt_token`).
  - Behavior:
    1. Validates tenant and tenant access (`get_current_tenant`, `DISABLE_AUTH`).
    2. Creates or fetches a `ChatSession`.
    3. Persists user `Message`.
    4. Routes message via `SupervisorAgent` or direct agent.
    5. Persists assistant `Message` with structured metadata.
  - Response (`ChatResponse`):
    - Contains assistant reply text plus structured metadata (agent, intent, tools, etc.).

---

## 3. Chat User & Session Endpoints

### 3.1 Chat Users (`src/api/chat_users.py`)

> Router prefix: `/api`

Typical endpoints (names inferred from code patterns):

- `POST /api/{tenant_id}/chat-users`
  - Description: Create or get a `ChatUser` for a tenant (by email/username).
  - Body: `{ email, username, department? }`
  - Response: Chat user profile with `user_id`.

- `GET /api/{tenant_id}/chat-users/{user_id}`
  - Description: Fetch chat user profile.

_Front‑end uses `chatUserService` to create sessions and chat users; refer to that file for exact paths._

### 3.2 Sessions (`src/api/sessions.py`)

> Router prefix: `/api`

- `POST /api/{tenant_id}/session`
  - Description: Create a new chat session for a given `ChatUser`.
  - Body: `{ user_id: string }`
  - Response: `session_id` and session info.

- `GET /api/{tenant_id}/session/{session_id}`
  - Description: Get session details including messages.
  - Response:
    - Session summary with `messages` array.
  - Used by: `frontend/components/ChatWidget.tsx` for polling.

- `POST /api/{tenant_id}/session/{session_id}/end`
  - Description: Mark session as ended/closed.

---

## 4. Supporter / Escalation Endpoints (`src/api/supporter.py`)

> Router prefix: `/api/supporter` or `/api`

Key capabilities:

- List online supporters for a tenant.
- Request escalation of a chat session from bot → human.
- Post messages from supporter into an existing session.
- Update escalation status (`pending` → `assigned` → `resolved`).

Endpoints (typical forms):

- `POST /api/{tenant_id}/sessions/{session_id}/escalate`
  - Description: Request escalation to a human supporter.
  - Body: `{ reason: string }`

- `GET /api/supporter/sessions`
  - Description: List sessions assigned/pending for the current supporter.

- `POST /api/supporter/sessions/{session_id}/message`
  - Description: Supporter sends a message into the session.

Refer directly to `supporter.py` for exact names and auth requirements.

---

## 5. Admin APIs (`src/api/admin`) – Tenants, Agents, Tools, Knowledge

> Router prefix: `/api/admin`
> Auth: Typically requires an authenticated admin user (JWT)

### 5.1 Tenants (`admin/tenants.py`)

- `GET /api/admin/tenants`
  - List tenants (with filters, pagination).

- `GET /api/admin/tenants/{tenant_id}`
  - Get single tenant details.

- `POST /api/admin/tenants`
  - Create a new tenant.

- `PUT /api/admin/tenants/{tenant_id}`
  - Update tenant (status, domain, configuration).

- `DELETE /api/admin/tenants/{tenant_id}`
  - Soft delete or deactivate tenant (depending on implementation).

Also includes:
- LLM config per tenant.
- Widget config per tenant.
- Permissions for which agents/tools are enabled.

### 5.2 Agents (`admin/agents.py`)

Manage `AgentConfig` and their tenant permissions:

- `GET /api/admin/agents`
- `GET /api/admin/agents/{agent_id}`
- `POST /api/admin/agents`
- `PUT /api/admin/agents/{agent_id}`
- `DELETE /api/admin/agents/{agent_id}`

Additional endpoints for:
- Enabling/disabling agent per tenant.
- Listing agents available for a given tenant.

### 5.3 Tools (`admin/tools.py`)

Manage `ToolConfig` and `BaseTool` definitions:

- CRUD for tools and base tools.
- Tenant‑level permissions (enable/disable).
- Update tool configuration (endpoint, method, headers, schemas).

### 5.4 Knowledge (`admin/knowledge.py`)

Manage knowledge base / RAG documents:

- Upload documents for a tenant.
- List, update, and delete documents.
- Trigger re‑indexing or chunking operations.

### 5.5 Escalation (`admin/escalation.py`)

Admin view into escalated sessions:

- List escalated sessions by status.
- Manually assign supporters.
- Override escalation outcomes.

### 5.6 Admin Sessions (`admin/sessions.py`)

Admin‑level access to sessions:

- Search/filter sessions by tenant, user, date, escalation status.
- View full session message history.

---

## 6. Health Check & Root (`src/main.py`)

- `GET /health`
  - Response:
    - `{ "status": "healthy", "environment": "...", "version": "0.1.0" }`

- `GET /`
  - Basic metadata about the service and link to `/docs`.

---

## 7. Authentication & Authorization Notes

- JWT handling is done in `src/middleware/auth.py` and used via dependencies in routers.
- `settings.DISABLE_AUTH` (from `config.py`) can allow bypassing auth in development.
- In production, startup checks in `main.py` prevent `DISABLE_AUTH=true` and require `JWT_PUBLIC_KEY`.

---

