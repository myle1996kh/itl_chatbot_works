# Role Name Correction - 'staff' → 'supporter'

## Issue

The escalation system was using the wrong role name. Analysis revealed:
- **Users table** only contains: `'supporter'` and `'admin'` roles
- **Sessions table** contains tenant user references (NOT from users table)
- Escalation system incorrectly referenced `'staff'` role which doesn't exist

## Architecture Clarification

```
┌─────────────────────────────────────────────────────────┐
│ USERS TABLE (Backend staff only)                        │
│ - user_id (UUID)                                        │
│ - role: 'supporter' | 'admin'  ← Only these 2 roles    │
│ - tenant_id (scoped to tenant)                          │
│ - supporter_status: online/offline/busy/away            │
│ - current_sessions_count (escalation tracking)          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SESSIONS TABLE (Chat sessions)                          │
│ - session_id (UUID)                                     │
│ - user_id: UUID reference (NOT FK to users)            │
│   └─ This is tenant user, NOT from users table         │
│ - assigned_user_id (FK to users.user_id)               │
│   └─ When escalated, assign to a 'supporter' user      │
│ - escalation_status: none/pending/assigned/resolved    │
└─────────────────────────────────────────────────────────┘

ESCALATION FLOW:
├─ Tenant user chats → session.user_id = tenant_uuid
├─ Escalation requested → session.escalation_status = 'pending'
├─ Admin assigns supporter → session.assigned_user_id = supporter_uuid
│  (where supporter is from users table with role='supporter')
└─ Message from supporter → Message.sender_user_id = supporter_uuid
```

## Changes Made

### 1. User Model
**File**: `backend/src/models/user.py`

```python
# Before
role = Column(String(50), nullable=False)  # 'tenant_user', 'staff', 'admin'

# After
role = Column(String(50), nullable=False)  # 'supporter', 'admin'
```

### 2. Escalation Service - assign_user()
**File**: `backend/src/services/escalation_service.py`

```python
# Before
user = db.query(User).filter(
    and_(
        User.user_id == user_id,
        User.tenant_id == tenant_id,
        User.role == 'staff'  # ❌ Wrong role
    )
).first()

if not user:
    return {
        "success": False,
        "error": "User not found, not staff, or does not belong to this tenant",
    }

# After
user = db.query(User).filter(
    and_(
        User.user_id == user_id,
        User.tenant_id == tenant_id,
        User.role == 'supporter'  # ✅ Correct role
    )
).first()

if not user:
    return {
        "success": False,
        "error": "User not found, not a supporter, or does not belong to this tenant",
    }
```

### 3. Escalation Service - find_available_staff()
**File**: `backend/src/services/escalation_service.py`

```python
# Before
available_staff = db.query(User).filter(
    and_(
        User.tenant_id == tenant_id,
        User.role == 'staff',  # ❌ Wrong role
        User.supporter_status.in_(['online', 'available']),
        User.current_sessions_count < User.max_concurrent_sessions
    )
).order_by(User.current_sessions_count.asc()).all()

# After
available_supporters = db.query(User).filter(
    and_(
        User.tenant_id == tenant_id,
        User.role == 'supporter',  # ✅ Correct role
        User.supporter_status.in_(['online', 'available']),
        User.current_sessions_count < User.max_concurrent_sessions
    )
).order_by(User.current_sessions_count.asc()).all()
```

### 4. Escalation API - get_staff()
**File**: `backend/src/api/admin/escalation.py`

```python
# Before
staff = db.query(User).filter(
    User.tenant_id == tenant_id,
    User.role == 'staff'  # ❌ Wrong role
).all()

# After
staff = db.query(User).filter(
    User.tenant_id == tenant_id,
    User.role == 'supporter'  # ✅ Correct role
).all()
```

### 5. API Documentation Updates
**File**: `backend/src/api/admin/escalation.py`

- Updated `get_staff()` docstring: "Get list of staff" → "Get list of supporters"
- Updated `get_available_staff()` docstring: "Get list of available staff users" → "Get list of available supporters"
- Updated schema comments: `role='staff'` → `role='supporter'`

## Verification

All role references now correctly use `'supporter'`:

```bash
✅ No references to role='staff' remain
✅ All functions use role='supporter'
✅ All syntax valid
✅ All imports correct
```

## Key Points

1. **Users table** only has these roles:
   - `'supporter'` - Can handle escalations
   - `'admin'` - System administrators

2. **Sessions table** tracks:
   - `user_id` - Tenant user (NOT a users table FK)
   - `assigned_user_id` - Assigned supporter (FK to users with role='supporter')

3. **Escalation flow**:
   - Tenant user requests escalation
   - Admin assigns a `'supporter'` user
   - Supporter handles the chat
   - Escalation marked as resolved

## Impact

- ✅ Escalation system now uses correct role name
- ✅ find_available_staff() correctly filters supporters
- ✅ Capacity tracking works with actual supporters
- ✅ All API endpoints properly identify supporters

## Next Steps

When creating supporters in the system:
```python
# Correct way to create a supporter
user = User(
    tenant_id=tenant_uuid,
    email='supporter@example.com',
    username='supporter_name',
    password_hash='...',
    role='supporter',  # ✅ Use this role
    display_name='Supporter Name',
    supporter_status='online',
    max_concurrent_sessions=5,
    current_sessions_count=0
)
```

## Database Query Examples

### Get all supporters for a tenant
```sql
SELECT * FROM users
WHERE tenant_id = 'tenant-uuid'
AND role = 'supporter'
ORDER BY display_name;
```

### Get available supporters (with capacity)
```sql
SELECT * FROM users
WHERE tenant_id = 'tenant-uuid'
AND role = 'supporter'
AND supporter_status IN ('online', 'available')
AND current_sessions_count < max_concurrent_sessions
ORDER BY current_sessions_count ASC;
```

### Get escalations assigned to supporters
```sql
SELECT s.session_id, s.escalation_status, u.display_name
FROM sessions s
JOIN users u ON s.assigned_user_id = u.user_id
WHERE s.tenant_id = 'tenant-uuid'
AND s.escalation_status != 'none'
AND u.role = 'supporter';
```

---

## Status

✅ **FIXED** - All role references now use 'supporter'
✅ **VERIFIED** - Syntax and imports correct
✅ **READY** - System properly identifies supporters for escalation
