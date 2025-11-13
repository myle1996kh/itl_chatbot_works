# Escalation System - Flow Diagrams

## 1. Data Model Relationships (After Fixes)

```
┌─────────────┐
│   Tenant    │
│ tenant_id   │ (UUID)
│ name        │
└──────┬──────┘
       │
       │ 1:M
       │
   ┌───┴────────────────────────┐
   │                            │
   │                            │
   ▼                            ▼
┌─────────────┐          ┌──────────────┐
│    User     │          │ ChatSession  │
│ user_id (PK)├──────────┤ user_id (FK) │ ← NEW: Proper FK!
│ tenant_id   │ 1:M      │ assigned_    │
│ role        │ ◄────────┤   user_id(FK)│ ← Staff assigned
│ email       │          │ escalation_  │
│ username    │          │   status     │
│ supporter_  │          │ escalation_  │
│   status    │ ◄────────┤   reason     │
│ max_        │ 1:M      │ escalation_  │
│   concurrent├──────────┤   requested_ │
│   _sessions │          │   at         │
│ current_    │          │ escalation_  │
│   sessions_ │          │   assigned_  │
│   count     │          │   at         │
└─────────────┘          └──────┬───────┘
       ▲                        │
       │                        │ 1:M
       │                        │
       │                        ▼
       │                  ┌───────────────┐
       └──────────────────┤   Message     │
        sender_user_id(FK)│ message_id(PK)│
                          │ session_id(FK)│
                          │ role          │
                          │ content       │
                          │ sender_user_id│ ← FK if role='supporter'
                          └───────────────┘

Legend:
PK = Primary Key
FK = Foreign Key
1:M = One-to-Many relationship
◄─── = Foreign Key relationship
```

---

## 2. Escalation State Machine

```
                    ┌────────────────────┐
                    │   Session Created  │
                    │   user_id = UUID   │ ✅ NEW: Proper FK
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Escalation Status  │
                    │    = 'none'        │
                    └─────────┬──────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
        ┌───────────▼──────────┐    ┌──▼──────────────────┐
        │ User clicks          │    │ Auto-escalation      │
        │ "Talk to Human"      │    │ detected (Issue #3)  │
        └──────────┬───────────┘    └──────┬───────────────┘
                   │                       │
                   └───────────┬───────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │ Admin notified of  │
                    │ escalation pending │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Admin views queue  │
                    │ GET /escalations   │
                    └─────────┬──────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │ Admin checks available    │
              │ staff (load balanced)     │
              │ GET /staff/available      │ ✅ FIXED: Capacity checks
              └───────────────┬───────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │ Admin assigns staff     │
                 │ POST /escalations/assign│ ✅ FIXED: Validates availability
                 └────────────┬────────────┘
                              │
               ┌──────────────▼──────────────┐
               │                            │
         ┌─────▼──────────┐     ┌──────────▼─────────┐
         │ Success:       │     │ Failed:            │
         │ - Set assigned │     │ - User offline     │
         │ - Status =     │     │ - At capacity      │
         │   'assigned'   │     │ - Not staff        │
         │ - Counter +1   │     │ - Session wrong    │
         │   (Issue #4)   │     │   status           │
         └─────┬──────────┘     └────────────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Staff joins chat and    │
    │ responds to user        │
    │ Message.role='supporter'│
    │ sender_user_id=staff_uuid
    └────────────┬────────────┘
                 │
        ┌────────▼─────────┐
        │ Support ongoing  │
        │ Multiple messages│
        └────────┬─────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Issue resolved     │
        │ Admin marks done   │
        │ POST /escalations/ │
        │       resolve      │
        └────────┬───────────┘
                 │
    ┌────────────▼───────────┐
    │ On Resolution:         │
    │ - Status = 'resolved'  │
    │ - Counter -1 (Issue #4)│
    │ - Release capacity     │
    └────────┬───────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ Session escalation  │
    │ complete & closed   │
    └─────────────────────┘
```

---

## 3. Staff Capacity Management

