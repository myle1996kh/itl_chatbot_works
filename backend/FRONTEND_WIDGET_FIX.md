# Frontend Widget Fix - Update to Use Widget Endpoints

**Issue**: Frontend is calling `/api/{tenant_id}/session/...` which requires JWT authentication

**Solution**: Update frontend to use `/api/widget/session/...` with widget_key authentication

---

## 🔍 Files That Need Updating

Based on the error and code search, these frontend files need updates:

1. **`frontend/services/sessionService.ts`** - Session management
2. **`frontend/services/chatService.ts`** - Chat functionality  
3. **`frontend/services/chatUserService.ts`** - User chat sessions
4. **`frontend/widget.tsx`** - Widget component

---

## 📝 Required Changes

### 1. Update Session Service

**File**: `frontend/services/sessionService.ts`

**Line 99** - Change from:
```typescript
`${base}/api/${tenantId}/session?${params.toString()}`
```

**To**:
```typescript
`${base}/api/widget/session?tenant_id=${tenantId}&${params.toString()}`
```

**Line 240** - Change from:
```typescript
`${base}/api/${tenantId}/session/${sessionId}`
```

**To**:
```typescript
`${base}/api/widget/session/${sessionId}?tenant_id=${tenantId}`
```

**Add Widget Key Header**:
```typescript
headers: {
  'X-Widget-Key': widgetKey,  // Get from URL params
  'Content-Type': 'application/json'
}
```

---

### 2. Update Chat Service

**File**: `frontend/services/chatService.ts`

**Line 225** - Change from:
```typescript
`${API_CONFIG.BASE_URL}/api/${tenantId}/session?user_id=default_user`
```

**To**:
```typescript
`${API_CONFIG.BASE_URL}/api/widget/chat?tenant_id=${tenantId}`
```

**Add Widget Key Header**:
```typescript
headers: {
  'X-Widget-Key': widgetKey,
  'Content-Type': 'application/json'
}
```

---

### 3. Update Chat User Service

**File**: `frontend/services/chatUserService.ts`

**Line 146** - Change from:
```typescript
`${API_CONFIG.BASE_URL}/api/${tenantId}/sessions?user_id=${encodeURIComponent(userId)}`
```

**To**:
```typescript
`${API_CONFIG.BASE_URL}/api/widget/session?tenant_id=${tenantId}`
```

**Line 199** - Change from:
```typescript
`${API_CONFIG.BASE_URL}/api/${tenantId}/sessions/${sessionId}`
```

**To**:
```typescript
`${API_CONFIG.BASE_URL}/api/widget/session/${sessionId}?tenant_id=${tenantId}`
```

---

### 4. Extract Widget Key from URL

**File**: `frontend/widget.tsx` (or main widget file)

**Add at the top**:
```typescript
// Extract widget credentials from URL
const urlParams = new URLSearchParams(window.location.search);
const tenantId = urlParams.get('tenant_id');
const widgetKey = window.location.pathname.split('/widget/')[1]?.split('?')[0];

// Store for use in API calls
const API_CONFIG = {
  BASE_URL: window.location.origin,
  WIDGET_KEY: widgetKey,
  TENANT_ID: tenantId
};
```

---

## 🔧 Complete Example

### Before (JWT-protected):
```typescript
// ❌ Old way - requires JWT
const response = await fetch(
  `${base}/api/${tenantId}/session/${sessionId}`,
  {
    headers: {
      'Authorization': `Bearer ${jwtToken}`,  // Widget doesn't have this!
      'Content-Type': 'application/json'
    }
  }
);
```

### After (Widget-authenticated):
```typescript
// ✅ New way - uses widget_key
const response = await fetch(
  `${base}/api/widget/session/${sessionId}?tenant_id=${tenantId}`,
  {
    headers: {
      'X-Widget-Key': widgetKey,  // Widget has this!
      'Content-Type': 'application/json'
    }
  }
);
```

---

## 📊 Endpoint Mapping

