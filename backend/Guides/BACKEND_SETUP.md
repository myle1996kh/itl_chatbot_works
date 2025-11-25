# Backend Setup Guide

**Purpose**: How to run the AgentHub Multi-Tenant Chatbot backend from scratch

**Last Updated**: 2025-11-25

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Python** | 3.11+ | Backend runtime |
| **PostgreSQL** | 15+ | Database |
| **Redis** | 7.x | Caching layer |
| **Docker** (optional) | Latest | For PostgreSQL + Redis containers |
| **Git** | Latest | Version control |

### Knowledge Requirements

- Basic Python knowledge
- Familiarity with REST APIs
- Understanding of environment variables
- SQL basics (helpful but not required)

---

## Quick Start (5 Minutes)

For developers who want to get running immediately:

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start PostgreSQL + Redis (Docker - TO BE CREATED IN PHASE 1)
# docker-compose up -d

# 5. Set environment variables
# Copy .env.example to .env and edit (TO BE CREATED IN PHASE 1)

# 6. Run migrations
alembic upgrade head

# 7. Start server
python src/main.py
```

**Note**: Steps 4 and 5 require files that will be created in Phase 1. For now, set up PostgreSQL and Redis manually.

---

## Detailed Setup

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd chatbot_25.11
```

### Step 2: Set Up Python Virtual Environment

**Windows**:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac**:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**Verify activation**:
```bash
which python  # Linux/Mac
where python  # Windows

# Should point to venv/bin/python or venv\Scripts\python.exe
```

### Step 3: Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected packages** (53 total, key ones listed):
- FastAPI >= 0.100.0
- uvicorn[standard]
- SQLAlchemy >= 2.0.0
- alembic >= 1.12.0
- psycopg2-binary >= 2.9.0
- pgvector >= 0.3.5
- langchain >= 0.3.0
- langgraph >= 0.2.0
- langchain-postgres >= 0.0.12
- sentence-transformers >= 3.3.0
- redis >= 5.0.0
- pydantic >= 2.0
- pydantic-settings >= 2.0
- cryptography
- structlog
- pytest, pytest-asyncio, pytest-cov (for testing)

**Verify installation**:
```bash
pip list | findstr "fastapi"  # Windows
pip list | grep fastapi       # Linux/Mac

# Should show FastAPI version
```

### Step 4: Set Up PostgreSQL

#### Option A: Docker (Recommended)

**Note**: `docker-compose.yml` will be created in Phase 1. For now, use manual Docker command:

```bash
docker run -d \
  --name agenthub-postgres \
  -e POSTGRES_DB=chatbot_itl \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  pgvector/pgvector:pg15
```

**Enable pgvector extension**:
```bash
docker exec -it agenthub-postgres psql -U postgres -d chatbot_itl

# In psql:
CREATE EXTENSION vector;
\dx  # Verify extension is installed
\q
```

#### Option B: Local PostgreSQL Installation

1. Install PostgreSQL 15+ from https://www.postgresql.org/download/
2. Install pgvector extension:
   - **Windows**: Download from https://github.com/pgvector/pgvector/releases
   - **Linux**: `sudo apt install postgresql-15-pgvector`
   - **Mac**: `brew install pgvector`

3. Create database:
```bash
psql -U postgres

# In psql:
CREATE DATABASE chatbot_itl;
CREATE EXTENSION vector;
\c chatbot_itl
\dx  # Verify extension
\q
```

**Verify connection**:
```bash
psql -h localhost -U postgres -d chatbot_itl -c "SELECT version();"
```

### Step 5: Set Up Redis

#### Option A: Docker (Recommended)

```bash
docker run -d \
  --name agenthub-redis \
  -p 6379:6379 \
  redis:7-alpine
```

**Verify**:
```bash
docker exec -it agenthub-redis redis-cli ping
# Should return: PONG
```

#### Option B: Local Redis Installation

- **Windows**: Download from https://github.com/tporadowski/redis/releases
- **Linux**: `sudo apt install redis-server`
- **Mac**: `brew install redis`

**Start Redis**:
```bash
# Linux/Mac
redis-server

# Windows
redis-server.exe
```