```
┌──────────────────────────────────────────────────┐
│ Staff Member: John                               │
│ ├─ role: 'staff'                                 │
│ ├─ supporter_status: 'online'                    │
│ ├─ max_concurrent_sessions: 5                    │
│ └─ current_sessions_count: 0                     │
└──────────────────────────────────────────────────┘

TIME: T0
    GET /staff/available
    Response: John available (0/5) ✅

    POST /escalations/assign (Escalation #1)
    ├─ Check: online? ✅
    ├─ Check: at capacity? No (0 < 5) ✅
    ├─ Assign: John.user_id
    └─ Increment: current_sessions_count → 1

┌──────────────────────────────────────────────────┐
│ Staff Member: John                               │
│ └─ current_sessions_count: 1/5 (20%)             │
└──────────────────────────────────────────────────┘

TIME: T1
    POST /escalations/assign (Escalation #2)
    ├─ Check: online? ✅
    ├─ Check: at capacity? No (1 < 5) ✅
    ├─ Assign: John.user_id
    └─ Increment: current_sessions_count → 2

┌──────────────────────────────────────────────────┐
│ Staff Member: John                               │
│ └─ current_sessions_count: 2/5 (40%)             │
└──────────────────────────────────────────────────┘

TIME: T2
    POST /escalations/assign (Escalation #3)
    ├─ Check: online? ✅
    ├─ Check: at capacity? No (2 < 5) ✅
    ├─ Assign: John.user_id
    └─ Increment: current_sessions_count → 3

... (assign more) ...

TIME: T5
┌──────────────────────────────────────────────────┐
│ Staff Member: John                               │
│ └─ current_sessions_count: 5/5 (100%) 🔴 AT CAP │
└──────────────────────────────────────────────────┘

    POST /escalations/assign (Escalation #6)
    ├─ Check: online? ✅
    ├─ Check: at capacity? YES ❌ REJECT
    └─ Response: "Staff member at capacity (5/5)"

TIME: T7 (Escalation #1 resolved)
    POST /escalations/resolve (Escalation #1)
    ├─ Check: assigned_user_id? John ✅
    ├─ Get assigned user (John)
    └─ Decrement: current_sessions_count → 4

┌──────────────────────────────────────────────────┐
│ Staff Member: John                               │
│ └─ current_sessions_count: 4/5 (80%)             │
└──────────────────────────────────────────────────┘

    POST /escalations/assign (Escalation #6 - RETRY)
    ├─ Check: online? ✅
    ├─ Check: at capacity? No (4 < 5) ✅ ACCEPT NOW
    ├─ Assign: John.user_id
    └─ Increment: current_sessions_count → 5
```

---

## 4. Request Validation Flow (Issue #6 Fix)

```
POST /api/admin/tenants/{tenant_id}/escalations

┌──────────────────────────────┐
│ FastAPI receives request     │
└──────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Parse JSON body              │
└──────────────────────────────┘
           │
           ▼
   ┌───────┴─────────┐
   │                 │
   ▼                 ▼
BEFORE:           AFTER:
request=None ❌   No default ✅
AttributeError    FastAPI validates
on access         required parameter
   │                 │
   ├─ None.reason    └─ 422 if missing
   └─ Crash!

┌──────────────────────────────┐
│ Validate with Pydantic       │
│ (EscalationRequest)          │
├─ session_id: UUID ✅          │
├─ reason: str ✅               │
├─ auto_detected: bool ✅        │
└─ keywords: List[str]? ✅       │
└──────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Route to handler function    │
│ request is guaranteed valid  │
└──────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Safe to access:              │
│ - request.session_id ✅       │
│ - request.reason ✅           │
│ - request.keywords ✅         │
└──────────────────────────────┘
```

---

## 5. ChatSession user_id Fix (Issue #1)

