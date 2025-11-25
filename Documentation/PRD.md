# ITL_chatbot - Product Requirements Document

> **⚠️ OUTDATED DOCUMENT**
>
> **Status**: This PRD reflects the original product vision but **does not accurately represent the current implementation**.
>
> **For current system information**:
> - **Backend Code** is the source of truth (see `backend/src/`)
> - **Setup Guide**: `backend/Guides/BACKEND_SETUP.md`
> - **Architecture Analysis**: `Documentation/ARCHITECTURE_ANALYSIS.md`
> - **Developer Guide**: `CLAUDE.md`
>
> **Key Differences from PRD**:
> - Configuration uses `DISABLE_AUTH` (not `disauth_status`)
> - Admin UI/SPA is minimal/not fully implemented
> - Backend-first approach; frontend to be developed later
> - Focus on multi-tenant API, RAG, and agent orchestration
>
> **Last Reviewed**: 2025-11-25

---

**Author:** BMad
**Date:** 2025-11-11
**Version:** 1.0 (Archived)

---

## Executive Summary

Tenant-facing admin + chat ecosystem where support leads assign bots and supporters via the admin UI, with every change persisted in PostgreSQL/pgvector (no redeploys). Aligns to backend\src FastAPI services and the shared admin SPA so new tenants, LLM/tool stacks, and chat flows are configured centrally and synced back to the database.

### What Makes This Special

Support leaders instantly wire new tenants, assign human/AI supporters, and have the chatbot interpret user intent with accurate context from pgvector—all without redeploying code.

---

## Project Classification

**Technical Type:** Admin SPA + API backend (web_app + api_backend hybrid)
**Domain:** Customer support SaaS
**Complexity:** Medium-high (multi-tenant RBAC + LangChain routing)

Multi-tenant chatbot ops suite: single React/Vue admin SPA backed by FastAPI (`backend\src`) plus a lightweight tenant-facing demo widget rendered from the same frontend build. Widgets are embedded via iframe snippets per tenant but all tenant configuration and chat orchestration live in the backend/postgres stack.

### Domain Context

- Customer support SaaS: conversation history must be auditable, and every query filters by `tenant_id` for isolation.
- Demo environments may enable `disauth_status=True`, but production requires JWT auth; switching states must be explicit.
- RBAC expectations: supporters touch only assigned tenants, admins see all.

---

## Success Criteria

- Admins onboard a new tenant (LLM config, supporter assignments, widget settings) entirely via UI with zero code deploys.
- Demo tenant chatbot loads live tenant + session data from PostgreSQL/pgvector through `backend\src\api\chat.py`, allowing JWT bypass (`disauth_status=True`) only in test mode.
- Tenant widgets respond with accurate intents tied to tenant knowledge bases and persist every chat + assignment to the DB.
- Admin dashboard eliminates mock data: tenants and chat sessions come from backend APIs (`GET /api/admin/tenants`, `GET /api/admin/chat-sessions`).
- Quick login path exists for admin and supporter demo accounts.

### Business Metrics

- Tenant onboarding time < 15 minutes end-to-end.
- Supporter reassignment latency is effectively instant (UI change reflected via API immediately).
- Demo chat correctness ≥ 80% of prompts with proper tenant knowledge references.
- Admin/supporter quick-login friction approaches zero while still respecting role boundaries.

---

## Product Scope

### MVP - Minimum Viable Product

- Admin dashboard (shared SPA) consumes `GET /api/admin/tenants` to render real tenants and drives tenant CRUD + supporter assignment + widget configuration via backend FastAPI endpoints.
- Frontend removes all mock data; tenant lists, supporter rosters, and chat session logs source live DB data through backend APIs.
- Demo tenant chatbot page and iframe snippet call `backend\src\api\chat.py` so user inputs flow through LangChain/pgvector and persist sessions/messages end-to-end.
- `disauth_status` toggle surfaced for local/demo use (default true locally, false in production) and wired into backend auth logic.
- Quick admin/supporter login path (seeded accounts) to accelerate demos while still honoring role permissions.
- Flow assignment outcomes (user → supporter/agent) persist per session and render in both admin dashboard and API payloads.
- Every API under `backend\src\api\chat.py` remains production-ready and stores complete session/message data.

### Growth Features (Post-MVP)

- Replace auth bypass with robust JWT + role-specific dashboards.
- Per-tenant analytics (conversation volume, resolution rate, failed intents).
- Tenant self-service portal for knowledge uploads and bot configuration.
- Embeddable widget customization (branding, localization) beyond default theme.
- Automated regression harness replaying chats through `backend\src\api\chat.py` endpoints.

### Vision (Future)

- Self-service marketplace where tenants onboard themselves, provision LLM credits, and manage multi-supporter teams.
- AI-assisted supporter handoffs and automated knowledge ingestion from CRM/ticketing systems.
- Real-time compliance guardrails (PII detection, audit logging) for enterprise deployments.

---

## Domain-Specific Requirements

- Store conversation history with auditability; include timestamps, tenant context, and supporter assignments.
- Enforce tenant isolation on every DB query; no shared cache entries without tenant scoping.
- Document demo-vs-production auth states and ensure toggling `disauth_status` is traceable.

---

## Innovation & Novel Patterns

- Config-driven tenant onboarding: UI edits DB-backed configs that immediately shift chatbot flows—no redeploys.
- Unified widget + admin SPA build: demo widget lives alongside admin UI for MVP speed while still emitting iframe snippets for tenant sites.
- Flow-assignment automation hooks enabling future AI-driven supporter routing.

