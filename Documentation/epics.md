# backend\src  - Epic Breakdown

**Author:** BMad
**Date:** 2025-11-11
**Project Level:** method
**Target Scale:** multi-tenant SaaS MVP

---

## Overview

This document provides the complete epic and story breakdown for backend\src , decomposing the requirements from the [PRD](./PRD.md) into implementable stories.

1. Foundation & Admin Data Plumbing – Replace mock data by binding frontend admin SPA to backend FastAPI (GET /api/admin/tenants, chat session APIs) and expose disauth toggle + quick login scaffolding.
2. Tenant Configuration & Supporter Assignment – CRUD tenants, map LLM/tool configs, assign supporters, and ensure RBAC + persistence across backend\src models.
3. Chat Pipeline & Widget Embed – Ensure demo widget + iframe call backend\src\api\chat.py, persist sessions/messages, and surface flow assignment outcomes.
4. Observability & Compliance Guardrails – Logging/audit trails, tenant isolation enforcement, and toggling disauth for demo vs production.
5. Growth Enablement – Prepare analytics hooks, regression harness, and customization paths for upcoming iterations.

---

## Epic 1: Foundation & Admin Data Plumbing

Align admin SPA with live backend APIs and surface environment controls.

### Story 1.1: Admin Frontend Bootstrapping
As an admin tester
I want the shared SPA to load configuration from live backend endpoints
So that tenant data shown in UI reflects the real database

**Acceptance Criteria:**
Given the app builds
When the admin SPA loads
Then it reads API base URL and disauth flag from environment/config (no hardcoded mocks)

Given disauth_status is true
When the SPA loads
Then it shows “JWT bypass enabled (demo mode)” banner/info

Given quick login credentials exist
When I click “Demo Login”
Then the form pre-fills seeded admin credentials (without hitting backend yet)

**Prerequisites:** none
**Technical Notes:** Update frontend config loader, add indicator component, prep quick-login button bound to future auth endpoint.

### Story 1.2: Tenant List API Integration
As an admin user
I want the dashboard tenant list to call GET /api/admin/tenants
So that I manage real tenants instead of mock data

**Acceptance Criteria:**
Given backend is running
When dashboard loads
Then it fetches GET /api/admin/tenants and renders tenant/supporter/widget data

Given API returns []
When dashboard loads
Then UI shows “No tenants yet” and CTA to create

Given API errors
Then UI shows error state + retry

**Prerequisites:** Story 1.1
**Technical Notes:** Replace mock service, add loading/error UI, align typings to backend schema.

### Story 1.3: Chat Session List Wiring
As a supporter
I want the session viewer to read chat sessions from backend APIs
So that I can inspect real conversations

**Acceptance Criteria:**
Given GET /api/admin/chat-sessions succeeds
When I open Sessions page
Then entries show tenant, participant, last message per API response

Given pagination exists
When I change page
Then requests send pagination params and append results appropriately

Given API errors
Then UI shows fallback + retry

**Prerequisites:** Story 1.2
**Technical Notes:** Hook to real endpoint, implement pagination controls, reuse session types.

### Story 1.4: disauth Toggle Surface
As an admin user
I want to see and toggle disauth_status from the UI
So that dev/demo can bypass JWT while prod stays strict

**Acceptance Criteria:**
Given backend exposes disauth flag
When admin loads settings
Then UI shows current value true/false

Given I toggle true
Then frontend calls backend endpoint and shows “Demo mode active” indicator

Given I toggle false
Then backend updates and UI shows JWT required

**Prerequisites:** Story 1.2
**Technical Notes:** Bind to config endpoint, add warning copy, limit to admin role.

### Story 1.5: Quick Login Shortcut
As an admin tester
I want a quick login button for seeded demo accounts
So that I enter the dashboard rapidly

**Acceptance Criteria:**
Given seeded credentials exist
When I click “Login as Admin”
Then frontend calls login endpoint (or bypass) and stores token/session

Given login fails
Then error toast instructs to update creds

**Prerequisites:** Story 1.4
**Technical Notes:** Temporary measure; store creds in env; ensure logout clears session.

---

## Epic 2: Tenant Configuration & Supporter Assignment

Enable CRUD and RBAC persistence for tenants/supporters.

### Story 2.1: Tenant Creation Form + API
As an admin
I want to create tenants via UI calling POST /api/admin/tenants
So that new orgs can onboard without redeploys

**Acceptance Criteria:**
Given I fill tenant name + base configs
When I submit
Then frontend POSTs to backend and list refreshes with new tenant

Given validation fails
Then errors show inline (missing name, duplicate slug, etc.)

**Prerequisites:** Story 1.2
**Technical Notes:** Build form, reuse backend schema, show spinner during submission.

### Story 2.2: Tenant Update + LLM Config
As an admin
I want to edit tenant LLM/tool configs via PATCH
So that chatbot behavior updates instantly

**Acceptance Criteria:**
Given I adjust LLM model or pgvector settings
When I save
Then PATCH /api/admin/tenants/{id} persists changes and UI refreshes

Given backend rejects invalid config
Then UI surfaces validation errors

**Prerequisites:** Story 2.1
**Technical Notes:** Provide UI for LLM model selection, embeddings config; map to backend fields.