```
BEFORE (String Type):
┌──────────────────────────────────────────┐
│ ChatSession                              │
│ ├─ session_id: UUID                      │
│ ├─ tenant_id: UUID                       │
│ ├─ user_id: String(255) ❌ NO FK!        │
│ │  └─ "a-string-uuid"                    │
│ ├─ assigned_user_id: UUID (FK) ✅        │
│ └─ escalation_status: 'pending'          │
└──────────────────────────────────────────┘
           │
           ├─ No FK constraint → orphaned data possible
           ├─ String comparison issues
           ├─ Can't join properly with users table
           └─ Can't access: session.user.role

AFTER (UUID Type with FK):
┌──────────────────────────────────────────┐
│ ChatSession                              │
│ ├─ session_id: UUID                      │
│ ├─ tenant_id: UUID                       │
│ ├─ user_id: UUID (FK) ✅ PROPER!         │
│ │  └─ references users.user_id           │
│ ├─ assigned_user_id: UUID (FK) ✅        │
│ │  └─ references users.user_id           │
│ └─ escalation_status: 'pending'          │
└──────────────────────────────────────────┘
           │
           ├─ FK constraint prevents orphaned data
           ├─ Type-safe comparisons
           ├─ Proper join with users table
           └─ Can access: session.user.role ✅

Enables:
├─ session.user.role → Check if user is tenant/staff/admin
├─ session.user.supporter_status → Check if online/offline
├─ session.user.current_sessions_count → Track capacity
└─ Proper relationship navigation in ORM
```

---

## 6. Load Balancing Strategy

```
Multiple pending escalations, multiple staff available:

ESCALATION QUEUE:
├─ Escalation #1 (User A)
├─ Escalation #2 (User B)
├─ Escalation #3 (User C)
└─ Escalation #4 (User D)

STAFF AVAILABILITY (get /staff/available):
Returns list sorted by load (least busy first):
┌─────────────────────────┐
│ Available Staff         │
├─────────────────────────┤
│ 1. John   (1/5) 20%     │ ← Least busy, assign here
│ 2. Jane   (2/5) 40%     │
│ 3. Bob    (3/5) 60%     │
│ 4. Alice  (4/5) 80%     │
│ 5. OFF    (X/X) ❌      │ ← Offline, skip
│ 6. BUSY   (5/5) ❌      │ ← At capacity, skip
└─────────────────────────┘

ASSIGNMENT STRATEGY:
├─ Escalation #1 → Assign to John (1/5) → Now 2/5
├─ Escalation #2 → Assign to John (2/5) → Now 3/5
├─ Escalation #3 → Assign to Jane  (2/5) → Now 3/5
└─ Escalation #4 → Assign to Bob   (3/5) → Now 4/5

Result: BALANCED LOAD
├─ John: 3/5 (60%)
├─ Jane: 3/5 (60%)
├─ Bob:  4/5 (80%)
└─ All available staff fairly utilized
```

---

## 7. Complete Request Flow (Summary)

```
CLIENT                    API                     DATABASE
  │                       │                          │
  │─── 1. Create Session ─────────────────────────────────>
  │     POST /{tenant_id}/chat                      [INSERT]
  │                       │                          │
  │                       │<──── 2. Session Created ──
  │<────────────────────────  (user_id = UUID FK)
  │     {session_id, ...}
  │                       │
  │─── 3. Escalate ────────────────────────────────────>
  │     POST /escalations                           [UPDATE]
  │     {session_id, reason}
  │                       │
  │                       │<─── 4. Status = pending ──
  │<────────────────────────  (escalation_status='pending')
  │     {escalation_response}
  │
  │─── 5. Get Available ───────────────────────────────>
  │     GET /staff/available                        [SELECT]
  │                       │                  with capacity
  │                       │<─── filters ────────────
  │<────────────────────────  (supporters_status='online'
  │     {available_staff}     AND current_sessions < max)
  │
  │─── 6. Assign ──────────────────────────────────────>
  │     POST /escalations/assign                   [UPDATE x2]
  │     {session_id, user_id}
  │                       │
  │                       ├─ Verify: user online? ✅
  │                       ├─ Verify: at capacity? ✅
  │                       ├─ Update session
  │                       │  (assigned_user_id=X)  [UPDATE]
  │                       │
  │                       ├─ Update user counter +1 [UPDATE]
  │                       │  (current_sessions+1)
  │                       │<────────────────────────
  │<────────────────────────  {success=true}
  │     {escalation_response}
  │
  │─── 7. Chat Continues ──────────────────────────────>
  │     POST /{tenant_id}/chat
  │     {message, role='supporter',
  │      sender_user_id=staff_uuid}
  │                       │                       [INSERT]
  │                       │────────────────────────>
  │<────────────────────────  {message saved}
  │
  │─── 8. Resolve ─────────────────────────────────────>
  │     POST /escalations/resolve                 [UPDATE x2]
  │     {session_id, resolution_notes}
  │                       │
  │                       ├─ Update session
  │                       │  (status='resolved')   [UPDATE]
  │                       │
  │                       ├─ Decrement user counter
  │                       │  (current_sessions-1)  [UPDATE]
  │                       │<────────────────────────
  │<────────────────────────  {success=true}
  │     {escalation_response}
  │
```

