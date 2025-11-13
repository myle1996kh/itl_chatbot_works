# Escalation System - Deployment Checklist

## Pre-Deployment (Phase 1 - Issues #1, #4, #6)

### Code Review
- [x] All changes reviewed
- [x] No breaking changes to existing APIs
- [x] Backward compatible with existing data
- [x] Logging added for debugging
- [x] Error messages are descriptive

### Files Modified (6 files)
- [x] `backend/src/api/admin/escalation.py`
- [x] `backend/src/services/escalation_service.py`
- [x] `backend/src/models/session.py`
- [x] `backend/src/models/user.py`
- [x] `backend/src/api/chat.py`
- [x] `backend/alembic/versions/20251113_0000_fix_session_user_id_type.py` (NEW)

### Documentation Created (5 files)
- [x] `ESCALATION_SYSTEM_ANALYSIS.md` - Root cause analysis
- [x] `ESCALATION_FIXES_APPLIED.md` - Detailed fix documentation
- [x] `ESCALATION_API_REFERENCE.md` - Complete API documentation
- [x] `ESCALATION_FIX_SUMMARY.md` - This phase summary
- [x] `ESCALATION_FLOW_DIAGRAM.md` - Visual diagrams
- [x] `ESCALATION_DEPLOYMENT_CHECKLIST.md` - This checklist

---

## Database Backup

Before running migrations:

```bash
# Create backup
pg_dump -h localhost -U agenthub -d agenthub > escalation_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
file escalation_backup_*.sql
ls -lh escalation_backup_*.sql
```

### Backup Storage
- [ ] Backup file created with timestamp
- [ ] Backup location: `backend/` directory
- [ ] Backup size verified (should be >1MB if data exists)

---

## Database Migration

### Step 1: Review Migration

```bash
cd backend

# View migration file
cat alembic/versions/20251113_0000_fix_session_user_id_type.py

# Verify:
# - Uses proper SQLAlchemy operations
# - Includes rollback logic
# - Handles existing data conversion
```

### Step 2: Run Migration

```bash
# Show current version
alembic current

# Show pending migrations
alembic history | head -10

# Apply migration
alembic upgrade head

# Verify
alembic current
```

### Step 3: Verify Database Schema

```bash
# Connect to database
psql -h localhost -U agenthub -d agenthub

# Check sessions table structure
\d sessions

# Verify user_id is UUID:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sessions' AND column_name = 'user_id';

# Should show:
# column_name | data_type | is_nullable
# -----------+-----------+------------
# user_id    | uuid      | NO

# Check foreign key constraint exists:
SELECT constraint_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'sessions' AND column_name = 'user_id';

# Should show:
# fk_sessions_user_id_users

# Verify index exists:
\d sessions
# Should show indices including ix_sessions_tenant_user

\q  # exit psql
```

### Step 4: Check Migration Rollback (Safety Test)

```bash
# Test rollback capability (optional but recommended)
alembic downgrade -1

# Verify reverted
alembic current

# Re-apply
alembic upgrade head

# Verify re-applied
alembic current
```

**Checklist**:
- [ ] Migration runs without errors
- [ ] `alembic current` shows correct version
- [ ] Database schema verified
- [ ] Foreign key constraint exists
- [ ] Index recreated correctly
- [ ] Rollback tested (optional)

---

## Code Deployment

### Step 1: Install/Update Dependencies (If Needed)

```bash
cd backend

# No new dependencies added, but verify environment
pip list | grep -i sqlalchemy

# Should show SQLAlchemy 2.0+
```

### Step 2: Restart Application

```bash
# If running in development with auto-reload:
# Just restart the process

# If running with supervisor/gunicorn:
supervisorctl restart agenthub-api

# Or manually:
kill -9 $(lsof -t -i:8000)  # Kill old process
uvicorn src.main:app --reload  # Restart
```

### Step 3: Verify API Started

```bash
# Check if API is running
curl http://localhost:8000/health

# Should return 200 OK
# {
#   "status": "healthy"
# }
```

