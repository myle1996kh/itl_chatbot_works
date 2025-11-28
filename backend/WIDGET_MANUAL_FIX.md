# Widget Frontend - Quick Summary

## ✅ What Needs to Be Done

The `frontend/widget.tsx` file needs to be updated to use widget-authenticated endpoints instead of JWT-protected endpoints.

## 🔧 Required Changes

### Change 1: Remove User Creation (Lines 77-102)
**Remove this code** that calls `/api/{tenantId}/chat_users`:
```typescript
let currentUserId = localStorage.getItem(`agenthub_user_${tenantId}`);
if (!currentUserId) {
    const userUrl = `${currentOrigin}/api/${tenantId}/chat_users`;
    // ... API call to create user
}
```

**Replace with**:
```typescript
let currentUserId = localStorage.getItem(`agenthub_user_${tenantId}`);
if (!currentUserId) {
    currentUserId = `widget_user_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    localStorage.setItem(`agenthub_user_${tenantId}`, currentUserId);
}
```

### Change 2: Update Session Creation (Lines 109-114)
**Change from**:
```typescript
const sessionUrl = `${currentOrigin}/api/${tenantId}/sessions?user_id=${currentUserId}`;
const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
```

**Change to**:
```typescript
const sessionUrl = `${currentOrigin}/api/widget/chat?tenant_id=${tenantId}`;
const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Widget-Key': widgetKey  // Add this!
    },
    body: JSON.stringify({
      message: '',
      session_id: crypto.randomUUID()
    })
});
```

## 📝 Manual Edit Instructions

1. Open `frontend/widget.tsx`
2. Find line 77-102 (user creation)
3. Replace with simple local user ID generation
4. Find line 109-114 (session creation)
5. Change endpoint to `/api/widget/chat`
6. Add `X-Widget-Key` header
7. Add request body with message and session_id

## ✅ Result

After these changes:
- ✅ No more 401 errors
- ✅ Widget works without JWT
- ✅ Uses widget_key authentication

---

**Status**: File restored from git. Ready for manual editing.
