# Role Assignment Guide - Frontend Integration MVP

**Status**: Planning
**Version**: 1.0
**Date**: 2025-11-10

## Quick Reference: Who Does What?

| Phase | Duration | Primary Agent | Support | Key Deliverable |
|-------|----------|---------------|---------|-----------------|
| **Phase 0** | 2 days | Backend Dev | - | Login endpoint works |
| **Phase 1** | 2 days | Both | Architect (review) | Chat with agent_id works |
| **Phase 2** | 1 day | Frontend Dev | - | Knowledge upload works |
| **Phase 3** | 2 days | Both | - | Staff can login to admin |
| **Phase 4** | 2 days | Both | - | Escalation end-to-end |
| **Phase 5** | 2 days | Both + QA | Tech Writer | All tests pass, docs done |

---

## Team Member Roles

### 1. Backend Developer

**Responsibility**: Build server-side features

**Phase 0: Backend Foundations** (2 days)
```
Task: Create User & Supporter models
  - Write: src/models/user.py
  - Write: src/models/supporter.py
  - Modify: src/models/session.py (add escalation fields)
  - Modify: src/models/message.py (add sender tracking)
  Doc: USER_MANAGEMENT_SPEC.md > Database Schema

Task: Database Migration
  - Run: alembic revision --autogenerate -m "Add user management"
  - Review generated migration
  - Run: alembic upgrade head
  - Seed initial test users
  Doc: USER_MANAGEMENT_SPEC.md > Migration Strategy

Task: Authentication
  - Create: src/api/auth.py
  - Create: src/middleware/auth.py
  - Implement: Password hashing (bcrypt)
  - Implement: JWT token generation
  Doc: USER_MANAGEMENT_SPEC.md > API Endpoints, JWT Token Structure
```

**Phase 1: Topic→Agent Routing** (1 day)
```
Task: Update Chat Endpoint
  - Modify: src/schemas/chat.py (add agent_id)
  - Modify: src/api/chat.py:
    - Accept agent_id parameter
    - Skip SupervisorAgent if agent_id provided
    - Use DomainAgent directly
    - Fallback to SupervisorAgent if needed (backward compat)
  - Test with frontend
  Doc: TOPIC_TO_AGENT_MAPPING.md > Implementation Changes
```

**Phase 3: User Management** (1 day)
```
Task: User CRUD Endpoints
  - Create: src/api/users.py
  - POST /api/admin/{tenant_id}/users (admin creates user)
  - GET /api/admin/{tenant_id}/users (list users)
  - PUT /api/admin/{tenant_id}/users/{user_id} (edit user)
  - DELETE /api/admin/{tenant_id}/users/{user_id} (deactivate)

Task: Supporter Endpoints
  - Create: src/api/supporters.py
  - GET /api/admin/{tenant_id}/supporters (list staff)
  - PUT /api/admin/{tenant_id}/supporters/{id}/status (update status)

Task: Seed Initial Users
  - Modify: backend/setup/seed_base_data.py
  - Create admin user for each tenant
  - Create 2-3 test staff users per tenant
  Doc: USER_MANAGEMENT_SPEC.md > API Endpoints
```

**Phase 4: Escalation** (1.5 days)
```
Task: Escalation Service
  - Create: src/services/escalation_service.py
  - Implement: detect_escalation_needed(message)
  - Implement: suggest_escalation(message)
  - Keyword list: complaint, urgent, error, help, human, etc.
  Doc: ESCALATION_FLOW.md > Auto-Escalation Detection

Task: Escalation Endpoints
  - POST /{tenant_id}/sessions/{id}/escalate
  - PUT /{tenant_id}/sessions/{id}/assign-supporter
  - PUT /{tenant_id}/sessions/{id}/resolve
  - GET /admin/{tenant_id}/escalations/pending

Task: Chat Integration
  - Modify: src/api/chat.py
  - After AI response, detect escalation keywords
  - Return escalation_suggested in ChatResponse
  Doc: ESCALATION_FLOW.md > Integration in Chat Flow
```

