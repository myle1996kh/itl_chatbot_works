# API Contracts - Backend

**Generated:** 2025-11-26
**Part:** Backend API
**Base URL:** `/api`

## Overview

The backend exposes RESTful API endpoints organized by domain. Authentication uses JWT tokens (RS256). All endpoints support JSON request/response formats.

## API Organization

### Public Endpoints
- **Public Widgets** (`/api/public/widgets/*`) - Unauthenticated widget access
- **Chat** (`/api/{tenant_id}/chat`) - Main chat endpoint

### Authenticated Endpoints
- **Authentication** (`/api/auth/*`) - User login, registration, management
- **Sessions** (`/api/{tenant_id}/session`) - Session management
- **Chat Users** (`/api/{tenant_id}/chat-users/*`) - End user management
- **Supporter** (`/api/{tenant_id}/supporter/*`) - Support staff interface

### Admin Endpoints (`/api/admin/*`)
- **Agents** - Agent configuration management
- **Tools** - Tool definition and configuration
- **Tenants** - Tenant management and settings
- **Knowledge** - Document upload and RAG management
- **Sessions** - Session monitoring and management
- **Escalation** - Human escalation workflow
- **Widgets** - Widget configuration per tenant

## Endpoint Categories

### 1. Chat & Messaging

#### POST `/api/{tenant_id}/chat`
**Purpose:** Send chat message and get agent response
**Authentication:** JWT or Widget token
**Request Body:**
```json
{
  "session_id": "uuid",
  "message": "string",
  "user_id": "uuid"
}
```
**Response:** Streaming SSE or JSON with agent response

#### GET `/api/{tenant_id}/session`
**Purpose:** List user sessions
**Authentication:** JWT
**Query Params:** `user_id`, `status`, `limit`

### 2. Authentication (`/api/auth/*`)

#### POST `/api/auth/login`
**Purpose:** User authentication
**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```
**Response:** JWT token + user data

#### POST `/api/auth/register`
**Purpose:** Create new user account
**Request Body:** User registration data

#### GET `/api/auth/users`
**Purpose:** List system users (admin only)

### 3. Admin - Agents (`/api/admin/agents/*`)

#### GET `/api/admin/agents`
**Purpose:** List all agent configurations
**Response:** Array of agent configs with tools

#### POST `/api/admin/agents`
**Purpose:** Create new agent configuration
**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "system_prompt": "string",
  "output_format_id": "uuid",
  "tool_ids": ["uuid"]
}
```

#### PUT `/api/admin/agents/{agent_id}`
**Purpose:** Update agent configuration

#### POST `/api/admin/agents/reload-cache`
**Purpose:** Reload agent cache from database

### 4. Admin - Tools (`/api/admin/tools/*`)

#### GET `/api/admin/tools`
**Purpose:** List all tool configurations

#### POST `/api/admin/tools`
**Purpose:** Create new tool configuration
**Request Body:**
```json
{
  "base_tool_id": "uuid",
  "name": "string",
  "config": {},
  "input_schema": {}
}
```

#### PUT `/api/admin/tools/{tool_id}`
**Purpose:** Update tool configuration

### 5. Admin - Knowledge Base (`/api/admin/knowledge/*`)

#### POST `/api/admin/knowledge/upload`
**Purpose:** Upload documents for RAG
**Content-Type:** `multipart/form-data`
**Fields:**
- `file`: Document file (PDF, DOCX)
- `tenant_id`: Target tenant
- `metadata`: Optional JSON metadata

#### POST `/api/admin/knowledge/ingest`
**Purpose:** Trigger document embedding process
**Request Body:**
```json
{
  "tenant_id": "uuid",
  "document_ids": ["uuid"]
}
```

#### GET `/api/admin/knowledge/stats`
**Purpose:** Get knowledge base statistics per tenant

#### DELETE `/api/admin/knowledge/documents`
**Purpose:** Delete documents from knowledge base

### 6. Admin - Tenants (`/api/admin/tenants/*`)

#### GET `/api/admin/tenants`
**Purpose:** List all tenants

#### POST `/api/admin/tenants`
**Purpose:** Create new tenant
**Request Body:**
```json
{
  "name": "string",
  "subdomain": "string",
  "settings": {}
}
```

#### PUT `/api/admin/tenants/{tenant_id}`
**Purpose:** Update tenant configuration

#### GET `/api/admin/tenants/{tenant_id}/permissions`
**Purpose:** Get tenant agent/tool permissions

#### PUT `/api/admin/tenants/{tenant_id}/permissions`
**Purpose:** Update tenant permissions

### 7. Admin - Widgets (`/api/admin/widgets/*`)

#### GET `/api/admin/widgets/{tenant_id}`
**Purpose:** Get widget configuration for tenant

#### PUT `/api/admin/widgets/{tenant_id}`
**Purpose:** Update widget configuration
**Request Body:**
```json
{
  "primary_color": "string",
  "welcome_message": "string",
  "position": "string",
  "enabled": boolean
}
```

### 8. Admin - Escalation (`/api/admin/escalation/*`)

#### GET `/api/admin/escalation/queue`
**Purpose:** Get escalation queue (pending human intervention)

#### POST `/api/admin/escalation/{session_id}/escalate`
**Purpose:** Manually escalate session to human

#### POST `/api/admin/escalation/{session_id}/assign`
**Purpose:** Assign supporter to escalated session

#### POST `/api/admin/escalation/{session_id}/resolve`
**Purpose:** Mark escalation as resolved

#### GET `/api/admin/escalation/staff`
**Purpose:** List available support staff

#### POST `/api/admin/escalation/staff`
**Purpose:** Create supporter account

### 9. Supporter Interface (`/api/{tenant_id}/supporter/*`)

#### GET `/api/{tenant_id}/supporter/sessions`
**Purpose:** Get assigned sessions for logged-in supporter

#### POST `/api/{tenant_id}/supporter/message`
**Purpose:** Send message as supporter in escalated session
**Request Body:**
```json
{
  "session_id": "uuid",
  "message": "string"
}
```

### 10. Public Widgets (`/api/public/widgets/*`)

#### GET `/api/public/widgets/{tenant_id}/config`
**Purpose:** Get public widget configuration (unauthenticated)
**Response:** Widget styling and settings

#### POST `/api/public/widgets/{tenant_id}/chat`
**Purpose:** Public chat endpoint for embedded widgets
**Authentication:** Widget token (auto-generated)

## Authentication

### JWT Authentication
- **Header:** `Authorization: Bearer <token>`
- **Algorithm:** RS256 (RSA with SHA-256)
- **Claims:** user_id, email, role, tenant_id, exp

### Widget Authentication
- **Auto-generated:** Widget tokens created per session
- **Scope:** Limited to chat endpoint only
- **Validation:** Tenant-specific token validation

## Error Responses

### Standard Error Format
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Rate Limiting

Rate limits configured per tenant:
- **Default:** 60 requests/minute
- **Burst:** 100 requests/minute
- **Headers:**
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Multi-Tenancy

All endpoints (except admin) are tenant-scoped:
- Path parameter: `{tenant_id}`
- Data isolation: All queries filtered by tenant_id
- Permissions: Agent/tool access controlled per tenant

## Integration Points

### Frontend → Backend
- REST API calls over HTTPS
- WebSocket for real-time chat updates
- JWT token in Authorization header

### External Systems → Backend
- Widget embedding via public endpoints
- Webhook callbacks for external tools
- OAuth integration for auth providers
