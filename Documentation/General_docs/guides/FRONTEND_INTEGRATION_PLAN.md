# Frontend Integration Plan - MVP Roadmap

**Status**: Implementation Ready
**Version**: 1.0
**Target Duration**: 3 Weeks
**Date**: 2025-11-10

## Executive Summary

Integration of existing React frontend with ITL_chatbot backend using direct Topic→Agent routing, with user management and escalation support.

**Key Changes**:
- Add User/Supporter models to backend (1 day)
- Map frontend Topics directly to backend Agents (bypass SupervisorAgent)
- Implement staff login for admin dashboard
- Add manual + auto escalation detection
- Enable knowledge base uploads

**Key Files to Modify**:
- Backend: 5 new files + 4 model updates
- Frontend: 8 files to modify
- Database: 1 migration

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              TENANT ORGANIZATION                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐              ┌──────────────────┐   │
│  │  Chat Widget │              │ Admin Dashboard  │   │
│  │  (Customer)  │              │   (Staff/Admin)  │   │
│  └──────┬───────┘              └────────┬─────────┘   │
│         │                               │              │
│         │ 1. Select Topic               │ Login        │
│         │ 2. Send message + agent_id    │ (Staff)      │
│         │                               │              │
│         └───────────┬───────────────────┘              │
│                     │                                   │
│                     ↓                                   │
│    ┌────────────────────────────────────┐             │
│    │      Backend (FastAPI)             │             │
│    ├────────────────────────────────────┤             │
│    │                                    │             │
│    │ ┌──────────────────────────────┐  │             │
│    │ │  Chat Endpoint               │  │             │
│    │ │  - Accept agent_id           │  │             │
│    │ │  - Skip SupervisorAgent      │  │             │
│    │ │  - Direct → DomainAgent      │  │             │
│    │ │  - Auto-detect escalation    │  │             │
│    │ └──────────────────────────────┘  │             │
│    │                                    │             │
│    │ ┌──────────────────────────────┐  │             │
│    │ │  User Management             │  │             │
│    │ │  - Tenant users              │  │             │
│    │ │  - Staff/Supporters          │  │             │
│    │ │  - Role-based access         │  │             │
│    │ └──────────────────────────────┘  │             │
│    │                                    │             │
│    │ ┌──────────────────────────────┐  │             │
│    │ │  Escalation Service          │  │             │
│    │ │  - Keyword detection         │  │             │
│    │ │  - Session tracking          │  │             │
│    │ │  - Supporter assignment      │  │             │
│    │ └──────────────────────────────┘  │             │
│    │                                    │             │
│    └────────────────────────────────────┘             │
│                     ↑                                   │
│                     │                                   │
│         ┌───────────┴──────────────┐                   │
│         │                          │                   │
│   PostgreSQL + pgvector      Knowledge Base            │
│   (Sessions, Messages,          (RAG)                  │
│    Users, Supporters)                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Phase Breakdown

### Phase 0: Backend Foundations (2 days)

**Goal**: Create user management infrastructure

#### Tasks:

1. **Create Models** (0.5 day)
   - [ ] Create `src/models/user.py`
   - [ ] Create `src/models/supporter.py`
   - [ ] Update `src/models/session.py` with escalation fields
   - [ ] Update `src/models/message.py` with sender tracking

2. **Database Migration** (0.5 day)
   - [ ] Create migration: `alembic revision --autogenerate -m "Add user management"`
   - [ ] Run migration locally: `alembic upgrade head`
   - [ ] Seed initial users per tenant

3. **Authentication** (1 day)
   - [ ] Create `src/api/auth.py` with login endpoint
   - [ ] Implement JWT token generation
   - [ ] Create RBAC middleware
   - [ ] Add password hashing utility

#### Deliverables:
- [ ] 5 new API endpoints (login, create user, list users, etc.)
- [ ] JWT token generation and validation
- [ ] Middleware for role-based access
- [ ] Database migration complete

---

### Phase 1: Topic→Agent Direct Routing (2 days)

**Goal**: Skip SupervisorAgent, route directly to selected agents

#### Tasks:

1. **Backend Changes** (1 day)
   - [ ] Update `ChatRequest` schema to include `agent_id`
   - [ ] Modify chat endpoint in `src/api/chat.py`:
     ```python
     # Before: SupervisorAgent routes based on intent
     # After: Use agent_id directly
     if request.agent_id:
       agent = get_agent_by_id(request.agent_id)
     else:
       agent = supervisor.route(request.message)
     ```
   - [ ] Test backward compatibility (no agent_id provided)

