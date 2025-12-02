# Role-Based Features Specification

## Overview

This document defines specific features and functions for each role to enable independent testing.

---

## 🔴 Admin Role Features

### Route: `/admin`

#### 1. Dashboard (`/admin/dashboard`)

**Purpose:** Overview of system statistics

**Features:**
- Total tenants count
- Total users count (by role)
- Active sessions count
- Escalations pending count
- Knowledge base documents count
- Recent activity feed

**API Calls:**
```typescript
// GET /api/admin/stats
interface DashboardStats {
  tenants: { total: number; active: number };
  users: { admin: number; supporter: number; tenant_user: number };
  sessions: { active: number; total: number };
  escalations: { pending: number; assigned: number; resolved: number };
  knowledge: { documents: number; collections: number };
}
```

**Test Cases:**
- [ ] Load dashboard stats successfully
- [ ] Display charts/graphs for metrics
- [ ] Show recent activity timeline
- [ ] Auto-refresh every 30 seconds

---

#### 2. Tenant Management (`/admin/tenants`)

**Purpose:** Manage all tenants in the system

**Features:**
- List all tenants (table view)
- **Create new tenant with setup wizard** (one-click setup)
  - Step 1: Basic info (name, domain)
  - Step 2: LLM configuration (provider, model, API key)
  - Step 3: Select agents (GuidelineAgent, InvoiceAgent, TrackingAgent)
  - Step 4: Select tools (RAGTool, HTTPTool, etc.)
  - Auto-generate widget embed code
- Edit tenant details
- Delete tenant (with confirmation)
- View tenant statistics
- Copy widget embed code

**API Calls:**
```typescript
// GET /api/admin/tenants
getTenants(): Promise<Tenant[]>

// POST /api/admin/tenants/create-new (Full setup in one call)
createTenantFull(data: TenantFullCreateRequest): Promise<TenantFullResponse>
// Request:
{
  name: string;
  domain: string;
  llm_config: {
    provider: string;  // 'openrouter', 'google', 'openai'
    model_name: string;
    api_key: string;  // Will be encrypted
    rate_limit_rpm: number;
    rate_limit_tpm: number;
  };
  agent_ids: string[];  // Agent UUIDs to enable
  tool_ids: string[];   // Tool UUIDs to enable
}
// Response includes widget_key and embed_code

// GET /api/admin/agents (List available agents)
getAgents(): Promise<Agent[]>

// GET /api/admin/tools (List available tools)
getTools(): Promise<Tool[]>

// GET /api/admin/llm-models (List available LLM models)
getLLMModels(): Promise<LLMModel[]>

// PUT /api/admin/tenants/{tenant_id}
updateTenant(tenantId: string, data: UpdateTenantRequest): Promise<Tenant>

// DELETE /api/admin/tenants/{tenant_id}
deleteTenant(tenantId: string): Promise<void>
```

**Test Cases:**
- [ ] List all tenants with pagination
- [ ] **Create new tenant using setup wizard**
  - [ ] Step 1: Enter name and domain
  - [ ] Step 2: Select LLM provider and enter API key
  - [ ] Step 3: Select agents (at least 1)
  - [ ] Step 4: Select tools (at least RAGTool)
  - [ ] Verify widget embed code is generated
  - [ ] Copy embed code to clipboard
- [ ] Edit tenant name and domain
- [ ] Delete tenant (soft delete - status=inactive)
- [ ] Search/filter tenants
- [ ] View tenant widget configuration

---

#### 3. User Management (`/admin/users`)

**Purpose:** Manage all users (admin, supporter, tenant_user)

**Features:**
- List users with role filter
- Create new user (any role)
- Edit user details
- Delete user
- Reset user password
- Change user role

**API Calls:**
```typescript
// GET /api/admin/users?role=admin&tenant_id=xxx
listUsers(filters: UserFilters): Promise<User[]>

// POST /api/admin/users
createUser(data: CreateUserRequest): Promise<User>

// PUT /api/admin/users/{user_id}
updateUser(userId: string, data: UpdateUserRequest): Promise<User>

// DELETE /api/admin/users/{user_id}
deleteUser(userId: string): Promise<void>
```