**Verify**:
```bash
redis-cli ping
# Should return: PONG
```

### Step 6: Configure Environment Variables

**Current state** (as of 2025-11-25):
- `.env` exists with only `FERNET_KEY`
- `.env.example` does NOT exist (will be created in Phase 1)

**For now, create your own `.env`**:

```bash
# Navigate to backend/
cd backend

# Create .env file
# Windows
type nul > .env

# Linux/Mac
touch .env
```

**Edit `backend/.env`** and add:

```bash
# Database
DATABASE_URL=postgresql://postgres:your_secure_password@localhost:5432/chatbot_itl

# Redis
REDIS_URL=redis://localhost:6379

# Security - Generate Fernet key if not already set
# Run: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY=your-fernet-key-here

# JWT Authentication (Optional - for production)
JWT_PUBLIC_KEY=
# Multi-line public key example:
# -----BEGIN PUBLIC KEY-----
# MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
# -----END PUBLIC KEY-----

# Auth Bypass (Development only - NEVER set true in production)
DISABLE_AUTH=true

# Environment
ENVIRONMENT=development

# Logging
LOG_LEVEL=INFO

# API Server
API_HOST=0.0.0.0
API_PORT=8000

# LLM Provider (Optional - if using OpenRouter)
OPENROUTER_API_KEY=

# Testing (Optional)
TEST_BEARER_TOKEN=
```

**Generate Fernet Key**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Important**:
- Replace `your_secure_password` with your actual PostgreSQL password
- Never commit `.env` to version control (already in `.gitignore`)
- For production, set `DISABLE_AUTH=false` and configure `JWT_PUBLIC_KEY`

### Step 7: Update Alembic Configuration

**Current issue**: `alembic.ini` has hardcoded database credentials (will be fixed in Phase 2).

**For now, edit `backend/alembic.ini`**:

Find line 59:
```ini
sqlalchemy.url = postgresql://postgres:Postgres123!@172.23.178.103:32001/chatbot
```

Replace with:
```ini
# Comment out hardcoded URL (don't delete for reference)
# sqlalchemy.url = postgresql://postgres:Postgres123!@172.23.178.103:32001/chatbot

# Will be loaded from env.py using DATABASE_URL from .env
sqlalchemy.url =
```

**Alembic will read from environment variable** (already configured in `alembic/env.py`).

### Step 8: Run Database Migrations

Migrations use **Alembic** (canonical migration system).

```bash
# Ensure you're in backend/ directory
cd backend

# Check current migration status
alembic current

# If no migrations applied, you'll see:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# INFO  [alembic.runtime.migration] No current revision

# Apply all migrations
alembic upgrade head
```

**Expected output**:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 20251105_1430_..., initial schema
INFO  [alembic.runtime.migration] Running upgrade 20251105_1430_... -> 20251110_1957_..., add user management
INFO  [alembic.runtime.migration] Running upgrade ... -> head
```

**Verify migrations applied**:
```bash
alembic current

# Should show latest migration:
# 20251114_0000_... (head)
```

**Check database tables**:
```bash
psql -h localhost -U postgres -d chatbot_itl

# In psql:
\dt
# Should show 17+ tables: tenants, sessions, messages, agent_configs, etc.

\d tenants
# Should show table structure

\q
```

### Step 9: Seed Initial Data (Optional)

**Note**: There are seed data scripts in `backend/migrations/` directory. These are separate from Alembic migrations.

**Check what seed data exists**:
```bash
ls backend/migrations/

# You'll see:
# 0_create_tables.py
# 1_seed_base_data.py
# 2_seed_llm_models.py
# 3_seed_output_formats.py
# etc.
```

**Option A: Run seed data scripts** (if database is empty):
```bash
cd backend/migrations
python run_all.py
```

**Option B: Seed data manually via API** (recommended):
- Use admin endpoints to create agents, tools, tenants
- See [TENANT_SETUP_FLOW.md](./TENANT_SETUP_FLOW.md) for step-by-step guide

### Step 10: Start the Backend Server

```bash
# Ensure you're in backend/ directory
cd backend

