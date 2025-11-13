# Developer Quick Start - Supporter Chat Implementation

**For**: Backend developers implementing supporter chat endpoints
**Time**: ~4-6 days
**Complexity**: Medium (requires authorization, database queries, testing)

---

## 🚀 Start Here

### 1. Prerequisites (30 min)

**Read these documents** (in order):
1. ESCALATION_API_REFERENCE.md - Endpoints 8-9 (what to build)
2. SUPPORTER_CHAT_IMPLEMENTATION.md - Tasks 1-10 (how to build)
3. IMPLEMENTATION_SUMMARY.md - Overview + diagrams

**Setup**:
```bash
# Clone repo
cd backend

# Install dependencies
pip install -r requirements.txt

# Setup database
alembic upgrade head

# Run existing tests to verify setup
pytest tests/ -v
```

---

## 📋 10 Implementation Tasks (Follow In Order)

### Task 1️⃣ : Create Schema (File: `src/schemas/supporter_chat.py`)

**What**: Define request/response data models

**Time**: 30 min

**Create**:
```python
# Request
class SupporterChatRequest:
    session_id: UUID
    message: str
    metadata: Optional[dict] = None

# Response
class SupporterChatResponse:
    success: bool
    message_id: UUID
    session_id: UUID
    role: str = 'supporter'
    sender_user_id: UUID
    content: str
    created_at: datetime
    metadata: dict

# Sessions Response
class SupporterSessionsResponse:
    success: bool
    total_sessions: int
    active_sessions: int
    sessions: List[{...}]  # See SUPPORTER_CHAT_IMPLEMENTATION.md
```

**Checklist**:
- [ ] Request schema validates UUID formats
- [ ] Request schema validates non-empty message
- [ ] Response includes all required fields
- [ ] Sessions response pageable
- [ ] Type hints on all fields

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 1

---

### Task 2️⃣ : Create API Endpoints (File: `src/api/supporter.py` - NEW)

**What**: Two endpoints for supporters to view and chat

**Time**: 2-3 hours

**Endpoint 1: GET /api/tenants/{tenant_id}/supporters/{supporter_id}/sessions**
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
    # 1. Validate authorization (admin OR supporter_id == current_user)
    # 2. Validate tenant exists
    # 3. Query sessions assigned to supporter
    # 4. Return paginated results
