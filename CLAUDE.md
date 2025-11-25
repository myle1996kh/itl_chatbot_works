# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AgentHub Multi-Agent Chatbot Framework** - A production-ready, multi-tenant chatbot system using LangChain 0.3+ for agent orchestration, PostgreSQL with pgvector for RAG, and FastAPI for the backend API.

## Technology Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn
- **Agent Framework**: LangChain 0.3+, LangGraph 0.2+
- **Database**: PostgreSQL 15+ with pgvector extension
- **ORM**: SQLAlchemy 2.0+, Alembic for migrations
- **Caching**: Redis 7.x
- **Vector Search**: pgvector with sentence-transformers (all-MiniLM-L6-v2, 384 dimensions)
- **Security**: JWT (RS256), Fernet encryption
- **Logging**: structlog
- **Testing**: pytest, pytest-asyncio, pytest-cov

## Project Structure

```
ITL_PGVector/
├── backend/                          # Main FastAPI backend application
│   ├── src/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Settings (Pydantic Settings)
│   │   ├── models/                   # SQLAlchemy ORM models (17 models)
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── api/                      # FastAPI route handlers
│   │   │   ├── chat.py               # Chat endpoint
│   │   │   ├── sessions.py           # Session management
│   │   │   └── admin/                # Admin endpoints (agents, tools, tenants, knowledge)
│   │   ├── services/                 # Core business logic
│   │   │   ├── supervisor_agent.py   # Intent detection and routing
│   │   │   ├── domain_agents.py      # Domain-specific agent implementations
│   │   │   ├── rag_service.py        # PgVector-based RAG
│   │   │   ├── llm_manager.py        # LLM provider management
│   │   │   ├── tool_loader.py        # Dynamic tool loading
│   │   │   ├── embedding_service.py  # Sentence-transformers embedding
│   │   │   ├── conversation_memory.py # Conversation history
│   │   │   ├── checkpoint_service.py  # LangGraph checkpoint management
│   │   │   ├── cache_service.py       # Redis caching layer
│   │   │   ├── document_processor.py  # PDF/DOCX parsing for RAG
│   │   │   └── escalation_service.py  # Human escalation workflow
│   │   ├── tools/                    # Tool implementations
│   │   │   ├── rag.py                # RAG tool for knowledge retrieval
│   │   │   └── http.py               # HTTP API tool
│   │   ├── middleware/               # FastAPI middleware
│   │   │   ├── auth.py               # JWT authentication
│   │   │   └── logging.py            # Request logging
│   │   └── utils/                    # Utilities
│   ├── alembic/                      # Database migrations
│   │   └── versions/                 # Migration scripts
│   ├── tests/                        # Bruno API tests (.bru files)
│   │   └── Chatbot/                  # API test collections
│   │       ├── admin-agents/         # Agent admin tests
│   │       ├── admin-knowledge/      # Knowledge base tests
│   │       ├── admin-tools/          # Tool admin tests
│   │       ├── chat/                 # Chat endpoint tests
│   │       └── ...                   # Other test collections
│   ├── Guides/                       # Setup & configuration guides
│   │   ├── BACKEND_SETUP.md          # How to run backend from scratch
│   │   ├── TENANT_SETUP_FLOW.md      # Tenant configuration guide
│   │   └── CONFIGURATION.md          # Environment variables reference
│   ├── migrations/                   # Custom seed data scripts (optional)
│   ├── alembic/                      # Database migrations (canonical)
│   │   └── versions/                 # Migration scripts
│   ├── docker-compose.yml            # TO BE CREATED (Phase 1)
│   ├── requirements.txt              # Python dependencies
│   ├── pyproject.toml                # Project config (black, ruff, pytest, mypy)
│   ├── alembic.ini                   # Alembic configuration
│   ├── .env.example                  # TO BE CREATED (Phase 1)
│   ├── .env                          # Environment variables (not in git)
│   ├── test_rag.ipynb                # RAG testing notebook
│   └── notebook.ipynb                # General testing notebook
├── Documentation/                    # Architecture & analysis docs
│   ├── ARCHITECTURE_ANALYSIS.md      # System analysis (multi-tenancy verification)
│   ├── DATABASE_ERD.md               # Database schema documentation
│   ├── REFACTORING_PLAN.md           # Improvement roadmap
│   ├── PRD.md                        # Product requirements (OUTDATED)
│   └── README.md                     # Documentation index
└── CHANGELOG_FIXES.md                # Problem tracking & file changes log
```

## Common Commands

### Development Setup

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Install dev dependencies
pip install black ruff mypy
```

### Running the Application

```bash
# Start PostgreSQL + Redis with Docker
cd backend
docker-compose up -d

# Run database migrations
alembic upgrade head

# Start API server (development mode with auto-reload)
python src/main.py
# OR
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

**Current Test Suite**: Bruno API Tests (.bru files)

