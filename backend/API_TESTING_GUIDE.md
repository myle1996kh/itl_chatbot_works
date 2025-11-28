# API Testing Guide with Authentication

**Project**: ITL Chatbot Backend  
**Authentication**: JWT RS256  
**Date**: 2025-11-27

---

## 🔑 Authentication Overview

The API uses **JWT RS256** tokens for authentication. All endpoints (except public ones) require a valid JWT token in the `Authorization` header.

---

## 🚀 Quick Test

### 1. Test Without Auth (Should Fail)

```bash
# This should return 401 Unauthorized
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

**Expected Response**:
```json
{
  "detail": "Not authenticated"
}
```

### 2. Get a Valid Token

**Option A: Login via API** (if you have a user)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password",
    "tenant_id": "your-tenant-id"
  }'
```

**Option B: Generate Test Token** (development)
```bash
python test_api_auth.py
```

### 3. Test With Auth (Should Work)

```bash
# Replace YOUR_TOKEN with actual token
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Hello",
    "session_id": "test-session"
  }'
```

---

## 📝 Step-by-Step Testing

### Step 1: Check Server is Running

```bash
# Test health endpoint (no auth required)
curl http://localhost:8000/health
```

**Expected**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-27T..."
}
```

### Step 2: Check API Documentation

Open in browser:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

You can test endpoints directly from Swagger UI!

### Step 3: Get List of Tenants (Public Endpoint)

```bash
curl http://localhost:8000/api/auth/tenants
```

**Expected**:
```json
{
  "total": 1,
  "tenants": [
    {
      "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded",
      "name": "Default Tenant",
      "domain": "default"
    }
  ]
}
```

### Step 4: Create a Test User (Admin Only)

First, you need an admin token. For initial setup, you can:

**Option 1**: Use the test script (creates a valid token)
```bash
python test_api_auth.py --create-user
```

**Option 2**: Manually create user in database
```bash
python create_test_user.py
```

### Step 5: Login to Get Token

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded"
  }'
```

**Expected**:
```json
{
  "user_id": "...",
  "email": "test@example.com",
  "username": "testuser",
  "role": "tenant_user",
  "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "status": "active"
}
```

**Save the token** for next steps!

### Step 6: Test Protected Endpoints

```bash
# Set token as variable
TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test chat endpoint
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "What is the weather today?",
    "session_id": "test-session-123"
  }'
```

---

## 🧪 Testing Different Endpoints

### Chat Endpoints

**Send Message**:
```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how can you help me?",
    "session_id": "session-001"
  }'
```

**Get Chat History**:
```bash
curl -X GET "http://localhost:8000/api/v1/sessions/session-001/messages" \
  -H "Authorization: Bearer $TOKEN"
```

### Admin Endpoints

**List Tenants** (Admin only):
```bash
curl -X GET http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Upload Document** (Admin only):
```bash
curl -X POST http://localhost:8000/api/admin/knowledge/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@document.pdf" \
  -F "tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded"
```

**List RAG Tools**:
```bash
curl -X GET "http://localhost:8000/api/admin/tools?tenant_id=3105b788-b5ff-4d56-88a9-532af4ab4ded" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🔧 Using Postman

### 1. Import Collection

Create a new Postman collection with these settings:

**Authorization**:
- Type: Bearer Token
- Token: `{{jwt_token}}`

**Variables**:
- `base_url`: `http://localhost:8000`
- `jwt_token`: (paste your token here)
- `tenant_id`: `3105b788-b5ff-4d56-88a9-532af4ab4ded`

### 2. Example Requests

**Login**:
```
POST {{base_url}}/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!",
  "tenant_id": "{{tenant_id}}"
}
```

**Chat**:
```
POST {{base_url}}/api/v1/chat
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "message": "Hello",
  "session_id": "test-session"
}
```

---

## 🐍 Using Python Requests

### Simple Test Script

