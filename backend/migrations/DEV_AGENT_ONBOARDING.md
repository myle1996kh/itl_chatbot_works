# Dev Agent Onboarding Guide

**Phase 7 Handoff Document**
**Date:** 2025-11-11
**For:** All Dev Agents (1-4)

---

## 🎯 Quick Start (5 Minutes)

### Step 1: Read Your Assignment
Find your requirement document in `/backend/migrations/tracking/`:
- **Dev Agent 1:** `REQUIREMENT_CHAT_ROUTING.md`
- **Dev Agent 2:** `REQUIREMENT_CHAT_SESSIONS.md`
- **Dev Agent 3:** `REQUIREMENT_KNOWLEDGE_BASE.md`
- **Dev Agent 4:** `REQUIREMENT_ESCALATION.md`

### Step 2: Understand the System
Read these in order:
1. `/backend/migrations/HANDOFF_SUMMARY.md` - System overview (15 min)
2. `/backend/migrations/PHASE_7_STATUS.md` - Phase completion (5 min)
3. Your assigned requirement document - Your specific tasks (10 min)

### Step 3: Start Development
```bash
# Navigate to backend
cd backend

# Create virtual environment (if needed)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# OR use uv (recommended - auto-manages environment)
uv run python -m pytest tests/unit/

# Start development server
uv run python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📊 System Architecture (Quick Reference)

### Multi-Tenant Structure
```
3 Tenants:
├─ eTMS (3105b788-b5ff-4d56-88a9-532af4ab4ded)
│  ├─ LLM: Google Gemini 2.5 Flash
│  ├─ 4 Agents: SupervisorAgent, GuidelineAgent, DebtAgent, ShipmentAgent
│  ├─ 6 Tools: search_knowledge_base, get_customer_debt_by_mst, etc.
│  └─ 3 Users + 1 Supporter
│
├─ eFMS (d19a8569-a01f-4026-91b2-9da41f2e0cc2)
│  ├─ LLM: Google Gemini 2.0 Flash (OpenRouter)
│  └─ 3 Users + 1 Supporter
│
└─ Vela (7319e693-a4c9-4023-be86-e50184e80abf)
   ├─ LLM: GPT-4o Mini (OpenRouter)
   └─ 3 Users + 1 Supporter
```

### Agent Types
- **SupervisorAgent** - Intent detection and routing (system agent)
- **DomainAgent** - Specialized agents (GuidelineAgent, DebtAgent, ShipmentAgent)
- **Each agent** has assigned tools and tenant permissions

### Tool Types
- **RAG Tools** - `search_knowledge_base` (semantic search with pgvector)
- **HTTP Tools** - `get_customer_debt_by_mst`, `track_shipment`, etc. (API calls)

### Request Flow
```
POST /api/{tenant_id}/chat
   ↓
Chat Endpoint receives message
   ↓
SupervisorAgent detects intent
   ↓
Route to appropriate DomainAgent
   ↓
DomainAgent executes tools if needed
   ↓
Response formatted and returned to user
```

---

## 🗂️ Key Files by Category

### Your Development Target
- **`backend/src/api/chat.py`** - Main chat endpoint (200 lines)
  - Contains `POST /api/{tenant_id}/chat` implementation
  - Lines 1-50: Imports and function setup
  - Lines 51-150: Chat endpoint logic (MODIFY THIS)
  - Lines 151-250: Helper functions

### Database Models (Read-Only Reference)
- **`backend/src/models/__init__.py`** - All model imports
- **`backend/src/models/tenant.py`** - Tenant model
- **`backend/src/models/agent.py`** - Agent and AgentTools models
- **`backend/src/models/session.py`** - Session and Message models
- **`backend/src/models/tenant_llm_config.py`** - LLM configuration
- **`backend/src/models/tool.py`** - Tool and ToolConfig models
- **`backend/src/models/user.py`** - User and Supporter models

### Services (Reference Implementation)
- **`backend/src/services/supervisor_agent.py`** - Intent routing logic
- **`backend/src/services/domain_agents.py`** - Agent execution
- **`backend/src/services/rag_service.py`** - Knowledge base search
- **`backend/src/services/llm_manager.py`** - LLM provider management
- **`backend/src/services/tool_loader.py`** - Dynamic tool loading
- **`backend/src/services/conversation_memory.py`** - Message history

### Testing & Verification
- **`backend/test_chat_api.py`** - Example chat API test
- **`backend/tests/unit/`** - Unit test suite
- **`backend/tests/integration/`** - Integration tests
- **`backend/tests/e2e/`** - End-to-end tests

### Configuration & Setup
- **`backend/.env`** - Environment variables (secrets)
- **`backend/.env.example`** - Environment template
- **`backend/pyproject.toml`** - Project dependencies and config
- **`backend/alembic.ini`** - Database migration config

---

## 🔧 Development Environment Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+ (running in Docker)
- Redis 7.x (running in Docker)

### Quick Setup
```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies using uv (recommended)
uv sync
# OR using pip
pip install -r requirements.txt

# 3. Start Docker services
docker-compose up -d

# 4. Run database migrations
alembic upgrade head

# 5. Seed database (if not already seeded)
python migrations/run_all.py

# 6. Start API server
uv run python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 7. Test API health
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```

### Environment Variables (.env)
```bash
# Database
DATABASE_URL=postgresql://agenthub:agenthub@localhost:5432/agenthub

# Redis
REDIS_URL=redis://localhost:6379

