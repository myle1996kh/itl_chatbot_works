# Configuration Reference

**Purpose**: Complete reference for all environment variables and configuration settings

**Last Updated**: 2025-11-25

---

## Overview

AgentHub uses **Pydantic Settings** to manage configuration. All settings are loaded from:
1. Environment variables (highest priority)
2. `.env` file in `backend/` directory
3. Default values in `config.py`

**Configuration file**: `backend/src/config.py`

---

## Environment Variables

### Database Configuration

#### `DATABASE_URL`
- **Type**: String
- **Required**: Yes (has insecure default)
- **Default**: `postgresql://postgres:123456@localhost:5432/chatbot_itl`
- **Format**: `postgresql://[user]:[password]@[host]:[port]/[database]`
- **Example**: `postgresql://agenthub:securepass@db.example.com:5432/agenthub_prod`
- **Security**: ⚠️ **CRITICAL** - Remove hardcoded password in production
- **Notes**:
  - Must use PostgreSQL 15+ with pgvector extension
  - For production, use secure password and avoid hardcoding

#### `DB_POOL_SIZE`
- **Type**: Integer
- **Required**: No
- **Default**: `20`
- **Purpose**: Number of persistent database connections in pool
- **Tuning**:
  - Low traffic: 10-20
  - Medium traffic: 20-50
  - High traffic: 50-100
- **Notes**: Higher values use more memory but handle more concurrent requests

#### `DB_MAX_OVERFLOW`
- **Type**: Integer
- **Required**: No
- **Default**: `10`
- **Purpose**: Maximum overflow connections beyond pool size
- **Formula**: Total max connections = `DB_POOL_SIZE + DB_MAX_OVERFLOW`
- **Example**: Default allows 20 + 10 = 30 total connections

---

### Redis Configuration

#### `REDIS_URL`
- **Type**: String
- **Required**: Yes (has default)
- **Default**: `redis://localhost:6379`
- **Format**: `redis://[host]:[port]/[db_number]`
- **Examples**:
  - Local: `redis://localhost:6379`
  - Remote: `redis://redis.example.com:6379/0`
  - With password: `redis://:password@redis.example.com:6379`
- **Purpose**: Caching LLM responses, agent configurations, rate limiting
- **Notes**: Redis 7.x recommended

#### `CACHE_TTL_SECONDS`
- **Type**: Integer
- **Required**: No
- **Default**: `3600` (1 hour)
- **Purpose**: Default time-to-live for cached items
- **Tuning**:
  - Short-lived data: 300 (5 minutes)
  - Medium: 3600 (1 hour)
  - Long-lived: 86400 (24 hours)

---

### Security Configuration

#### `JWT_PUBLIC_KEY`
- **Type**: String (multi-line)
- **Required**: **YES for production** (if `DISABLE_AUTH=false`)
- **Default**: `""` (empty)
- **Format**: PEM-encoded RSA public key
- **Example**:
  ```
  JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
  -----END PUBLIC KEY-----"
  ```
- **Purpose**: Verify RS256 JWT tokens from authentication service
- **Security**: Public key (safe to store), used to verify token signatures
- **Notes**:
  - Only needed if using JWT authentication (`DISABLE_AUTH=false`)
  - Must match private key used to sign tokens