2. **Frontend Changes** (1 day)
   - [ ] Create `config/topic-agent-mapping.ts`
   - [ ] Update `ChatWidget.tsx` to pass `agent_id`
   - [ ] Update `ragService.ts` → call backend instead of local Gemini
   - [ ] Test with real backend

3. **Config Management**
   - [ ] Create `.env.local` template
   - [ ] Add `API_ENDPOINTS` constants

#### Deliverables:
- [ ] ChatRequest accepts agent_id
- [ ] Chat endpoint uses agent_id when provided
- [ ] Frontend sends correct agent_id for each topic
- [ ] E2E test: Topic selection → Message sent → Response received

---

### Phase 2: Knowledge Base Upload & Enrichment (2 days)

**Goal**: Connect knowledge upload to backend RAG + enable chat message enrichment

#### Tasks:

1. **Backend** (1 day)
   - [ ] Verify endpoint: `POST /api/tenants/{tenant_id}/knowledge/upload-document` (file upload)
   - [ ] Create endpoint: `POST /api/tenants/{tenant_id}/knowledge/enrich-from-chat` (message enrichment)
   - [ ] Implement access control: Admin (all sessions) + Staff (assigned only)
   - [ ] Test both endpoints

2. **Frontend** (1 day)
   - [ ] Update `AdminDashboard.tsx` knowledge upload UI (file upload)
   - [ ] Add enrich button to `ChatWidget.tsx` (select messages → add to KB)
   - [ ] Add message selection UI (checkboxes/toggles)
   - [ ] Connect both endpoints with auth headers
   - [ ] Show success/error messages

#### Deliverables:
- [ ] File upload endpoint works (POSTable to backend)
- [ ] Documents stored in pgvector
- [ ] Chat message enrichment endpoint works (with access control)
- [ ] Admin can upload files + enrich from any session
- [ ] Staff can enrich from assigned sessions only
- [ ] Error handling if staff tries unassigned session (403 Forbidden)

---

### Phase 3: User Management & Login (2 days)

**Goal**: Enable staff/admin login for admin dashboard

#### Tasks:

1. **Backend** (1 day)
   - [ ] Seed initial users per tenant (admin + test staff)
   - [ ] Create admin endpoints for user CRUD
   - [ ] Test login endpoint
   - [ ] Implement token refresh (optional for MVP)

2. **Frontend** (1 day)
   - [ ] Create login page component
   - [ ] Add login form in AdminDashboard
   - [ ] Store JWT token in localStorage
   - [ ] Add role-based view switching (Admin ↔ Staff ↔ Customer)
   - [ ] Protect admin routes with auth middleware

#### Deliverables:
- [ ] Login page functional
- [ ] JWT token stored and validated
- [ ] Admin dashboard shows different views per role
- [ ] Logout functionality

---

### Phase 4: Escalation Feature (2 days)

**Goal**: Manual + auto escalation with supporter response

#### Tasks:

1. **Backend** (1.5 days)
   - [ ] Create `EscalationService` with keyword detection
   - [ ] Add escalation endpoints:
     - `POST /{tenant_id}/sessions/{session_id}/escalate`
     - `PUT /{tenant_id}/sessions/{session_id}/assign-supporter`
   - [ ] Modify chat endpoint to detect escalation keywords
   - [ ] Implement supporter message sending
   - [ ] Track supporter load (current sessions count)

2. **Frontend** (0.5 days)
   - [ ] Add "Talk to Human" button in ChatWidget
   - [ ] Show escalation suggestion banner
   - [ ] Add escalation queue view in AdminDashboard
   - [ ] Implement supporter message UI
   - [ ] Polling for assigned supporter (or use WebSocket later)

#### Deliverables:
- [ ] Manual escalation request works
- [ ] Auto-escalation detects keywords
- [ ] Admin sees escalation queue
- [ ] Admin can assign supporters
- [ ] Supporters can respond in chat
- [ ] Escalation status persists

---

### Phase 5: Integration Testing & Refinement (2 days)

**Goal**: E2E testing, bug fixes, optimization

#### Tasks:

