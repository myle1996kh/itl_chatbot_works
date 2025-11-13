# Requirement: Chat Sessions API Endpoint

**Status:** Pending Implementation
**Assigned To:** Dev Agent 2
**Created:** 2025-11-11
**Priority:** HIGH - Enables frontend session history
**Estimated Hours:** 3 hours

---

## 🎯 Objective

Implement `GET /api/{tenant_id}/sessions` endpoint to retrieve all chat sessions for a user with filtering, pagination, and metadata support.

**Current Issue:**
```
GET /api/{tenant_id}/sessions
Status: 200 OK
Response: Empty list (no DB queries)
UI: No session history displayed
```

**Desired State:**
```
GET /api/{tenant_id}/sessions?user_id={uuid}&limit=10&offset=0
Status: 200 OK
Response: [
  {
    "session_id": "uuid",
    "user_id": "uuid",
    "title": "Debt Query - Oct 5",
    "agent_name": "DebtAgent",
    "created_at": "2025-11-05T10:30:00Z",
    "updated_at": "2025-11-05T15:45:00Z",
    "message_count": 12,
    "is_active": true
  },
  ...
]
UI: Session history populated and selectable
```

---

## 🔍 Root Cause Analysis

**Problem:** Frontend requests session data but backend returns empty list

**Why:** Endpoint doesn't query `sessions` table from database

**Solution:** Database schema ready with:
- 3 tenants created
- Sessions ready for users to create
- Messages table ready for chat history

---

## 📋 Requirements

### Requirement 1: GET Sessions Endpoint

**What:** Create `GET /api/{tenant_id}/sessions` endpoint

**Where:** `backend/src/api/sessions.py` (new file)

**Implementation:**
```python
@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    tenant_id: str,
    user_id: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> SessionListResponse:
    """Get all chat sessions for a user with pagination."""
    # 1. Validate tenant_id exists
    # 2. Query sessions table:
    #    - Filter by tenant_id
    #    - Filter by user_id (if provided)
    #    - Order by updated_at DESC
    #    - Paginate with limit/offset
    # 3. Count total sessions
    # 4. Return response with pagination metadata
```

**Input Parameters:**
- `tenant_id` (path) - Tenant identifier
- `user_id` (query, optional) - Filter by user UUID
- `limit` (query, default: 10) - Results per page
- `offset` (query, default: 0) - Pagination offset

**Response Schema (SessionListResponse):**
```python
class SessionInfo(BaseModel):
    session_id: UUID
    user_id: UUID
    title: Optional[str]
    agent_name: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int
    is_active: bool

class SessionListResponse(BaseModel):
    sessions: List[SessionInfo]
    total: int
    limit: int
    offset: int
    has_more: bool
```

**Acceptance Criteria:**
- [ ] Endpoint created at `GET /api/{tenant_id}/sessions`
- [ ] Returns 200 with paginated session list
- [ ] Filters by user_id when provided
- [ ] Orders results by updated_at DESC (newest first)
- [ ] Includes message_count from messages table
- [ ] Respects limit/offset pagination
- [ ] Returns has_more flag for frontend
- [ ] Tenant isolation enforced (only show own sessions)
- [ ] Handles empty results gracefully
- [ ] Tests verify all filter combinations

---

### Requirement 2: Session Entity Serialization

**What:** Ensure ChatSession model properly serializes to response

**Why:** Frontend needs structured session metadata

**Implementation:**
- Add computed property for message_count
- Add computed property for agent_name from agent_id join
- Add is_active flag (based on recent activity)

**Acceptance Criteria:**
- [ ] ChatSession.message_count computed correctly
- [ ] ChatSession.agent_name resolved via join
- [ ] is_active flag reflects recent messages (< 24h)
- [ ] Timestamp serialization in ISO format
- [ ] Title truncated to 255 chars if needed

---

### Requirement 3: Database Queries Optimized

**What:** Ensure queries are efficient with proper indexing

