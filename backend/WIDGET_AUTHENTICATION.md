# Widget Embed Code & Authentication

**Question**: Is the token automatically included in the widget embed code?

**Answer**: **No, and that's by design!** ✅

---

## 🔑 How Widget Authentication Works

### The Widget Key System

The widget uses a **different authentication mechanism** than the main API:

1. **Widget Key** (`wk_...`) - Public identifier
2. **Widget Secret** - Server-side only (never exposed)
3. **Tenant ID** - Identifies which tenant

### Why No JWT Token in Embed Code?

**Security Reasons**:
- ✅ Embed code is **public** (visible in website source)
- ✅ JWT tokens are **private** (should never be exposed)
- ✅ Widget key is **safe to expose** (designed for public use)

---

## 📝 Widget Embed Code Structure

### What's Generated

```html
<script>
  (function() {
    var chatWidget = document.createElement('iframe');
    chatWidget.src = 'http://localhost:8000/widget/wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded';
    // ... styling and event handlers
  })();
</script>
```

### What's Included ✅

1. **Widget Key**: `wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae`
   - Public identifier
   - Safe to expose
   - Used for widget authentication

2. **Tenant ID**: `3105b788-b5ff-4d56-88a9-532af4ab4ded`
   - Identifies the tenant
   - Public information
   - Used for routing

3. **API Base URL**: `http://localhost:8000`
   - Automatically set based on environment
   - Development: `http://localhost:8000`
   - Production: Your production domain

### What's NOT Included ❌

1. **JWT Token** - Never included (security risk)
2. **Widget Secret** - Server-side only
3. **API Keys** - Never exposed

---

## 🔒 Authentication Flow

### 1. User Visits Website with Widget

```
Website → Loads embed code → Creates iframe
```

### 2. Widget Authenticates

```
Widget → Sends widget_key to backend
Backend → Validates widget_key + widget_secret
Backend → Returns widget configuration
```

### 3. User Chats

```
User → Sends message via widget
Widget → Uses widget_key for auth
Backend → Validates and processes
Backend → Returns response
```

---

## 🛡️ Security Model

### Widget Key vs JWT Token

| Feature | Widget Key | JWT Token |
|---------|-----------|-----------|
| **Purpose** | Public widget auth | User/admin auth |
| **Exposure** | ✅ Safe to expose | ❌ Must be private |
| **Location** | Frontend embed code | Backend API calls |
| **Validation** | Widget secret (server) | Public key (server) |
| **Scope** | Single tenant widget | Full API access |

### Why This is Secure

1. **Widget Key is Public** ✅
   - Designed to be embedded in websites
   - Only allows access to that tenant's widget
   - Cannot access admin functions
   - Cannot access other tenants

2. **Widget Secret is Private** ✅
   - Stored in database only
   - Never sent to frontend
   - Used for server-side validation
   - Can be regenerated if compromised

3. **Tenant Isolation** ✅
   - Widget key is tied to specific tenant
   - Cannot access other tenant's data
   - Enforced at database level

---

## 📊 How to Get Widget Embed Code

### Option 1: Via API (Admin)

```bash
# Get embed code for a tenant
curl -X GET "http://localhost:8000/api/admin/tenants/{tenant_id}/widget/embed-code" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response**:
```json
{
  "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded",
  "widget_key": "wk_apfVItl1M6nCu5GIVZP49vd1QUDOU1ae",
  "embed_code": "<script>...</script>"
}
```

### Option 2: Via Admin UI

1. Login to admin panel
2. Go to Tenant Settings
3. Click "Get Widget Code"
4. Copy the generated code

### Option 3: When Creating Tenant

```bash
# Create tenant (automatically generates widget)
curl -X POST "http://localhost:8000/api/admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "domain": "mycompany.com"
  }'
```

**Response includes**:
```json
{
  "tenant_id": "...",
  "widget_key": "wk_...",
  "embed_code": "<script>...</script>"
}
```

---

## 🔄 Widget Key Rotation

### When to Rotate

- Security breach suspected
- Regular security maintenance
- Changing widget configuration

### How to Rotate

```bash
# Regenerate widget keys
curl -X POST "http://localhost:8000/api/admin/tenants/{tenant_id}/widget/regenerate-keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Important**: Old embed code will stop working!

---

## 🧪 Testing Widget

### 1. Create Test HTML File

```html
<!DOCTYPE html>
<html>
<head>
    <title>Widget Test</title>
</head>
<body>
    <h1>Test Page</h1>
    
    <!-- Paste your widget embed code here -->
    <script>
      (function() {
        var chatWidget = document.createElement('iframe');
        chatWidget.src = 'http://localhost:8000/widget/wk_YOUR_KEY?tenant_id=YOUR_TENANT_ID';
        chatWidget.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 9999;';
        document.body.appendChild(chatWidget);
      })();
    </script>
</body>
</html>
```

### 2. Open in Browser

```bash
# Just open the HTML file
start test_widget.html
```

### 3. Verify

- ✅ Widget loads
- ✅ Can send messages
- ✅ Gets responses
- ✅ No authentication errors

---

## 🔍 Debugging Widget Issues

### Widget Not Loading

**Check**:
1. Is backend running?
2. Is widget_key correct?
3. Is tenant_id correct?
4. Check browser console for errors

**Solution**:
```bash
# Verify widget config exists
curl -X GET "http://localhost:8000/api/admin/tenants/{tenant_id}/widget" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### "Widget not found" Error

**Cause**: Invalid widget_key or tenant_id

**Solution**: Get fresh embed code from API

### CORS Errors

**Cause**: Frontend domain not in CORS_ORIGINS

**Solution**: Add domain to `.env`:
```bash
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## 📝 Summary

### Key Points

1. **No JWT Token in Embed Code** ✅
   - Widget uses widget_key instead
   - Safe to expose publicly
   - Designed for frontend embedding

2. **Widget Key is Public** ✅
   - Meant to be in website source
   - Only accesses that tenant's widget
   - Cannot access admin functions

3. **Widget Secret is Private** ✅
   - Server-side only
   - Used for validation
   - Never exposed to frontend

4. **Automatic Generation** ✅
   - Created when tenant is created
   - Embed code auto-generated
   - Ready to copy-paste

### Security Best Practices

- ✅ Widget key is safe to expose
- ✅ Never expose JWT tokens
- ✅ Rotate widget keys if compromised
- ✅ Use HTTPS in production
- ✅ Configure CORS properly

---

## 🎯 Quick Reference

### Get Widget Embed Code

```bash
# Via API
curl -X GET "http://localhost:8000/api/admin/tenants/{tenant_id}/widget/embed-code" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### What's in the Code

```
✅ Widget Key (public, safe)
✅ Tenant ID (public)
✅ API Base URL (public)
❌ JWT Token (NEVER included)
❌ Widget Secret (server-side only)
```

### Test Widget

```html
<!-- Copy embed code from API response -->
<script>...</script>
```

---

**Bottom Line**: The widget embed code is **safe to use publicly** because it only contains the widget key, which is designed for public exposure and has limited permissions!