1. **Testing** (1 day)
   - [ ] E2E test: Chat flow (topic select → message → response)
   - [ ] E2E test: Escalation (manual and auto)
   - [ ] E2E test: Knowledge upload and RAG retrieval
   - [ ] E2E test: Admin dashboard operations
   - [ ] Load test with 10+ concurrent users

2. **Documentation** (0.5 day)
   - [ ] Complete API documentation
   - [ ] Update deployment guide
   - [ ] Create runbook for ops

3. **Refinement** (0.5 day)
   - [ ] UX improvements
   - [ ] Error message clarity
   - [ ] Performance optimization

#### Deliverables:
- [ ] All E2E tests passing
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Ready for staging deployment

---

## Implementation Priority

### Must Have (MVP)
- [x] User/Supporter models
- [x] Staff login
- [x] Topic→Agent direct routing
- [x] Chat with backend
- [x] Knowledge upload
- [x] Manual escalation
- [x] Auto-escalation detection
- [x] Supporter response in chat

### Nice to Have (Phase 2+)
- [ ] Real-time chat (WebSocket)
- [ ] Automated escalation (AI decides when to escalate)
- [ ] User registration (currently admin-only)
- [ ] Supporter status updates (online/busy/away)
- [ ] Escalation metrics dashboard

### Won't Have (Out of Scope)
- [ ] Video chat with supporters
- [ ] Mobile app
- [ ] Multi-language support
- [ ] Analytics dashboard

---

## File Structure

### Backend Files to Create

```
backend/src/
├── models/
│   ├── user.py              # NEW
│   ├── supporter.py         # NEW
│   └── (update existing models for fields)
├── api/
│   ├── auth.py              # NEW - login endpoint
│   └── users.py             # NEW - user management (admin)
├── services/
│   ├── escalation_service.py # NEW - keyword detection + logic
│   └── (update chat.py logic)
└── utils/
    ├── password.py          # NEW - bcrypt hashing
    └── (update logging)
```

### Backend Files to Modify

```
backend/src/
├── api/chat.py              # Accept agent_id, detect escalation
├── api/admin/knowledge.py   # Ensure working
├── models/
│   ├── session.py           # Add escalation fields
│   └── message.py           # Add sender_supporter_id
└── middleware/auth.py       # Add RBAC
```

### Frontend Files to Create

```
frontend/src/
├── config/
│   ├── topic-agent-mapping.ts   # NEW
│   └── api.ts                   # NEW
└── pages/
    └── LoginPage.tsx            # NEW
```

### Frontend Files to Modify

```
frontend/src/
├── App.tsx                      # Add login flow, auth state
├── components/
│   ├── ChatWidget.tsx          # Send agent_id, show escalation
│   ├── AdminDashboard.tsx      # Add login, escalation queue
│   ├── UserInfoForm.tsx        # Integrate with backend users
│   └── icons.tsx               # Maybe add new icons
├── services/
│   ├── chatService.ts          # Call backend chat endpoint
│   ├── ragService.ts           # Remove local Gemini, use backend
│   ├── authService.ts          # NEW - login/logout
│   └── sessionService.ts       # NEW - fetch sessions from backend
└── types.ts                    # Update interfaces
```

### Database Migration

```
backend/alembic/versions/
└── 20251110_XXXX_add_user_management.py  # NEW
```

---

## API Summary Table

| Endpoint | Method | Purpose | Auth | Status |
|----------|--------|---------|------|--------|
| `/api/auth/login` | POST | Staff login | None | ✅ NEW |
| `/api/{tenant_id}/chat` | POST | Chat with agent | Optional | ✅ MODIFY |
| `/api/{tenant_id}/sessions` | GET | List sessions | Required | ✅ EXISTING |
| `/{tenant_id}/sessions/{id}/messages` | GET | Get chat history | Required | ✅ EXISTING |
| `/{tenant_id}/sessions/{id}/escalate` | POST | Request human | Optional | ✅ NEW |
| `/{tenant_id}/sessions/{id}/assign-supporter` | PUT | Assign staff | Required (admin) | ✅ NEW |
| `/api/tenants/{tenant_id}/knowledge/upload-document` | POST | Upload documents | Required (Staff+) | ✅ NEW |
| `/api/tenants/{tenant_id}/knowledge/enrich-from-chat` | POST | Enrich from messages | Required (Staff+) | ✅ NEW |
| `/api/admin/{tenant_id}/users` | POST/GET | User mgmt | Required (admin) | ✅ NEW |
| `/api/admin/{tenant_id}/supporters` | GET | List staff | Required (admin) | ✅ NEW |