**Database Dependencies:**
- `tenants` table ✅ Seeded
- `sessions` table ✅ Schema ready
- `messages` table ✅ Schema ready
- `agent_configs` table ✅ Seeded

**Optimization:**
- Index on `sessions.tenant_id`
- Index on `sessions.user_id`
- Index on `sessions.updated_at` (for sorting)
- Left join to `messages` for count

**Acceptance Criteria:**
- [ ] Query executes in < 100ms for 1000 sessions
- [ ] Uses indexed columns for filtering
- [ ] Counts messages efficiently

---

### Requirement 4: Integration with Frontend

**What:** Frontend displays session list in UI

**Expected Behavior:**
1. User logs in
2. Frontend calls `GET /api/{tenant_id}/sessions?user_id={uuid}`
3. Backend returns paginated list
4. Frontend displays sessions in sidebar
5. User clicks session → loads chat history

**Testing:**
- [ ] Frontend can fetch sessions
- [ ] Sessions display with titles, timestamps
- [ ] Pagination works (load more)
- [ ] Empty state handled gracefully

---

## 🗄️ Database Schema (Already Seeded)

```sql
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    agent_id UUID REFERENCES agent_configs(agent_id),
    title VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_updated_at (updated_at DESC)
);

CREATE TABLE messages (
    message_id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(session_id),
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 📊 Test Data Available

**Ready to Test:**
- ✅ 3 tenants (eTMS, eFMS, Vela)
- ✅ 9 users (admins + supporters)
- ✅ 4 agents (Supervisor, Guideline, Debt, Shipment)

**Test Flow:**
1. Create session for user: `INSERT INTO sessions (session_id, tenant_id, user_id, agent_id) VALUES (...)`
2. Add messages: `INSERT INTO messages (message_id, session_id, role, content) VALUES (...)`
3. Call endpoint: `GET /api/{tenant_id}/sessions?user_id={uuid}`
4. Verify response includes message_count

---

## 🔗 Related Components

| Component | Status | Notes |
|-----------|--------|-------|
| ChatSession Model | ✅ Ready | Defined in `src/models/session.py` |
| Message Model | ✅ Ready | Defined in `src/models/message.py` |
| Database Schema | ✅ Ready | Tables created via alembic |
| Tenant Isolation | ✅ Ready | tenant_id filter enforced |
| User Auth | ✅ Ready | user_id from JWT token |

---

## ✅ Definition of Done (DoD)

1. **Code Complete**
   - [ ] GET /sessions endpoint implemented
   - [ ] SessionListResponse schema defined
   - [ ] Pagination logic working
   - [ ] Proper error handling

2. **Tests Passing**
   - [ ] Unit tests for query logic (100% coverage)
   - [ ] Integration tests for API response
   - [ ] E2E test: Create session → Fetch → Verify

3. **Documentation**
   - [ ] Docstring added to endpoint
   - [ ] Response schema documented
   - [ ] Error codes documented

4. **Performance**
   - [ ] Query < 100ms
   - [ ] Proper indexes used
   - [ ] Handles 1000+ sessions gracefully

5. **Security**
   - [ ] Tenant isolation verified
   - [ ] User can only see own sessions
   - [ ] Input validation on pagination params

6. **Frontend Integration**
   - [ ] Frontend can fetch sessions
   - [ ] UI displays session list
   - [ ] Session selection works

---

## 🚀 Implementation Notes

**Key Files to Modify:**
1. `backend/src/api/sessions.py` - Create new or update existing
2. `backend/src/schemas/session.py` - Add response schemas
3. `backend/src/main.py` - Register router if new

**Estimated Complexity:** Medium (3 hours)

**Blockers:** None - database schema ready, seeding complete

**Dependencies:**
- Phase 3 complete (database seeded)
- Auth middleware working

---

## 📞 Questions to Resolve

- Should session title be auto-generated from first message?
- What defines "is_active" - should it be based on timestamp?
- Should pagination include sort_by parameter?

---

**Status:** Ready for Dev Agent 2 implementation
**Next Step:** Begin endpoint implementation after database migration runs successfully
