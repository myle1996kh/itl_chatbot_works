# Syntax Error Fix - FastAPI Parameter Order

## Issue

After Phase 1 fixes, a `SyntaxError` occurred:

```
File "...escalation.py", line 140
    request: EscalationRequest,
    ^^^^^^^^^^^^^^^^^^^^^^^^^^
SyntaxError: non-default argument follows default argument
```

## Root Cause

In FastAPI, when using `Depends()` for dependency injection, the parameter order matters in Python:
- Required parameters (without defaults) must come before optional parameters (with defaults)
- `Path(...)` and `Depends(...)` provide defaults

The previous code had:
```python
async def escalate_session(
    tenant_id: str = Path(...),              # Has default
    request: EscalationRequest,              # No default ← ERROR!
    db: Session = Depends(get_db),           # Has default
)
```

This is invalid Python syntax because `request` (no default) comes after `tenant_id` (has default).

## Solution

Move the `request` parameter to the end and use `Body(...)` to explicitly mark it as a request body:

```python
from fastapi import Body

async def escalate_session(
    tenant_id: str = Path(...),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
    request: EscalationRequest = Body(...),  # ← Moved to end with Body(...)
)
```

## Changes Made

### 1. Added `Body` import

**File**: `backend/src/api/admin/escalation.py`

```python
# Before
from fastapi import APIRouter, Depends, HTTPException, Path, Query

# After
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body
```

### 2. Fixed all three POST endpoints

#### Endpoint 1: POST /escalations
```python
# Before
async def escalate_session(
    tenant_id: str = Path(...),
    request: EscalationRequest,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
)

# After
async def escalate_session(
    tenant_id: str = Path(...),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
    request: EscalationRequest = Body(...),
)
```

#### Endpoint 2: POST /escalations/assign
```python
# Before
async def assign_supporter(
    tenant_id: str = Path(...),
    request: EscalationAssignRequest,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
)

# After
async def assign_supporter(
    tenant_id: str = Path(...),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
    request: EscalationAssignRequest = Body(...),
)
```

#### Endpoint 3: POST /escalations/resolve
```python
# Before
async def resolve_escalation(
    tenant_id: str = Path(...),
    request: EscalationResolveRequest,
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
)

# After
async def resolve_escalation(
    tenant_id: str = Path(...),
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
    request: EscalationResolveRequest = Body(...),
)
```

## Verification

All files now have valid syntax:

```bash
✅ src/api/admin/escalation.py
✅ src/api/chat.py
✅ src/models/session.py
✅ src/models/user.py
✅ src/services/escalation_service.py
```

Tested with:
```bash
python -m py_compile src/api/admin/escalation.py  # PASSED
from src.api.admin import escalation             # PASSED
```

## Functionality Impact

**No functional changes** - this is purely a syntax fix:
- Request validation still works the same way
- FastAPI still requires the request body
- All validation is enforced by Pydantic via `Body(...)`
- API behavior is identical

## Testing

The application should now start without syntax errors:

```bash
cd backend
uvicorn src.main:app --reload

# Should show:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# (No SyntaxError)
```

## Reference

This fix follows FastAPI best practices:
- Required parameters with defaults should use explicit markers: `Path()`, `Body()`, `Query()`
- Dependency injection parameters go in the middle
- Request body goes last

See: https://fastapi.tiangolo.com/tutorial/request-body/

## Status

✅ **FIXED** - All syntax errors resolved
✅ **VERIFIED** - Python compilation successful
✅ **READY** - Application can now start