---

## 8. Request Validation Chain

```
HTTP POST /api/admin/tenants/{tenant_id}/escalations
│
├─ 1. FastAPI parses JSON
│  └─ Converts body → EscalationRequest dict
│
├─ 2. Pydantic validates
│  ├─ session_id: validate UUID ✅
│  ├─ reason: validate string ✅
│  ├─ auto_detected: validate bool ✅
│  └─ keywords: validate list[str]? ✅
│
├─ 3. Handler receives request
│  ├─ request.session_id is guaranteed UUID ✅
│  ├─ request.reason is guaranteed str ✅
│  └─ No AttributeError possible ✅
│
├─ 4. Service validation
│  ├─ Verify session exists ✅
│  ├─ Verify not already escalated ✅
│  └─ Create escalation record ✅
│
└─ 5. Return response
   └─ EscalationResponse (validated schema) ✅

BEFORE (Issue #6):
request: EscalationRequest = None  ❌
    → 400/500 on access
    → AttributeError: 'NoneType' object has no attribute

AFTER (Issue #6):
request: EscalationRequest  ✅
    → Validated by FastAPI/Pydantic
    → Safe to access all fields
    → Clear 422 error if missing
```

---

## 9. Staff Availability Validation

```
POST /api/admin/tenants/{tenant_id}/escalations/assign

┌─────────────────────────────────┐
│ 1. Get escalated session        │
│    from database                │
└─────────────┬───────────────────┘
              │
         ┌────▼────┐
         │ Exists? │
         └────┬────┘
              │
        ┌─────┴──────┐
        YES          NO
        │             │
        │         [400 Not Found]
        ▼
┌─────────────────────────────────┐
│ 2. Get staff user from db       │
└─────────────┬───────────────────┘
              │
         ┌────▼───────────┐
         │ Exists + staff │
         │ + same tenant? │
         └────┬───────────┘
              │
        ┌─────┴──────────────────┐
        YES                      NO
        │                         │
        │                   [400 Not Found/Not Staff]
        ▼
┌─────────────────────────────────┐
│ 3. Check availability           │
│    supporter_status             │
└─────────────┬───────────────────┘
              │
    ┌─────────┴──────────┐
    │ in ['online',      │
    │  'available']?     │
    └─────────┬──────────┘
              │
         ┌────┴────┐
         YES      NO
         │        │
         │   [400 Not Available]
         ▼
┌─────────────────────────────────┐
│ 4. Check capacity               │
│    current_sessions <           │
│    max_sessions                 │
└─────────────┬───────────────────┘
              │
         ┌────┴────┐
         YES      NO
         │        │
         │   [400 At Capacity]
         ▼
┌─────────────────────────────────┐
│ ✅ ALL CHECKS PASSED            │
│                                 │
│ 5. Assign user:                 │
│    - session.assigned_user_id=X │
│    - session.status='assigned'  │
│    - user.counter += 1          │
│    - Save to DB                 │
└─────────────┬───────────────────┘
              │
              ▼
         [201 Created]
         {success: true}
```

---

## Color Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fixed/Working |
| ❌ | Broken/Not Allowed |
| 🔴 | At Capacity/Critical |
| ◄─── | Foreign Key Relationship |
| 1:M | One-to-Many |
| ... | Continues |

---

## Notes

- All diagrams show state after fixes are applied
- Issue numbers reference the original analysis
- Database operations shown in [BRACKETS]
- Response codes shown as [HTTP code]