# Encryption
FERNET_KEY=<generated-key-here>

# LLM APIs
GOOGLE_API_KEY=<your-google-api-key>
OPENROUTER_API_KEY=<your-openrouter-key>

# Auth
DISABLE_AUTH=true  # For local development

# Logging
LOG_LEVEL=INFO
ENVIRONMENT=development
```

---

## 🧪 Testing Your Implementation

### Run All Tests
```bash
cd backend
pytest --cov=src --cov-report=term --cov-fail-under=80
```

### Run Tests for Your Feature
```bash
# Run specific test file
pytest tests/unit/test_your_feature.py -v

# Run specific test
pytest tests/unit/test_your_feature.py::test_name -v

# Run with debugging
pytest tests/unit/test_your_feature.py -v -s
```

### Test Chat API Manually
```bash
# Using curl
curl -X POST http://localhost:8000/api/3105b788-b5ff-4d56-88a9-532af4ab4ded/test/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your test message here",
    "user_id": "test-user",
    "session_id": null,
    "metadata": {}
  }'

# Expected response format
{
  "session_id": "...",
  "message_id": "...",
  "agent": "AgentName",
  "intent": "intent_type",
  "format": "text",
  "response": {"message": "..."},
  "metadata": {
    "duration_ms": 2183.54,
    "llm_model": {"model_class": "ChatGoogleGenerativeAI"},
    "tool_calls": []
  }
}
```

### View API Documentation
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/health

---

## 📚 Code Style & Guidelines

### Format & Linting
```bash
cd backend

# Format code (line length: 100)
black src/

# Lint code
ruff check src/ --fix

# Type checking
mypy src/
```

### Style Rules
- **Line Length:** 100 characters max
- **Formatting:** Use `black` for auto-formatting
- **Linting:** Use `ruff` for code quality
- **Type Hints:** Use type hints for all function signatures
- **Async:** Use `async/await` for I/O (database, LLM, Redis)
- **Logging:** Use `structlog` with context

### Imports Pattern
```python
# Standard library imports
import sys
from pathlib import Path

# Third-party imports
from fastapi import FastAPI, HTTPException
from sqlalchemy.orm import Session

# Local imports
from src.models import User, Session as ChatSession
from src.services import supervisor_agent
from src.config import settings
```

---

## 🐛 Debugging Tips

### Enable Debug Logging
```python
# In your code
import structlog
log = structlog.get_logger(__name__)

# Log with context
log.info("message_sent", user_id=user_id, tenant_id=tenant_id)
```

### View Server Logs
```bash
# While server is running in another terminal
docker-compose logs -f backend

# Or if running locally
# Check console output where you ran uvicorn
```

### Database Debugging
```bash
# Connect to PostgreSQL
psql -h localhost -U agenthub -d agenthub

# View tables
\dt

# View specific table
SELECT * FROM tenants;

# Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Test Database Queries
```python
# In Python
from src.config import SessionLocal
db = SessionLocal()

# Query example
from src.models import Tenant
tenants = db.query(Tenant).all()
print(f"Found {len(tenants)} tenants")

db.close()
```

---

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| ModuleNotFoundError | Virtual environment not activated | Use `uv run` or activate venv |
| Database connection error | PostgreSQL not running | `docker-compose up -d postgres` |
| pgvector not found | Extension not installed | Run migration: `alembic upgrade head` |
| No LLM configuration | TenantLLMConfig missing | Run seed script: `python migrations/7_seed_llm_configs.py` |
| Unsupported LLM provider | Wrong provider name in DB | Check llm_models table, should be "gemini" not "google" |
| 500 error in chat endpoint | Check server logs | Look for full error in console or Docker logs |

---

## 📞 Support

### Documentation References
- **LangChain:** https://python.langchain.com/docs/
- **LangGraph:** https://langchain-ai.github.io/langgraph/
- **FastAPI:** https://fastapi.tiangolo.com/
- **SQLAlchemy:** https://docs.sqlalchemy.org/en/20/
- **pgvector:** https://github.com/pgvector/pgvector

### Key Files to Reference
1. `HANDOFF_SUMMARY.md` - System overview
2. `PHASE_7_STATUS.md` - Phase completion
3. Your requirement document - Your specific tasks
4. `CLAUDE.md` - Project guidelines

### Before You Get Stuck
1. Check requirement document for detailed specs
2. Look at similar implementations in codebase
3. Review HANDOFF_SUMMARY.md for architecture
4. Run tests to verify: `pytest tests/ -v`
5. Check server logs for error details

---

## ✅ Completion Checklist

When you complete your implementation, verify:

- [ ] All tests passing (`pytest --cov=src --cov-fail-under=80`)
- [ ] Chat API returns 200 status for your feature
- [ ] No breaking changes to other features
- [ ] Code follows project style guidelines
- [ ] Requirement document marked as COMPLETED
- [ ] Implementation notes added to requirement doc
- [ ] All new functions have type hints
- [ ] All new classes documented with docstrings

---

## 🎯 Next Steps

1. **Read your requirement document completely**
2. **Review HANDOFF_SUMMARY.md for system context**
3. **Set up development environment**
4. **Begin implementation following requirement specs**
5. **Write tests as you develop**
6. **Test chat API with curl or Swagger UI**
7. **Mark requirement as COMPLETED when done**

---

**Good luck! The system is ready, database is seeded, API is functional. Your job is to complete the features.**

**Any issues? Check the requirement document first, then HANDOFF_SUMMARY.md, then logs.**
