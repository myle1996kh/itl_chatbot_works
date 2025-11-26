# Widget Authentication Fix

## Problem

The widget embed code was failing silently because two critical endpoints required **authentication that the public widget couldn't provide**:

1. `POST /api/{tenant_id}/chat_users` - Create anonymous user
2. `POST /api/{tenant_id}/sessions` - Create chat session

Both had `Depends(get_current_tenant)` which requires JWT authentication. When the widget (running in iframe on customer website) tried to call these, the requests were blocked.

**Error:** Widget stuck in loading state, no console errors (requests silently failed)

## Solution

Removed the `get_current_tenant` dependency from both endpoints since:

1. **These are PUBLIC widget endpoints** - Any website embedding the widget needs to use them
2. **Tenant isolation is already enforced** - Validated by path parameter (`{tenant_id}`)
3. **User validation is sufficient** - Chat user must exist in that tenant
4. **No sensitive data exposed** - Only creates anonymous guest users/sessions

## Files Modified

### 1. `backend/src/api/chat_users.py` (line 29-34)

**Before:**
```python
@router.post("/{tenant_id}/chat_users", response_model=ChatUserResponse)
async def create_chat_user(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: ChatUserCreate = Body(...),
    db: Session = Depends(get_db),
    current_tenant: Optional[str] = Depends(get_current_tenant),  # ❌ REMOVED
) -> ChatUserResponse:
```

**After:**
```python
@router.post("/{tenant_id}/chat_users", response_model=ChatUserResponse)
async def create_chat_user(
    tenant_id: str = Path(..., description="Tenant UUID"),
    request: ChatUserCreate = Body(...),
    db: Session = Depends(get_db),
) -> ChatUserResponse:
    """
    ...
    **PUBLIC ENDPOINT** - No authentication required (widget uses this).
    Tenant isolation is enforced by path parameter validation.
    """
```

### 2. `backend/src/api/sessions.py` (line 256-262)

**Before:**
```python
@router.post("/{tenant_id}/sessions", response_model=SessionCreateResponse)
async def create_session(
    tenant_id: str = Path(..., description="Tenant UUID"),
    user_id: str = Query(..., description="Chat user UUID"),
    request: Optional[SessionCreateRequest] = Body(None),
    db: Session = Depends(get_db),
    current_tenant: Optional[str] = Depends(get_current_tenant),  # ❌ REMOVED
) -> SessionCreateResponse:
```

**After:**
```python
@router.post("/{tenant_id}/sessions", response_model=SessionCreateResponse)
async def create_session(
    tenant_id: str = Path(..., description="Tenant UUID"),
    user_id: str = Query(..., description="Chat user UUID"),
    request: Optional[SessionCreateRequest] = Body(None),
    db: Session = Depends(get_db),
) -> SessionCreateResponse:
    """
    ...
    **PUBLIC ENDPOINT** - No authentication required (widget uses this).
    Tenant isolation is enforced by path parameter and user validation.
    """
```

## Security Implications

✅ **Still Secure:**
- Tenant ID validated on every request
- Chat user must exist in that tenant before session creation
- No API keys or admin operations exposed
- Rate limiting can still be applied per tenant
- Anonymous users are isolated from authenticated users

❌ **Potential Attack Surface:**
- Could theoretically enumerate valid tenant IDs (but they're already public in embed code)
- Anyone can create anonymous users (by design - guests from websites)

## Testing

After restart, the widget should now:

```
🔧 Widget Init: { widgetKey: 'wk_...', tenantId: '...' }
📡 Fetching widget config from: ...
✅ Widget config loaded: { ... }
👤 Creating new chat user at: http://localhost:8000/api/{tenant_id}/chat_users
👤 User creation response status: 201
✅ Chat user created: {user_id}
🔄 Creating session at: http://localhost:8000/api/{tenant_id}/sessions?user_id={user_id}
📡 Session response status: 201
✅ Session created: {session_id}
```

Then the full chat interface appears in the bottom-right corner.

## Related Code

**Endpoints still requiring authentication:**
- `GET /api/{tenant_id}/session` - List sessions (requires admin/auth)
- `GET /api/admin/...` - All admin endpoints
- `POST /api/{tenant_id}/chat` - Send message (requires valid session)

**Endpoints now public:**
- `GET /api/widget-config` - Get widget config (already public)
- `POST /api/{tenant_id}/chat_users` - Create anonymous user (NEW)
- `POST /api/{tenant_id}/sessions` - Create session (NEW)