### Validation Approach

- Manual E2E walk-through: create tenant → assign supporter → open demo widget → run chat → verify session + messages saved in DB.
- API contract tests for `GET /api/admin/tenants`, `GET /api/admin/chat-sessions`, and all endpoints in `backend\src\api\chat.py`.
- Smoke test `disauth_status` toggle to confirm bypass works locally but is disabled in production.

---

## Admin SPA + API Requirements

### Endpoint Specification

- `GET /api/admin/tenants` – returns tenants plus supporter roster, `disauth_status`, and widget config.
- `POST /api/admin/tenants` – create tenant with LLM/tool settings.
- `PATCH /api/admin/tenants/{id}` – update tenant config, including supporter assignments.
- `GET /api/admin/chat-sessions` – paginated session list for admins/supporters.
- `POST /api/chat/messages` – user message entry point; creates/extends session and persists message payloads.
- `GET /api/chat/sessions/{id}` – fetch full conversation for admin/supporter review.

### Authentication & Authorization

- Local/demo: `disauth_status=True` bypasses JWT but UI still requires quick admin/supporter login guard.
- Production: JWT-protected admin routes; supporter role limited to assigned tenants; admins see all.
- Widgets embed `tenant_id` and (when auth enforced) signed tokens so backend can validate origin.

### Tenant & Permission Model

- `tenants` table is the root context; each tenant stores LLM/tool configs, widget snippet, supporter assignments.
- `sessions` always reference `tenant_id`; widget must include tenant identifier on every call.
- Admin UI filters by role: admins view all tenants, supporters only their assignments.

| Role | Capabilities |
| --- | --- |
| Admin | Manage all tenants, supporters, widgets, toggle disauth, inspect every chat |
| Supporter | View/edit only assigned tenants, respond to chats, view their sessions |
| Tenant widget user | Chat only for their tenant; no admin capabilities |

---

## User Experience Principles

- Dashboard-first: tenants and supporter status visible immediately after login (no blank states).
- Live data cues: loading and “live from backend” indicators reassure users data is real-time.
- Inline quick actions: supporter assignment, disauth toggle, and widget snippet copy accessible without leaving context.
- Demo widget reachable from the same UI with explicit iframe snippet controls.

### Key Interactions

1. Admin logs in via quick demo account and sees tenant list populated by `GET /api/admin/tenants`.
2. Admin selects a tenant, assigns supporters, and adjusts chatbot settings; backend persists instantly.
3. Admin opens demo widget page, sends a message, and sees the new session appear in the dashboard.
4. Supporter logs in, limited to assigned tenants, and responds within the chat session viewer.

---

## Functional Requirements

- **FR1 Tenant Listing:** Frontend must call `GET /api/admin/tenants` to fetch tenants, supporters, and widget configs—no mock data.
- **FR2 Tenant CRUD:** Admin UI creates/updates tenants via POST/PATCH endpoints, capturing LLM + pgvector settings.
- **FR3 Supporter Assignment:** Admin assigns supporters per tenant; backend stores mapping and enforces scoped access.
- **FR4 Chat Session Viewer:** Admin/supporter views sessions from API-backed data with pagination and filters.
- **FR5 Chat Interaction:** Widget/demo page posts messages to `backend\src\api\chat.py`; pipeline handles intent/tooling and persists payloads.
- **FR6 Flow Assignment Persistence:** Every routing decision (AI vs supporter) is saved and displayed in UI + APIs.
- **FR7 disauth Toggle:** UI/config surfaces `disauth_status`; switching updates backend auth behavior.
- **FR8 Demo Widget Embed:** System emits iframe/snippet embedding `tenant_id` so external sites can run the chatbot.
- **FR9 Quick Login:** Seeded admin/supporter credentials allow rapid access while respecting role scopes.

---

## Non-Functional Requirements

### Performance

- Admin API responses (tenant list <100) must return within 500 ms.
- Chat latency widget→response < 2 seconds under nominal LLM load.

### Security

- With `disauth_status=False`, all admin endpoints require JWT; secrets kept in environment variables.
- Audit logs capture admin/supporter actions (tenant edits, assignments, disauth toggles).

### Scalability

- Every DB query filters by `tenant_id`; caching layers must respect tenant contexts.
- Sessions/messages tables support ≥1M rows; pgvector indexes tuned for retrieval performance.

### Integration

- Chat endpoints integrate with SupervisorAgent, Domain Agents, ToolLoader, and pgvector services defined in `backend\src`.
- Future CRM/ticketing connectors must use ToolLoader abstractions—no hardcoded service calls.

---

## Implementation Planning

Requirements now need decomposition into epics/stories (Tenant Admin, Chat Pipeline, Widget Embed, Auth Toggle, Quick Login). Run `workflow create-epics-and-stories` next to generate the engineering backlog.

---

## References

- Product Brief (legacy spec): `sample/spec_business_chatbot.md`
- Additional historical context: `CLAUDE.md`

---

## Next Steps

1. Run `workflow create-epics-and-stories` to break PRD requirements into implementable work.
2. Continue improving frontend bindings to backend APIs and replace remaining mock logic.
3. Prepare production auth plan (JWT enforcement, role scopes) before deploying beyond demo.

_This PRD captures the essence of ITL_chatbot: admins configure tenants/supporters once and the demo widget instantly reflects the right context while persisting every interaction._
