# Escalation API Reference - Updated

## Overview

Updated escalation endpoints with improved validation, availability checking, and capacity management.

---

## Session Role Assignment Rules (NEW)

**Background**: Sessions track conversation context with 3 participant roles. These roles determine who can view, send messages, and manage escalations.

### Session Participants (3 Roles)

| Session Role | User Type | Description | Can View | Can Send Messages | Permissions |
|--------------|-----------|-------------|----------|-------------------|-------------|
| **tenant_user** | Regular customer | The original user requesting help via chat | Own sessions only | Yes (via `/chat`) | View own messages, request escalation |
| **supporter** | Backend staff | Assigned human to handle escalation | Only assigned sessions | Yes (via `/supporter-chat`) | Send support messages, resolve escalation |
| **admin** | System admin | Tenant administrator | All sessions | Yes (optional) | Full session management, view all, assign staff |

### Session Ownership & Access Control

```
Session Created:
├─ user_id = tenant_user_uuid (who initiated)
├─ assigned_user_id = NULL (not yet assigned)
└─ escalation_status = 'none' (no escalation yet)

After Escalation Request:
├─ user_id = tenant_user_uuid (unchanged)
├─ assigned_user_id = NULL (pending assignment)
├─ escalation_status = 'pending' (waiting for staff)
└─ Access: tenant_user (read only), admin (full)

After Staff Assignment:
├─ user_id = tenant_user_uuid (unchanged)
├─ assigned_user_id = supporter_uuid (assigned staff)
├─ escalation_status = 'assigned' (active escalation)
└─ Access: tenant_user (read/write), supporter (read/write), admin (full)

After Resolution:
├─ user_id = tenant_user_uuid (unchanged)
├─ assigned_user_id = supporter_uuid (was assigned)
├─ escalation_status = 'resolved' (closed)
└─ Access: tenant_user (read only), supporter (read only), admin (full)
```

### Message Flow by Role

```
Timeline of a session with escalation:

10:30 - tenant_user sends message
        Message(role='user', sender_user_id=tenant_user_uuid)
        ↓
10:31 - bot responds
        Message(role='assistant', sender_user_id=NULL)
        ↓
10:35 - tenant_user escalates
        Session.escalation_status = 'pending'
        Session.escalation_requested_at = 10:35
        ↓
10:40 - admin assigns supporter
        Session.escalation_status = 'assigned'
        Session.assigned_user_id = supporter_uuid
        Session.escalation_assigned_at = 10:40
        ↓
10:45 - supporter sends first response
        Message(role='supporter', sender_user_id=supporter_uuid)
        ↓
10:50 - tenant_user replies to supporter
        Message(role='user', sender_user_id=tenant_user_uuid)
        ↓
11:00 - supporter resolves
        Session.escalation_status = 'resolved'
```

### No Auto-Handle (Manual Workflow)

**Current Design**: NO automatic role assignment or message routing.
- Escalations are **manually assigned** by admin
- Messages do NOT auto-route based on role
- Each role sends to explicit endpoint (`/chat` for user, `/supporter-chat` for supporter)
- **Future Enhancement**: Can add auto-assignment rules, smart routing, auto-responses (Phase 2)

### Access Control Logic

```
GET session/{session_id}:
  if user_role == 'admin':
    → Can always view
  elif user_role == 'supporter':
    → Can view if assigned_user_id == current_user_id
  elif user_role == 'tenant_user':
    → Can view if user_id == current_user_id
  else:
    → Forbidden

POST /chat (tenant_user message):
  if session.user_id == current_user_id:
    → Allowed (create/update session)
  else:
    → Forbidden

POST /supporter-chat (supporter message):
  if session.assigned_user_id == current_user_id:
    → Allowed (must be assigned)
  elif session.escalation_status != 'assigned':
    → Forbidden (session not in escalation)
  else:
    → Forbidden

POST /admin/escalations/assign (admin only):
  if current_user_role == 'admin' and current_user_tenant == session.tenant_id:
    → Allowed (assign supporter)
  else:
    → Forbidden
```

---

## Authentication

All escalation endpoints require:
- **Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Role**: `admin` (for management endpoints)
- **Tenant Access**: User must have access to the specified tenant

---

## Endpoints

### 1. Auto-Escalation Detection

Analyze a message for escalation keywords.

```http
POST /api/admin/escalations/detect
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "message": "I need to speak to a human immediately!",
  "keywords": ["urgent", "critical"]  // optional custom keywords
}
```

