# Requirement: Escalation with Supporter Assignment

**Status:** Pending Implementation
**Assigned To:** Dev Agent 4
**Created:** 2025-11-11
**Priority:** HIGH - Enables human escalation workflow
**Estimated Hours:** 4 hours

---

## 🎯 Objective

Implement escalation workflow to route unresolved conversations to available human supporters with assignment, notification, and status tracking.

**Current Issue:**
```
POST /api/{tenant_id}/escalate
Status: 500 or Not Implemented
Response: No escalation workflow
UI: "Escalate to human" button doesn't work
```

**Desired State:**
```
POST /api/{tenant_id}/escalate
{
  "session_id": "uuid",
  "reason": "Unable to resolve debt query",
  "priority": "high"
}

Status: 200 OK
Response: {
  "escalation_id": "uuid",
  "status": "assigned",
  "assigned_to": "support_debt@eFMS.local",
  "assigned_at": "2025-11-11T10:30:00Z"
}

UI: Chat transferred to human supporter
```

---

## 🔍 Root Cause Analysis

**Problem:** No escalation endpoints implemented

**Why:** Escalation logic requires:
1. Finding available supporters
2. Assigning to least-busy supporter
3. Creating escalation record
4. Notifying supporter
5. Updating chat session

**Solution:** Database schema ready with:
- User & Supporter tables seeded
- 6 supporters created per tenant
- Escalation table ready for tracking

---

## 📋 Requirements

### Requirement 1: Escalation Endpoint

**What:** Create `POST /api/{tenant_id}/escalate` endpoint

**Where:** `backend/src/api/escalation.py` (new file)

**Implementation:**
```python
@router.post("/escalate", response_model=EscalationResponse)
async def create_escalation(
    tenant_id: str,
    escalation_request: EscalationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> EscalationResponse:
    """Escalate conversation to human supporter."""
    # 1. Validate tenant_id and session_id
    # 2. Check session owner matches current_user
    # 3. Find available supporters in tenant:
    #    - is_available = True
    #    - active_assignments < max_assignments
    # 4. Assign to supporter with lowest active count
    # 5. Create escalation record
    # 6. Update session status
    # 7. Notify supporter (optional: via webhook/queue)
    # 8. Return escalation details
```

**Request Schema (EscalationRequest):**
```python
class EscalationRequest(BaseModel):
    session_id: UUID
    reason: str  # Why escalating
    priority: str = "normal"  # normal, high, critical
    custom_message: Optional[str] = None
```

**Response Schema (EscalationResponse):**
```python
class SupporterInfo(BaseModel):
    supporter_id: UUID
    user_id: UUID
    email: str
    display_name: Optional[str]
    is_available: bool

class EscalationResponse(BaseModel):
    escalation_id: UUID
    session_id: UUID
    status: str  # pending, assigned, in_progress, resolved, closed
    assigned_to: Optional[SupporterInfo]
    assigned_at: Optional[datetime]
    resolved_at: Optional[datetime]
    notes: Optional[str]
```

**Acceptance Criteria:**
- [ ] Endpoint created at `POST /api/{tenant_id}/escalate`
- [ ] Validates session_id exists and belongs to user
- [ ] Finds available supporters in tenant
- [ ] Assigns to least-busy supporter
- [ ] Creates escalation record in database
- [ ] Updates session status to escalated
- [ ] Returns 200 with escalation details
- [ ] Handles no available supporters (returns 503)
- [ ] Tenant isolation enforced
- [ ] Proper error handling and logging

---

### Requirement 2: Supporter Assignment Logic

**What:** Implement supporter availability tracking and load balancing

**Why:** Assign escalations to least-busy supporters

**Implementation:**
```python
def find_available_supporter(tenant_id: UUID, db: Session) -> Optional[Supporter]:
    """Find available supporter with lowest active escalations."""
    # 1. Get all available supporters in tenant
    # 2. Count active escalations per supporter
    # 3. Return supporter with lowest count
    # 4. Return None if all busy

    supporters = db.query(Supporter)\
        .join(User)\
        .filter(User.tenant_id == tenant_id)\
        .filter(Supporter.is_available == True)\
        .all()

    # Count active escalations for each
    supporter_loads = {}
    for supporter in supporters:
        active_count = db.query(Escalation)\
            .filter(Escalation.assigned_to == supporter.supporter_id)\
            .filter(Escalation.status == "in_progress")\
            .count()
        supporter_loads[supporter] = active_count

    # Return supplier with minimum load
    if supporter_loads:
        return min(supporter_loads, key=supporter_loads.get)
    return None
```