**Phase 5: Testing** (1 day)
```
Task: Unit Tests
  - backend/tests/unit/test_user_model.py
  - backend/tests/unit/test_escalation_detection.py
  - backend/tests/unit/test_topic_agent_routing.py

Task: Integration Tests
  - backend/tests/integration/test_chat_flow.py
  - backend/tests/integration/test_user_endpoints.py
  - backend/tests/integration/test_escalation_flow.py

Coverage Target: 80%+
Doc: FRONTEND_INTEGRATION_PLAN.md > Testing Strategy
```

**Tools & Skills Needed**:
- Python/FastAPI
- SQLAlchemy ORM
- Alembic migrations
- JWT/authentication
- pytest (testing)

---

### 2. Frontend Developer

**Responsibility**: Build client-side features & UI

**Phase 1: Topic→Agent Routing** (1 day)
```
Task: Configuration File
  - Create: frontend/src/config/topic-agent-mapping.ts
  - Map each Topic ID to Agent ID
  - Example:
    {
      'user-support': { agentId: 'agent-support-guide' },
      'shipment-lookup': { agentId: 'agent-tracking-debt' }
    }

Task: API Configuration
  - Create: frontend/src/config/api.ts
  - Setup: BASE_URL, TENANT_ID from .env
  - Define: All API endpoints as constants
  Doc: API_CONTRACTS_FRONTEND.md > Environment Configuration

Task: Chat Service
  - Modify: frontend/src/services/chatService.ts
  - Create sendMessage() function
  - Call: POST /api/{tenant_id}/chat
  - Pass: agent_id with message
  Doc: API_CONTRACTS_FRONTEND.md > Chat Endpoint

Task: Chat Widget
  - Modify: frontend/src/components/ChatWidget.tsx
  - Get agent_id from TOPIC_TO_AGENT_MAPPING
  - Pass agent_id to sendMessage()
  - Test with real backend
  Doc: API_CONTRACTS_FRONTEND.md > Frontend Implementation
```

**Phase 2: Knowledge Upload** (0.5 days)
```
Task: Connect Knowledge API
  - Modify: frontend/src/components/AdminDashboard.tsx
  - Knowledge upload form → Call backend API
  - POST /api/admin/{tenant_id}/knowledge
  - Show success/error messages
  Doc: API_CONTRACTS_FRONTEND.md > Knowledge Upload Endpoint
```

**Phase 3: User Management** (1 day)
```
Task: Login Page
  - Create: frontend/src/pages/LoginPage.tsx
  - Form fields: email, password, tenant_id
  - Call: POST /api/auth/login
  - Store JWT in localStorage

Task: Auth Service
  - Create: frontend/src/services/authService.ts
  - staffLogin(email, password, tenantId)
  - getAuthToken()
  - getUserRole()
  - logout()

Task: Protected Routes
  - Add: Auth middleware
  - Redirect: Unauthenticated users to login
  - Show: Role-based UI (Admin ↔ Staff ↔ Customer)

Task: Admin Dashboard
  - Modify: frontend/src/components/AdminDashboard.tsx
  - Add: Login form if not authenticated
  - Show: Different views for admin vs staff
  - Admin: Can create/manage users, assign supporters
  - Staff: Can only see assigned sessions
  Doc: USER_MANAGEMENT_SPEC.md > RBAC, API_CONTRACTS_FRONTEND.md > Login
```

**Phase 4: Escalation** (1 day)
```
Task: Escalation Button & Banner
  - Modify: frontend/src/components/ChatWidget.tsx
  - Add: "Talk to Human" button (always visible)
  - Add: Escalation suggestion banner (if AI detects)
  - Call: POST /api/{tenant_id}/sessions/{id}/escalate

Task: Escalation Queue View
  - Modify: frontend/src/components/AdminDashboard.tsx
  - Add: Escalations tab
  - Show: List of pending escalations
  - Feature: Dropdown to assign supporter
  - Call: PUT /api/admin/{tenant_id}/sessions/{id}/assign-supporter

Task: Supporter Message UI
  - Modify: frontend/src/components/ChatWidget.tsx
  - If escalated & assigned:
    - Show supporter name
    - Support messages from supporter
    - Input field for supporter to respond
  - Call: POST /api/{tenant_id}/sessions/{id}/messages
  Doc: ESCALATION_FLOW.md > Frontend Implementation
```