**Response** (200 OK):
```json
{
  "should_escalate": true,
  "detected_keywords": ["immediately", "human"],
  "confidence": 0.67,
  "reason": "Detected 2 escalation keyword(s): immediately, human"
}
```

**Response** (500):
```json
{
  "detail": "Failed to detect auto-escalation: <error>"
}
```

---

### 2. Manual Escalation Request

Escalate a chat session to pending status.

```http
POST /api/admin/tenants/{tenant_id}/escalations
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "User frustrated with bot response",
  "auto_detected": false,
  "keywords": []
}
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID

**Request Body**:
```typescript
{
  session_id: string          // UUID of chat session
  reason: string              // Why escalation is needed
  auto_detected?: boolean     // Was auto-detected? (default: false)
  keywords?: string[]         // Keywords that triggered detection
}
```

**Response** (201 Created):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "user-uuid-123",
  "escalation_status": "pending",
  "escalation_reason": "User frustrated with bot response",
  "assigned_user_id": null,
  "escalation_requested_at": "2025-11-13T10:30:00Z",
  "escalation_assigned_at": null,
  "created_at": "2025-11-13T10:29:00Z"
}
```

**Response** (400):
```json
{
  "detail": "Session not found" | "Session already escalated with status: assigned"
}
```

---

### 3. Assign Staff to Escalation

Assign an available staff member to a pending escalation.

```http
POST /api/admin/tenants/{tenant_id}/escalations/assign
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "550e8400-e29b-41d4-a716-446655440111"
}
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID

**Request Body**:
```typescript
{
  session_id: string    // UUID of escalated session
  user_id: string       // UUID of staff user to assign
}
```

**Response** (200 OK):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "user-uuid-123",
  "escalation_status": "assigned",
  "escalation_reason": "User frustrated with bot response",
  "assigned_user_id": "550e8400-e29b-41d4-a716-446655440111",
  "escalation_requested_at": "2025-11-13T10:30:00Z",
  "escalation_assigned_at": "2025-11-13T10:35:00Z",
  "created_at": "2025-11-13T10:29:00Z",
  "staff_current_sessions": 2,
  "staff_max_sessions": 5
}
```

**Response** (400):
```json
{
  "detail": "Session not found"
          | "Session cannot be assigned (status: resolved)"
          | "User not found, not staff, or does not belong to this tenant"
          | "Staff member not available (status: offline)"
          | "Staff member at capacity (5/5). Cannot assign more sessions."
}
```

---

### 4. Resolve Escalation

Mark an escalation as resolved and free up staff capacity.

```http
POST /api/admin/tenants/{tenant_id}/escalations/resolve
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "resolution_notes": "Issue resolved, user satisfied"
}
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID

**Request Body**:
```typescript
{
  session_id: string              // UUID of escalated session
  resolution_notes?: string       // Optional resolution summary
}
```

**Response** (200 OK):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "user-uuid-123",
  "escalation_status": "resolved",
  "escalation_reason": "User frustrated with bot response",
  "assigned_user_id": "550e8400-e29b-41d4-a716-446655440111",
  "escalation_requested_at": "2025-11-13T10:30:00Z",
  "escalation_assigned_at": "2025-11-13T10:35:00Z",
  "created_at": "2025-11-13T10:29:00Z"
}
```

**Response** (400):
```json
{
  "detail": "Session not found"
          | "Session is not escalated"
}
```

---

### 5. Get Escalation Queue

Retrieve all escalations for a tenant with optional status filtering.

```http
GET /api/admin/tenants/{tenant_id}/escalations?status=pending
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID

**Query Parameters**:
- `status` (optional): Filter by status - `pending`, `assigned`, or `resolved`

**Response** (200 OK):
```json
{
  "pending_count": 3,
  "assigned_count": 5,
  "resolved_count": 12,
  "escalations": [
    {
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "user_id": "user-uuid-123",
      "escalation_status": "pending",
      "escalation_reason": "User frustrated",
      "assigned_user_id": null,
      "escalation_requested_at": "2025-11-13T10:30:00Z",
      "escalation_assigned_at": null,
      "created_at": "2025-11-13T10:29:00Z"
    }
  ]
}
```

---

### 6. Get All Staff Members

Get all staff users for a tenant with availability information.

```http
GET /api/admin/tenants/{tenant_id}/staff
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID

**Response** (200 OK):
```json
{
  "success": true,
  "staff": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440111",
      "email": "john@example.com",
      "username": "john_supporter",
      "display_name": "John Smith",
      "supporter_status": "online",
      "max_concurrent_sessions": 5,
      "current_sessions_count": 2,
      "available": true,
      "created_at": "2025-11-01T08:00:00Z"
    },
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440222",
      "email": "jane@example.com",
      "username": "jane_supporter",
      "display_name": "Jane Doe",
      "supporter_status": "offline",
      "max_concurrent_sessions": 5,
      "current_sessions_count": 0,
      "available": false,
      "created_at": "2025-11-02T09:00:00Z"
    }
  ],
  "total": 2
}
```

**Fields**:
- `available`: `true` if `supporter_status` is 'online'/'available' AND `current_sessions_count < max_concurrent_sessions`

---

### 7. Get Available Staff (NEW)

Get staff members currently available for assignment, sorted by least busy.

```http
GET /api/admin/tenants/{tenant_id}/staff/available
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID

**Response** (200 OK):
```json
{
  "success": true,
  "available_staff": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440111",
      "email": "john@example.com",
      "username": "john_supporter",
      "display_name": "John Smith",
      "supporter_status": "online",
      "max_concurrent_sessions": 5,
      "current_sessions_count": 1,
      "capacity_percentage": 20,
      "created_at": "2025-11-01T08:00:00Z"
    },
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440333",
      "email": "bob@example.com",
      "username": "bob_supporter",
      "display_name": "Bob Johnson",
      "supporter_status": "online",
      "max_concurrent_sessions": 5,
      "current_sessions_count": 3,
      "capacity_percentage": 60,
      "created_at": "2025-11-03T10:00:00Z"
    }
  ],
  "total": 2
}
```

**Filtering**:
- Returns only staff with `supporter_status` = 'online' or 'available'
- Returns only staff with `current_sessions_count < max_concurrent_sessions`
- **Sorted by**: `current_sessions_count` (ascending) - least busy first
- **Capacity percentage**: `(current_sessions_count / max_concurrent_sessions) * 100`

**Use Case**: Admin can assign to the least busy available staff (first in list).

---

## Data Models

### EscalationResponse
```typescript
{
  session_id: string
  tenant_id: string
  user_id: string
  escalation_status: 'none' | 'pending' | 'assigned' | 'resolved'
  escalation_reason?: string
  assigned_user_id?: string
  escalation_requested_at?: DateTime
  escalation_assigned_at?: DateTime
  created_at: DateTime

  // Returned on successful assignment
  staff_current_sessions?: number
  staff_max_sessions?: number
}
```

### EscalationQueueResponse
```typescript
{
  pending_count: number
  assigned_count: number
  resolved_count: number
  escalations: EscalationResponse[]
}
```

### StaffMemberResponse
```typescript
{
  user_id: string
  email: string
  username: string
  display_name?: string
  supporter_status: 'online' | 'offline' | 'busy' | 'away'
  max_concurrent_sessions: number
  current_sessions_count: number
  available: boolean
  capacity_percentage?: number
  created_at?: DateTime
}
```

---

## Status State Machine

```
Session states:

    Created
       ↓
    'none' (no escalation)
       ↓
   (User requests support)
       ↓
    'pending' (awaiting assignment)
       ↓
   (Admin assigns staff)
       ↓
    'assigned' (active support)
       ↓
   (Support completed)
       ↓
    'resolved' (closed)
```

**Transitions**:
- `none` → `pending`: User requests escalation
- `pending` → `assigned`: Admin assigns staff
- `pending` → `resolved`: Direct resolve without assignment
- `assigned` → `resolved`: Staff resolves escalation
- `assigned` → `pending`: Reassign to different staff (allowed)

---

## Error Responses

All errors return standard HTTP status codes with detail messages:

```json
{
  "detail": "Error description"
}
```

**Common Errors**:
- `400 Bad Request`: Invalid input, session not found, user not staff, etc.
- `403 Forbidden`: User not authorized for tenant
- `404 Not Found`: Tenant not found
- `410 Gone`: Deprecated endpoint (supporter CRUD endpoints)
- `500 Internal Server Error`: Unexpected server error

---

## Usage Examples

### Example 1: Complete Escalation Flow

```bash
# 1. User requests escalation
curl -X POST http://localhost:8000/api/admin/tenants/tenant-123/escalations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-456",
    "reason": "User frustrated with bot",
    "auto_detected": false
  }'

# Response: escalation_status = "pending"

# 2. Admin gets available staff
curl -X GET http://localhost:8000/api/admin/tenants/tenant-123/staff/available \
  -H "Authorization: Bearer TOKEN"

# Response: [John (1/5 sessions), Bob (3/5 sessions)]