# Start with main.py (includes auto-reload)
python src/main.py
```

**Expected output**:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**Alternative method** (using uvicorn directly):
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 11: Verify Server is Running

**Open in browser**:
- **API Docs (Swagger)**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

**Test health endpoint**:
```bash
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy", "timestamp": "2025-11-25T10:00:00Z"}
```

**Check logs** for any errors or warnings.

---

## Common Issues & Troubleshooting

### Issue 1: "ModuleNotFoundError: No module named 'src'"

**Cause**: Python can't find the `src` module.

**Solution**:
```bash
# Set PYTHONPATH to include backend directory
export PYTHONPATH=.  # Linux/Mac
set PYTHONPATH=.     # Windows CMD
$env:PYTHONPATH="."  # Windows PowerShell

# Then run:
python src/main.py
```

### Issue 2: "psycopg2.OperationalError: could not connect to server"

**Cause**: PostgreSQL is not running or connection details are wrong.

**Check**:
```bash
# Verify PostgreSQL is running
docker ps  # If using Docker
# OR
psql -h localhost -U postgres -c "SELECT 1;"

# Verify DATABASE_URL in .env matches your setup
cat .env | grep DATABASE_URL  # Linux/Mac
findstr DATABASE_URL .env      # Windows
```

**Solution**: Start PostgreSQL and verify credentials.

### Issue 3: "redis.exceptions.ConnectionError"

**Cause**: Redis is not running.

**Check**:
```bash
# Verify Redis is running
docker ps  # If using Docker
# OR
redis-cli ping  # Should return PONG
```

**Solution**: Start Redis.

### Issue 4: "alembic.util.exc.CommandError: Target database is not up to date"

**Cause**: Database is missing migrations.

**Solution**:
```bash
alembic upgrade head
```

### Issue 5: "pgvector extension not found"

**Cause**: pgvector extension not installed.

**Solution**:
```bash
docker exec -it agenthub-postgres psql -U postgres -d chatbot_itl

# In psql:
CREATE EXTENSION vector;
\dx  # Verify installation
\q
```

### Issue 6: "Invalid Fernet key"

**Cause**: `FERNET_KEY` in `.env` is invalid or missing.

**Solution**:
```bash
# Generate new key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Add to .env
echo "FERNET_KEY=your-generated-key" >> .env
```

### Issue 7: Port 8000 already in use

**Cause**: Another process is using port 8000.

**Check**:
```bash
# Windows
netstat -ano | findstr :8000

# Linux/Mac
lsof -i :8000
```

**Solution**: Kill the process or use a different port:
```bash
# Change port in .env
API_PORT=8001

# Or specify when running:
python src/main.py --port 8001
```

---

## Development Workflow

### Daily Development

1. **Activate virtual environment**:
   ```bash
   cd backend
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Linux/Mac
   ```

2. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

3. **Check for new migrations**:
   ```bash
   alembic current
   alembic upgrade head
   ```

4. **Start server**:
   ```bash
   python src/main.py
   ```

### Making Database Schema Changes

1. **Modify SQLAlchemy models** in `src/models/`

2. **Generate migration**:
   ```bash
   alembic revision --autogenerate -m "description of changes"
   ```

3. **Review generated migration** in `alembic/versions/`

4. **Apply migration**:
   ```bash
   alembic upgrade head
   ```

5. **Test rollback** (optional):
   ```bash
   alembic downgrade -1
   alembic upgrade head
   ```

### Testing Changes

```bash
# Run tests (Phase 4 - pytest suite to be created)
pytest --cov=src --cov-report=term

# Run specific tests
pytest tests/unit/test_auth.py -v
```

### Code Quality Checks

```bash
# Format code
black src/

# Lint code
ruff check src/

# Type checking
mypy src/
```

---

## Architecture Overview

Understanding the system architecture helps with development:

```
User Request
    ↓
FastAPI Endpoint (api/chat.py)
    ↓
Auth Middleware (middleware/auth.py) → Extract tenant_id
    ↓
SupervisorAgent (services/supervisor_agent.py) → Detect intent, route to domain agent
    ↓
