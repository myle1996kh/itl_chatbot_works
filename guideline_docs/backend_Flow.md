# Backend Flow – Multi‑Tenant Chatbot

This document summarizes the main backend flows observed in `backend/src`, focusing on how requests move through the system.

---

## 1. Request Lifecycle (FastAPI)

1. **Incoming HTTP request**
   - Enters `FastAPI` app defined in `src/main.py`.

2. **CORS / Preflight**
   - `handle_cors_preflight` middleware intercepts `OPTIONS` requests and returns a simple 200 with CORS headers.
   - Other methods pass through to CORS middleware and routing.

3. **Authentication / Tenant Context**
   - `src.middleware.auth` dependencies (e.g., `get_current_tenant`) run for protected endpoints.
   - Behavior can change based on `settings.DISABLE_AUTH` (development vs. production).

4. **Routing**
   - Routers from `src/api` and `src/api/admin` handle business logic.
   - Dependency `get_db` (from `config.py`) injects a SQLAlchemy session per request.

5. **Database & Services**
   - Handlers use models from `src.models` and services from `src.services` to read/write data and call LLMs/tools.

6. **Response**
   - Pydantic schemas in `src/schemas` define responses.
   - Exceptions are turned into HTTP responses; security‑related ones use `SecurityError` handler in `main.py`.

---

## 2. Chat Flow (User → LLM/Tools → Response)

**Entry point:** `POST /api/{tenant_id}/chat` (`src/api/chat.py`)

1. **Tenant validation**
   - Load `Tenant` by `tenant_id`.
   - Ensure `current_tenant` (from auth) matches when auth is enabled; otherwise, reject with 403.

2. **Session resolution**
   - `_get_or_create_session` is called with:
     - `tenant_id`
     - `request.session_id` (optional)
     - `request.user_id` (chat user UUID)
   - If `session_id` is provided and valid, it is reused.
   - Otherwise, a new `ChatSession` is created and linked to:
     - `Tenant`
     - `ChatUser`

3. **Persist user message**
   - Create `Message`:
     - `role="user"`
     - `content=request.message`
     - `metadata=request.metadata` (if any)
   - Commit to DB for full audit trail.

4. **Determine routing strategy**
   - Extract optional `jwt_token` from `request.metadata`.
   - If `request.agent_name` is provided:
     - Route directly to that `AgentConfig` via `_route_to_agent`.
   - Else:
     - Instantiate `SupervisorAgent` with:
       - DB session
       - `tenant_id`
       - `jwt_token`
       - `session_id` (for conversation memory)
     - Call `supervisor.route_message(request.message)`.

5. **Supervisor / Agent execution**
   - `SupervisorAgent`:
     - Performs intent detection.
     - Selects appropriate `AgentConfig` and/or tools.
   - `DomainAgent` (and other agent classes):
     - Call `llm_manager` to interact with underlying LLM models.
     - Optionally call tools via `BaseTool`/`ToolConfig` definitions.
   - `llm_manager`:
     - Handles model selection, rate limiting (via Redis), and provider‑specific logic.

6. **Persist assistant response**
   - Response from agent is a structured `agent_response` dict with:
     - `data` (LLM content)
     - `metadata` (model, tool calls, entities, agent_id, tenant_id)
   - `_extract_display_text` converts `agent_response["data"]` into user‑visible text.
   - Create `Message` with:
     - `role="assistant"`
     - `content` = display text
     - `message_metadata` = structured fields from `agent_response`.
   - Commit to DB.

7. **Return API response**
   - Build `ChatResponse` (schema from `src/schemas/chat.py`) combining:
     - Assistant text
     - Session and agent metadata
     - Possible renderer hints or structured payloads for the frontend.

---

## 3. Chat User & Session Management Flow

**Chat User creation:**

1. Frontend calls chat‑user endpoint (via `chatUserService` in `frontend/services`):
   - Sends `tenant_id`, `email`, `username`, optional `department`.

