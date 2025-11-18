# Frontend README – Multi‑Tenant Chatbot

This document is focused on the frontend (`frontend` folder).

---

## 1. Tech Stack

- **Build tool**: Vite
- **Framework**: React + TypeScript
- **Styling**: Tailwind/utility‑style classes (in JSX), plus custom CSS where needed.
- **Markdown Rendering**: `react-markdown` + `remark-gfm`

---

## 2. Project Layout (Frontend)

Under `frontend`:

- `App.tsx`
  - Root component: orchestrates views and high‑level state.
  - Manages tenants, user info, selected view (`demo` vs `admin`), chat widget open/close.

- `components/`
  - `ChatWidget.tsx` – main chat UI widget for end‑users.
  - `UserInfoForm.tsx` – collect user name/email/department and create sessions.
  - `AdminDashboard.tsx` – admin UI for managing agents, tools, and sessions (based on backend admin APIs).
  - `icons.tsx` – reusable SVG icons used throughout the UI.

- `pages/`
  - Additional page‑level components (e.g., admin views, landing page) depending on your setup.

- `services/`
  - `tenantService.ts` – fetches tenants and tenant details from backend.
  - `chatService.ts` – sends chat messages to backend chat API.
  - `chatUserService.ts` – create chat users and sessions.
  - `escalationService.ts` – manage escalation requests and statuses.
  - `authService.ts` – stores API base URL, tokens, and auth helpers.

- `src/`
  - Additional frontend configuration and helpers (e.g., `config/topic-agent-mapping`).

- Root files:
  - `index.html`, `index.tsx` – Vite entry.
  - `constants.ts` – default tenant config (fallback) for styling and demo.
  - `types.ts` – shared TS interfaces (Tenant, Message, UserInfo, etc.).
  - `vite.config.ts` – Vite configuration.

---

## 3. Backend Integration

- Default backend base URL in `tenantService.ts`:

```ts
let API_BASE_URL = getApiBaseUrl() || 'http://localhost:8000';
```

- ChatWidget polling uses hardcoded URL:

```ts
`http://localhost:8000/api/${tenant.id}/session/${sessionId}`
```

If your backend runs elsewhere, adjust:

- `API_BASE_URL` via `authService.setApiBaseUrl(url)` or
- Update hardcoded URLs in components/services to match.

---

## 4. Running the Frontend

From the project root:

```powershell
cd frontend
npm install
npm run dev
```

Vite will print a local dev URL (e.g., `http://localhost:5173`).  
Open it in your browser; the app will call the backend at `http://localhost:8000` by default.

---

## 5. Frontend Flow Summary

High‑level end‑user chat flow (demo view):

1. **Tenant loading**
   - On mount, `App.tsx` calls `getTenants()` from `tenantService.ts`.
   - If no tenants exist, it shows an error; otherwise, the first tenant becomes selected.

2. **User info capture**
   - `UserInfoForm` collects `username`, `email`, `department`.
   - On submit, frontend calls chat user + session APIs via `chatUserService`.
   - The response provides `user_id` and `session_id`.
   - These values are cached in `sessionStorage` keyed by tenant (`activeUser_<tenant_id>`).

3. **Chat widget**
   - `ChatWidget` is opened with:
     - `tenant`, `userInfo`, `initialTopicId`, `userId`, `sessionId`.
   - On first load:
     - Restores chat history from `localStorage` (per tenant and user).
     - If no history, shows a welcome message based on tenant theme.

4. **Sending messages**
   - When user sends a message:
     - Frontend calls `sendMessage` from `chatService.ts`.
     - Sends `tenant_id`, `session_id`, `user_id`, and `message` to `POST /api/{tenant_id}/chat`.
     - Shows a “typing” indicator while waiting.
   - Response:
     - ChatWidget appends the assistant message to local state and saves to `localStorage`.

5. **Polling for updates**
   - ChatWidget periodically polls:
     - `GET /api/{tenant_id}/session/{session_id}`
   - Fetches latest `messages` (including supporter messages) and replaces local history.

6. **Session end & restart**
   - `onEndSession`:
     - Calls `endSession` via `chatUserService`.
     - Immediately creates a new session for same user and updates stored session id.
     - Clears client‑side history when session changes.

7. **Escalation to supporter**
   - `escalationService` utilities:
     - `detectAutoEscalation` inspects chat content for escalation triggers.
     - `escalateSession` calls backend to mark session as escalated and notify supporters.
   - UI reflects escalation status (`none`, `pending`, `assigned`, `resolved`).

---

## 6. Admin View (High Level)

In `view='admin'`, `App.tsx` renders `AdminDashboard`:

- Uses `tenantService`, admin endpoints (`/api/admin/...`) to:
  - List tenants, agents, tools, sessions.
  - Manage permissions and escalation queues.

Details of admin flows are defined inside `AdminDashboard` and its sub‑components, which map directly onto backend admin APIs documented in `guideline_docs/backend_API.md`.

---