DomainAgent (services/domain_agents.py) → Load tools, execute
    ↓
Tools (tools/rag.py, tools/http.py) → RAG retrieval, API calls
    ↓
Response → Store in messages table → Return to user
```

**Key Services**:
- `supervisor_agent.py` - Intent detection and routing
- `domain_agents.py` - Specialized agent implementations
- `llm_manager.py` - LLM provider management (with encrypted API keys)
- `rag_service.py` - PgVector-based RAG
- `tool_loader.py` - Dynamic tool loading
- `embedding_service.py` - Sentence-transformers (384D vectors)
- `conversation_memory.py` - Session/message history

**Database**:
- 17 SQLAlchemy models
- Multi-tenant isolation via `tenant_id` foreign keys
- Permission system: `tenant_agent_permissions`, `tenant_tool_permissions`

---

## API Endpoints Reference

**Chat**:
- `POST /api/{tenant_id}/chat` - Send message
- `GET /api/{tenant_id}/session` - List sessions

**Admin - Tenants**:
- `GET /api/admin/tenants` - List tenants
- `POST /api/admin/tenants` - Create tenant
- `PATCH /api/admin/tenants/{id}` - Update tenant

**Admin - Agents**:
- `GET /api/admin/agents` - List agents
- `POST /api/admin/agents` - Create agent
- `POST /api/admin/agents/reload-cache` - Reload agent cache

**Admin - Tools**:
- `GET /api/admin/tools` - List tools
- `POST /api/admin/tools` - Create tool

**Admin - Knowledge Base**:
- `POST /api/admin/knowledge/upload` - Upload documents
- `POST /api/admin/knowledge/ingest` - Trigger ingestion
- `GET /api/admin/knowledge/stats` - Get stats
- `DELETE /api/admin/knowledge` - Delete documents

**Admin - Sessions**:
- `GET /api/admin/sessions` - List all sessions (admin view)

**Auth** (if enabled):
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

**Health**:
- `GET /health` - Health check

---

## Next Steps After Setup

1. **Create your first tenant** - See [TENANT_SETUP_FLOW.md](./TENANT_SETUP_FLOW.md)
2. **Upload knowledge base documents** - Use admin knowledge endpoints
3. **Test chat functionality** - Send test messages
4. **Review logs** - Check for errors or warnings
5. **Set up monitoring** (Phase 2 - Prometheus metrics to be added)

---

## Production Deployment

**Before deploying to production**:

1. **Security** (Phase 2 fixes required):
   - [ ] Set `DISABLE_AUTH=false`
   - [ ] Configure `JWT_PUBLIC_KEY`
   - [ ] Fix DISABLE_AUTH production check (Issue #1)
   - [ ] Add RAG post-query validation (Issue #2)
   - [ ] Implement rate limiting (Issue #3)

2. **Infrastructure**:
   - [ ] Use production-grade PostgreSQL (not Docker)
   - [ ] Set up PostgreSQL replication
   - [ ] Configure Redis persistence
   - [ ] Set up backup strategy
   - [ ] Enable SSL/TLS

3. **Environment**:
   - [ ] Set `ENVIRONMENT=production`
   - [ ] Use strong `FERNET_KEY`
   - [ ] Remove any hardcoded credentials
   - [ ] Configure proper logging (structured logs to file/service)

4. **Monitoring**:
   - [ ] Set up Prometheus metrics
   - [ ] Configure Grafana dashboards
   - [ ] Set up alerting (PagerDuty/Opsgenie)
   - [ ] Enable error tracking (Sentry)

See `CHANGELOG_FIXES.md` for full list of issues and fixes.

---

## Additional Resources

- **Configuration Reference**: [CONFIGURATION.md](./CONFIGURATION.md)
- **Tenant Setup Guide**: [TENANT_SETUP_FLOW.md](./TENANT_SETUP_FLOW.md)
- **Architecture Analysis**: `../Documentation/ARCHITECTURE_ANALYSIS.md`
- **Database ERD**: `../Documentation/DATABASE_ERD.md`
- **Developer Guide**: `../CLAUDE.md`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-25
**Maintained By**: Engineering Team