2. Backend (`src/api/chat_users.py`):
   - Checks if a `ChatUser` with the same (`tenant_id`, `email`) exists.
   - Creates a new `ChatUser` if not, or returns existing.
   - Returns `user_id` to frontend.

**Session lifecycle:**

1. Frontend calls `createSession(tenant_id, user_id)`:
   - POST `/api/{tenant_id}/session`.

2. Backend (`src/api/sessions.py`):
   - Creates `ChatSession` with:
     - `tenant_id`
     - `user_id`
     - Optional initial metadata.
   - Returns `session_id`.

3. Frontend stores:
   - `user_id`
   - `session_id`
   - in `sessionStorage`/`localStorage` for continuity across page loads.

4. When the user ends a session:
   - Frontend calls `endSession(tenant_id, session_id)`.
   - Backend updates session state or marks it as ended.
   - Frontend may immediately create a new session for the same user.

5. For message history:
   - `GET /api/{tenant_id}/session/{session_id}` returns:
     - Session with `messages[]`.
   - Used by frontend for polling and restoring chats.

---

## 4. Escalation Flow (Bot → Human Supporter)

1. **Detection**
   - Frontend analyses messages (via `detectAutoEscalation` helper) or through explicit user action to request a human.

2. **Escalation request**
   - Frontend calls an escalation endpoint (via `escalateSession` in `frontend/services/escalationService`), typically:
     - `POST /api/{tenant_id}/sessions/{session_id}/escalate`
     - Body includes `reason`.

3. **Backend handling (`src/api/supporter.py`)**
   - Updates `ChatSession`:
     - `escalation_status='pending'`
     - `escalation_reason`
     - `escalation_requested_at`
   - Optionally notifies supporters (polling or push mechanisms).

4. **Assignment**
   - Supporters (staff `User` with role `supporter`) poll their queue or an admin UI:
     - Admin/supporter endpoints in `supporter.py` / `admin/escalation.py` allocate a `User` as `assigned_user_id`.
   - Session `escalation_status` becomes `assigned`.

5. **Human messages**
   - Supporters send messages using supporter endpoints.
   - Messages are persisted in `Message` table with:
     - `role='supporter'` or similar.

6. **Resolution**
   - Once complete, escalation endpoints mark:
     - `escalation_status='resolved'`
     - `escalation_assigned_at`, and possibly close the session.

---

## 5. Tenant, Agent, and Tool Management Flow (Admin)

1. **Tenant provisioning**
   - Admin calls `/api/admin/tenants` to create a new `Tenant`.
   - Optionally configures:
     - `TenantLLMConfig`
     - `TenantWidgetConfig`
     - `TenantAgentPermission` and `TenantToolPermission`

2. **Agent lifecycle**
   - Admin defines `AgentConfig` (name, prompt, model, default output format).
   - Links tools via `AgentTools` with priorities.
   - Enables agents per tenant via `TenantAgentPermission`.

3. **Tool lifecycle**
   - Admin defines `BaseTool` (generic capabilities).
   - Creates `ToolConfig` with concrete config (API endpoint, schema).
   - Enables tools per tenant via `TenantToolPermission`.

4. **Knowledge management**
   - Admin uploads RAG documents through `/api/admin/knowledge` endpoints.
   - Backend processes documents (chunk, index) for retrieval during agent runs.

---

## 6. Observability & Error Handling

- **Logging**
  - Configured via `src.utils.logging.configure_logging`.
  - Structured logging used in chat flow (`chat.py`) and startup events (`main.py`).

- **Security errors**
  - Custom `SecurityError` in `src.utils.exceptions`.
  - Handled by `@app.exception_handler(SecurityError)` in `main.py`:
    - Generates an `incident_id`
    - Logs critical event
    - Returns generic 500 with `incident_id` (no sensitive details).

- **Rate limiting**
  - `llm_manager.set_rate_limiter(redis_client)` invoked on startup if `REDIS_URL` is set.
  - Failures to initialize Redis are logged but do not block startup.

---