#### `FERNET_KEY`
- **Type**: String
- **Required**: **YES** (critical)
- **Default**: `""` (empty - insecure)
- **Format**: Base64-encoded 32-byte key
- **Generate**:
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```
- **Example**: `kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=`
- **Purpose**: Encrypt tenant LLM API keys in database
- **Security**: ⚠️ **CRITICAL** - Must be kept secret, never commit to version control
- **Notes**:
  - Used for symmetric encryption (Fernet)
  - If lost, all encrypted API keys become unrecoverable
  - Rotate periodically for security

#### `DISABLE_AUTH`
- **Type**: Boolean
- **Required**: No
- **Default**: `true` (development mode)
- **Values**: `true` or `false`
- **Purpose**: Bypass JWT authentication for local testing
- **Security**: ⚠️ **CRITICAL** - Must be `false` in production
- **Behavior**:
  - `true`: All requests use test tenant ID, no JWT required
  - `false`: JWT token required in `Authorization` header
- **Validation**: Config has built-in check (lines 59-72 in config.py):
  ```python
  if DISABLE_AUTH=true and ENVIRONMENT=production:
      raise ValueError("Cannot bypass auth in production")
  ```
- **Notes**:
  - Only for development/testing
  - Logs warning when enabled
  - See Issue #4 in CHANGELOG_FIXES.md

#### `TEST_BEARER_TOKEN`
- **Type**: String
- **Required**: No
- **Default**: `""` (empty)
- **Purpose**: Bearer token used by HTTP tool when calling external APIs in dev mode
- **Usage**: Only used when `DISABLE_AUTH=true`
- **Example**: `Bearer sk-test-1234567890abcdef`
- **Notes**: For testing external API integrations locally

---

### Application Settings

#### `ENVIRONMENT`
- **Type**: String
- **Required**: No
- **Default**: `development`
- **Values**: `development` | `production` | `staging`
- **Purpose**: Control environment-specific behavior
- **Effects**:
  - `development`:
    - SQLAlchemy echo enabled (logs SQL queries)
    - Allows `DISABLE_AUTH=true`
    - More verbose logging
  - `production`:
    - SQLAlchemy echo disabled
    - Blocks `DISABLE_AUTH=true`
    - Structured logging only
- **Security**: Set to `production` for live deployments

#### `LOG_LEVEL`
- **Type**: String
- **Required**: No
- **Default**: `INFO`
- **Values**: `DEBUG` | `INFO` | `WARNING` | `ERROR` | `CRITICAL`
- **Purpose**: Control logging verbosity
- **Recommendations**:
  - Development: `DEBUG` (very verbose)
  - Staging: `INFO`
  - Production: `INFO` or `WARNING`
- **Notes**: Uses structlog for structured logging

#### `API_HOST`
- **Type**: String
- **Required**: No
- **Default**: `0.0.0.0`
- **Purpose**: Host address for API server to bind to
- **Values**:
  - `0.0.0.0` - Listen on all network interfaces (default)
  - `127.0.0.1` - Localhost only
  - Specific IP - Bind to specific interface
- **Security**: Use `127.0.0.1` if behind reverse proxy

#### `API_PORT`
- **Type**: Integer
- **Required**: No
- **Default**: `8000`
- **Purpose**: Port for API server
- **Common values**: `8000`, `8080`, `80`, `443`
- **Notes**: Ensure port is not already in use

---

### CORS Configuration

#### `CORS_ORIGINS`
- **Type**: String (comma-separated)
- **Required**: No
- **Default**: `http://localhost:3000,http://localhost:8080`
- **Format**: Comma-separated list of allowed origins
- **Example**: `https://app.example.com,https://widget.example.com`
- **Purpose**: Allow cross-origin requests from frontend applications
- **Security**:
  - Development: Allow localhost origins
  - Production: Only allow specific domains
  - Never use `*` (wildcard) in production
- **Notes**: Parsed into list by `cors_origins_list` property

---

### Rate Limiting

