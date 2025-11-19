# Auth Flows (DISABLE_AUTH = False)

This document describes how authentication and authorization behave for chat users, supporters, and admins when `settings.DISABLE_AUTH == False` (normal auth enabled).

## Shared Behavior

- All protected endpoints expect `Authorization: Bearer <JWT>`.
- `HTTPBearer` extracts the token; missing token results in `401 Bearer token required`.
- `decode_jwt` is used to decode and validate the token.
- `get_current_user` returns the decoded JWT payload (e.g. `{"sub": user_id, "tenant_id": ..., "roles": [...]}`).
- `get_current_tenant` extracts `tenant_id` from the JWT via `extract_tenant_id`.
- If `DISABLE_AUTH` is False and there is any mismatch or missing data, dependencies raise `HTTPException` (401/403).

## Chat User Flow

Endpoint: `POST /api/{tenant_id}/chat`  
Files: `backend/src/api/chat.py`, `backend/src/middleware/auth.py`

1. Client calls `/api/{tenant_id}/chat` with a Bearer token.
2. `get_current_tenant` runs:
   - Requires token; if missing → 401.
   - Decodes token and extracts `tenant_id` from JWT.
3. In `chat_endpoint`:
   - The `Tenant` with path `tenant_id` is loaded; if not found → 404.
   - Tenant access check:
     - If `current_tenant` (from JWT) != path `tenant_id` → 403 `"Access denied to this tenant"`.
   - If the check passes, chat logic runs (session creation, message saving, agent responses).

Notes:

- The chat user ID is taken from `request.user_id` in the body; there is no strict check that `request.user_id == JWT["sub"]` in the current implementation.

## Supporter Flow

Endpoints:  
- `GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions`  
- `POST /api/tenants/{tenant_id}/supporter-chat`  
Files: `backend/src/api/supporter.py`, `backend/src/middleware/auth.py`

### Common Steps

- Both endpoints depend on:
  - `current_user: dict = Depends(get_current_user)`
  - `current_tenant: Optional[str] = Depends(get_current_tenant)`
- With `DISABLE_AUTH == False`:
  - A valid Bearer token is required.
  - `get_current_user` provides the JWT payload (`sub`, `roles`, etc.).
  - `get_current_tenant` provides `tenant_id` from the JWT.

### `GET /tenants/{tenant_id}/supporters/{supporter_id}/sessions`

1. Extract `current_user_id = current_user["sub"]`; if missing → 401.
2. Validate `current_user_id` is a UUID; if invalid → 401.
3. Ensure the `Tenant` with `tenant_id` exists; if not → 404.
4. Tenant access check:
   - If `current_tenant != str(tenant_id)` → 403 `"Access denied to this tenant"`.
5. Ensure `supporter_id` refers to a `User` in that tenant with `role == "supporter"`; if not → 404 `"Supporter not found"`.
6. Query and return chat sessions assigned to `supporter_id` (with escalation status not `"none"`).

Intended authorization semantics:

- Supporters should only see their own sessions.
- Admins should be able to see any supporter’s sessions.
- To fully enforce this, additional checks are typically needed, for example:
  - If `"admin" in current_user["roles"]`: allow any `supporter_id`.
  - Else require `current_user_uuid == supporter_id`; otherwise → 403.

### `POST /tenants/{tenant_id}/supporter-chat`

1. Extract `current_user_id = current_user["sub"]`; if missing → 401.
2. Validate `current_user_id` is a UUID (`current_user_uuid`); if invalid → 401.
3. Ensure `Tenant` exists for `tenant_id`; if not → 404.
4. Tenant access check:
   - If `current_tenant != str(tenant_id)` → 403.
5. Load `ChatSession` by `request.session_id` and `tenant_id`; if not found → 400 `"Session not found"`.
6. Require `session.escalation_status == "assigned"`; otherwise → 400.
7. Require `session.assigned_user_id == current_user_uuid`; otherwise → 400 `"Session is not assigned to you"`.
8. Ensure there is a `User` record with `user_id == current_user_uuid`, `tenant_id`, and `role == "supporter"`; otherwise → 403.
9. Validate `request.message` is non-empty; if empty → 400.
10. Create a `Message`:
    - `role = "supporter"`
    - `sender_user_id = current_user_uuid`
11. Update `session.last_message_at` and commit.

## Admin Flow

Files: `backend/src/middleware/auth.py`, `backend/src/api/supporter.py`, `backend/src/api/admin/...`

### Admin Role Dependency

Dependency: `require_admin_role(request, credentials)`  
File: `backend/src/middleware/auth.py`

- For non-`OPTIONS` requests when `DISABLE_AUTH == False`:
  - Requires Bearer token; if none → 401.
  - If token is of the form `mock_jwt.{user_id}.{tenant_id}.{role}`:
    - If `role == "admin"` → allowed as mock admin.
    - Else → 403.
  - Otherwise uses `decode_jwt(token)` and expects `"admin"` in `payload["roles"]`.
  - If `"admin"` not present → 403.
  - On success, returns the payload with user and tenant info.

### `POST /api/admin/tenants/{tenant_id}/sessions/{session_id}/messages`

Endpoint: `admin_send_message` in `backend/src/api/supporter.py`

1. Depends on `get_current_user` and `get_current_tenant`:
   - Token required and decoded (as above).
2. Extract `current_user_id = current_user["sub"]`; convert to UUID.
3. Tenant access check:
   - If `current_tenant != str(tenant_id)` → 403.
4. Load `ChatSession` by `session_id` and `tenant_id`; if not found → 404.
5. Validate non-empty `request.message`; if empty → 400.
6. Create a `Message`:
   - `role = "supporter"`
   - `sender_user_id = current_user_uuid`
7. Update `session.last_message_at`, commit, and return details.

Notes:

- This endpoint does not currently enforce admin role explicitly; to make it admin-only, you can:
  - Add `current_admin = Depends(require_admin_role)` to the endpoint, or
  - Check `"admin" in current_user.get("roles", [])` before processing.