```bash
# Bruno tests are located in tests/Chatbot/
# 56 API test files organized by endpoint groups:
# - admin-agents/, admin-knowledge/, admin-tools/, admin-tenants/
# - chat/, sessions/, supporter/, etc.

# To run Bruno tests, use Bruno CLI or Bruno GUI application
# See: https://www.usebruno.com/
```

**Future**: pytest test suite to be implemented in Phase 4

```bash
# Planned pytest structure (not yet implemented):
# pytest --cov=src --cov-report=term --cov-fail-under=80
# pytest tests/unit/
# pytest tests/integration/
```

### Code Quality

```bash
cd backend

# Format code (line length: 100)
black src/

# Lint code
ruff check src/

# Type checking
mypy src/
```

### Database Operations

```bash
# Create new migration (auto-generate from model changes)
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history

# View current version
alembic current

# Reset database (WARNING: destroys all data)
alembic downgrade base
alembic upgrade head
```

### Docker Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f backend

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

## Architecture Overview

### Multi-Agent System

The system uses a **Supervisor-Domain Agent pattern**:

1. **SupervisorAgent** (`services/supervisor_agent.py`):
   - Routes incoming messages to appropriate domain agents
   - Detects single intent, multiple intents, or unclear queries
   - Uses LLM for intent classification
   - Handles multi-language support

2. **DomainAgent** (`services/domain_agents.py`):
   - Specialized agents for specific domains (e.g., tracking, invoice, support)
   - Dynamically loads tools from database based on agent configuration
   - Performs entity extraction from user messages
   - Executes tool calls with extracted entities
   - Returns formatted responses

3. **Tool System** (`tools/`, `services/tool_loader.py`):
   - Tools are defined in database (`base_tools`, `tool_configs` tables)
   - Tools have input schemas that define required entities
   - Dynamic tool loading based on tenant permissions
   - Built-in tools: RAG (knowledge retrieval), HTTP (API calls)

### Multi-Tenancy

- **Tenant Isolation**: All data is scoped by `tenant_id`
- **Permissions**: Agents and tools are assigned per-tenant via permission tables
- **LLM Configs**: Each tenant can have custom LLM settings (provider, model, temperature)
- **Knowledge Bases**: RAG uses metadata filtering on `tenant_id` for isolation

### Database Schema (17 Models)

**Core Tenant Tables**:
- `tenants` - Organizations using the system
- `llm_models` - Available LLM providers/models
- `tenant_llm_configs` - Tenant-specific LLM configurations (1:1 with tenants)
- `tenant_widget_configs` - Widget configuration per tenant (1:1 with tenants)

**User & Authentication**:
- `users` - System users (admins, supporters)
- `chat_users` - Chat participants/end users
- `supporters` - Support staff (partially deprecated, see migrations)

**Agent & Tool Configuration**:
- `base_tools` - Tool type templates
- `tool_configs` - Specific tool instances with configs
- `agent_configs` - Domain agent configurations
- `agent_tools` - Many-to-many junction table (agents ↔ tools)
- `output_formats` - Response format definitions

**Permissions**:
- `tenant_agent_permissions` - Agent access per tenant
- `tenant_tool_permissions` - Tool access per tenant

**Runtime**:
- `sessions` - Conversation sessions
- `messages` - Chat message history
- `checkpoints` - LangGraph state persistence

### RAG (Retrieval-Augmented Generation)

**Implementation** (`services/rag_service.py`):
- Uses **PostgreSQL + pgvector** (migrated from ChromaDB)
- **Embeddings**: sentence-transformers (`all-MiniLM-L6-v2`, 384 dimensions)
- **Index**: HNSW for fast similarity search
- **Search**: Cosine similarity with configurable top-k
- **Multi-tenancy**: Metadata filtering on `tenant_id`
- **Document Table**: `knowledge_documents` with tenant isolation

**Testing**: See `backend/test_rag.ipynb` for RAG testing workflow

### Authentication & Security

- **JWT**: RS256 public key validation (`middleware/auth.py`)
- **Encryption**: Fernet for API key encryption (`utils/encryption.py`)
- **Auth Bypass**: `DISABLE_AUTH=true` for local testing (development only)
- **Rate Limiting**: Configured per tenant (RPM/TPM limits)

### Configuration

All settings in `src/config.py` use Pydantic Settings, loaded from `.env`:

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `FERNET_KEY` - Generate with: `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`

**Optional**:
- `JWT_PUBLIC_KEY` - RS256 public key (required if auth enabled)
- `DISABLE_AUTH` - Set to `true` for local testing without JWT
- `ENVIRONMENT` - `development` or `production`
- `LOG_LEVEL` - `INFO`, `DEBUG`, etc.

## Development Patterns

### Adding a New Domain Agent

1. Add agent config to database via admin API or migration seed data
2. Create tool configs and link via `agent_tools` junction table
3. Grant tenant permissions in `tenant_agent_permissions`
4. Agent will be automatically loaded by `SupervisorAgent`