| Old Endpoint (JWT) | New Endpoint (Widget) |
|-------------------|----------------------|
| `POST /api/{tenant_id}/chat` | `POST /api/widget/chat?tenant_id={tenant_id}` |
| `GET /api/{tenant_id}/session/{id}` | `GET /api/widget/session/{id}?tenant_id={tenant_id}` |
| `GET /api/{tenant_id}/session/{id}/messages` | `GET /api/widget/session/{id}/messages?tenant_id={tenant_id}` |

**Header Change**:
- Old: `Authorization: Bearer {jwt_token}`
- New: `X-Widget-Key: {widget_key}`

---

## 🎯 Quick Fix Steps

### Step 1: Find Widget Key in Frontend

```typescript
// In your main widget file
const getWidgetCredentials = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname;
  
  return {
    widgetKey: path.split('/widget/')[1]?.split('?')[0],
    tenantId: urlParams.get('tenant_id')
  };
};

const { widgetKey, tenantId } = getWidgetCredentials();
```

### Step 2: Create API Helper

```typescript
// Create a helper for widget API calls
const widgetFetch = async (endpoint: string, options: RequestInit = {}) => {
  const { widgetKey, tenantId } = getWidgetCredentials();
  
  const url = endpoint.includes('?')
    ? `${endpoint}&tenant_id=${tenantId}`
    : `${endpoint}?tenant_id=${tenantId}`;
  
  return fetch(url, {
    ...options,
    headers: {
      'X-Widget-Key': widgetKey,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};

// Usage
const response = await widgetFetch('/api/widget/chat', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello', session_id: 'test' })
});
```

### Step 3: Update All API Calls

Replace all instances of:
- `/api/${tenantId}/session` → `/api/widget/session`
- `/api/${tenantId}/chat` → `/api/widget/chat`
- `Authorization: Bearer` → `X-Widget-Key`

---

## 🧪 Testing

### Test 1: Check Widget Key Extraction

```typescript
console.log('Widget Key:', widgetKey);
console.log('Tenant ID:', tenantId);
// Should show: wk_5EcDPUz6yDOapawv08CfQ9W2fcjYBH5E
// Should show: 3105b788-b5ff-4d56-88a9-532af4ab4ded
```

### Test 2: Test API Call

```typescript
const response = await widgetFetch('/api/widget/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: 'Test message',
    session_id: 'test-session'
  })
});

console.log('Status:', response.status);  // Should be 200, not 401
```

---

## ⚠️ Common Mistakes

1. **Forgetting tenant_id in query params**:
   ```typescript
   // ❌ Wrong
   `/api/widget/session/${id}`
   
   // ✅ Correct
   `/api/widget/session/${id}?tenant_id=${tenantId}`
   ```

2. **Using Authorization header instead of X-Widget-Key**:
   ```typescript
   // ❌ Wrong
   headers: { 'Authorization': `Bearer ${token}` }
   
   // ✅ Correct
   headers: { 'X-Widget-Key': widgetKey }
   ```

3. **Not extracting widget_key from URL**:
   ```typescript
   // ❌ Wrong - hardcoded
   const widgetKey = 'wk_xxx';
   
   // ✅ Correct - from URL
   const widgetKey = window.location.pathname.split('/widget/')[1]?.split('?')[0];
   ```

---

## 📚 Summary

### What to Change

1. **Update endpoint URLs**: `/api/{tenant_id}/...` → `/api/widget/...`
2. **Add tenant_id as query param**: `?tenant_id={tenant_id}`
3. **Change header**: `Authorization: Bearer` → `X-Widget-Key`
4. **Extract widget_key from URL**: Get from `window.location.pathname`

### Files to Update

- `frontend/services/sessionService.ts`
- `frontend/services/chatService.ts`
- `frontend/services/chatUserService.ts`
- `frontend/widget.tsx`

---

## 🎯 Next Steps

1. **Extract widget credentials** from URL in main widget file
2. **Create API helper** function with widget authentication
3. **Update all API calls** to use new endpoints
4. **Test** with `DISABLE_AUTH=false`

Once updated, the widget will work without requiring JWT tokens! ✅