```python
import requests

# Configuration
BASE_URL = "http://localhost:8000"
EMAIL = "test@example.com"
PASSWORD = "Test123!"
TENANT_ID = "3105b788-b5ff-4d56-88a9-532af4ab4ded"

# 1. Login
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={
        "email": EMAIL,
        "password": PASSWORD,
        "tenant_id": TENANT_ID
    }
)

if login_response.status_code == 200:
    token = login_response.json()["token"]
    print(f"✅ Login successful! Token: {token[:50]}...")
    
    # 2. Test chat endpoint
    chat_response = requests.post(
        f"{BASE_URL}/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message": "Hello, how are you?",
            "session_id": "test-session"
        }
    )
    
    if chat_response.status_code == 200:
        print("✅ Chat successful!")
        print(chat_response.json())
    else:
        print(f"❌ Chat failed: {chat_response.status_code}")
        print(chat_response.text)
else:
    print(f"❌ Login failed: {login_response.status_code}")
    print(login_response.text)
```

---

## 🔍 Debugging Authentication Issues

### Issue: "Not authenticated"

**Cause**: Missing or invalid token

**Check**:
```bash
# Verify token is being sent
curl -v -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Look for: Authorization: Bearer ...
```

### Issue: "Invalid token"

**Cause**: Token expired or malformed

**Check**:
```bash
# Decode token (without verification)
python -c "
import jwt
import sys
token = sys.argv[1]
print(jwt.decode(token, options={'verify_signature': False}))
" "$TOKEN"
```

**Expected**:
```json
{
  "sub": "user-id",
  "tenant_id": "tenant-id",
  "roles": ["tenant_user"],
  "exp": 1234567890
}
```

### Issue: "Token expired"

**Cause**: Token older than 24 hours

**Solution**: Login again to get new token

### Issue: "DISABLE_AUTH=true but still getting 401"

**Check .env**:
```bash
grep DISABLE_AUTH .env
# Should be: DISABLE_AUTH=false for production
# Or: DISABLE_AUTH=true for development (no auth)
```

---

## 🧪 Automated Testing

### Using pytest

```python
# tests/test_api_integration.py
import pytest
import requests

BASE_URL = "http://localhost:8000"

def test_health_endpoint():
    """Test health endpoint (no auth required)"""
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_chat_requires_auth():
    """Test that chat endpoint requires authentication"""
    response = requests.post(
        f"{BASE_URL}/api/v1/chat",
        json={"message": "test"}
    )
    assert response.status_code == 401

def test_login_and_chat(test_user_credentials):
    """Test full flow: login → chat"""
    # Login
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=test_user_credentials
    )
    assert login_response.status_code == 200
    token = login_response.json()["token"]
    
    # Chat
    chat_response = requests.post(
        f"{BASE_URL}/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message": "Hello",
            "session_id": "test-session"
        }
    )
    assert chat_response.status_code == 200
```

Run tests:
```bash
pytest tests/test_api_integration.py -v
```

---

## 📊 Common Response Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 200 | Success | Request successful |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Endpoint doesn't exist |
| 422 | Validation Error | Invalid request body |
| 500 | Server Error | Backend error (check logs) |

---

## 🎯 Quick Reference

### Get Token
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","tenant_id":"3105b788-b5ff-4d56-88a9-532af4ab4ded"}'
```

### Use Token
```bash
TOKEN="your_token_here"

curl -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","session_id":"test"}'
```

### Check Token
```bash
python -c "import jwt; print(jwt.decode('$TOKEN', options={'verify_signature': False}))"
```

---

## 📚 Additional Resources

- **API Docs**: http://localhost:8000/docs
- **Test Scripts**: `test_api_auth.py`, `create_test_user.py`
- **Authentication Code**: `src/middleware/auth.py`
- **JWT Utils**: `src/utils/jwt.py`

---

**Next**: Run `python test_api_auth.py` to get started with testing!
