# Supporter Chat Implementation Guide

**Phase**: Chat escalation integration (Phase 2 of escalation system)
**Status**: Planning - No auto-handle yet (manual workflow only)
**Last Updated**: 2025-11-13

---

## Overview

This document outlines the backend implementation tasks for supporter chat functionality. The system uses 3 session roles with NO automatic routing - explicit endpoints for each role.

---

## Architecture

```
Message Flow:

tenant_user
    ↓
POST /api/{tenant_id}/chat
    ↓ (Existing endpoint)
    ├─ Creates/updates session
    ├─ Saves user message (role='user', sender_user_id=tenant_user_uuid)
    ├─ Routes to SupervisorAgent (escalation detection)
    └─ Returns response

supporter (after assignment)
    ↓
POST /api/{tenant_id}/supporter-chat (NEW)
    ↓
    ├─ Validates session assigned to supporter
    ├─ Saves message (role='supporter', sender_user_id=supporter_uuid)
    ├─ NO agent processing (direct message)
    └─ Returns message_id + confirmation

admin
    ↓
GET /api/admin/tenants/{tenant_id}/escalations (Existing)
GET /api/admin/tenants/{tenant_id}/staff/available (Existing)
POST /api/admin/tenants/{tenant_id}/escalations/assign (Existing)
    ↓
    └─ Manage escalations manually
```

---

## Implementation Tasks

### Task 1: Create Supporter Chat Schema

**File**: `backend/src/schemas/supporter_chat.py` (NEW)

```python
# Define request/response schemas for supporter chat

SupporterChatRequest:
  - session_id: UUID
  - message: str
  - metadata: Optional[dict]

SupporterChatResponse:
  - success: bool
  - message_id: UUID
  - session_id: UUID
  - role: str = 'supporter'
  - sender_user_id: UUID
  - content: str
  - created_at: datetime
  - metadata: dict

SupporterSessionsResponse:
  - success: bool
  - total_sessions: int
  - active_sessions: int
  - sessions: List[{
      session_id: UUID
      tenant_id: UUID
      user_id: UUID
      escalation_status: str
      escalation_reason: Optional[str]
      assigned_user_id: UUID
      escalation_requested_at: datetime
      escalation_assigned_at: datetime
      message_count: int
      last_message_at: datetime
      created_at: datetime
    }]
```

**Checklist**:
- [ ] Request schema validates session_id (UUID)
- [ ] Request schema validates message (non-empty string)
- [ ] Response includes created message details
- [ ] Response includes metadata from request
- [ ] Sessions response includes pagination support

---

### Task 2: Implement Supporter Chat Endpoint

**File**: `backend/src/api/supporter.py` (NEW)

#### Endpoint 1: Get Supporter's Assigned Sessions

```python
@router.get("/{tenant_id}/supporters/{supporter_id}/sessions")
async def get_supporter_sessions(
    tenant_id: UUID,
    supporter_id: UUID,
    status: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(20),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Get all sessions assigned to a supporter.

    Only returns sessions where assigned_user_id == supporter_id
    Supporter can only see own sessions (current_user == supporter_id)
    Admin can see any supporter's sessions

    Response: SupporterSessionsResponse
    """
    # Validate authorization
    # Validate tenant access
    # Query sessions: escalation_status != 'none' AND assigned_user_id == supporter_id
    # Include message count
    # Return paginated results
```

**Validation Logic**:
```
1. Check if current_user is 'admin' OR current_user == supporter_id
   → If neither: return 403 Forbidden

2. Check if tenant exists
   → If not: return 404 Not Found

3. Check if supporter user exists and has role='supporter'
   → If not: return 404 Not Found

4. Query sessions:
   SELECT s.*, COUNT(m.message_id) as message_count
   FROM sessions s
   LEFT JOIN messages m ON s.session_id = m.session_id
   WHERE s.tenant_id = tenant_id
   AND s.assigned_user_id = supporter_id
   AND (status IS NULL OR s.escalation_status = status)
   ORDER BY s.escalation_assigned_at DESC
   LIMIT limit OFFSET skip
```

**Checklist**:
- [ ] Authorization: supporter sees own only, admin sees all
- [ ] Validates tenant exists
- [ ] Validates supporter is role='supporter'
- [ ] Returns only escalated sessions (NOT 'none')
- [ ] Includes message count per session
- [ ] Supports pagination (skip, limit)
- [ ] Supports status filtering (optional)
- [ ] Proper error responses (403, 404)

---

#### Endpoint 2: Supporter Send Message to Tenant

```python
@router.post("/{tenant_id}/supporter-chat")
async def supporter_send_message(
    tenant_id: UUID,
    request: SupporterChatRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Supporter sends direct message to tenant user in assigned session.

    - Message role = 'supporter'
    - sender_user_id = current_user (from JWT)
    - No agent/bot processing
    - Session must be in 'assigned' escalation status
    - Only assigned supporter can send

    Response: SupporterChatResponse
    """
    # 1. Validate tenant access
    # 2. Get session by session_id
    # 3. Validate session belongs to tenant
    # 4. Validate session.escalation_status == 'assigned'
    # 5. Validate current_user == session.assigned_user_id
    # 6. Create Message record
    # 7. Update session.last_message_at
    # 8. Return message response
```