**Phase 5: E2E Tests** (1 day)
```
Task: E2E Test Suite
  - frontend/tests/e2e/chat.spec.ts
    - User selects topic → Message sent → Response received
    - Escalation flow end-to-end
  - frontend/tests/e2e/admin.spec.ts
    - Admin login → Dashboard loads
    - Assign supporter → Session updates
    - Supporter responds → User sees message
  - frontend/tests/e2e/escalation.spec.ts
    - Auto-escalation detection
    - Manual escalation request
    - Supporter assignment
  Doc: FRONTEND_INTEGRATION_PLAN.md > Testing Strategy
```

**Tools & Skills Needed**:
- React/TypeScript
- HTTP client (fetch/axios)
- React Router
- localStorage/sessionStorage
- Testing framework (MSW, Playwright)

---

### 3. Architect (Optional, Reviews Only)

**Role**: Review design decisions, ensure consistency

**When Involved**:
- Phase 1 kickoff: Review Topic→Agent mapping approach
- Phase 3: Review user model design & RBAC
- Phase 4: Review escalation flow architecture

**Deliverables**:
- Approve architectural decisions
- Flag consistency issues
- Suggest optimizations

---

### 4. Tech Writer (Phase 5 Only)

**Role**: Complete documentation for deployment

**Phase 5: Documentation** (0.5 days)
```
Task: API Documentation
  - Ensure Swagger/OpenAPI is complete
  - Add examples for all endpoints
  - Document error codes

Task: Deployment Guide
  - How to deploy backend (migrations, secrets, env vars)
  - How to deploy frontend (build, env config)
  - Staging vs Production setup

Task: Operations Runbook
  - How to create new users
  - How to manage supporter load
  - How to handle escalation queue
  - Troubleshooting guide

Task: Team Onboarding
  - Setup instructions
  - Architecture overview
  - First-time contributor guide
```

---

### 5. QA Engineer (Phase 5 Only)

**Role**: Test strategy, load testing, quality assurance

**Phase 5: Testing** (0.5 days)
```
Task: Test Strategy
  - Define test scope
  - Identify edge cases
  - Setup test environment

Task: Load Testing
  - Test with 50+ concurrent users
  - Monitor response times
  - Identify bottlenecks

Task: Bug Reporting
  - Report issues in standardized format
  - Prioritize by severity
  - Provide reproduction steps

Task: Acceptance Criteria
  - Verify all features work
  - Confirm success criteria met
  - Sign off for release
```

---

## Timeline by Agent

### Week 1

**Backend Dev (40 hours)**
- Mon-Tue: Phase 0 (foundations)
  - User & Supporter models (4h)
  - Database migration (2h)
  - Auth endpoints (6h)
- Wed-Thu: Phase 1 (chat)
  - Update chat endpoint (4h)
  - Testing (2h)
- Fri: Stability & fixes (2h)

**Frontend Dev (40 hours)**
- Mon-Tue: Preparation & setup
  - Environment setup (2h)
  - Review API contracts (4h)
  - Setup test infrastructure (4h)
- Wed-Thu: Phase 1 implementation
  - Config files (2h)
  - Chat service (3h)
  - ChatWidget integration (4h)
  - Testing (2h)
- Fri: Stabilization & bug fixes (2h)

---

### Week 2

**Backend Dev (40 hours)**
- Mon: Phase 3a (user endpoints)
  - User CRUD endpoints (4h)
  - Supporter endpoints (2h)
- Tue: Phase 3b (finishing)
  - Seed data (2h)
  - Testing (2h)
- Wed-Thu: Phase 4a (escalation service)
  - Escalation service (6h)
  - Escalation endpoints (4h)
- Fri: Testing & bug fixes (2h)

**Frontend Dev (40 hours)**
- Mon: Phase 2 & 3
  - Knowledge upload UI (2h)
  - Login page (4h)
  - Auth service (3h)
- Tue: Phase 3 continuation
  - Protected routes (3h)
  - Admin dashboard role switching (3h)
- Wed-Thu: Phase 4 (escalation UI)
  - Escalation button & banner (4h)
  - Escalation queue (3h)
  - Supporter messages UI (4h)
