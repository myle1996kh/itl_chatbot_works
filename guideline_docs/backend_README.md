# Backend README – Multi‑Tenant Chatbot

This document is focused on the backend only (`backend/src`), complementing the root `README.md`.

---

## 1. Tech Stack

- **Framework**: FastAPI
- **ORM**: SQLAlchemy (with PostgreSQL + JSONB/UUID)
- **Config**: Pydantic Settings (`src/config.py`)
- **Migrations**: Alembic (`backend/alembic.ini`)
- **LLM Orchestration**: Custom `llm_manager`, `SupervisorAgent`, domain agents
- **Cache/Rate Limiting**: Redis (optional)

---

## 2. Project Layout (Backend)

Under `backend/src`:

- `main.py` – FastAPI app initialization and server entrypoint.
- `config.py` – Pydantic `Settings`, DB and Redis config, session/engine factory.
- `models/` – SQLAlchemy models (tenants, sessions, messages, tools, agents, users, etc.).
- `schemas/` – Pydantic models for request/response bodies.
- `api/` – Route handlers:
  - `auth.py` – Authentication & tenant listing.
  - `chat.py` – Chat endpoint.
  - `sessions.py` – Session management.
  - `chat_users.py` – Chat user CRUD.
  - `supporter.py` – Supporter and escalation APIs.
  - `admin/` – Admin APIs (tenants, agents, tools, knowledge, escalation, sessions).
- `services/` – Business logic:
  - `llm_manager.py` – LLM provider integration and rate limiting.
  - Domain agents, supervisor agent, tools, knowledge ingestion, etc.
- `middleware/` – Auth and other HTTP middleware.
- `utils/` – Helpers (logging, exceptions, etc.).

---

## 3. Configuration

Configuration is primarily driven by environment variables read by `src.config.Settings`.

Key variables:

- `DATABASE_URL`
  - PostgreSQL DSN.
  - Default (already set in `config.py`):
    - `postgresql://postgres:Postgres123!@172.23.178.103:32001/chatbot`

- `ENVIRONMENT`
  - `development` (default) or `production`.
  - Controls logging and auth safety checks.

- `API_HOST`, `API_PORT`
  - Bind address and port for uvicorn.
  - Default: `0.0.0.0:8000`.

- `REDIS_URL` (optional)
  - `redis://host:port` for rate limiting.

- `JWT_PUBLIC_KEY`
  - Required in production for JWT verification.

- `DISABLE_AUTH`
  - `False` by default.
  - In development, can be set `True` to bypass auth for easier testing.
  - In production, startup validation forbids `DISABLE_AUTH=True`.

You can place these values in a `.env` file inside `backend`, or set them via your shell.

---

## 4. Running the Backend with uv

From the project root:

```powershell
cd backend

# Create virtual environment
uv venv .venv

# Install dependencies (choose one, depending on your project config)
uv sync          # if pyproject.toml exists
# or
uv pip install -r requirements.txt
```

Then run the API:

```powershell
uv run python src/main.py
```

The API is available at:

- `http://localhost:8000/`
- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`

---

## 5. Database & Migrations

1. Ensure PostgreSQL is running and accessible with:

```text
postgresql://postgres:Postgres123!@172.23.178.103:32001/chatbot
```

2. Apply migrations (from `backend`):

```powershell
uv run alembic upgrade head
```

3. ERD and table descriptions:
   - See `guideline_docs/backend_ERD.md` for a detailed entity/relationship overview.

---

## 6. API Surface

- High‑level API documentation:
  - See `guideline_docs/backend_API.md` for:
    - Chat endpoint
    - Sessions and chat users
    - Admin endpoints (tenants, agents, tools, knowledge, escalation)

---

## 7. Development Notes

- **Hot reload**:
  - `main.py` enables uvicorn reload mode in development, watching `backend/src` and ignoring transient files.

- **Auth bypass for local testing**:
  - Set `DISABLE_AUTH=true` and `ENVIRONMENT=development` to skip JWT auth when calling chat/admin APIs locally.

- **Rate limiting**:
  - If `REDIS_URL` is set, `llm_manager` uses Redis for rate limiting LLM calls.
  - Failures to connect to Redis are logged but do not crash the app.

---