### Story 2.3: Supporter Assignment Workflow
As an admin
I want to assign supporters per tenant
So that only responsible staff see those chats

**Acceptance Criteria:**
Given supporters exist
When I assign them to a tenant
Then backend updates mapping and UI shows assignment

Given supporter logs in
Then they see only assigned tenant data

**Prerequisites:** Story 2.2
**Technical Notes:** Leverage backend permission endpoints; ensure UI respects role scope.

### Story 2.4: Widget Snippet Generator
As an admin
I want to copy an iframe/embed snippet per tenant
So that tenants can drop the widget into their sites

**Acceptance Criteria:**
Given tenant exists
When I open Widget tab
Then UI shows snippet containing tenant_id + base URL

Given I click Copy
Then snippet copied to clipboard and note shows

**Prerequisites:** Story 2.2
**Technical Notes:** Reference backend-provided config; ensure snippet includes tenant_id and optional token placeholder.

### Story 2.5: Tenant RBAC Enforcement
As a supporter
I want the backend to enforce tenant scoping
So that I can't access other orgs’ data

**Acceptance Criteria:**
Given supporter requests tenant list
Then backend filters to assigned tenants

Given admin requests
Then backend returns all tenants

**Prerequisites:** Story 2.3
**Technical Notes:** Ensure backend queries filter by tenant_id and role; add tests.

---

## Epic 3: Chat Pipeline & Widget Embed

Ensure chat flows use backend\src\api\chat.py and persist sessions/messages.

### Story 3.1: Widget → API Wiring
As a tenant user
I want the demo widget to send messages to POST /api/chat/messages
So that conversations run through full pipeline

**Acceptance Criteria:**
Given I send a message
When widget calls POST endpoint
Then backend creates/updates session and returns response

Given tenant_id missing
Then backend rejects and widget shows error

**Prerequisites:** Story 1.2
**Technical Notes:** Update widget component to call backend; include tenant_id; handle loading state.

### Story 3.2: Session Persistence Verification
As an admin
I want chats to appear in session viewer immediately
So that I can audit conversations

**Acceptance Criteria:**
Given widget conversation occurs
When I refresh Sessions page
Then new session + messages appear with correct tenant and timestamps

Prerequisites: Story 3.1, Story 1.3
Technical Notes: Ensure backend stores sessions/messages; add API poll or WebSocket.

### Story 3.3: Flow Assignment Display
As a supporter
I want to see whether AI or human handled each message
So that routing decisions are transparent

Acceptance Criteria:
Given backend sets flow assignment field
When session list renders
Then each message indicates “AI” or supporter name

Prerequisites: Story 3.2
Technical Notes: Extend data model/display; ensure backend writes assignment info.

### Story 3.4: iframe Demo Page
As an admin
I want a built-in demo widget page
So that I can show tenant chatbot without embedding elsewhere

Acceptance Criteria:
Given I open Demo Widget page
Then it loads tenant selector and embedded widget for preview

Prerequisites: Story 3.1
Technical Notes: Reuse widget component, allow tenant switching, share same API wiring.

---

## Epic 4: Observability & Compliance Guardrails

Logging, tenant isolation, auth toggles.

### Story 4.1: Audit Log for Admin Actions
As a compliance reviewer
I want admin/supporter changes logged
So that I can trace who edited tenants or toggled disauth

Acceptance Criteria:
Given admin updates tenant
Then audit log records actor, tenant_id, change set

Prerequisites: Story 2.2
Technical Notes: Log in backend; expose basic viewer.

### Story 4.2: Tenant Isolation Tests
As an engineer
I want regression tests verifying tenant_id scoping
So that data never leaks across tenants

Acceptance Criteria:
Given automated tests run
Then attempts to fetch other-tenant data fail

Prerequisites: Story 2.5
Technical Notes: Add unit/integration tests; document results.

### Story 4.3: disauth Mode Safeguards
As an admin
I want warnings + reminders when disauth is enabled
So that we don’t forget to re-enable JWT

Acceptance Criteria:
Given disauth true
Then UI shows persistent warning and logs event

Prerequisites: Story 1.4
Technical Notes: Add toast/banner; write to audit log.

---

## Epic 5: Growth Enablement

Prepare analytics, regression harness, customization groundwork.

### Story 5.1: Analytics Hook Framework
As a product lead
I want per-tenant metrics pipeline hooks
So that we can later show dashboards

Acceptance Criteria:
Given chat events occur
Then metrics service receives events with tenant_id

Prerequisites: Story 3.2
Technical Notes: Define event schema; send to queue/log.

### Story 5.2: Chat Regression Harness
As a QA engineer
I want a script to replay chats against backend\src\api\chat.py
So that we catch regressions quickly

Acceptance Criteria:
Given harness runs
Then it executes scripted conversations and validates responses stored in DB

Prerequisites: Story 3.1
Technical Notes: CLI script hitting API; summary output.

### Story 5.3: Widget Customization Settings
As a tenant admin
I want to tweak widget branding (colors/logo)
So that embed matches my site

Acceptance Criteria:
Given I change branding
Then snippet reflects customization and widget renders accordingly

Prerequisites: Story 2.4
Technical Notes: Add config fields; update frontend styles.

---

_For implementation: Use create-story workflow per story to build action plans._