#### `DEFAULT_RATE_LIMIT_RPM`
- **Type**: Integer
- **Required**: No
- **Default**: `60`
- **Purpose**: Default requests per minute per tenant
- **Notes**:
  - Stored in database per tenant (`tenant_llm_configs.rate_limit_rpm`)
  - ⚠️ **Currently NOT enforced** (see Issue #6 in CHANGELOG_FIXES.md)
  - Will be enforced in Phase 2

#### `DEFAULT_RATE_LIMIT_TPM`
- **Type**: Integer
- **Required**: No
- **Default**: `10000`
- **Purpose**: Default tokens per minute per tenant
- **Notes**:
  - Stored in database per tenant (`tenant_llm_configs.rate_limit_tpm`)
  - ⚠️ **Currently NOT enforced** (see Issue #6 in CHANGELOG_FIXES.md)
  - Will be enforced in Phase 2

---

### LLM Provider Configuration

#### `OPENROUTER_API_KEY`
- **Type**: String
- **Required**: No (only if using OpenRouter)
- **Default**: `""` (empty)
- **Format**: `sk-or-v1-...` (OpenRouter API key format)
- **Purpose**: API key for OpenRouter multi-model API
- **Security**: Keep secret, never commit to version control
- **Notes**:
  - OpenRouter provides access to multiple LLM providers
  - Can also use direct provider keys (OpenAI, Anthropic) per tenant
  - Tenant-specific keys stored encrypted in database

#### `OPENROUTER_BASE_URL`
- **Type**: String
- **Required**: No
- **Default**: `https://openrouter.ai/api/v1`
- **Purpose**: Base URL for OpenRouter API
- **Notes**: Rarely needs to be changed

---

## Configuration File (.env)

### Example `.env` File

```bash
# ============================================================================
# AgentHub Multi-Tenant Chatbot - Configuration
# ============================================================================

# ----------------------------------------------------------------------------
# Database Configuration (PostgreSQL 15+ with pgvector)
# ----------------------------------------------------------------------------
DATABASE_URL=postgresql://agenthub:secure_password_here@localhost:5432/agenthub_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# ----------------------------------------------------------------------------
# Redis Configuration (Caching & Rate Limiting)
# ----------------------------------------------------------------------------
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600

# ----------------------------------------------------------------------------
# Security - Encryption & Authentication
# ----------------------------------------------------------------------------

# Fernet Key (for encrypting tenant API keys)
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY=your-fernet-key-here

# JWT Public Key (RS256, only needed if DISABLE_AUTH=false)
# Multi-line format:
# JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
# MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
# -----END PUBLIC KEY-----"
JWT_PUBLIC_KEY=

# Auth Bypass Toggle (DEVELOPMENT ONLY - never true in production)
DISABLE_AUTH=true

# ----------------------------------------------------------------------------
# Application Settings
# ----------------------------------------------------------------------------
ENVIRONMENT=development
LOG_LEVEL=INFO
API_HOST=0.0.0.0
API_PORT=8000

# ----------------------------------------------------------------------------
# CORS Configuration
# ----------------------------------------------------------------------------
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# ----------------------------------------------------------------------------
# Rate Limiting (Defaults for new tenants)
# ----------------------------------------------------------------------------
DEFAULT_RATE_LIMIT_RPM=60
DEFAULT_RATE_LIMIT_TPM=10000

# ----------------------------------------------------------------------------
# LLM Provider (Optional - OpenRouter)
# ----------------------------------------------------------------------------
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# ----------------------------------------------------------------------------
# Testing (Optional)
# ----------------------------------------------------------------------------
TEST_BEARER_TOKEN=
```

### Example Production `.env`

```bash
# Production Configuration
DATABASE_URL=postgresql://agenthub:STRONG_PASSWORD@prod-db.internal:5432/agenthub
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=20

REDIS_URL=redis://prod-redis.internal:6379
CACHE_TTL_SECONDS=3600

FERNET_KEY=PRODUCTION_FERNET_KEY_HERE
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
PRODUCTION_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----"

# CRITICAL: Must be false in production
DISABLE_AUTH=false

ENVIRONMENT=production
LOG_LEVEL=WARNING
API_HOST=0.0.0.0
API_PORT=8000

CORS_ORIGINS=https://app.example.com,https://widget.example.com

DEFAULT_RATE_LIMIT_RPM=100
DEFAULT_RATE_LIMIT_TPM=50000

OPENROUTER_API_KEY=PRODUCTION_OPENROUTER_KEY
```

---

## Security Best Practices

### 1. Never Commit Secrets

**Add to `.gitignore`**:
```
# Environment files
.env
.env.local
.env.production

# Backup env files
*.env.backup
```

### 2. Rotate Keys Regularly

**Fernet Key Rotation**:
1. Generate new key
2. Update `.env` with new key
3. Re-encrypt all tenant API keys in database
4. Old key becomes invalid

**Frequency**: Every 90 days for production

### 3. Use Different Keys Per Environment

```bash
# Development
FERNET_KEY=dev_key_here

# Staging
FERNET_KEY=staging_key_here

# Production
FERNET_KEY=prod_key_here
```

**Never** use the same key across environments.

### 4. Validate Production Settings

Before deploying:
```bash
# Check critical settings
grep DISABLE_AUTH .env  # Must be false
grep ENVIRONMENT .env    # Must be production
grep FERNET_KEY .env     # Must be set and unique
grep JWT_PUBLIC_KEY .env # Must be set
```

### 5. Secure Database Credentials

**Bad**:
```bash
DATABASE_URL=postgresql://postgres:123456@localhost:5432/db
```

**Good**:
```bash
DATABASE_URL=postgresql://app_user:$(openssl rand -base64 32)@secure-host:5432/db
```

Use tools like:
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets
- Environment-specific secret stores

---

## Configuration Loading Order

Pydantic Settings loads configuration in this order (later overrides earlier):

1. **Default values** in `config.py` (lowest priority)
2. **`.env` file** in `backend/` directory
3. **Environment variables** (highest priority)

**Example**:
```python
# config.py default
API_PORT: int = Field(default=8000)

# .env file
API_PORT=8080

# Environment variable (overrides .env)
export API_PORT=9000

# Result: API_PORT = 9000
```

---

## Validation & Error Handling

### Built-in Validators

#### 1. DISABLE_AUTH Production Check

**Code** (`config.py` lines 59-72):
```python
@field_validator("DISABLE_AUTH")
@classmethod
def validate_auth_bypass(cls, v: bool, info) -> bool:
    environment = info.data.get("ENVIRONMENT", "production")

    if v and environment == "production":
        raise ValueError(
            "DISABLE_AUTH cannot be true in production environment"
        )

    return v
```

**Effect**: Prevents starting server with `DISABLE_AUTH=true` in production.

**Error message**:
```
ValueError: DISABLE_AUTH cannot be true in production environment.
Set ENVIRONMENT=development or DISABLE_AUTH=false
```

### Configuration Errors

**Missing required variables**:
```
ValidationError: 1 validation error for Settings
FERNET_KEY
  field required (type=value_error.missing)
```

**Invalid format**:
```
ValidationError: 1 validation error for Settings
DATABASE_URL
  invalid or missing URL scheme (type=value_error.url.scheme)
```

---

## Environment-Specific Configuration

### Development

```bash
ENVIRONMENT=development
DISABLE_AUTH=true
LOG_LEVEL=DEBUG
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_dev
```

### Staging

```bash
ENVIRONMENT=staging
DISABLE_AUTH=false
LOG_LEVEL=INFO
DATABASE_URL=postgresql://agenthub_stg:password@staging-db:5432/agenthub_stg
JWT_PUBLIC_KEY="..." # Staging JWT key
```

### Production

```bash
ENVIRONMENT=production
DISABLE_AUTH=false
LOG_LEVEL=WARNING
DATABASE_URL=postgresql://agenthub_prod:strong_password@prod-db:5432/agenthub_prod
JWT_PUBLIC_KEY="..." # Production JWT key
DB_POOL_SIZE=100
DB_MAX_OVERFLOW=50
```

---

## Troubleshooting

### Issue: "Settings validation error"

**Check `.env` syntax**:
```bash
# Bad (spaces around =)
API_PORT = 8000

# Good (no spaces)
API_PORT=8000
```

### Issue: "Database connection refused"

**Verify `DATABASE_URL`**:
```bash
# Test connection manually
psql "$(grep DATABASE_URL .env | cut -d '=' -f2)"
```

### Issue: "Redis connection failed"

**Verify `REDIS_URL`**:
```bash
# Test connection
redis-cli -u "$(grep REDIS_URL .env | cut -d '=' -f2)" ping
# Should return: PONG
```

### Issue: "Invalid Fernet key"

**Regenerate**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Copy output to FERNET_KEY in .env
```

---

## Related Documentation

- **Backend Setup**: [BACKEND_SETUP.md](./BACKEND_SETUP.md)
- **Tenant Setup**: [TENANT_SETUP_FLOW.md](./TENANT_SETUP_FLOW.md)
- **Issue Tracking**: `../../CHANGELOG_FIXES.md`
- **Developer Guide**: `../../CLAUDE.md`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-25
**Maintained By**: Engineering Team
