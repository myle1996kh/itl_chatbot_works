# Frontend Flow – Multi‑Tenant Chatbot

This document describes the main UI and data flows in the frontend (`frontend`), and how they map to backend APIs and configuration.

---

## 1. High‑Level Views

- **Demo view (`view="demo"`)**
  - Default in `App.tsx`.
  - For end‑users to chat with the bot using the embedded `ChatWidget`.

- **Admin view (`view="admin"`)**
  - Switched via UI controls in `App.tsx`.
  - Renders `AdminDashboard` to manage tenants, agents, tools, and sessions (via admin APIs).

---

## 2. Tenant Discovery & Selection

1. On mount, `App.tsx` calls `getTenants()` from `services/tenantService.ts`.
2. `tenantService`:
   - Uses `API_BASE_URL` (defaults to `http://localhost:8000` or stored via `authService`).
   - Calls `GET /api/auth/tenants`.
   - Caches results in `localStorage` (`tenants_cache`) for 5 minutes.
3. The first tenant from the list becomes `selectedTenant` (unless user chooses another).
4. For each tenant, `App.tsx` tracks:
   - `availableTenants`
   - `selectedTenant`
   - A per‑tenant active user/session cache key (`activeUser_<tenant_id>`).

Business rule:
- If no tenants are returned, frontend shows an error and stops.

---

## 3. User Identification & Session Bootstrap

### 3.1 Capturing user info

1. If no active user is cached for the `selectedTenant`, `App.tsx` renders `UserInfoForm`.
2. User provides:
   - `username`
   - `email`
   - `department` (optional).
3. On submit:
   - `UserInfoForm` calls helpers from `services/chatUserService.ts`:
     - Create or lookup `ChatUser` for the tenant.
     - Create initial `ChatSession`.
   - Backend:
     - `ChatUser` table: ensures unique (`tenant_id`, `email`).
     - `Session` table: creates session linked to `ChatUser`.
4. On success:
   - `App.tsx` stores:
     - `userInfo` (username, email, department).
     - `userId` (chat user UUID).
     - `sessionId` (initial session UUID).
     - `initialTopicId` (from `constants.ts` fallback tenant topics).
   - It also saves these in `sessionStorage` under `activeUser_<tenant_id>`.

### 3.2 Restoring user/session from cache

Whenever `selectedTenant` changes or app reloads:

1. `App.tsx` reads `activeUser_<tenant_id>` from `sessionStorage`.
2. If found, it restores:
   - `userInfo`, `userId`, `sessionId`.
   - Sets `initialTopicId` to the default topic from `constants.ts`.
3. The chat widget will then start from the last known session for that user and tenant.

---

## 4. Chat Flow in `ChatWidget`

Props passed from `App.tsx`:
- `tenant`
- `userInfo`
- `initialTopicId`
- `userId`
- `sessionId` (current session)
- `onClose`, `onEndSession`

### 4.1 Initial load and history

1. `ChatWidget` computes:
   - `getHistoryKey() => "chatHistory_<tenant.id>_<user.email>"`
   - `getActiveSessionKey() => "activeSession_<tenant.id>_<user.email>"`
2. On mount:
   - Tries to read chat history from `localStorage[historyKey]`.
   - If history exists: loads messages.
   - Else:
     - Uses `tenant.theme.welcomeMessage` to show a first bot message.
   - Attempts to restore sessionId from `localStorage[activeSessionKey]`.

Business rules:
- Chat history and active session are isolated by tenant and user email.
- If `initialSessionId` prop changes:
  - `ChatWidget` resets `messages`, clears history and active session keys, and starts fresh.

### 4.2 Sending a message

When user submits text (and optional file):

1. `ChatWidget`:
   - Appends a new `Message` to local `messages` with `sender="user"`.
   - Sets `isTyping=true`.
2. Builds payload for `sendMessage` (`services/chatService.ts`), including:
   - `tenant_id` (from `tenant.id`).
   - `user_id` (ChatUser UUID).
   - `session_id` (current session).
   - `message` (user text).
   - Optional `agent_name` (from `getAgentNameFromMessage`) for direct routing.
   - Optional metadata (file info, etc.).
3. `chatService` sends `POST` to:
   - `/api/{tenant_id}/chat`.
4. Backend processes message (see backend flow docs) and returns `ChatResponse`.
5. On success:
   - `ChatWidget` appends assistant message to `messages`.
   - Saves updated history to `localStorage[historyKey]`.
   - Resets `isTyping=false`.

Error handling:
- On failure, shows an error message in the chat and logs to console.

### 4.3 Polling for new messages

To receive supporter messages or other updates:

1. `ChatWidget` starts a polling interval (e.g., setInterval every few seconds).
2. Each tick:
   - Calls `GET http://localhost:8000/api/{tenant.id}/session/{sessionId}`.
   - Parses `data.messages` and maps them to frontend `Message` objects.
   - Replaces local `messages` with the latest from backend to avoid stale state.
3. Updates `localStorage[historyKey]` with the latest array.

Business rule:
- Polling ensures supporter/admin‑side messages and state changes are visible to the end user.

### 4.4 Session end and restart

1. When user clicks “End Session” in the widget:
   - `onEndSession` is called (provided by `App.tsx`).
2. `App.tsx`:
   - Uses `chatUserService.endSession` to mark the backend session as ended.
   - Immediately calls `createSession` again for the same `userId` to start a fresh session.
   - Updates internal `sessionId` state and stored `activeUser_<tenant_id>` session.
3. `ChatWidget` sees `initialSessionId` change and resets chat history for the new session.

---

## 5. Escalation Flow (Frontend)

1. `ChatWidget` and other components may call helpers from `services/escalationService.ts`:
   - `detectAutoEscalation(messages)` – heuristics to decide when to escalate.
   - `escalateSession(tenantId, sessionId, reason)` – sends escalation request.
2. Typical escalation API:
   - `POST /api/{tenant_id}/sessions/{session_id}/escalate`
   - Body: `{ reason }`.
3. UI state in `ChatWidget`:
   - `isEscalated: boolean`
   - `escalationStatus: 'none' | 'pending' | 'assigned' | 'resolved'`
   - `showEscalationDialog: boolean`, `escalationReason: string`
4. When escalation is pending or assigned:
   - Polling via `GET /api/{tenant_id}/session/{session_id}` will surface supporter messages and status updates.

---

## 6. Admin Flows (High‑Level)

Admin workflows are implemented in:
- `components/AdminDashboard.tsx`
- `services/adminService.ts`, `services/knowledgeService.ts`, `services/ragService.ts`, etc.

Typical flows:

1. **Authentication**
   - Admin logs in via `authService` (`/api/auth/login`), receiving JWT.
   - JWT stored (e.g., in `localStorage`) and attached to admin API calls.

2. **Tenant management**
   - List tenants (`GET /api/admin/tenants`).
   - Create/update tenant (forms in dashboard calling `adminService` helpers).

3. **Agent & tool configuration**
   - List agents/tools per tenant.
   - Enable/disable agents and tools using admin APIs.
   - Configure tools (endpoints, schemas) and bind them to agents.

4. **Knowledge & RAG**
   - Upload documents (`knowledgeService` → `/api/admin/knowledge/...`).
   - Manage document metadata, re‑indexing, and RAG settings.

5. **Escalation management**
   - Supporters/admins view escalated sessions.
   - Assign themselves sessions, send messages, resolve escalations.

All admin flows are driven by backend admin APIs summarized in `guideline_docs/backend_API.md`.

---