# 3. Admin assigns least busy staff
curl -X POST http://localhost:8000/api/admin/tenants/tenant-123/escalations/assign \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-456",
    "user_id": "john-uuid"
  }'

# Response: escalation_status = "assigned", john's counter = 2/5

# 4. Admin resolves when done
curl -X POST http://localhost:8000/api/admin/tenants/tenant-123/escalations/resolve \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-456",
    "resolution_notes": "Issue resolved"
  }'

# Response: escalation_status = "resolved", john's counter = 1/5
```

### Example 2: Auto-Escalation Detection

```bash
curl -X POST http://localhost:8000/api/admin/escalations/detect \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need to speak to a human immediately! This is urgent!"
  }'

# Response:
# {
#   "should_escalate": true,
#   "detected_keywords": ["human", "immediately", "urgent"],
#   "confidence": 1.0,
#   "reason": "Detected 3 escalation keyword(s): human, immediately, urgent"
# }
```

---

## Deprecations

The following endpoints return `410 Gone`:

```http
POST   /api/tenants/{tenant_id}/supporters
PUT    /api/tenants/{tenant_id}/supporters/{supporter_id}
DELETE /api/tenants/{tenant_id}/supporters/{supporter_id}
```

**Message**: `"Supporter API deprecated. Use staff users."`

**Migration**: Use the User model with `role='staff'` instead of the Supporter model.

---

## Availability Status Values

Staff members can have the following statuses:

- `online`: Available and actively working
- `offline`: Not working
- `busy`: Working but can't take new sessions
- `away`: Temporarily away

**For Assignment**: Only `online` or `available` status qualifies as assignable.

---

## Capacity Management

Staff capacity is tracked with:
- `max_concurrent_sessions`: Maximum sessions a staff member can handle (default: 5)
- `current_sessions_count`: Currently active escalations assigned to this staff

**Example**:
```json
{
  "max_concurrent_sessions": 5,
  "current_sessions_count": 2,
  "capacity_percentage": 40
}
```

When assigning:
- Check: `current_sessions_count < max_concurrent_sessions`
- Increment on assignment
- Decrement on resolution

---

## Best Practices

1. **Always check available staff before assigning**
   - Use `/staff/available` endpoint
   - Returns staff sorted by load (least busy first)

2. **Handle capacity errors gracefully**
   - Response will indicate staff at capacity
   - Show "no available staff" message to user
   - Queue escalation or handle differently

3. **Track assignment lifecycle**
   - Monitor escalation_status state changes
   - Ensure resolution releases capacity

4. **Monitor escalation metrics**
   - Track pending_count (SLA)
   - Track resolution time
   - Monitor staff utilization

---

## Supporter Chat APIs (NEW)

### 8. Get Supporter's Assigned Sessions

Get all sessions currently assigned to a supporter (their workload).

```http
GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions
Authorization: Bearer <JWT_TOKEN>
```

**Path Parameters**:
- `tenant_id` (UUID): The tenant ID
- `supporter_id` (UUID): The supporter user ID

**Query Parameters**:
- `status` (optional): Filter by escalation status - `pending`, `assigned`, `resolved`
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Pagination limit (default: 20)

**Response** (200 OK):
```json
{
  "success": true,
  "total_sessions": 3,
  "active_sessions": 2,
  "sessions": [
    {
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "user_id": "user-uuid-123",
      "escalation_status": "assigned",
      "escalation_reason": "User frustrated with bot",
      "assigned_user_id": "550e8400-e29b-41d4-a716-446655440111",
      "escalation_requested_at": "2025-11-13T10:30:00Z",
      "escalation_assigned_at": "2025-11-13T10:35:00Z",
      "message_count": 5,
      "last_message_at": "2025-11-13T10:45:00Z",
      "created_at": "2025-11-13T10:29:00Z"
    }
  ]
}
```

**Checklist**:
- [ ] Only returns sessions assigned to this supporter (`assigned_user_id = supporter_id`)
- [ ] Includes message count for workload tracking
- [ ] Includes last message timestamp for activity tracking
- [ ] Paginable for large workloads
- [ ] Can filter by escalation status

---

### 9. Supporter Send Message to Tenant User (Chat Handler)

Supporter responds to tenant user in an assigned session. Works like regular `/chat` but:
- Message role = `'supporter'` (not `'user'`)
- `sender_user_id` = supporter's `user_id`
- No bot/agent processing (direct message to conversation)
- Updates session's `escalation_assigned_at` timestamp

```http
POST /api/tenants/{tenant_id}/supporter-chat
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "I understand the issue. Let me help you with that.",
  "metadata": {
    "sender_type": "supporter"
  }
}
```

**Headers**:
- `Authorization: Bearer <SUPPORTER_JWT_TOKEN>` (supporter user's token)
- `Content-Type: application/json`

**Request Body**:
```typescript
{
  session_id: string          // UUID of assigned session
  message: string             // Message content from supporter
  metadata?: {                // Optional metadata
    sender_type?: "supporter" // Mark as from supporter
    [key: string]: any
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message_id": "550e8400-e29b-41d4-a716-446655440222",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "supporter",
  "sender_user_id": "550e8400-e29b-41d4-a716-446655440111",
  "content": "I understand the issue. Let me help you with that.",
  "created_at": "2025-11-13T10:46:00Z",
  "metadata": {
    "sender_type": "supporter"
  }
}
```

**Response** (400 Bad Request):
```json
{
  "detail": "Session not found"
          | "Session is not assigned to you (assigned_user_id mismatch)"
          | "Session escalation is not in 'assigned' status"
          | "Unauthorized: Only assigned supporter can send messages"
}
```

**Response** (403 Forbidden):
```json
{
  "detail": "You do not have access to this tenant"
          | "Your user role is not 'supporter'"
}
```

**Behavior**:
1. Validates supporter is assigned to session
2. Validates supporter belongs to correct tenant
3. Creates Message record with:
   - `role = 'supporter'`
   - `sender_user_id = supporter_user_id` (from JWT)
   - `content = message`
   - `session_id = session_id`
4. Updates session's `last_message_at` timestamp
5. Does NOT trigger SupervisorAgent (direct message)
6. Returns created message details

**Checklist**:
- [ ] Only assigned supporter can send messages to their sessions
- [ ] Message role = 'supporter' (not 'user' or 'assistant')
- [ ] sender_user_id = supporter's user_id from JWT
- [ ] Session must be in 'assigned' escalation status
- [ ] No bot/agent response (direct conversation)
- [ ] Updates session's last_message_at
- [ ] Proper authorization checks (tenant + role)

---

## Message Role Types

The `Message.role` field supports 5 role types:

| Role | Source | Use Case |
|------|--------|----------|
| `'user'` | Tenant user | Regular user questions in `/chat` endpoint |
| `'assistant'` | Bot/Agent | Automated responses from SupervisorAgent or DomainAgents |
| `'system'` | System | Internal system messages, notifications |
| `'supporter'` | Backend staff | Human supporter responses via `/supporter-chat` |
| `'admin'` | Administrator | Admin messages or system maintenance notes |

**Message Tracking**:
- User & Supporter messages: `sender_user_id` = originating user ID (from users table)
- Bot/System messages: `sender_user_id` = NULL
- All messages: `timestamp` = creation time for chronological ordering

**Example Query** (Get conversation history with roles):
```sql
SELECT
  message_id,
  role,
  content,
  sender_user_id,
  timestamp
FROM messages
WHERE session_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY timestamp ASC;

-- Result shows complete conversation with speaker identification:
-- message_id | role      | content | sender_user_id | timestamp
-- ... | user      | Hi, help! | user-uuid-1 | 10:30
-- ... | assistant | Sure! | NULL | 10:31
-- ... | user      | It's still broken | user-uuid-1 | 10:35
-- ... | supporter | I'll help now | supporter-uuid | 10:40
```

---

---

## Support Labels (For Tracking Issues)

When reporting issues/tasks related to these endpoints, use labels to track patterns:

- `[ERROR]` - Product bugs (endpoint crashes, data inconsistent)
- `[SLOW]` - Performance issues (slow queries, timeout)
- `[AUTH]` - Authorization failures (access denied, role issues)
- `[UNCLEAR]` - Ambiguous requirements (spec conflicts, edge cases)
- `[GUIDELINE]` - Code quality (missing logs, type hints, patterns)
- `[TESTING]` - Test coverage gaps
- `[SCHEMA]` - Database optimization needed
- `[FEATURE]` - Enhancement requests for future

**Example**: `"[SLOW] GET /supporters/{id}/sessions times out with 1000+ results"`

See SUPPORT_LABELS.md for detailed guidance on tracking supporter workload.

---

## Next Phase

The following enhancements are planned:

- [ ] Auto-escalation integration in chat flow
- [ ] WebSocket notifications for new escalations
- [ ] Escalation SLA tracking
- [ ] Staff availability calendar
- [ ] Escalation handoff between staff members
- [ ] Supporter message typing indicators
- [ ] Message read/delivery status tracking
