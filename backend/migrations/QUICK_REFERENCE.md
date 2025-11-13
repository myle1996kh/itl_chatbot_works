# Quick Reference Card - Phase 7 Handoff

**Print this card for quick access during development**

---

## 🎯 Your Assignment

| Agent | Requirement Document | Focus |
|-------|-------------------|-------|
| **You** | `tracking/REQUIREMENT_*.md` | **See document name** |

---

## 🚀 Quick Start (10 Minutes)

```bash
# 1. Navigate to backend
cd backend

# 2. Activate environment or use uv
uv run python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 3. Open in new terminal
curl http://localhost:8000/health

# 4. View API docs
# Open browser: http://localhost:8000/docs
```

---

## 📚 Read First (In This Order)

1. `DEV_AGENT_ONBOARDING.md` - Setup guide
2. `HANDOFF_SUMMARY.md` - System overview
3. `tracking/REQUIREMENT_*.md` - Your specific tasks

---

## 🗂️ Key Files You'll Modify

```
backend/src/
├── api/chat.py          ← Your main target
├── models/              ← Reference (read-only)
├── services/            ← Reference (read-only)
└── tools/               ← Reference (read-only)
```

---

## 💻 Important Commands

```bash
# Run tests (from backend/)
pytest --cov=src --cov-fail-under=80

# Run specific test
pytest tests/unit/test_chat.py -v

# Format code
black src/

# Lint code
ruff check src/ --fix

# Type check
mypy src/

# Reset database
python migrations/run_all.py
```

---

## 🧪 Test Your Feature

```bash
# Using curl
curl -X POST http://localhost:8000/api/3105b788-b5ff-4d56-88a9-532af4ab4ded/test/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your test message",
    "user_id": "test-user",
    "session_id": null,
    "metadata": {}
  }'

# OR use Swagger UI
# http://localhost:8000/docs
```

---

## 📊 System Context

**3 Tenants:**
- **eTMS** (testing): 3105b788-b5ff-4d56-88a9-532af4ab4ded
- **eFMS**: d19a8569-a01f-4026-91b2-9da41f2e0cc2
- **Vela**: 7319e693-a4c9-4023-be86-e50184e80abf

**4 Agents:**
- SupervisorAgent (intent routing)
- GuidelineAgent (knowledge base)
- DebtAgent (debt info)
- ShipmentAgent (tracking)

**6 Tools:**
- search_knowledge_base (RAG)
- get_customer_debt_by_mst (API)
- get_salesman_debt (API)
- track_shipment (API)
- update_shipment_status (API)
- +1 more

---

## 🔑 Key Endpoints

```
Health:  GET  http://localhost:8000/health
Chat:    POST http://localhost:8000/api/{tenant_id}/test/chat
Docs:         http://localhost:8000/docs
ReDoc:        http://localhost:8000/redoc
```

---

## 🗄️ Database Models (13 Tables)

**Core:**
- tenants
- sessions
- messages

**Agents & Tools:**
- agent_configs
- tool_configs
- agent_tools
- base_tools

**Permissions:**
- tenant_agent_permissions
- tenant_tool_permissions

**LLM:**
- llm_models
- tenant_llm_configs

**Users:**
- users, supporters

---

## ⚡ Async/Await Pattern

```python
# ✅ CORRECT - Use async for I/O
async def get_chat_response(
    db: Session,
    message: str,
    tenant_id: str
):
    # Database queries
    tenant = db.query(Tenant).filter(...).first()

    # LLM calls
    response = await llm.ainvoke(...)

    # Return result
    return response

# ❌ WRONG - Don't use sync I/O
def get_chat_response(db, message):
    response = llm.invoke(...)  # BLOCKING!
```

---

## 🧬 Type Hints Pattern

```python
from typing import Optional, List
from src.models import Session, Message
from src.schemas import ChatRequest, ChatResponse

async def process_chat(
    db: Session,
    request: ChatRequest,
    tenant_id: str
) -> ChatResponse:
    """Process chat message and return response."""
    messages: List[Message] = db.query(Message).all()

    response: Optional[str] = await get_llm_response(request.message)

    return ChatResponse(response=response)
```

---

## 📝 Logging Pattern

```python
import structlog

log = structlog.get_logger(__name__)

# Log with context
log.info(
    "message_processed",
    tenant_id=tenant_id,
    user_id=user_id,
    duration_ms=123.45
)

# Log errors
log.error(
    "llm_call_failed",
    tenant_id=tenant_id,
    error=str(e),
    stack_trace=traceback.format_exc()
)
```

---

## 🔍 Debug Tips

```python
# Print variable
print(f"Debug: {variable}")

# Check type
print(f"Type: {type(variable)}")

# Pretty print dict
import json
print(json.dumps(data, indent=2))

# Database query debug
from sqlalchemy import event
# Enable SQL logging in debug mode
```

---

## ✅ Before Committing

- [ ] Tests passing: `pytest --cov=src --cov-fail-under=80`
- [ ] Code formatted: `black src/`
- [ ] No lint issues: `ruff check src/`
- [ ] Type check passes: `mypy src/`
- [ ] Chat API works: `curl http://localhost:8000/health`
- [ ] No breaking changes to other features
- [ ] Updated requirement document with progress
- [ ] Added docstrings to new functions

---

## 🆘 Common Issues

| Problem | Fix |
|---------|-----|
| Module not found | Use `uv run` or activate venv |
| Database connection error | Check PostgreSQL is running: `docker-compose ps` |
| LLM provider error | Check provider name is "gemini" not "google" |
| No TenantLLMConfig | Run: `python migrations/7_seed_llm_configs.py` |
| 500 error | Check server logs in console |
| Tests failing | Run: `pytest tests/ -v` for details |

---

## 🌐 Useful Links

- **LangChain Docs:** https://python.langchain.com/
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **SQLAlchemy:** https://docs.sqlalchemy.org/
- **pgvector:** https://github.com/pgvector/pgvector
- **Pydantic:** https://docs.pydantic.dev/

---

## 📋 Completion Checklist

When done with your task:

- [ ] Requirement document marked as COMPLETED
- [ ] All tests passing (80%+ coverage)
- [ ] Chat API returns 200 for your feature
- [ ] No breaking changes to other features
- [ ] Code follows project style guidelines
- [ ] Implementation notes added to requirement doc

---

## 💬 Questions?

1. Check your requirement document (should have all specs)
2. Review `HANDOFF_SUMMARY.md` for system architecture
3. Look at similar code in `backend/src/services/`
4. Check server logs: look at console output where uvicorn is running
5. Debug with `print()` statements and pytest

---

**Quick Reference v1.0 | Phase 7 Handoff | 2025-11-11**