**Test Cases:**
- [ ] List users filtered by role
- [ ] Create admin user
- [ ] Create supporter user
- [ ] Edit user display name
- [ ] Delete user
- [ ] Change user role from supporter to admin

---

#### 4. Session Monitoring (`/admin/sessions`)

**Purpose:** View ALL chat sessions across all tenants

**Features:**
- List all sessions (all tenants)
- Filter by tenant
- Filter by status (active/ended)
- View session details
- View full chat history
- Manually assign supporter
- End session

**API Calls:**
```typescript
// GET /api/admin/tenants/{tenant_id}/sessions
getSessions(tenantId: string): Promise<SessionSummary[]>

// GET /api/admin/tenants/{tenant_id}/sessions/{session_id}
getSessionDetail(tenantId: string, sessionId: string): Promise<SessionDetail>

// POST /api/admin/tenants/{tenant_id}/sessions/{session_id}/assign
assignSupporter(tenantId: string, sessionId: string, supporterId: string): Promise<void>
```

**Test Cases:**
- [ ] List all sessions for a tenant
- [ ] View session chat history
- [ ] Assign supporter to session
- [ ] Filter sessions by status
- [ ] Search sessions by user email

---

#### 5. Knowledge Base Management (`/admin/knowledge`)

**Purpose:** Manage knowledge base documents for all tenants

**Features:**
- Select tenant
- Select agent (GuidelineAgent, InvoiceAgent, TrackingAgent)
- Upload documents (PDF, DOCX, TXT)
- View uploaded documents
- Delete documents
- Enrich from chat history
- View knowledge base stats

**API Calls:**
```typescript
// POST /api/admin/tenants/{tenant_id}/knowledge/upload-document
uploadDocument(tenantId: string, file: File, agentName: string): Promise<UploadResponse>

// GET /api/admin/tenants/{tenant_id}/knowledge/stats
getKnowledgeStats(tenantId: string): Promise<KnowledgeStats>

// POST /api/admin/tenants/{tenant_id}/knowledge/ingest-texts
ingestTexts(tenantId: string, texts: string[], agentName: string): Promise<IngestResponse>
```

**Test Cases:**
- [ ] Upload PDF document
- [ ] Upload DOCX document
- [ ] View knowledge base stats
- [ ] Enrich from selected chat messages
- [ ] Delete document

---

#### 6. Escalation Queue (`/admin/escalations`)

**Purpose:** Manage all escalated sessions

**Features:**
- View escalation queue (pending, assigned, resolved)
- Filter by status
- Assign supporter to escalation
- Resolve escalation
- View escalation details
- Add resolution notes

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/escalations?status=pending
getEscalations(tenantId: string, status?: string): Promise<EscalationResponse[]>

// POST /api/tenants/{tenant_id}/escalations/{session_id}/assign
assignSupporter(tenantId: string, sessionId: string, supporterId: string): Promise<EscalationResponse>

// POST /api/tenants/{tenant_id}/escalations/{session_id}/resolve
resolveEscalation(tenantId: string, sessionId: string, notes?: string): Promise<EscalationResponse>
```

**Test Cases:**
- [ ] View pending escalations
- [ ] Assign supporter to escalation
- [ ] Resolve escalation with notes
- [ ] Filter by status (pending/assigned/resolved)

---
```typescript
// GET /api/admin/tenants/{tenant_id}/supporters
getSupporters(tenantId: string): Promise<Supporter[]>

// POST /api/admin/tenants/{tenant_id}/supporters
createSupporter(tenantId: string, data: CreateSupporterRequest): Promise<Supporter>

// PUT /api/admin/tenants/{tenant_id}/supporters/{supporter_id}
updateSupporter(tenantId: string, supporterId: string, data: UpdateSupporterRequest): Promise<Supporter>