**Acceptance Criteria:**
- [ ] Finds available supporters in tenant
- [ ] Counts active escalations per supporter
- [ ] Assigns to least-busy supporter
- [ ] Handles all supporters busy case
- [ ] Handles no supporters in tenant case
- [ ] Efficient query (< 50ms)

---

### Requirement 3: Escalation Status Tracking

**What:** Track escalation lifecycle with status updates

**Why:** Monitor escalations from creation to resolution

**Implementation:**
```python
# Escalation status transitions
ESCALATION_STATUSES = {
    "pending": "Awaiting supporter",
    "assigned": "Assigned to supporter",
    "in_progress": "Supporter actively handling",
    "on_hold": "Waiting for additional info",
    "resolved": "Issue resolved",
    "closed": "Escalation closed"
}
```

**Endpoints for Status Updates:**

```python
@router.patch("/escalations/{escalation_id}/status", response_model=EscalationResponse)
async def update_escalation_status(
    escalation_id: UUID,
    status_update: StatusUpdate,
    db: Session = Depends(get_db)
) -> EscalationResponse:
    """Update escalation status."""
    # 1. Get escalation
    # 2. Validate status transition is allowed
    # 3. Update status with timestamp
    # 4. If resolved/closed, mark session complete
    # 5. Return updated escalation
```

**Status Update Schema:**
```python
class StatusUpdate(BaseModel):
    status: str  # New status
    notes: Optional[str] = None
```

**Acceptance Criteria:**
- [ ] Escalation creation sets status = "pending"
- [ ] Assignment sets status = "assigned"
- [ ] Supporter can update to "in_progress"
- [ ] Can update to "on_hold" for info requests
- [ ] Can update to "resolved" or "closed"
- [ ] Status transitions logged
- [ ] Timestamps recorded for each status
- [ ] Session updated when escalation closed

---

### Requirement 4: Supporter Availability Management

**What:** Allow supporters to update availability status

**Why:** Supporters need to indicate when busy/unavailable

**Implementation:**
```python
@router.patch("/supporters/{supporter_id}/availability", response_model=SupporterAvailabilityResponse)
async def update_supporter_availability(
    supporter_id: UUID,
    availability: AvailabilityUpdate,
    db: Session = Depends(get_db)
) -> SupporterAvailabilityResponse:
    """Update supporter availability."""
    # 1. Get supporter
    # 2. Update is_available flag
    # 3. Return updated status
```

**Availability Update Schema:**
```python
class AvailabilityUpdate(BaseModel):
    is_available: bool

class SupporterAvailabilityResponse(BaseModel):
    supporter_id: UUID
    email: str
    is_available: bool
    active_escalations: int
    updated_at: datetime
```

**Acceptance Criteria:**
- [ ] Supporter can mark as available
- [ ] Supporter can mark as unavailable
- [ ] Unavailable supporters not assigned new escalations
- [ ] Shows active escalation count
- [ ] Returns updated status with timestamp

---

### Requirement 5: Escalation History & Analytics

**What:** Track escalation metrics and history

**Why:** Monitor escalation patterns and supporter performance

**Implementation:**
```python
@router.get("/escalations", response_model=EscalationListResponse)
async def get_escalations(
    tenant_id: str,
    status: Optional[str] = Query(None),
    assigned_to: Optional[UUID] = Query(None),
    limit: int = Query(20),
    offset: int = Query(0),
    db: Session = Depends(get_db)
) -> EscalationListResponse:
    """Get escalation history with filtering."""
    # 1. Query escalations table
    # 2. Filter by status if provided
    # 3. Filter by assigned_to if provided
    # 4. Order by created_at DESC
    # 5. Paginate
    # 6. Return list with stats
```

**Response Schema:**
```python
class EscalationSummary(BaseModel):
    escalation_id: UUID
    session_id: UUID
    status: str
    priority: str
    assigned_to: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    resolution_time_minutes: Optional[int]

class EscalationListResponse(BaseModel):
    escalations: List[EscalationSummary]
    total: int
    limit: int
    offset: int
```

**Acceptance Criteria:**
- [ ] Endpoint created at `GET /api/{tenant_id}/escalations`
- [ ] Filters by status
- [ ] Filters by assigned_to
- [ ] Shows resolution time
- [ ] Paginated results
- [ ] Tenant isolation enforced

