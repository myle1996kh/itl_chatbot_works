# Escalation API Reference - Updated

## Overview

Updated escalation endpoints with improved validation, availability checking, and capacity management.

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

## Next Phase

The following enhancements are planned:

- [ ] Auto-escalation integration in chat flow
- [ ] WebSocket notifications for new escalations
- [ ] Escalation SLA tracking
- [ ] Staff availability calendar
- [ ] Escalation handoff between staff members
