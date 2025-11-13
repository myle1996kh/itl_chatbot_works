# Escalation System - Comprehensive Analysis & Issues Found

## Executive Summary

The escalation system has **7 critical issues** preventing "Assign to Human" from working properly. Issues span models, service logic, API contracts, and chat flow integration.

---

## ISSUE #1: ChatSession user_id Type Mismatch (CRITICAL)

### Problem
```python
# Current in models/session.py
user_id = Column(String(255), nullable=False)  # ❌ String type!

# Should be UUID FK like assigned_user_id
assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
```

### Impact
- Can't reliably join session to users for escalation lookup
- Inconsistent with assigned_user_id which is proper UUID FK
- String comparison issues in queries

### Fix
```python
# Change to:
user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
```

### Migration Needed
Yes - requires database migration to convert existing String UUIDs to UUID type.

---

## ISSUE #2: No Role-Based Escalation Logic (CRITICAL)

### Problem
Current role system has 3 roles:
- `tenant_user` - Regular users (can't escalate)
- `staff` - Supporters (should handle escalations)
- `admin` - Admins (manage escalations)

But escalation flow doesn't distinguish behavior by role:

```python
# In escalation.py, any admin can escalate any session
@require_admin_role  # ❌ Should also check user role
async def escalate_session(...):
```

### Missing Behaviors
1. **Regular User**: Should see "Talk to Human" button in chat UI
2. **Staff User**: Should see escalation queue dashboard
3. **Admin User**: Full escalation management + reporting

### Current Code Gap
- `ChatSession.user_id` is just string ID from JWT, not FK to users table
- Can't determine if user is tenant_user/staff/admin in session context
- No role-based response filtering

### Fix Strategy
1. Make `ChatSession.user_id` proper UUID FK to `users.user_id`
2. Add relationship: `session.user = relationship("User")`
3. Use role to control UI and API visibility

---

## ISSUE #3: Missing Escalation Trigger in Chat Flow (CRITICAL)

### Problem
Chat endpoint has no integration with escalation:

```python
# In api/chat.py
@router.post("/{tenant_id}/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, ...):
    # Flow:
    # 1. Save user message
    # 2. Route through SupervisorAgent  ← Auto-escalation could go here
    # 3. Save assistant response
    # ❌ NO ESCALATION DETECTION!
```

### Current ChatRequest Schema
```python
# In schemas/chat.py (inferred)
class ChatRequest(BaseModel):
    session_id: Optional[str]
    message: str
    user_id: str
    agent_name: Optional[str]
    metadata: Optional[Dict[str, Any]]

    # ❌ Missing:
    # - escalate_requested: bool (for "Talk to Human" button)
    # - auto_escalation_check: bool (enable auto-detection)
```

### Missing Response Fields
```python
# In schemas/chat.py (inferred)
class ChatResponse(BaseModel):
    # ... existing fields ...

    # ❌ Missing escalation info:
    # - escalation_status: Optional[str]
    # - auto_escalation_detected: Optional[bool]
    # - assigned_supporter: Optional[str]
    # - escalation_suggestion: Optional[str]
```

### Fix Strategy
1. Add escalation request fields to `ChatRequest`
2. Call `escalation_service.detect_auto_escalation()` after message save
3. Trigger escalation if requested or auto-detected
4. Return escalation status in `ChatResponse`

---

## ISSUE #4: No Staff Availability Checking (MAJOR)

### Problem
Escalation service assigns without checking capacity:

```python
# In escalation_service.py
def assign_user(db, session_id, tenant_id, user_id):
    # Gets user...
    user = db.query(User).filter(
        User.user_id == user_id,
        User.tenant_id == tenant_id,
        User.role == 'staff'
    ).first()

    # ❌ No checks for:
    # - user.current_sessions_count >= user.max_concurrent_sessions
    # - user.supporter_status (online/offline/busy/away)

    # Assigns immediately
    session.assigned_user_id = user_id
    session.escalation_status = 'assigned'
```

### Missing Fields Not Used
```python
class User(Base):
    supporter_status = Column(String(50), default='offline')  # ❌ Never checked
    max_concurrent_sessions = Column(Integer, default=5)     # ❌ Never checked
    current_sessions_count = Column(Integer, default=0)      # ❌ Never updated!
```

### Impact
- Staff members get overloaded with sessions
- Can't track staff availability
- No load balancing

### Fix Strategy
1. Add availability check before assignment:
```python
def assign_user(...):
    if user.current_sessions_count >= user.max_concurrent_sessions:
        return {"success": False, "error": "Staff member at capacity"}
    if user.supporter_status not in ['online']:
        return {"success": False, "error": "Staff member not online"}
```

2. Increment when assigned, decrement when resolved:
```python
session.assigned_user_id = user_id
user.current_sessions_count += 1  # Track capacity
session.escalation_status = 'assigned'
```

3. Add helper function to find available staff:
```python
def find_available_staff(db, tenant_id):
    """Return staff with capacity and online status."""
    return db.query(User).filter(
        User.tenant_id == tenant_id,
        User.role == 'staff',
        User.supporter_status == 'online',
        User.current_sessions_count < User.max_concurrent_sessions
    ).order_by(User.current_sessions_count).all()
```

---

## ISSUE #5: Message Model Lacks Sender Validation (MAJOR)

### Problem
Message sender tracking is weak:

```python
# In models/message.py
class Message(Base):
    role = Column(String(50))  # 'user', 'assistant', 'system', 'supporter'
    sender_user_id = Column(UUID(as_uuid=True), FK("users.user_id"), nullable=True)

    # ❌ Problems:
    # 1. role='supporter' but sender_user_id nullable (should be required for supporter)
    # 2. No constraint to ensure sender_user_id.role == 'staff'
    # 3. Can have role='supporter' with null sender_user_id
```

### Current Flow Gap
When staff responds to escalated session:
1. Message created with role='supporter'
2. sender_user_id should be the staff user UUID
3. But schema allows nullable sender_user_id

### Fix Strategy
1. Make sender_user_id required when role='supporter'
2. Add validation in service layer:
```python
def add_supporter_message(db, session_id, user_id, content):
    # Verify user is staff
    user = db.query(User).filter(
        User.user_id == user_id,
        User.role == 'staff'
    ).first()
    if not user:
        raise ValueError("Sender must be staff user")

    message = Message(
        session_id=session_id,
        role='supporter',
        content=content,
        sender_user_id=user_id  # Always set for supporter messages
    )
```

---

## ISSUE #6: Request Body Parameter Not Validated (MAJOR)

### Problem
Endpoints accept None request body:

```python
# In escalation.py
@router.post(
    "/tenants/{tenant_id}/escalations",
    response_model=EscalationResponse,
    status_code=201
)
async def escalate_session(
    tenant_id: str = Path(...),
    request: EscalationRequest = None,  # ❌ Default None!
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    # Will crash if request is None
    result = escalation_service.escalate_session(
        ...
        reason=request.reason,  # ❌ AttributeError if request is None
        ...
    )
```

### Same Issue in All Endpoints
- `escalate_session()` - request can be None
- `assign_supporter()` - request can be None
- `resolve_escalation()` - request can be None

### Fix
```python
# Remove = None default
async def escalate_session(
    tenant_id: str = Path(...),
    request: EscalationRequest,  # ✅ Required
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
```

---

## ISSUE #7: Auto-Escalation Detection Not Integrated (MAJOR)

### Problem
Auto-escalation endpoint exists but is never called:

```python
# Endpoint exists but unused
@router.post("/escalations/detect")
async def detect_auto_escalation(request: AutoEscalationDetectionRequest):
    result = escalation_service.detect_auto_escalation(...)
    return result
```

### Missing Integration Points
1. **After user message saved** - Should check if message triggers auto-escalation
2. **Return in chat response** - Should tell UI if escalation was auto-triggered
3. **Automatic escalation** - Should auto-escalate if confidence > threshold

### Fix Strategy
```python
# In api/chat.py
@router.post("/{tenant_id}/chat")
async def chat_endpoint(request: ChatRequest, ...):
    # ... save user message ...

    # Check for auto-escalation
    if request.auto_escalation_check or settings.AUTO_ESCALATE_ENABLED:
        detection = escalation_service.detect_auto_escalation(
            message=request.message,
            custom_keywords=request.keywords
        )

        if detection["should_escalate"]:
            escalation_service.escalate_session(
                db=db,
                session_id=session.session_id,
                tenant_id=tenant_id,
                reason=detection["reason"],
                auto_detected=True,
                keywords=detection["detected_keywords"]
            )

    # ... get agent response ...

    # Return with escalation status
    return ChatResponse(
        ...,
        escalation_status=session.escalation_status,
        auto_escalation_detected=detection.get("should_escalate", False) if detection else None
    )
```

---

## Role Behavior Matrix (Current vs. Desired)

| Action | tenant_user | staff | admin |
|--------|------------|-------|-------|
| **Chat** | ✅ Full chat | ✅ Full chat + can reply to escalations | ✅ Full chat + all admin features |
| **Request Escalation** | ✅ Can request | ✅ Can request | ✅ Can request |
| **See Escalation Status** | ✅ Own session | ✅ Own session + assigned escalations | ✅ All escalations |
| **Assign to Staff** | ❌ No | ❌ No | ✅ Yes (admin only) |
| **Reply to Escalated Session** | ❌ No | ✅ Yes (if assigned) | ✅ Yes (if assigned) |
| **View Escalation Queue** | ❌ No | ❌ No | ✅ Yes |
| **Resolve Escalation** | ❌ No | ✅ Yes (own escalations) | ✅ Yes (all) |

---

## Complete Escalation Flow (Fixed)

### Flow Sequence

```
USER SIDE (tenant_user):
  1. Chat message sent → "Do you need to talk to a human?" [Yes/No button]
  2. Click Yes → ChatRequest.escalate_requested = true
  3. Wait for assignment notification

CHAT API PROCESSING:
  1. Save user message to database
  2. Check for auto-escalation OR use escalate_requested flag
  3. If should escalate:
     - Call escalation_service.escalate_session()
     - Status = 'pending'
  4. Call SupervisorAgent with user message
  5. Save AI response
  6. Return ChatResponse with escalation_status

ADMIN SIDE (admin role):
  1. Admin sees escalation queue dashboard
  2. GET /api/admin/tenants/{tenant_id}/escalations?status=pending
  3. Sees pending escalations with users & reasons
  4. Clicks "Assign" next to escalation
  5. POST /api/admin/tenants/{tenant_id}/escalations/assign
     - Body: {session_id, user_id (staff UUID)}
     - Service checks: user.role='staff', user.supporter_status='online'
     - Service checks: user.current_sessions_count < max_concurrent_sessions
     - If available: session.assigned_user_id = user_id, increment counter
     - Returns success
  6. Status changes to 'assigned' in UI

SUPPORTER SIDE (staff role):
  1. Sees assigned escalations
  2. Joins chat session (uses assigned_user_id)
  3. Sends reply message:
     - POST /{tenant_id}/chat with role='supporter'
     - Message.sender_user_id = staff_user_id
     - Message.role = 'supporter'
  4. User sees "Supporter John is here"
  5. Conversation continues

RESOLUTION (admin or staff):
  1. Issue resolved → Admin or staff marks resolved
  2. POST /api/admin/tenants/{tenant_id}/escalations/resolve
     - Body: {session_id, resolution_notes}
  3. Status = 'resolved'
  4. user.current_sessions_count -= 1 (decrement staff capacity)
  5. Both parties see "Support conversation ended"
```

---

## Data Model Issues & Fixes

### ChatSession
```python
# BEFORE
user_id = Column(String(255), nullable=False)  # ❌ String, not FK

# AFTER
user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)  # ✅ Proper FK
user = relationship("User", foreign_keys=[user_id], back_populates="sessions")

# This enables:
session.user.role  # Get user role
session.user.supporter_status  # Check if online
session.user.current_sessions_count  # Track capacity
```

### Message
```python
# Add validation helper
@validates('sender_user_id')
def validate_sender(self, key, value):
    if self.role == 'supporter' and value is None:
        raise ValueError("supporter messages must have sender_user_id")
    return value
```

### User
```python
# These fields should be actively used:
supporter_status: str = 'offline'  # ← Check before assigning
current_sessions_count: int = 0     # ← Increment on assign, decrement on resolve
max_concurrent_sessions: int = 5    # ← Check not exceeded
```

---

## API Contract Changes Required

### ChatRequest (Add escalation support)
```python
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    user_id: str
    agent_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    # NEW: Escalation fields
    escalate_requested: bool = False  # User clicked "Talk to Human"
    auto_escalation_check: bool = False  # Enable auto-detection
    keywords: Optional[List[str]] = None  # Custom keywords for detection
```

### ChatResponse (Add escalation status)
```python
class ChatResponse(BaseModel):
    # ... existing fields ...
    session_id: str
    message: str

    # NEW: Escalation tracking
    escalation_status: Optional[str] = None  # 'none', 'pending', 'assigned', 'resolved'
    auto_escalation_detected: Optional[bool] = None
    escalation_confidence: Optional[float] = None
    assigned_supporter_id: Optional[str] = None
    escalation_reason: Optional[str] = None
```

### Escalation Endpoints (Fix request validation)
```python
# ALL endpoints should have request: SchemaType (no = None default)

# Before:
async def escalate_session(
    tenant_id: str = Path(...),
    request: EscalationRequest = None,  # ❌ BAD
    ...
)

# After:
async def escalate_session(
    tenant_id: str = Path(...),
    request: EscalationRequest,  # ✅ GOOD
    ...
)
```

---

## Summary of Changes

| Issue | Type | Severity | Fix Location |
|-------|------|----------|--------------|
| #1: user_id type mismatch | Data Model | CRITICAL | models/session.py + migration |
| #2: No role-based logic | Service/API | CRITICAL | services/, api/escalation.py |
| #3: No escalation in chat flow | Integration | CRITICAL | api/chat.py + schemas/chat.py |
| #4: No staff availability checking | Service | MAJOR | services/escalation_service.py |
| #5: Message sender validation | Data Model | MAJOR | models/message.py |
| #6: Request validation missing | API | MAJOR | api/admin/escalation.py |
| #7: Auto-escalation not integrated | Integration | MAJOR | api/chat.py + services |

---

## Testing Strategy

1. **Unit Tests**:
   - Test auto-escalation detection with keywords
   - Test staff availability checking
   - Test escalation state transitions

2. **Integration Tests**:
   - Test escalation flow from chat request to resolution
   - Test staff assignment and capacity tracking
   - Test message sender validation

3. **E2E Tests**:
   - User requests escalation → Admin assigns → Staff responds → Resolved
   - Auto-escalation detection in chat flow
   - Role-based access control for escalation operations

---

## Priority Order

1. **Fix Issue #6** (Request validation) - Easy, prevents runtime errors
2. **Fix Issue #1** (user_id type) - Requires migration but critical for joins
3. **Fix Issue #3** (Chat integration) - Highest user impact
4. **Fix Issue #4** (Staff availability) - Production readiness
5. **Fix Issue #7** (Auto-escalation integration) - User experience
6. **Fix Issue #5** (Message validation) - Data integrity
7. **Fix Issue #2** (Role logic) - Complete the picture
