# 🧪 Quick API Testing Guide

**Quick Reference**: How to test your API endpoints with authentication

---

## ⚡ Super Quick Start (3 Steps)

### 1. Run the Test Script

```bash
python test_api_auth.py
```

This will:
- ✅ Check if server is running
- ✅ Generate a valid JWT token
- ✅ Test authentication
- ✅ Save token to `test_token.txt`

### 2. Use the Token

```bash
# Load token
$TOKEN = Get-Content test_token.txt

# Test chat endpoint
curl -X POST http://localhost:8000/api/v1/chat `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"message":"Hello","session_id":"test"}'
```

### 3. Check API Docs

Open in browser: http://localhost:8000/docs

Click "Authorize" button and paste your token!

---

## 🔑 Manual Testing

### Get a Token (Option 1: Auto-Generate)

```bash
python test_api_auth.py
# Token saved to test_token.txt
```

### Get a Token (Option 2: Login)

```bash
curl -X POST http://localhost:8000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@example.com",
    "password": "your_password",
    "tenant_id": "3105b788-b5ff-4d56-88a9-532af4ab4ded"
  }'
```

### Use the Token

```bash
# PowerShell
$TOKEN = "your_token_here"

curl -X POST http://localhost:8000/api/v1/chat `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"message":"Hello","session_id":"test"}'
```

---

## 📝 Common Test Cases

### 1. Test Without Auth (Should Fail)

```bash
curl -X POST http://localhost:8000/api/v1/chat `
  -H "Content-Type: application/json" `
  -d '{"message":"test"}'

# Expected: 401 Unauthorized
```

### 2. Test Health (No Auth Required)

```bash
curl http://localhost:8000/health

# Expected: {"status":"healthy"}
```

### 3. Test With Valid Token

```bash
$TOKEN = Get-Content test_token.txt

curl -X POST http://localhost:8000/api/v1/chat `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"message":"Hello","session_id":"test"}'

# Expected: 200 OK with response
```

### 4. Test Admin Endpoint

```bash
curl -X GET http://localhost:8000/api/admin/tenants `
  -H "Authorization: Bearer $TOKEN"

# Expected: List of tenants
```

---

## 🌐 Using Swagger UI (Easiest!)

1. **Open**: http://localhost:8000/docs
2. **Click**: "Authorize" button (top right)
3. **Paste**: Your token from `test_token.txt`
4. **Click**: "Authorize"
5. **Test**: Any endpoint by clicking "Try it out"

---

## 🐍 Using Python

```python
import requests

# Load token
with open("test_token.txt") as f:
    token = f.read().strip()

# Test endpoint
response = requests.post(
    "http://localhost:8000/api/v1/chat",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "message": "Hello",
        "session_id": "test"
    }
)

print(response.status_code)
print(response.json())
```

---

## 🔍 Troubleshooting

### "Not authenticated" Error

**Solution**: Make sure you're sending the token:
```bash
# Check header is included
curl -v -X POST http://localhost:8000/api/v1/chat `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"message":"test"}'

# Look for: > Authorization: Bearer ...
```

### "Invalid token" Error

**Solution**: Generate a new token:
```bash
python test_api_auth.py
```

### Server Not Running

**Solution**: Start the server:
```bash
uvicorn src.main:app --reload
```

---

## 📊 Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | ✅ Working! |
| 401 | Unauthorized | Get/refresh token |
| 403 | Forbidden | Need admin role |
| 422 | Validation Error | Check request body |
| 500 | Server Error | Check server logs |

---

## 🎯 Quick Commands

```bash
# Generate token
python test_api_auth.py

# Load token (PowerShell)
$TOKEN = Get-Content test_token.txt

# Test chat
curl -X POST http://localhost:8000/api/v1/chat `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"message":"Hello","session_id":"test"}'

# Check token
python -c "import jwt; print(jwt.decode(open('test_token.txt').read(), options={'verify_signature': False}))"
```

---

## 📚 More Details

See **`API_TESTING_GUIDE.md`** for:
- Complete endpoint list
- Postman collection
- Advanced testing
- Integration tests

---

**Quick Start**: Run `python test_api_auth.py` and you're ready to test! 🚀
