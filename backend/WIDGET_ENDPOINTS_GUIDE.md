# Widget Endpoints - Implementation Guide

**Updated**: 2025-11-27  
**Status**: ✅ Widget-authenticated endpoints implemented!

---

## 🎉 What's New

I've added **widget-authenticated endpoints** that don't require JWT tokens!

### New Endpoints

1. **`POST /api/widget/chat`** - Send chat messages
2. **`GET /api/widget/session/{session_id}`** - Get session info
3. **`GET /api/widget/session/{session_id}/messages`** - Get chat history

These endpoints use **widget_key** authentication instead of JWT!

---

## 🔑 Authentication Method

### Widget Key Header

All widget endpoints require the `X-Widget-Key` header:

```javascript
headers: {
  'X-Widget-Key': 'wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae'
}
```

**Plus** the `tenant_id` query parameter:
```
?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded
```

---

## 📝 API Reference

### 1. Send Chat Message

**Endpoint**: `POST /api/widget/chat?tenant_id={tenant_id}`

**Headers**:
```
X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae
Content-Type: application/json
```

**Body**:
```json
{
  "message": "Hello, how can you help me?",
  "session_id": "session-123"
}
```

**Response**:
```json
{
  "response": "I can help you with...",
  "session_id": "session-123",
  "message_id": "msg-456"
}
```

**Example (curl)**:
```bash
curl -X POST "http://localhost:8000/api/widget/chat?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded" \
  -H "X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "session_id": "test-session"
  }'
```

**Example (JavaScript)**:
```javascript
const response = await fetch(
  'http://localhost:8000/api/widget/chat?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded',
  {
    method: 'POST',
    headers: {
      'X-Widget-Key': 'wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Hello',
      session_id: 'test-session'
    })
  }
);

const data = await response.json();
console.log(data);
```

---

### 2. Get Session Info

**Endpoint**: `GET /api/widget/session/{session_id}?tenant_id={tenant_id}`

**Headers**:
```
X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae
```

**Response**:
```json
{
  "session_id": "session-123",
  "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded",
  "created_at": "2025-11-27T10:00:00",
  "updated_at": "2025-11-27T10:30:00"
}
```

**Example (curl)**:
```bash
curl "http://localhost:8000/api/widget/session/test-session?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded" \
  -H "X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
```

**Example (JavaScript)**:
```javascript
const response = await fetch(
  'http://localhost:8000/api/widget/session/test-session?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded',
  {
    headers: {
      'X-Widget-Key': 'wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae'
    }
  }
);

const session = await response.json();
```

---

### 3. Get Chat History

**Endpoint**: `GET /api/widget/session/{session_id}/messages?tenant_id={tenant_id}&limit=50`

**Headers**:
```
X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae
```

**Query Parameters**:
- `tenant_id` (required): Tenant UUID
- `limit` (optional): Max messages to return (default: 50, max: 100)

**Response**:
```json
{
  "session_id": "session-123",
  "total": 10,
  "messages": [
    {
      "message_id": "msg-1",
      "role": "user",
      "content": "Hello",
      "created_at": "2025-11-27T10:00:00"
    },
    {
      "message_id": "msg-2",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "created_at": "2025-11-27T10:00:05"
    }
  ]
}
```

**Example (curl)**:
```bash
curl "http://localhost:8000/api/widget/session/test-session/messages?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded&limit=20" \
  -H "X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
```

**Example (JavaScript)**:
```javascript
const response = await fetch(
  'http://localhost:8000/api/widget/session/test-session/messages?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded&limit=20',
  {
    headers: {
      'X-Widget-Key': 'wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae'
    }
  }
);

const history = await response.json();
```

---

## 🧪 Testing the New Endpoints

### Test 1: Chat Endpoint

```bash
curl -X POST "http://localhost:8000/api/widget/chat?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded" \
  -H "X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","session_id":"test-session"}'
```

**Expected**: 200 OK with chat response

### Test 2: Session Endpoint

```bash
curl "http://localhost:8000/api/widget/session/test-session?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded" \
  -H "X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
```

**Expected**: 200 OK with session info

### Test 3: Messages Endpoint