**Checklist**:
- [ ] Application starts without errors
- [ ] No import errors in logs
- [ ] Health check endpoint responds
- [ ] Logs show successful initialization

---

## Manual Testing (Required)

### Test 1: Create Staff User

```bash
# Via admin API or database
psql -h localhost -U agenthub -d agenthub

INSERT INTO users (user_id, tenant_id, email, username, password_hash, role, created_at, updated_at, supporter_status, max_concurrent_sessions, current_sessions_count)
VALUES (
  gen_random_uuid(),
  (SELECT tenant_id FROM tenants LIMIT 1),
  'john@example.com',
  'john_supporter',
  '$2b$12$...',  -- bcrypt hash
  'staff',
  NOW(),
  NOW(),
  'online',
  5,
  0
);

\q
```

Or via API (if user creation endpoint exists):
```bash
curl -X POST http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "username": "john_supporter",
    "password": "securepass123",
    "role": "staff",
    "display_name": "John Supporter"
  }'
```

**Checklist**:
- [ ] Staff user created with role='staff'
- [ ] supporter_status='online' by default
- [ ] max_concurrent_sessions=5
- [ ] current_sessions_count=0

### Test 2: Create Session with UUID user_id

```bash
# Make chat request (now expects UUID user_id in JWT)
curl -X POST http://localhost:8000/api/test-tenant-id/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello bot",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Should return 200 with session_id
# user_id is now stored as UUID in database
```

**Checklist**:
- [ ] Chat endpoint accepts UUID user_id
- [ ] Session created with user_id as UUID FK
- [ ] No type conversion errors

### Test 3: Request Escalation (Issue #6 Fix)

```bash
# Test with valid request
curl -X POST http://localhost:8000/api/admin/tenants/TENANT-UUID/escalations \
  -H "Authorization: Bearer ADMIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION-UUID",
    "reason": "User frustrated",
    "auto_detected": false
  }'

# Should return 201 with escalation_response

# Test with missing body
curl -X POST http://localhost:8000/api/admin/tenants/TENANT-UUID/escalations \
  -H "Authorization: Bearer ADMIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return 422 Unprocessable Entity (validation error)
# NOT 500 Internal Server Error
```

**Checklist**:
- [ ] Valid request returns 201 Created
- [ ] Missing required field returns 422 (not 500)
- [ ] No AttributeError in logs
- [ ] Escalation status = 'pending'

### Test 4: Get Available Staff (Issue #4 Fix)

```bash
# Get all staff
curl -X GET http://localhost:8000/api/admin/tenants/TENANT-UUID/staff \
  -H "Authorization: Bearer ADMIN-TOKEN"

# Response includes "available" field
# [
#   {
#     "user_id": "...",
#     "email": "john@example.com",
#     "available": true,  # ← NEW
#     "current_sessions_count": 0,
#     "max_concurrent_sessions": 5
#   }
# ]

# Get available staff only
curl -X GET http://localhost:8000/api/admin/tenants/TENANT-UUID/staff/available \
  -H "Authorization: Bearer ADMIN-TOKEN"

# Response is filtered list
# Only returns staff with:
# - supporter_status = 'online'/'available'
# - current_sessions_count < max_concurrent_sessions
# - Sorted by current_sessions_count (ascending)
```

**Checklist**:
- [ ] GET /staff returns all staff with "available" flag
- [ ] GET /staff/available returns only available staff
- [ ] Staff sorted by current_sessions_count (ascending)
- [ ] Response includes capacity_percentage

### Test 5: Assign Staff with Capacity Check (Issue #4 Fix)

```bash
# Assign staff (should succeed)
curl -X POST http://localhost:8000/api/admin/tenants/TENANT-UUID/escalations/assign \
  -H "Authorization: Bearer ADMIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION-UUID",
    "user_id": "STAFF-UUID"
  }'

# Response:
# {
#   "escalation_status": "assigned",
#   "assigned_user_id": "STAFF-UUID",
#   "staff_current_sessions": 1,    # ← Incremented!
#   "staff_max_sessions": 5
# }

# Assign more escalations until at capacity (5 total)
# ... repeat assignment 4 more times ...

# Try assign when at capacity (should fail)
curl -X POST http://localhost:8000/api/admin/tenants/TENANT-UUID/escalations/assign \
  -H "Authorization: Bearer ADMIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION6-UUID",
    "user_id": "STAFF-UUID"
  }'

# Response: 400 Bad Request
# {
#   "detail": "Staff member at capacity (5/5). Cannot assign more sessions."
# }
```