// DELETE /api/admin/tenants/{tenant_id}/supporters/{supporter_id}
deleteSupporter(tenantId: string, supporterId: string): Promise<void>
```

**Test Cases:**
- [ ] List all supporters
- [ ] Create new supporter
- [ ] Update max concurrent sessions
- [ ] Delete supporter
- [ ] View supporter stats

---

#### 8. Settings (`/admin/settings`)

**Purpose:** System-wide settings

**Features:**
- LLM configuration (API keys, model selection)
- Email settings
- Notification settings
- Security settings
- Backup/restore

**Test Cases:**
- [ ] Update LLM API key
- [ ] Change default model
- [ ] Configure email settings

---

#### 9. Agent Management (`/admin/agents`) ⭐ NEW

**Purpose:** Create and manage AI agents

**Features:**
- List all agents (GuidelineAgent, InvoiceAgent, TrackingAgent, etc.)
- **Create new agent**
  - Name and description
  - Select LLM model
  - Define prompt template
  - Assign tools to agent
  - Set active/inactive status
- Edit agent configuration
- Update agent prompt template
- Assign/remove tools from agent
- Delete agent
- Reload agent cache

**API Calls:**
```typescript
// GET /api/admin/agents
listAgents(filters?: { is_active?: boolean }): Promise<Agent[]>

// POST /api/admin/agents
createAgent(data: {
  name: string;
  description: string;
  prompt_template: string;
  llm_model_id: string;
  tool_ids: string[];  // Tools to assign
  is_active: boolean;
}): Promise<Agent>

// GET /api/admin/agents/{agent_id}
getAgent(agentId: string): Promise<Agent>

// PATCH /api/admin/agents/{agent_id}
updateAgent(agentId: string, data: Partial<Agent>): Promise<Agent>

// POST /api/admin/agents/reload (Clear cache)
reloadAgentsCache(tenantId?: string): Promise<void>
```

**Test Cases:**
- [ ] List all agents
- [ ] Create new agent
  - [ ] Enter name and description
  - [ ] Select LLM model from dropdown
  - [ ] Write prompt template
  - [ ] Select tools (RAGTool, HTTPTool, etc.)
  - [ ] Set as active
- [ ] Edit agent prompt template
- [ ] Add/remove tools from agent
- [ ] Deactivate agent
- [ ] Reload agent cache

---

#### 10. Tool Management (`/admin/tools`) ⭐ NEW

**Purpose:** Create and manage tools for agents

**Features:**
- List all tools (RAGTool, HTTPTool, DatabaseTool, etc.)
- **Create new tool from base template**
  - Select base tool type (RAG, HTTP, Database, Custom)
  - Configure tool settings (API endpoints, credentials, etc.)
  - Define input schema
  - Set active/inactive status
- Edit tool configuration
- Update tool input schema
- Delete tool
- View which agents use this tool

**API Calls:**
```typescript
// GET /api/admin/tools
listTools(filters?: { is_active?: boolean }): Promise<Tool[]>

// GET /api/admin/base-tools (List base tool templates)
listBaseTools(): Promise<BaseTool[]>

// POST /api/admin/tools
createTool(data: {
  base_tool_id: string;  // Base template to use
  name: string;
  description: string;
  config: object;  // Tool-specific config (e.g., API URL, credentials)
  input_schema: object;  // JSON schema for tool inputs
  is_active: boolean;
}): Promise<Tool>

// GET /api/admin/tools/{tool_id}
getTool(toolId: string): Promise<Tool>

// PATCH /api/admin/tools/{tool_id}
updateTool(toolId: string, data: Partial<Tool>): Promise<Tool>
```

**Test Cases:**
- [ ] List all tools
- [ ] Create new tool
  - [ ] Select base tool template (e.g., HTTPTool)
  - [ ] Enter name and description
  - [ ] Configure tool settings (API URL, auth)
  - [ ] Define input schema
  - [ ] Set as active
- [ ] Edit tool configuration
- [ ] Update input schema
- [ ] Deactivate tool
- [ ] View agents using this tool

---

## 🟡 Supporter Role Features

### Route: `/support`

#### 1. My Chats (`/support` - Main Page)

**Purpose:** View assigned chat sessions

**Features:**
- List of assigned sessions
- Filter by status (active/waiting/resolved)
- Session preview (last message)
- Unread message count
- Click to open chat room

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions
getMySessions(tenantId: string, supporterId: string): Promise<SessionSummary[]>
```