**Validation Logic**:
```
1. Check current_tenant == tenant_id
   → If not: return 403 Forbidden

2. Get session by session_id + tenant_id
   → If not found: return 400 Bad Request (Session not found)

3. Check session.escalation_status == 'assigned'
   → If not: return 400 Bad Request (Session not assigned)

4. Check session.assigned_user_id == current_user
   → If not: return 400 Bad Request (Not assigned to you)

5. Get current_user from users table
   → Check user.role == 'supporter'
   → If not: return 403 Forbidden (Not a supporter)

6. Create Message:
   INSERT INTO messages (
       message_id,
       session_id,
       role,
       content,
       sender_user_id,
       timestamp,
       metadata
   ) VALUES (...)

7. Update session:
   UPDATE sessions
   SET last_message_at = NOW()
   WHERE session_id = session_id

8. Return SupporterChatResponse
```

**Checklist**:
- [ ] Validates tenant access (current_tenant == tenant_id)
- [ ] Validates session exists and belongs to tenant
- [ ] Validates session.escalation_status == 'assigned'
- [ ] Validates current_user is assigned (assigned_user_id match)
- [ ] Validates current_user has role='supporter'
- [ ] Creates message with role='supporter'
- [ ] Sets sender_user_id from JWT token
- [ ] Updates session.last_message_at
- [ ] Does NOT call SupervisorAgent (direct message only)
- [ ] Returns message details in response
- [ ] Proper error messages and status codes

---

### Task 3: Add Helper Service

**File**: `backend/src/services/supporter_service.py` (NEW)

**Methods**:
```python
class SupporterService:

    @staticmethod
    def get_assigned_sessions(
        db: Session,
        tenant_id: UUID,
        supporter_id: UUID,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        Query sessions assigned to supporter.
        Returns: {
            'total': int,
            'active': int,
            'sessions': [...]
        }
        """
        pass

    @staticmethod
    def send_supporter_message(
        db: Session,
        tenant_id: UUID,
        session_id: UUID,
        supporter_id: UUID,
        message: str,
        metadata: Optional[dict] = None,
    ) -> Message:
        """
        Create supporter message in session.
        Validates authorization before creating.
        Raises HTTPException if validation fails.
        Returns: Message object
        """
        pass

    @staticmethod
    def is_supporter_assigned(
        db: Session,
        session_id: UUID,
        supporter_id: UUID,
    ) -> bool:
        """Check if supporter is assigned to session."""
        pass

    @staticmethod
    def get_session_message_count(
        db: Session,
        session_id: UUID,
    ) -> int:
        """Get total message count for session."""
        pass
```

**Checklist**:
- [ ] Queries are optimized (use JOINs, not N+1)
- [ ] Proper error handling (raise HTTPException)
- [ ] Type hints on all methods
- [ ] Unit tests for each method
- [ ] Integration tests with database

---

### Task 4: Update Chat Schemas

**File**: `backend/src/schemas/chat.py` (MODIFY)

No changes needed if already supports sender_user_id. Verify:

```python
class ChatResponse:
    # Verify these fields exist:
    - message_id: UUID ✓
    - role: str ✓
    - sender_user_id: Optional[UUID] ✓
    - content: str ✓
    - created_at: datetime ✓
```

**Checklist**:
- [ ] ChatResponse includes message_id
- [ ] ChatResponse includes role field
- [ ] ChatResponse includes sender_user_id
- [ ] Schemas handle supporter messages correctly

---

### Task 5: Database Queries

**Query 1**: Get assigned sessions with message count
```sql
SELECT
  s.session_id,
  s.tenant_id,
  s.user_id,
  s.escalation_status,
  s.escalation_reason,
  s.assigned_user_id,
  s.escalation_requested_at,
  s.escalation_assigned_at,
  COUNT(DISTINCT m.message_id) as message_count,
  MAX(m.timestamp) as last_message_at,
  s.created_at
FROM sessions s
LEFT JOIN messages m ON s.session_id = m.session_id
WHERE s.tenant_id = $1
  AND s.assigned_user_id = $2
  AND s.escalation_status != 'none'
  AND ($3::VARCHAR IS NULL OR s.escalation_status = $3)
GROUP BY s.session_id
ORDER BY s.escalation_assigned_at DESC
LIMIT $4 OFFSET $5;
```

**Query 2**: Validate supporter assignment
```sql
SELECT s.session_id
FROM sessions s
WHERE s.session_id = $1
  AND s.tenant_id = $2
  AND s.assigned_user_id = $3
  AND s.escalation_status = 'assigned';
```

**Checklist**:
- [ ] Query 1 optimized with proper JOINs
- [ ] Query 1 includes message_count aggregation
- [ ] Query 2 validates all conditions
- [ ] Queries use parameterized inputs (prevent SQL injection)
- [ ] Create database indices if needed

---

### Task 6: Error Handling