---

## Testing Strategy

### Unit Tests

```python
# backend/tests/unit/test_escalation_detection.py
- test_detect_complaint_keyword()
- test_detect_urgent_keyword()
- test_no_escalation_needed()

# backend/tests/unit/test_user_model.py
- test_user_creation()
- test_password_hashing()
- test_unique_email_per_tenant()

# backend/tests/unit/test_topic_agent_routing.py
- test_agent_id_routing_skips_supervisor()
- test_fallback_to_supervisor_if_no_agent_id()
```

### Integration Tests

```python
# backend/tests/integration/test_chat_flow.py
- test_chat_with_agent_id()
- test_escalation_flow_manual()
- test_escalation_flow_auto()
- test_supporter_assignment()

# backend/tests/integration/test_user_endpoints.py
- test_staff_login()
- test_admin_create_user()
- test_user_list_with_filters()
```

### E2E Tests (Frontend)

```typescript
// frontend/tests/e2e/chat.spec.ts
- User selects topic → Chat message sent → Response received
- User sees escalation suggestion → Clicks "Talk to Human"
- Admin assigns supporter → Supporter sees session
- Supporter responds → User receives message

// frontend/tests/e2e/admin.spec.ts
- Admin logs in → Dashboard loads
- Admin sees escalation queue → Can assign supporter
- Supporter logs in → Sees assigned sessions
```

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Chat response latency | <2s (no RAG retrieval) | Monitor chat endpoint |
| Escalation detection | <200ms | Middleware timing |
| Dashboard session load | <1s | Admin dashboard open time |
| Concurrent users | 50+ | Load test tool |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Direct routing breaks existing flows | Backward compatible - fallback to SupervisorAgent |
| Supporter offline during escalation | Queue escalations, notify when supporter comes online |
| Message loss during escalation | Persist all messages to DB immediately |
| Supporter assigns self to too many sessions | Enforce max_concurrent_sessions limit |
| Keyword detection too aggressive | Configurable keyword list + confidence threshold |

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (unit + integration)
- [ ] Database migration tested locally
- [ ] Backend API tested with real frontend
- [ ] Frontend tested against real backend
- [ ] .env files configured correctly
- [ ] JWT secrets generated and configured
- [ ] API documentation reviewed

### Deployment

- [ ] Deploy database migration to staging
- [ ] Deploy backend to staging
- [ ] Deploy frontend to staging
- [ ] Smoke tests in staging environment
- [ ] Monitor logs for errors
- [ ] Verify escalation end-to-end
- [ ] Performance baseline recorded

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check API response times
- [ ] Verify chat history persistence
- [ ] Test with real staff users
- [ ] Collect feedback from testers

---

## Documentation References

Related documents:
- [`USER_MANAGEMENT_SPEC.md`](./USER_MANAGEMENT_SPEC.md) - Database schemas & auth
- [`TOPIC_TO_AGENT_MAPPING.md`](./TOPIC_TO_AGENT_MAPPING.md) - Architecture change
- [`ESCALATION_FLOW.md`](./ESCALATION_FLOW.md) - Escalation implementation
- [`API_CONTRACTS_FRONTEND.md`](./API_CONTRACTS_FRONTEND.md) - Exact API specs

---

## Success Criteria

MVP is complete when:

✅ Users can select a topic and chat with the correct agent
✅ Chat messages are persisted to database
✅ Staff can login to admin dashboard
✅ Staff can view and assign themselves to escalated sessions
✅ Staff can respond in chat, with messages visible to user
✅ Knowledge base uploads work
✅ Auto-detection of escalation keywords works
✅ E2E test: Topic selection → Message → AI response → Escalation → Staff response ✓

---

## Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| 0: Backend Foundations | 2 days | Week 1 Mon | Week 1 Tue |
| 1: Topic→Agent Routing | 2 days | Week 1 Wed | Week 1 Thu |
| 2: Knowledge Upload | 1 day | Week 2 Mon | Week 2 Mon |
| 3: User Management | 2 days | Week 2 Tue | Week 2 Wed |
| 4: Escalation | 2 days | Week 2 Thu | Week 3 Fri |
| 5: Testing & Refinement | 2 days | Week 3 Mon | Week 3 Tue |

**Total**: ~3 weeks for complete MVP