**Test Cases:**
- [ ] Load assigned sessions
- [ ] Show unread count badge
- [ ] Filter by active sessions
- [ ] Click to open chat room

---

#### 2. Chat Room (`/support/chat/:sessionId`)

**Purpose:** Chat interface to communicate with users

**Features:**
- View full chat history
- Send messages to user
- View user info (name, email, department)
- Mark session as resolved
- **Label/categorize session** (after resolution)
  - Bug/Error
  - Feature Request
  - Guideline Question
  - Invoice/Payment Issue
  - Shipment Tracking
  - Other
- Add resolution notes
- Escalate back to queue
- Real-time message updates

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/sessions/{session_id}
getSessionDetail(tenantId: string, sessionId: string): Promise<SessionDetail>

// POST /api/tenants/{tenant_id}/supporter-chat
sendMessage(tenantId: string, sessionId: string, message: string): Promise<MessageResponse>

// POST /api/tenants/{tenant_id}/escalations/{session_id}/resolve
resolveSession(tenantId: string, sessionId: string, data: {
  notes?: string;
  category?: 'bug' | 'feature_request' | 'guideline' | 'invoice' | 'tracking' | 'other';
}): Promise<void>

// Note: Category field needs to be added to backend escalations table
// For now, can include category in notes field as "Category: bug"
```

**Test Cases:**
- [ ] Load chat history
- [ ] Send message to user
- [ ] Receive real-time messages
- [ ] Mark session as resolved with category label
  - [ ] Select category from dropdown
  - [ ] Add resolution notes
  - [ ] Verify category is saved
- [ ] View user information
- [ ] Filter history by category (in History page)

---

#### 3. History (`/support/history`)

**Purpose:** View resolved/past sessions

**Features:**
- List of resolved sessions
- Search by user email
- Filter by date range
- View chat transcript

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions?status=resolved
getResolvedSessions(tenantId: string, supporterId: string): Promise<SessionSummary[]>
```

**Test Cases:**
- [ ] Load resolved sessions
- [ ] Search by user email
- [ ] Filter by date range
- [ ] View chat transcript

---

#### 4. Profile (`/support/profile`)

**Purpose:** Supporter profile settings

**Features:**
- Update display name
- Change password
- Set availability status (online/offline/busy)
- Notification preferences

**API Calls:**
```typescript
// PUT /api/users/{user_id}
updateProfile(userId: string, data: UpdateProfileRequest): Promise<User>

// PUT /api/tenants/{tenant_id}/supporters/{supporter_id}
updateStatus(tenantId: string, supporterId: string, status: string): Promise<Supporter>
```

**Test Cases:**
- [ ] Update display name
- [ ] Change password
- [ ] Set status to busy
- [ ] Update notification preferences

---

#### 5. Statistics (`/support/stats`)

**Purpose:** Personal performance statistics