**Status Codes & Messages**:

```python
# 400 Bad Request
- "Session not found"
- "Session is not assigned to you (assigned_user_id mismatch)"
- "Session escalation is not in 'assigned' status"
- "Message content cannot be empty"

# 403 Forbidden
- "You do not have access to this tenant"
- "Your user role is not 'supporter'"
- "Access denied to this session"

# 404 Not Found
- "Tenant not found"
- "Supporter not found"
- "Session not found"

# 500 Internal Server Error
- Database errors
- Unexpected exceptions (log and return generic message)
```

**Checklist**:
- [ ] All error cases covered
- [ ] Error messages are descriptive
- [ ] Status codes match HTTP standards
- [ ] Errors logged with context (tenant_id, user_id, etc.)

---

### Task 7: Authorization Middleware

**Verify**: Existing `get_current_user()` dependency extracts:
- `current_user` (user_id from JWT)
- User role from JWT (must be 'supporter' for supporter endpoints)
- User tenant from JWT

**Checklist**:
- [ ] JWT contains user_id
- [ ] JWT contains user role
- [ ] JWT contains tenant_id
- [ ] Dependency injection works for all endpoints
- [ ] Test with invalid/expired tokens

---

### Task 8: Logging & Monitoring

**Log Events**:
```python
# GET /{tenant_id}/supporters/{supporter_id}/sessions
logger.info(
    "supporter_sessions_retrieved",
    tenant_id=tenant_id,
    supporter_id=supporter_id,
    session_count=len(sessions),
    status=status,
)

# POST /{tenant_id}/supporter-chat
logger.info(
    "supporter_message_sent",
    tenant_id=tenant_id,
    session_id=session_id,
    supporter_id=current_user,
    message_length=len(message),
)

logger.error(
    "supporter_chat_error",
    tenant_id=tenant_id,
    session_id=session_id,
    error=str(e),
)
```

**Checklist**:
- [ ] Log successful operations
- [ ] Log authorization failures
- [ ] Log database errors
- [ ] Include context in logs (tenant_id, user_id, session_id)
- [ ] Use structured logging (structlog)

---

### Task 9: Testing

**Unit Tests** (`tests/unit/test_supporter_chat.py`):
- [ ] Test message creation with correct role
- [ ] Test authorization checks (only assigned supporter)
- [ ] Test session status validation
- [ ] Test message content validation
- [ ] Test error responses

**Integration Tests** (`tests/integration/test_supporter_chat.py`):
- [ ] Test complete flow: escalate → assign → send message
- [ ] Test get sessions endpoint
- [ ] Test database updates
- [ ] Test with real database

**End-to-End Tests** (`tests/e2e/test_escalation_flow.py`):
- [ ] Full escalation workflow
- [ ] Supporter response to tenant
- [ ] Session resolution

**Checklist**:
- [ ] Unit test coverage >80%
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] All error cases tested

---

### Task 10: Deployment

**Pre-Deployment**:
- [ ] Code review complete
- [ ] All tests passing
- [ ] Database migration (if schema changes)
- [ ] Backup created

**Deployment Checklist** (See ESCALATION_DEPLOYMENT_CHECKLIST.md):
- [ ] Migrate database (if needed)
- [ ] Deploy code
- [ ] Restart API server
- [ ] Run smoke tests
- [ ] Verify endpoints responding

**Post-Deployment**:
- [ ] Monitor logs for errors
- [ ] Verify message creation
- [ ] Check performance metrics
- [ ] Track supporter response times

---

## Development Order

1. **Schema** (Task 1)
2. **Service** (Task 3)
3. **API Endpoints** (Task 2)
4. **Error Handling** (Task 6)
5. **Logging** (Task 8)
6. **Tests** (Task 9)
7. **Database Queries** (Task 5) - Optimize based on tests
8. **Deployment** (Task 10)

---

## Future Enhancements (Phase 3)

These should NOT be implemented yet (keep it simple):

- [ ] Auto-escalation: Automatically assign to least-busy supporter
- [ ] Smart routing: Route messages based on sentiment/keywords
- [ ] Typing indicators: WebSocket for "supporter is typing..."
- [ ] Read receipts: Track if tenant read supporter messages
- [ ] Auto-responses: Auto-reply when no supporter available
- [ ] Message templates: Quick-response templates for supporters
- [ ] Sentiment analysis: Track conversation sentiment over time

---

## Notes

- **No Auto-Handle**: Current design is MANUAL only. Admin explicitly assigns supporters.
- **Direct Messages**: Supporter messages do NOT go through agent system.
- **Same Message Table**: Uses existing `messages` table with role discrimination.
- **No New Tables**: No database schema changes needed (only queries optimized).
- **Backward Compatible**: Existing chat endpoint unchanged.

---

## References

- ESCALATION_API_REFERENCE.md - API specifications
- ESCALATION_DEPLOYMENT_CHECKLIST.md - Deployment procedures
- ROLE_CORRECTION_FIX.md - Role naming (supporter vs staff)
- Chat API (`backend/src/api/chat.py`) - Reference implementation