```

**Endpoint 2: POST /api/tenants/{tenant_id}/supporter-chat**
```python
@router.post("/{tenant_id}/supporter-chat")
async def supporter_send_message(
    tenant_id: UUID,
    request: SupporterChatRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # 1. Validate tenant access
    # 2. Validate session exists & is assigned
    # 3. Validate current_user is assigned supporter
    # 4. Create Message record
    # 5. Update session.last_message_at
    # 6. Return message response
```

**Checklist**:
- [ ] Both endpoints created
- [ ] Authorization checks in place
- [ ] Error handling for all cases
- [ ] Returns correct status codes
- [ ] No agent/bot processing

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 2

---

### Task 3️⃣ : Create Service Helper (File: `src/services/supporter_service.py` - NEW)

**What**: Reusable helper methods for common operations

**Time**: 1 hour

**Methods**:
```python
class SupporterService:
    @staticmethod
    def get_assigned_sessions(...) -> Dict[str, Any]
        # Query sessions + message count

    @staticmethod
    def send_supporter_message(...) -> Message
        # Create message with validation

    @staticmethod
    def is_supporter_assigned(...) -> bool
        # Check if assigned to session

    @staticmethod
    def get_session_message_count(...) -> int
        # Count messages in session
```

**Checklist**:
- [ ] All methods have docstrings
- [ ] All methods have type hints
- [ ] Error handling (raise HTTPException)
- [ ] No N+1 queries (use JOINs)
- [ ] Unit tests for each method

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 3

---

### Task 4️⃣ : Verify Chat Schema (File: `src/schemas/chat.py` - CHECK)

**What**: Ensure existing ChatResponse supports new fields

**Time**: 15 min

**Verify these exist**:
- [ ] `message_id: UUID`
- [ ] `role: str` (supports 'supporter')
- [ ] `sender_user_id: Optional[UUID]`
- [ ] `created_at: datetime`

**If missing**: Add them (but likely already exists)

**Checklist**:
- [ ] ChatResponse has all required fields
- [ ] Schemas work with Message model
- [ ] Serialization correct

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 4

---

### Task 5️⃣ : Optimize Database Queries (File: See IMPLEMENTATION.md)

**What**: Ensure queries are efficient

**Time**: 1 hour

**Two queries to review**:

**Query 1**: Sessions with message count
```sql
SELECT
  s.session_id, s.tenant_id, s.user_id,
  s.escalation_status, s.assigned_user_id,
  COUNT(DISTINCT m.message_id) as message_count,
  MAX(m.timestamp) as last_message_at
FROM sessions s
LEFT JOIN messages m ON s.session_id = m.session_id
WHERE s.tenant_id = $1
  AND s.assigned_user_id = $2
  AND s.escalation_status != 'none'
GROUP BY s.session_id
ORDER BY s.escalation_assigned_at DESC
LIMIT $3 OFFSET $4;
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
- [ ] Queries use SQLAlchemy (not raw SQL)
- [ ] Proper parameter binding (prevent SQL injection)
- [ ] Indices exist on foreign keys
- [ ] No N+1 queries
- [ ] Test query performance

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 5

---

### Task 6️⃣ : Add Error Handling (File: `src/api/supporter.py`)

**What**: Handle all error cases with proper responses

**Time**: 1.5 hours

**Error Cases**:
```python
# 400 Bad Request
"Session not found"
"Session is not assigned to you"
"Session escalation is not in 'assigned' status"

# 403 Forbidden
"You do not have access to this tenant"
"Your user role is not 'supporter'"

# 404 Not Found
"Tenant not found"
"Supporter not found"
```

**Checklist**:
- [ ] All error cases covered
- [ ] Proper HTTP status codes
- [ ] Clear error messages
- [ ] No sensitive info exposed
- [ ] Error tests written

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 6

---

### Task 7️⃣ : Verify Authorization (File: `src/middleware/auth.py` - CHECK)

**What**: Ensure JWT middleware extracts required fields

**Time**: 30 min

**Verify JWT contains**:
- [ ] `user_id` (UUID)
- [ ] `role` ('supporter' or 'admin')
- [ ] `tenant_id` (UUID)

**Verify `get_current_user()` dependency works**

**Checklist**:
- [ ] JWT extraction working
- [ ] Role validation in middleware
- [ ] Tenant validation working
- [ ] Test with valid/invalid tokens

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 7

---

### Task 8️⃣ : Add Logging (File: `src/api/supporter.py`)

**What**: Log important events for debugging/monitoring

**Time**: 1 hour

**Log Events**:
```python
logger.info(
    "supporter_sessions_retrieved",
    tenant_id=tenant_id,
    supporter_id=supporter_id,
    session_count=len(sessions),
)

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
- [ ] Use structured logging (structlog)
- [ ] Include context (tenant_id, user_id)

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 8

---

### Task 9️⃣ : Write Tests (File: `tests/unit/test_supporter_chat.py` - NEW)

**What**: Unit + Integration + E2E tests

**Time**: 2-3 hours

**Unit Tests** (Test isolated functions):
```python
def test_create_message_with_supporter_role():
    # Verify message created with role='supporter'

def test_authorize_assigned_supporter():
    # Verify only assigned supporter can send

def test_session_status_validation():
    # Verify session must be 'assigned'

def test_message_content_validation():
    # Verify non-empty message required
```

**Integration Tests** (Test with DB):
```python
def test_complete_escalation_flow():
    # Create session → request escalation → assign → send message

def test_get_supporter_sessions():
    # Query sessions for supporter
```

**E2E Tests** (Test full endpoint):
```python
def test_supporter_chat_endpoint():
    # Call actual endpoint, verify response
```

**Checklist**:
- [ ] Unit tests for functions
- [ ] Integration tests with DB
- [ ] E2E tests for endpoints
- [ ] >80% code coverage
- [ ] All tests passing

**Reference**: SUPPORTER_CHAT_IMPLEMENTATION.md → Task 9

---

### Task 🔟 : Deploy & Verify (File: ESCALATION_DEPLOYMENT_CHECKLIST.md)

**What**: Deploy to production and verify working

**Time**: 1-2 hours

**Pre-Deployment**:
- [ ] Code review passed
- [ ] All tests passing
- [ ] Database backup created
- [ ] No breaking changes

**Deployment**:
```bash
# 1. Deploy code
git push origin main

# 2. Restart API server
supervisorctl restart agenthub-api

# 3. Verify health
curl http://localhost:8000/health

# 4. Run smoke tests
curl -X GET http://localhost:8000/api/tenants/{tenant_id}/supporters/{supporter_id}/sessions \
  -H "Authorization: Bearer TOKEN"
```

**Post-Deployment**:
- [ ] Monitor logs for errors
- [ ] Verify message creation
- [ ] Check response times
- [ ] Monitor error rates

**Reference**: ESCALATION_DEPLOYMENT_CHECKLIST.md

---

## ⏱️ Daily Schedule (6 Days)

### Day 1
- [ ] Morning: Read documentation (1 hour)
- [ ] Task 1: Schema (30 min)
- [ ] Task 2: API endpoints (3 hours)
- [ ] Task 3: Service (1 hour)
- [ ] Test after each task
- [ ] **Commit**: "feat: Add supporter chat endpoints & service"

### Day 2
- [ ] Task 4: Verify schema (15 min)
- [ ] Task 5: Database queries (1 hour)
- [ ] Task 6: Error handling (1.5 hours)
- [ ] Task 7: Authorization check (30 min)
- [ ] Refactor & polish
- [ ] **Commit**: "refactor: Optimize queries and error handling"

### Day 3
- [ ] Task 8: Logging (1 hour)
- [ ] Code review (2 hours)
- [ ] Bug fixes from review
- [ ] **Commit**: "feat: Add comprehensive logging"

### Day 4-5
- [ ] Task 9: Write tests (3 hours/day)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Fix failing tests
- [ ] **Commit**: "test: Add unit, integration, E2E tests"

### Day 6
- [ ] Task 10: Deploy (1-2 hours)
- [ ] Pre-deployment checks
- [ ] Deploy to production
- [ ] Post-deployment verification
- [ ] **Commit**: "deploy: Supporter chat endpoints v1.0"

---

## 📚 Quick Reference

### File Locations
```
backend/
├── src/
│   ├── api/supporter.py           (Create - Task 2)
│   ├── schemas/supporter_chat.py  (Create - Task 1)
│   └── services/supporter_service.py (Create - Task 3)
└── tests/
    ├── unit/test_supporter_chat.py (Create - Task 9)
    └── integration/test_supporter_chat.py (Create - Task 9)
```

### Key Models
- `User` - Backend staff (role='supporter')
- `ChatSession` - Conversation session (assigned_user_id points to supporter)
- `Message` - Individual messages (role='supporter', sender_user_id=supporter)

### Key Fields
- `Message.role` - 'user' | 'assistant' | 'supporter' | 'admin' | 'system'
- `Message.sender_user_id` - Who sent (user or supporter)
- `Session.assigned_user_id` - Assigned supporter (FK to User)
- `Session.escalation_status` - 'none' | 'pending' | 'assigned' | 'resolved'

### Common Commands
```bash
# Run all tests
pytest tests/ -v

# Run specific test
pytest tests/unit/test_supporter_chat.py::test_name -v

# Check coverage
pytest --cov=src --cov-report=term

# Format code
black src/

# Lint code
ruff check src/

# Type checking
mypy src/
```

---

## 🔍 Debugging Tips

### Issue: "Session not assigned to supporter"
→ Check `session.assigned_user_id == current_user` in database

### Issue: "Unauthorized: Not a supporter"
→ Check JWT token contains `role='supporter'`

### Issue: "Messages not appearing"
→ Verify `Message.role='supporter'` in database

### Issue: "Test failing"
→ Check database fixtures are creating correct data

### Issue: "Authorization failing"
→ Verify JWT middleware extracting fields correctly

---

## ✅ Success Criteria

When you're done, verify:

- [ ] 2 endpoints working (`GET` sessions, `POST` message)
- [ ] Messages created with `role='supporter'`
- [ ] Only assigned supporters can send
- [ ] Authorization validated
- [ ] All tests passing (>80% coverage)
- [ ] Logs show operations
- [ ] Deployed to production
- [ ] No errors in logs

---

## 🆘 Need Help?

**API Specs**: ESCALATION_API_REFERENCE.md
**Implementation Details**: SUPPORTER_CHAT_IMPLEMENTATION.md
**System Overview**: IMPLEMENTATION_SUMMARY.md
**Existing Chat Code**: src/api/chat.py (reference)

---

## 📊 Progress Tracker

```
[Day 1] Task 1 ████████ 50% Done
        Task 2 ████████ 75% Done
        Task 3 ████░░░░ 50% Done

[Day 2] Task 4-7 ████████░░ 80% Done

[Day 3] Task 8 ██████░░░░ 60% Done
        Code Review ██░░░░░░░░ 20% Done

[Day 4-5] Task 9 ░░░░░░░░░░ 0% Done (Starting)

[Day 6] Task 10 ░░░░░░░░░░ 0% Done (Pending)
```

---

**Ready? Start with Task 1! 🚀**