**Features:**
- Sessions handled (today, this week, this month)
- Average response time
- Customer satisfaction rating
- Resolution rate

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/supporters/{supporter_id}/stats
getMyStats(tenantId: string, supporterId: string): Promise<SupporterStats>
```

**Test Cases:**
- [ ] Load personal statistics
- [ ] View sessions handled chart
- [ ] View average response time

---

## 🟢 Tenant User Features (Widget - Unchanged)

### Route: Backend `/widget/:widget_key`

**Features:**
- Chat with AI agent
- Upload files
- View chat history
- Escalate to human support

**No changes needed** - Already implemented in `widget.tsx`

---

## Testing Strategy

### Unit Testing
```typescript
// Example test for Admin Dashboard
describe('AdminDashboard', () => {
  it('should load dashboard stats', async () => {
    const stats = await getDashboardStats();
    expect(stats.tenants.total).toBeGreaterThan(0);
  });
});
```

### Integration Testing
```typescript
// Example test for role-based routing
describe('Role-based Routing', () => {
  it('should redirect admin to /admin/dashboard', () => {
    loginAs('admin');
    expect(window.location.pathname).toBe('/admin/dashboard');
  });
  
  it('should redirect supporter to /support', () => {
    loginAs('supporter');
    expect(window.location.pathname).toBe('/support');
  });
});
```

### Manual Testing Checklist

**Admin Testing:**
- [ ] Login as admin → redirects to `/admin/dashboard`
- [ ] Navigate to all admin pages
- [ ] Create/edit/delete tenant
- [ ] Create/edit/delete user
- [ ] View sessions and assign supporter
- [ ] Upload knowledge base document
- [ ] Manage escalations

**Supporter Testing:**
- [ ] Login as supporter → redirects to `/support`
- [ ] View assigned sessions
- [ ] Open chat room and send message
- [ ] Mark session as resolved
- [ ] View history
- [ ] Update profile

**Access Control Testing:**
- [ ] Supporter cannot access `/admin/*` routes
- [ ] Admin can access all routes
- [ ] Unauthenticated user redirects to login

---

#### 2. Chat Room (`/support/chat/:sessionId`)

**Purpose:** Chat interface to communicate with users

**Features:**
- View full chat history
- Send messages to user
- View user info (name, email, department)
- Mark session as resolved
- **Label/categorize session** (after resolution)
  - Bug/Error
  - Feature Request
  - Guideline Question
  - Invoice/Payment Issue
  - Shipment Tracking
  - Other
- Add resolution notes
- Escalate back to queue
- Real-time message updates

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/sessions/{session_id}
getSessionDetail(tenantId: string, sessionId: string): Promise<SessionDetail>

// POST /api/tenants/{tenant_id}/supporter-chat
sendMessage(tenantId: string, sessionId: string, message: string): Promise<MessageResponse>

// POST /api/tenants/{tenant_id}/escalations/{session_id}/resolve
resolveSession(tenantId: string, sessionId: string, data: {
  notes?: string;
  category?: 'bug' | 'feature_request' | 'guideline' | 'invoice' | 'tracking' | 'other';
}): Promise<void>

// Note: Category field needs to be added to backend escalations table
// For now, can include category in notes field as "Category: bug"
```

**Test Cases:**
- [ ] Load chat history
- [ ] Send message to user
- [ ] Receive real-time messages
- [ ] Mark session as resolved with category label
  - [ ] Select category from dropdown
  - [ ] Add resolution notes
  - [ ] Verify category is saved
- [ ] View user information
- [ ] Filter history by category (in History page)

---

#### 3. History (`/support/history`)

**Purpose:** View resolved/past sessions

**Features:**
- List of resolved sessions
- Search by user email
- Filter by date range
- View chat transcript

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions?status=resolved
getResolvedSessions(tenantId: string, supporterId: string): Promise<SessionSummary[]>
```

**Test Cases:**
- [ ] Load resolved sessions
- [ ] Search by user email
- [ ] Filter by date range
- [ ] View chat transcript

---

#### 4. Profile (`/support/profile`)

**Purpose:** Supporter profile settings

**Features:**
- Update display name
- Change password
- Set availability status (online/offline/busy)
- Notification preferences

**API Calls:**
```typescript
// PUT /api/users/{user_id}
updateProfile(userId: string, data: UpdateProfileRequest): Promise<User>

// PUT /api/tenants/{tenant_id}/supporters/{supporter_id}
updateStatus(tenantId: string, supporterId: string, status: string): Promise<Supporter>
```

**Test Cases:**
- [ ] Update display name
- [ ] Change password
- [ ] Set status to busy
- [ ] Update notification preferences

---

#### 5. Statistics (`/support/stats`)

**Purpose:** Personal performance statistics

**Features:**
- Sessions handled (today, this week, this month)
- Average response time
- Customer satisfaction rating
- Resolution rate

**API Calls:**
```typescript
// GET /api/tenants/{tenant_id}/supporters/{supporter_id}/stats
getMyStats(tenantId: string, supporterId: string): Promise<SupporterStats>
```

**Test Cases:**
- [ ] Load personal statistics
- [ ] View sessions handled chart
- [ ] View average response time

---

## 🟢 Tenant User Features (Widget - Unchanged)

### Route: Backend `/widget/:widget_key`

**Features:**
- Chat with AI agent
- Upload files
- View chat history
- Escalate to human support

**No changes needed** - Already implemented in `widget.tsx`

---

## Testing Strategy

### Unit Testing
```typescript
// Example test for Admin Dashboard
describe('AdminDashboard', () => {
  it('should load dashboard stats', async () => {
    const stats = await getDashboardStats();
    expect(stats.tenants.total).toBeGreaterThan(0);
  });
});
```

### Integration Testing
```typescript
// Example test for role-based routing
describe('Role-based Routing', () => {
  it('should redirect admin to /admin/dashboard', () => {
    loginAs('admin');
    expect(window.location.pathname).toBe('/admin/dashboard');
  });
  
  it('should redirect supporter to /support', () => {
    loginAs('supporter');
    expect(window.location.pathname).toBe('/support');
  });
});
```

### Manual Testing Checklist

**Admin Testing:**
- [ ] Login as admin → redirects to `/admin/dashboard`
- [ ] Navigate to all admin pages
- [ ] Create/edit/delete tenant
- [ ] Create/edit/delete user
- [ ] View sessions and assign supporter
- [ ] Upload knowledge base document
- [ ] Manage escalations

**Supporter Testing:**
- [ ] Login as supporter → redirects to `/support`
- [ ] View assigned sessions
- [ ] Open chat room and send message
- [ ] Mark session as resolved
- [ ] View history
- [ ] Update profile

**Access Control Testing:**
- [ ] Supporter cannot access `/admin/*` routes
- [ ] Admin can access all routes
- [ ] Unauthenticated user redirects to login

---

## Frontend Delivery Plan

### Phase 1: Foundation (Week 1)
- Add React Router layout shells for `/admin`, `/support`, and auth; create ProtectedRoute/RoleGuard using existing session token.
- Implement role-based redirects after login (admin -> `/admin/dashboard`, supporter -> `/support`).
- Scaffold shared UI components: top nav/sidebar shell, table/list, form wizard container, empty/loading states.

### Phase 2: Admin Essentials (Week 2)
- Dashboard: fetch `/api/admin/stats`, render metric cards + charts, add 30s auto-refresh.
- Tenant Management: build 4-step create wizard, list with pagination/search, view/edit/delete, copy embed code.
- User Management: list/filter by role, create/edit/delete, change role, reset password action hook.
- Session Monitoring + Escalations: list/filter sessions, view details/chat history modal, assign supporter, end/resolve.

### Phase 3: Admin Advanced (Week 3)
- Knowledge Base: tenant/agent selector, upload (PDF/DOCX/TXT), list/delete, stats panel, ingest-from-chat action.
- Agent Management: list, create/edit (model, prompt, tools, active flag), reload cache action.
- Tool Management: list, create from base template, edit config/schema, deactivate, show agent usage.
- Settings: LLM settings, email/notification forms; basic validation and save confirmations.

### Phase 4: Supporter Workspace (Week 3-4)
- My Chats: list assigned sessions with status/unread chips and filters.
- Chat Room: history, send message, resolve with category + notes, user info pane, escalate back.
- History: resolved sessions list with email/date filters and transcript viewer.
- Profile & Stats: update profile/password/status/notifications; show personal stats (sessions handled, response time, CSAT).

### Phase 5: QA & Hardening
- Add integration tests for role-based routing/guards and critical flows (tenant create wizard, supporter chat resolve).
- Add unit tests for service calls/helpers; mock API adapters.
- Manual checklist: access control, upload flows, copy/embed, resolve/escalate, auto-refresh behavior.

### Acceptance Criteria
- All routes load with role-appropriate access; unauthorized routes redirect to login or home.
- Admin can create tenants via wizard, manage users, and assign/resolve escalations.
- Supporter can handle chats end-to-end (open, message, resolve with category) and view history.
- Knowledge base, agent, tool, and settings screens support create/update/delete with confirmations and error handling.