---

## 🗄️ Database Schema (Ready - Seeded via Phase 3)

```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    email VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(50),  -- admin, supporter, user
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    UNIQUE (tenant_id, email),
    INDEX idx_tenant_id (tenant_id)
);

CREATE TABLE supporters (
    supporter_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    is_available BOOLEAN DEFAULT TRUE,
    max_active_escalations INTEGER DEFAULT 5,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_is_available (is_available)
);

CREATE TABLE escalations (
    escalation_id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(session_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    assigned_to UUID REFERENCES supporters(supporter_id),
    status VARCHAR(50) DEFAULT 'pending',  -- pending, assigned, in_progress, on_hold, resolved, closed
    priority VARCHAR(50) DEFAULT 'normal',  -- normal, high, critical
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to)
);
```

---

## 📊 Test Data Available

**Ready to Test:**
- ✅ 3 tenants (eTMS, eFMS, Vela)
- ✅ 6 supporters per tenant (18 total)
- ✅ Users created with supporter role
- ✅ Sample sessions can be created

**Test Flow:**
1. Create session for user
2. Add messages to session
3. Call `POST /api/{tenant_id}/escalate` with session_id
4. Verify supporter assigned
5. Check escalation record created
6. Call `GET /api/{tenant_id}/escalations` → verify listed

---

## 🔗 Related Components

| Component | Status | Notes |
|-----------|--------|-------|
| User Model | ✅ Seeded | 9 users (3 admins + 6 supporters) |
| Supporter Model | ✅ Seeded | 6 supporters per tenant |
| Session Model | ✅ Ready | For linking escalations |
| Database Schema | ✅ Ready | Tables created via alembic |
| Tenant Isolation | ✅ Ready | tenant_id filtering enforced |

---

## ✅ Definition of Done (DoD)

1. **Code Complete**
   - [ ] POST /escalate endpoint
   - [ ] PATCH /escalations/{id}/status endpoint
   - [ ] PATCH /supporters/{id}/availability endpoint
   - [ ] GET /escalations endpoint
   - [ ] Supporter assignment logic
   - [ ] Response schemas defined

2. **Tests Passing**
   - [ ] Unit tests for assignment logic
   - [ ] Integration tests for endpoints
   - [ ] E2E test: Escalate → Assign → Update status
   - [ ] Load balancing logic verified

3. **Documentation**
   - [ ] Docstrings on all endpoints
   - [ ] Status transition rules documented
   - [ ] Error codes documented
   - [ ] Example escalation flow shown

4. **Performance**
   - [ ] Escalation creation < 100ms
   - [ ] Supporter finding < 50ms
   - [ ] Status updates < 50ms

5. **Security**
   - [ ] Tenant isolation verified
   - [ ] Users can only escalate own sessions
   - [ ] Supporters can only see assigned escalations
   - [ ] Input validation on all endpoints

6. **Frontend Integration**
   - [ ] Frontend shows "Escalate to Human" button
   - [ ] Escalation dialog works
   - [ ] Chat transfers to supporter
   - [ ] Escalation history visible

---

## 🚀 Implementation Notes

**Key Files to Modify:**
1. `backend/src/api/escalation.py` - Create new endpoints
2. `backend/src/schemas/escalation.py` - Add response schemas
3. `backend/src/services/escalation_service.py` - Assignment logic
4. `backend/src/main.py` - Register router

**Estimated Complexity:** Medium-High (4 hours)

**Blockers:** None - database ready, supporters seeded

**Dependencies:**
- Phase 3 complete (database seeded)
- User/Supporter tables populated
- Auth middleware working

---

## 💡 Considerations

**Scalability:**
- For 1000+ escalations, consider database partitioning
- Supporter load calculation could be cached

**Notifications:**
- Could send email/SMS to supporter when assigned
- Could send chat notification in supporter dashboard
- Consider using message queue (Redis) for async notifications

**Analytics:**
- Track average resolution time
- Track supporter performance metrics
- Generate escalation reports

---

## 📞 Questions to Resolve

- Should escalations auto-rebalance if supporter becomes unavailable?
- Should there be a maximum escalation age before auto-closing?
- Should supporters be able to transfer escalations to other supporters?

---

**Status:** Ready for Dev Agent 4 implementation
**Next Step:** Begin endpoint implementation after database migration runs successfully