**Checklist**:
- [ ] First assignment succeeds
- [ ] current_sessions_count increments
- [ ] Can assign up to max_concurrent_sessions
- [ ] Exceeding capacity returns 400 (not 500)
- [ ] Error message is descriptive

### Test 6: Set Staff Offline (Issue #4 Fix)

```bash
# Update staff status to offline
psql -h localhost -U agenthub -d agenthub

UPDATE users
SET supporter_status = 'offline'
WHERE user_id = 'STAFF-UUID';

\q

# Try to get available staff
curl -X GET http://localhost:8000/api/admin/tenants/TENANT-UUID/staff/available \
  -H "Authorization: Bearer ADMIN-TOKEN"

# Response: Staff member should NOT appear in list

# Try to assign to offline staff (should fail)
curl -X POST http://localhost:8000/api/admin/tenants/TENANT-UUID/escalations/assign \
  -H "Authorization: Bearer ADMIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION-UUID",
    "user_id": "STAFF-UUID"
  }'

# Response: 400 Bad Request
# {
#   "detail": "Staff member not available (status: offline). Current status must be 'online'."
# }
```

**Checklist**:
- [ ] Offline staff not in available list
- [ ] Can't assign to offline staff
- [ ] Error message is descriptive

### Test 7: Resolve Escalation (Issue #4 Fix)

```bash
# Get current counter before resolve
curl -X GET http://localhost:8000/api/admin/tenants/TENANT-UUID/staff \
  -H "Authorization: Bearer ADMIN-TOKEN"

# Shows staff with current_sessions_count = 1

# Resolve escalation
curl -X POST http://localhost:8000/api/admin/tenants/TENANT-UUID/escalations/resolve \
  -H "Authorization: Bearer ADMIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION-UUID",
    "resolution_notes": "Issue resolved"
  }'

# Response:
# {
#   "escalation_status": "resolved"
# }

# Check counter after resolve
curl -X GET http://localhost:8000/api/admin/tenants/TENANT-UUID/staff \
  -H "Authorization: Bearer ADMIN-TOKEN"

# Shows staff with current_sessions_count = 0 (decremented)
```

**Checklist**:
- [ ] Escalation resolves successfully
- [ ] current_sessions_count decrements
- [ ] Staff becomes available again
- [ ] Can assign new escalation to same staff

### Test 8: ChatSession user_id FK (Issue #1 Fix)

```bash
# Create session
curl -X POST http://localhost:8000/api/test-tenant/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "hello",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Verify in database
psql -h localhost -U agenthub -d agenthub

-- Should show user_id as UUID type
SELECT session_id, user_id, user_id::text as user_id_text
FROM sessions
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;

-- Should show proper FK relationship
SELECT * FROM information_schema.table_constraints
WHERE table_name='sessions' AND constraint_type='FOREIGN KEY';

-- Should include:
-- fk_sessions_user_id_users

\q
```

**Checklist**:
- [ ] Session created with UUID user_id
- [ ] user_id stored as UUID type (not string)
- [ ] FK constraint exists: fk_sessions_user_id_users
- [ ] Can query using UUID directly (not string)

---

## Smoke Tests (Final)

After all tests pass, run comprehensive smoke test:

```bash
#!/bin/bash

ADMIN_TOKEN="YOUR-ADMIN-JWT-TOKEN"
TENANT_ID="YOUR-TENANT-UUID"
STAFF_UUID="YOUR-STAFF-UUID"
SESSION_UUID="YOUR-SESSION-UUID"

echo "=== SMOKE TEST ==="

echo "1. Health check..."
curl -s http://localhost:8000/health | jq .

echo "2. Get escalation queue..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/admin/tenants/$TENANT_ID/escalations | jq .

echo "3. Get all staff..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/admin/tenants/$TENANT_ID/staff | jq .

echo "4. Get available staff..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/admin/tenants/$TENANT_ID/staff/available | jq .

echo "5. Create escalation..."
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_UUID\",\"reason\":\"test\",\"auto_detected\":false}" \
  http://localhost:8000/api/admin/tenants/$TENANT_ID/escalations | jq .

echo "=== SMOKE TEST COMPLETE ==="
```

**Checklist**:
- [ ] Health check returns 200
- [ ] Escalation queue endpoint works
- [ ] Staff endpoints work
- [ ] Create escalation works
- [ ] No 500 errors in logs

---

## Rollback Plan

If issues are discovered after deployment:

### Quick Rollback (Database)

```bash
cd backend

# Revert to previous schema
alembic downgrade -1

# Verify reverted
alembic current

# Restart application
kill $(lsof -t -i:8000)
uvicorn src.main:app --reload
```

### Full Rollback (Code)

```bash
# If code changes need to be reverted:
git revert COMMIT-HASH

# Or restore from backup:
git checkout HEAD~1 -- backend/src/api/admin/escalation.py
git checkout HEAD~1 -- backend/src/services/escalation_service.py
# ... etc for all files

# Restart
kill $(lsof -t -i:8000)
uvicorn src.main:app --reload
```

### Restore Database

```bash
# If major issues, restore from backup
psql -h localhost -U agenthub -d agenthub < escalation_backup_20251113_000000.sql

# Verify data restored
psql -h localhost -U agenthub -d agenthub
SELECT COUNT(*) FROM sessions;
\q
```

**Checklist**:
- [ ] Backup file verified before running
- [ ] Rollback tested successfully
- [ ] Data integrity verified after rollback

---

## Monitoring & Verification (Post-Deployment)

### Day 1 Checks

- [ ] All escalation endpoints responding
- [ ] No 500 errors in logs
- [ ] No AttributeError exceptions
- [ ] Database queries performing normally
- [ ] Staff capacity tracking working

### Week 1 Checks

- [ ] No escalations stuck in 'pending'
- [ ] Counter not going negative
- [ ] Load balancing distribution looks good
- [ ] Staff availability status accurate

### Metrics to Monitor

```sql
-- Escalation queue size
SELECT escalation_status, COUNT(*) as count
FROM sessions
WHERE escalation_status != 'none'
GROUP BY escalation_status;

-- Staff capacity usage
SELECT
  user_id,
  username,
  current_sessions_count,
  max_concurrent_sessions,
  ROUND(100.0 * current_sessions_count / max_concurrent_sessions) as utilization_pct
FROM users
WHERE role = 'staff'
ORDER BY utilization_pct DESC;

-- Average escalation time
SELECT
  AVG(EXTRACT(EPOCH FROM (escalation_assigned_at - escalation_requested_at))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM (escalation_assigned_at - escalation_requested_at))) as max_seconds
FROM sessions
WHERE escalation_status IN ('assigned', 'resolved');
```

---

## Summary

### Issues Fixed
- [x] Issue #6: Request parameter validation
- [x] Issue #1: ChatSession user_id type & FK
- [x] Issue #4: Staff availability & capacity

### Deployment Steps
1. [x] Code review complete
2. [ ] Database backup created
3. [ ] Migration applied
4. [ ] Database schema verified
5. [ ] Application restarted
6. [ ] Manual tests passed
7. [ ] Smoke tests passed
8. [ ] Monitoring enabled

### Sign-Off
- [ ] Development team: _____________
- [ ] QA team: _____________
- [ ] DevOps/Database admin: _____________
- [ ] Product manager: _____________

---

## Contact & Support

For issues during deployment:
- Check `ESCALATION_SYSTEM_ANALYSIS.md` for root causes
- Check `ESCALATION_API_REFERENCE.md` for endpoint details
- Check logs for specific error messages
- Refer to rollback plan above

**Next phase**: Issues #3, #5, #2, #7 (Chat integration, validation, role logic)