### Adding a New Tool

1. Define base tool in `base_tools` table (name, category, description)
2. Create tool config in `tool_configs` with `input_schema` JSON
3. Implement tool class in `tools/` directory (inherit from `BaseTool`)
4. Register tool in `tool_loader.py`'s tool registry
5. Grant tenant permissions in `tenant_tool_permissions`

### Testing Patterns

- **Unit tests**: Mock database sessions and external services
- **Integration tests**: Use test database with fixtures
- **E2E tests**: Full flow from API request to response
- Use `pytest-asyncio` for async tests
- Coverage target: 80% (`--cov-fail-under=80`)

### Migration Workflow

1. Modify SQLAlchemy models in `src/models/`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review generated migration in `alembic/versions/`
4. Apply: `alembic upgrade head`
5. Test rollback: `alembic downgrade -1` then `alembic upgrade head`

## Important Notes

### Model Imports

All models must be imported in `src/main.py` (even if appearing unused) to ensure SQLAlchemy relationship resolution works correctly. Do not remove these imports.

### Conversation Memory

Conversation history is stored in `messages` table and loaded by `ConversationMemoryService`. LangGraph checkpoints are stored in `checkpoints` table for state persistence.

### Tool Execution Flow

1. User message → SupervisorAgent detects intent → routes to DomainAgent
2. DomainAgent extracts entities from message using LLM
3. If entities match tool requirements → execute tool
4. If entities missing → ask clarification questions
5. Tool returns results → DomainAgent formats response using output format

### OpenRouter Integration

The system supports OpenRouter for LLM access:
- Configure `OPENROUTER_API_KEY` in `.env`
- Set tenant LLM config to use OpenRouter models
- LLM manager (`llm_manager.py`) handles provider routing

## API Documentation

When server is running:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

### Main Endpoints

**Chat**:
- `POST /api/{tenant_id}/chat` - Send chat message
- `GET /api/{tenant_id}/session` - List sessions (note: singular "session")

**Admin - Agents & Tools**:
- `GET /api/admin/agents` - List agents
- `POST /api/admin/agents` - Create agent
- `GET /api/admin/tools` - List tools
- `POST /api/admin/tools` - Create tool

**Admin - Knowledge Base**:
- `POST /api/admin/knowledge/upload` - Upload documents for RAG
- `POST /api/admin/knowledge/ingest` - Trigger document ingestion
- `GET /api/admin/knowledge/stats` - Get knowledge base stats

**Admin - Tenants**:
- `GET /api/admin/tenants` - List tenants
- `POST /api/admin/tenants` - Create tenant

**Auth** (if enabled):
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

See `backend/Guides/TENANT_SETUP_FLOW.md` for complete API workflow

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Test connection
psql -h localhost -U agenthub -d agenthub

# View logs
docker-compose logs postgres
```

### pgvector Extension Issues

```bash
# Connect to database
psql -h localhost -U agenthub -d agenthub

# Check if extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

# If not installed
CREATE EXTENSION vector;
```

### Migration Issues

```bash
# Check current version
alembic current

# View pending migrations
alembic history

# Force version (if migrations are out of sync)
alembic stamp head
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test connection
redis-cli ping

# View logs
docker-compose logs redis
```

## Code Style Guidelines

- **Line Length**: 100 characters (configured in `pyproject.toml`)
- **Formatting**: Use `black` for auto-formatting
- **Linting**: Use `ruff` for linting (select: E, F, I, N, W)
- **Type Hints**: Use type hints for function signatures
- **Logging**: Use `structlog` with structured context (see `utils/logging.py`)
- **Async**: Use `async/await` for I/O operations (database, LLM calls, Redis)

## References

### External Documentation
- **LangChain Docs**: https://python.langchain.com/docs/
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **pgvector**: https://github.com/pgvector/pgvector
- **FastAPI**: https://fastapi.tiangolo.com/
- **SQLAlchemy 2.0**: https://docs.sqlalchemy.org/en/20/
- **sentence-transformers**: https://www.sbert.net/

### Internal Documentation
- **Backend Setup**: `backend/Guides/BACKEND_SETUP.md` - How to run from scratch
- **Tenant Setup**: `backend/Guides/TENANT_SETUP_FLOW.md` - Tenant configuration workflow
- **Configuration**: `backend/Guides/CONFIGURATION.md` - Environment variables reference
- **Architecture Analysis**: `Documentation/ARCHITECTURE_ANALYSIS.md` - System audit & multi-tenancy verification
- **Database ERD**: `Documentation/DATABASE_ERD.md` - Complete schema documentation
- **Changelog**: `CHANGELOG_FIXES.md` - Problem tracking & file changes
- **PRD** (outdated): `Documentation/PRD.md` - Original product requirements (code is source of truth)

**Note**: List todo list and confirm action before coding too much, every summary that update back to main files, not create each file - like over documentation - one file unified - any note needed clear chat then list todo remaining > minimize token