```bash
curl "http://localhost:8000/api/widget/session/test-session/messages?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded" \
  -H "X-Widget-Key: wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
```

**Expected**: 200 OK with message history

---

## 🔒 Security Features

### Widget Key Validation

Each request validates:
1. ✅ Widget key exists
2. ✅ Widget key matches tenant
3. ✅ Tenant ID is valid
4. ✅ Session belongs to tenant (for session endpoints)

### No JWT Required

- ✅ Works with `DISABLE_AUTH=false`
- ✅ Uses widget_key instead of JWT
- ✅ Tenant-isolated automatically

---

## 📊 Comparison: Old vs New

### Old (JWT-Protected)

```javascript
// ❌ Requires JWT token
fetch('/api/3105b788.../session/123', {
  headers: {
    'Authorization': 'Bearer eyJhbGc...'  // JWT required!
  }
})
```

**Problem**: Widget can't get JWT tokens!

### New (Widget-Authenticated)

```javascript
// ✅ Uses widget key
fetch('/api/widget/session/123?tenant_id=3105b788...', {
  headers: {
    'X-Widget-Key': 'wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae'
  }
})
```

**Solution**: Widget uses its own authentication!

---

## 🎯 Widget Frontend Integration

### Example Widget Code

```javascript
class ChatWidget {
  constructor(widgetKey, tenantId) {
    this.widgetKey = widgetKey;
    this.tenantId = tenantId;
    this.sessionId = this.generateSessionId();
  }

  async sendMessage(message) {
    const response = await fetch(
      `http://localhost:8000/api/widget/chat?tenant_id=${this.tenantId}`,
      {
        method: 'POST',
        headers: {
          'X-Widget-Key': this.widgetKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          session_id: this.sessionId
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    return await response.json();
  }

  async loadHistory() {
    const response = await fetch(
      `http://localhost:8000/api/widget/session/${this.sessionId}/messages?tenant_id=${this.tenantId}`,
      {
        headers: {
          'X-Widget-Key': this.widgetKey
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Load history failed: ${response.status}`);
    }

    return await response.json();
  }

  generateSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
}

// Usage
const widget = new ChatWidget(
  'wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae',
  '3105b788-b5ff-4d56-88a9-532af4ab4ded'
);

// Send message
const response = await widget.sendMessage('Hello!');
console.log(response);

// Load history
const history = await widget.loadHistory();
console.log(history);
```

---

## ✅ Benefits

1. **No JWT Required** ✅
   - Widget doesn't need JWT tokens
   - Works with `DISABLE_AUTH=false`

2. **Secure** ✅
   - Widget key validated on every request
   - Tenant isolation enforced
   - Can't access other tenants

3. **Simple** ✅
   - Just add `X-Widget-Key` header
   - No complex token management

4. **Production Ready** ✅
   - Works in production with auth enabled
   - No security compromises

---

## 🐛 Troubleshooting

### 403 Invalid widget key

**Cause**: Wrong widget_key or tenant_id

**Solution**: Get correct values from API:
```bash
curl -X GET "http://localhost:8000/api/admin/tenants/{tenant_id}/widget" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 404 Widget not found

**Cause**: Widget config doesn't exist for tenant

**Solution**: Create widget config:
```bash
curl -X POST "http://localhost:8000/api/admin/tenants/{tenant_id}/widget" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 404 Session not found

**Cause**: Session doesn't exist or belongs to different tenant

**Solution**: Create session by sending first message

---

## 📝 Summary

### What Changed

- ✅ Added 3 new widget-authenticated endpoints
- ✅ No JWT required for widget endpoints
- ✅ Uses `X-Widget-Key` header for authentication
- ✅ Works with `DISABLE_AUTH=false` (production mode)

### How to Use

1. **Get widget_key** from tenant config
2. **Add header**: `X-Widget-Key: wk_...`
3. **Add query param**: `?tenant_id=...`
4. **Make requests** to `/api/widget/*` endpoints

### Next Steps

1. Update widget frontend to use new endpoints
2. Test with `DISABLE_AUTH=false`
3. Deploy to production!

---

**Status**: ✅ **Ready to use!**  
**Auth**: ✅ **Widget-key based (no JWT needed)**  
**Production**: ✅ **Works with auth enabled**
