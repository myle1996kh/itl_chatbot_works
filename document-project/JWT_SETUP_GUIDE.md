# JWT Setup Guide for .env Configuration

This guide explains how to configure JWT authentication for your ITL Chatbot backend.

---

## Understanding JWT Authentication

Your backend uses **JWT (JSON Web Tokens)** for authentication. The system:
1. **Receives** JWT tokens from your auth service (e.g., Auth0, Keycloak, custom auth)
2. **Verifies** tokens using a public key (RS256 algorithm)
3. **Extracts** tenant information from the token
4. **Enforces** tenant isolation

---

## Option 1: Development Mode (Quick Start)

For **development/testing only**, you can disable authentication:

### .env Configuration:
```bash
# Development Mode - NO JWT REQUIRED
DISABLE_AUTH=true
ENVIRONMENT=development
LOG_LEVEL=INFO

# Fernet key (use the validated one)
FERNET_KEY=kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=

# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/chatbot_itl

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

### ⚠️ WARNING:
- **NEVER** use `DISABLE_AUTH=true` in production
- This bypasses all authentication
- Uses a test tenant ID for all requests

---

## Option 2: Production Mode (JWT Required)

For **production**, you need a JWT public key from your authentication provider.

### Step 1: Choose Your Auth Provider

#### A. Using Auth0
1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → Your App → **Settings**
3. Scroll to **Advanced Settings** → **Certificates**
4. Copy the **Signing Certificate** (PEM format)

#### B. Using Keycloak
1. Go to Keycloak Admin Console
2. Navigate to **Realm Settings** → **Keys**
3. Find the **RS256** key
4. Click **Public Key** button
5. Copy the public key

#### C. Using Custom Auth Service
If you have your own auth service with RS256 keys:

```bash
# Generate key pair (if you don't have one)
ssh-keygen -t rsa -b 4096 -m PEM -f jwtRS256.key

# Extract public key
openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub

# View public key
cat jwtRS256.key.pub
```

### Step 2: Format the Public Key

The public key should look like this:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890abcdefghij
klmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijk
lmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijkl
mnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklm
nopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmn
opqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmno
pqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop
qrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ==
-----END PUBLIC KEY-----
```

### Step 3: Add to .env File

**Method 1: Single Line (Recommended)**

Replace newlines with `\n`:

```bash
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
```

**Method 2: Multi-line (If supported)**

Some .env parsers support multi-line:

```bash
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"
```

### Step 4: Complete Production .env

```bash
# Production Mode - JWT REQUIRED
DISABLE_AUTH=false
ENVIRONMENT=production
LOG_LEVEL=WARNING

# JWT Public Key (RS256)
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nYOUR_PUBLIC_KEY_HERE\n-----END PUBLIC KEY-----"

# Fernet key
FERNET_KEY=kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=

# Database (use strong password)
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD_HERE@localhost:5432/chatbot_itl

# Redis
REDIS_URL=redis://localhost:6379

# CORS (restrict to your domains)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate limiting
DEFAULT_RATE_LIMIT_RPM=60
DEFAULT_RATE_LIMIT_TPM=10000
```

---

## Option 3: I Don't Have an Auth Service Yet

If you don't have an authentication service, you have two options:

### A. Use Development Mode (Temporary)

Use `DISABLE_AUTH=true` for now and implement auth later.

### B. Set Up Simple JWT Auth

Create a minimal JWT auth service:

#### 1. Generate Keys

```bash
# Generate private key
openssl genrsa -out private.pem 4096

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem

# View public key
cat public.pem
```

#### 2. Create Token Generator Script

```python
# generate_token.py
import jwt
from datetime import datetime, timedelta

# Read private key
with open('private.pem', 'r') as f:
    private_key = f.read()

# Create token
payload = {
    'sub': 'user_id_123',
    'tenant_id': '3105b788-b5ff-4d56-88a9-532af4ab4ded',
    'email': 'user@example.com',
    'exp': datetime.utcnow() + timedelta(days=30)
}

token = jwt.encode(payload, private_key, algorithm='RS256')
print(f"Token: {token}")
```

#### 3. Use Public Key in .env

```bash
# Copy content of public.pem to .env
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

---

## Verification

After setting up your .env, verify it works:

### 1. Run Verification Script

```bash
cd backend
python verify_auth_config.py
```

### 2. Test Authentication

```bash
# Without token (should fail with 401)
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# With valid token (should work)
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### 3. Check Logs

```bash
# Start server and watch logs
uvicorn backend.src.main:app --reload

# Look for:
# ✅ "JWT public key configured"
# ✅ "Authentication enabled"
```

---

## JWT Token Requirements

Your JWT tokens must include:

```json
{
  "sub": "user_id",           // User identifier
  "tenant_id": "uuid",        // Tenant UUID (REQUIRED)
  "email": "user@example.com", // Optional
  "exp": 1234567890           // Expiration timestamp
}
```

The backend extracts `tenant_id` from the token to enforce multi-tenant isolation.

---

## Common Issues

### Issue 1: "JWT_PUBLIC_KEY not configured"

**Solution**: Ensure the public key is properly formatted in .env with `\n` for newlines.

### Issue 2: "Invalid token signature"

**Solution**: 
- Verify you're using the correct public key
- Ensure private/public key pair matches
- Check token algorithm is RS256

### Issue 3: "Token expired"

**Solution**: Generate a new token with future expiration.

### Issue 4: "Missing tenant_id in token"

**Solution**: Ensure your auth service includes `tenant_id` in JWT payload.

---

## Quick Decision Guide

**Choose Development Mode if:**
- ✅ You're testing locally
- ✅ You don't have an auth service yet
- ✅ You're developing new features

**Choose Production Mode if:**
- ✅ Deploying to production
- ✅ You have an auth service (Auth0, Keycloak, etc.)
- ✅ You need real user authentication

---

## Next Steps

1. **Choose your mode** (Development or Production)
2. **Update .env file** with appropriate settings
3. **Run verification**: `python verify_auth_config.py`
4. **Test authentication** with curl commands
5. **Proceed with other security steps**

---

## Need Help?

- **Auth0 Setup**: https://auth0.com/docs/get-started
- **Keycloak Setup**: https://www.keycloak.org/docs/latest/server_admin/
- **JWT Debugger**: https://jwt.io/ (decode and verify tokens)
