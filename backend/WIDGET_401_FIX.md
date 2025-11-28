# Widget 401 Unauthorized - Quick Fix

**Issue**: Widget getting 401 Unauthorized when trying to access session endpoints

**Error**: `GET /api/3105b788-b5ff-4d56-88a9-532af4ab4ded/session/... HTTP/1.1" 401 Unauthorized`

---

## 🔍 Root Cause

The widget is trying to access endpoints that require JWT authentication, but:
1. Widget uses **widget_key** authentication (not JWT)
2. Some endpoints are protected by JWT middleware
3. Widget endpoints need special handling

---

## ⚡ Quick Fix Options

### Option 1: Enable Development Mode (Quickest)

**For testing only!**

Edit `.env`:
```bash
DISABLE_AUTH=true
```

Restart server:
```bash
# Stop current server (Ctrl+C)
uvicorn src.main:app --reload
```

**Pros**: ✅ Widget works immediately  
**Cons**: ⚠️ Disables ALL authentication (dev only!)

---

### Option 2: Use Widget-Specific Endpoints (Recommended)

The widget should use public endpoints that don't require JWT:

**Current (Wrong)**:
```javascript
// This requires JWT authentication
fetch(`/api/${tenantId}/session/${sessionId}`)
```

**Correct (Widget endpoints)**:
```javascript
// This uses widget_key authentication
fetch(`/api/widget-config?tenant_id=${tenantId}&widget_key=${widgetKey}`)
```

---

### Option 3: Check Widget Frontend Code

The widget frontend needs to send the widget_key with requests.

**Check**: Does the widget frontend include widget_key in requests?

**Example**:
```javascript
// Widget should send widget_key
fetch(`/api/widget/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Widget-Key': widgetKey  // Widget authentication
  },
  body: JSON.stringify({
    message: 'Hello',
    tenant_id: tenantId
  })
})
```

---

## 🔧 Detailed Fix

### Step 1: Check Current Auth Setting

```bash
# Check .env file
grep DISABLE_AUTH .env
```

**For development/testing**:
```bash
DISABLE_AUTH=true
```

**For production**:
```bash
DISABLE_AUTH=false
```

### Step 2: Verify Widget Endpoint

The widget should load from:
```
http://localhost:8000/widget/wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded
```

This endpoint should:
- ✅ Serve the widget HTML/JS
- ✅ Not require JWT authentication
- ✅ Validate widget_key internally

### Step 3: Check Widget Route

The widget route should be exempt from JWT auth:

**File**: `src/main.py`

```python
# Widget routes should NOT have auth middleware
app.include_router(public_widgets.router)  # No auth required
```

---

## 🐛 Debugging

### Check Server Logs

Look for:
```
INFO: 127.0.0.1:62110 - "GET /api/3105b788.../session/... HTTP/1.1" 401
```

This means:
- ❌ Endpoint requires JWT auth
- ❌ Widget not sending JWT token
- ✅ Widget should use different endpoint

### Check Widget Console

Open browser console (F12) and look for:
```
Failed to fetch: 401 Unauthorized
```

### Test Widget Endpoint Directly

```bash
# This should work without auth
curl "http://localhost:8000/api/widget-config?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded&widget_key=wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
```

**Expected**: Widget configuration (200 OK)

---

## 📝 Recommended Solution

### For Development/Testing

**1. Temporarily disable auth**:
```bash
# .env
DISABLE_AUTH=true
```

**2. Restart server**:
```bash
uvicorn src.main:app --reload
```

**3. Test widget**:
```bash
# Open test_widget.html in browser
start test_widget.html
```

### For Production

**1. Keep auth enabled**:
```bash
# .env
DISABLE_AUTH=false
```

**2. Ensure widget uses correct endpoints**:
- Widget should use `/api/widget-config` (no auth)
- Widget should send `widget_key` with requests
- Widget should NOT use JWT-protected endpoints

**3. Check widget frontend code**:
- Verify it's using widget_key authentication
- Verify it's not trying to access JWT-protected endpoints

---

## 🎯 Quick Test

### Test 1: Widget Config Endpoint (Should Work)

```bash
curl "http://localhost:8000/api/widget-config?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded&widget_key=wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae"
```

**Expected**: 200 OK with widget config

### Test 2: Session Endpoint (Requires Auth)

```bash
curl "http://localhost:8000/api/3105b788-b5ff-4d56-88a9-532af4ab4ded/session/test"
```

**Expected**: 401 Unauthorized (correct!)

---

## 🔒 Security Note

**Development**:
- ✅ OK to use `DISABLE_AUTH=true` for testing
- ✅ Widget will work without authentication

**Production**:
- ⚠️ NEVER use `DISABLE_AUTH=true`
- ✅ Widget must use widget_key authentication
- ✅ Ensure widget frontend sends widget_key properly

---

## ✅ Summary

**Problem**: Widget getting 401 because it's trying to use JWT-protected endpoints

**Quick Fix** (Development):
```bash
# .env
DISABLE_AUTH=true

# Restart server
uvicorn src.main:app --reload
```

**Proper Fix** (Production):
- Widget should use `/api/widget-config` endpoint
- Widget should send `widget_key` with requests
- Widget should not access JWT-protected endpoints

---

**Next Step**: Set `DISABLE_AUTH=true` in `.env` and restart server to test widget!