- Fri: Testing & refinement (2h)

---

### Week 3

**Backend Dev (20 hours)**
- Mon: Phase 4b
  - Chat integration with escalation (4h)
  - Testing (4h)
- Tue-Wed: Phase 5
  - Unit & integration tests (8h)

**Frontend Dev (20 hours)**
- Mon-Tue: Phase 5
  - E2E tests (8h)
  - Bug fixes (4h)
- Wed: Refinement
  - Performance optimization (4h)
  - UX improvements (2h)
- Thu: Final testing
  - Smoke tests (2h)

**Tech Writer (10 hours)**
- Thu-Fri: Phase 5
  - Complete API docs (3h)
  - Deployment guide (3h)
  - Runbook (3h)
  - Onboarding docs (1h)

**QA Engineer (10 hours)**
- Thu-Fri: Phase 5
  - Test strategy & planning (2h)
  - Load testing (4h)
  - Bug reporting & prioritization (2h)
  - Acceptance testing (2h)

---

## Decision Tree: Who Should Do What?

```
Task involves backend API? → Backend Dev
  ├─ Database schema? → Also involve Backend Dev
  └─ Authentication? → Backend Dev

Task involves frontend UI? → Frontend Dev
  ├─ API integration? → Frontend Dev + Backend Dev
  └─ Testing? → Frontend Dev

Task is documentation? → Tech Writer (Phase 5)

Task is testing/QA? → QA Engineer (Phase 5)

Task affects overall design? → Architect (review)
```

---

## Communication & Handoffs

### Daily Standup (15 mins)
- What did each agent complete?
- What blockers exist?
- What's next?

### Phase Kickoff (30 mins)
- Architect reviews approach
- Assign tasks to developers
- Set expectations

### Phase Completion (30 mins)
- Code review by peer
- Verify tests passing
- Move to next phase

---

## Effort Summary

| Team Member | Role | Total Hours | Weeks |
|-------------|------|------------|-------|
| Backend Dev | Core implementation | 80 | 2.5 |
| Frontend Dev | Core implementation | 80 | 2.5 |
| Architect | Design reviews (part-time) | 10 | 0.25 |
| QA Engineer | Testing & quality | 10 | 0.25 |
| Tech Writer | Documentation | 10 | 0.25 |
| **Total** | **All roles** | **190** | **3** |

**Team Size**: 2 full-time (Backend + Frontend) + supports from QA/Tech Writer

---

## Success Criteria Per Agent

### Backend Dev ✅
- [ ] All models created & tested
- [ ] Chat endpoint accepts agent_id
- [ ] User login endpoint works
- [ ] Escalation service detects keywords
- [ ] All integration tests passing
- [ ] Code coverage >80%

### Frontend Dev ✅
- [ ] Chat sends correct agent_id
- [ ] Admin dashboard login works
- [ ] Escalation UI functional
- [ ] All E2E tests passing
- [ ] No console errors
- [ ] Performance meets targets

### QA Engineer ✅
- [ ] Load test: 50+ concurrent users
- [ ] No critical bugs found
- [ ] Acceptance criteria met
- [ ] Ready for staging deployment

### Tech Writer ✅
- [ ] API docs complete
- [ ] Deployment guide complete
- [ ] Runbook for operations
- [ ] Team can onboard new members

---

## Resources per Agent

### Backend Dev
- Access to database (PostgreSQL)
- Test database for migrations
- Local FastAPI server setup
- Git repository

### Frontend Dev
- Frontend codebase (React)
- Node.js & npm
- Test environment (Playwright)
- Real backend to test against

### Tech Writer
- Documentation templates
- API docs generator
- Version control for docs

### QA Engineer
- Load testing tool (k6, Apache JMeter)
- Staging environment
- Bug tracking system

---

## When to Escalate Issues

| Issue | Escalate To |
|-------|------------|
| Backend model design question | Architect |
| API contract conflict | Architect |
| Performance problem | Architect |
| Test failure blocking other work | Tech Lead |
| Documentation unclear | Tech Writer |
| Blocker affecting timeline | Project Manager |
