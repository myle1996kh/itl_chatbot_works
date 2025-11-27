# Architecture - Backend API

**Generated:** 2025-11-26
**Part:** Backend
**Type:** Backend API Service
**Primary Tech:** Python 3.11+ / FastAPI / LangChain

## Executive Summary

The backend is a production-ready, multi-tenant chatbot API built on FastAPI with LangChain/LangGraph for AI agent orchestration. It implements a **Supervisor-Domain Agent pattern** where a central supervisor routes user messages to specialized domain agents. The system features RAG (Retrieval-Augmented Generation) using PostgreSQL + pgvector, multi-provider LLM support, and comprehensive multi-tenancy with data isolation.

## Architecture Pattern

**Primary Pattern:** Service-Oriented API with Multi-Agent Orchestration

**Key Characteristics:**
- **Layered Architecture:** API → Services → Data Access
- **Agent Orchestration:** Supervisor pattern with specialized domain agents
- **Multi-Tenancy:** Tenant-scoped data isolation at all layers
- **Tool System:** Dynamic, extensible tool framework
- **RAG Pipeline:** Document ingestion → Embedding → Vector search → Generation

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│  (Frontend App, Embedded Widget, External API Clients)              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS/JWT
┌────────────────────────────┴────────────────────────────────────────┐
│                    FastAPI Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Chat API   │  │   Auth API   │  │  Admin API   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
│  ┌──────┴──────────────────┴──────────────────┴───────┐             │
│  │            Middleware Layer                         │             │
│  │  (Authentication, Logging, Tenant Isolation)        │             │
│  └──────────────────────┬──────────────────────────────┘             │
└─────────────────────────┴────────────────────────────────────────────┘
                          │
┌─────────────────────────┴────────────────────────────────────────────┐
│                    Business Logic / Service Layer                     │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Multi-Agent Orchestration System                  │  │
│  │                                                                │  │
│  │   ┌─────────────────────────────────────────────────────┐    │  │
│  │   │         SupervisorAgent (Intent Router)             │    │  │
│  │   │  - Intent detection                                 │    │  │
│  │   │  - Agent selection                                  │    │  │
│  │   │  - Multi-intent handling                            │    │  │
│  │   └──────────────────┬──────────────────────────────────┘    │  │
│  │                      │                                        │  │
│  │   ┌──────────────────┴──────────────────┐                    │  │
│  │   │         Domain Agents               │                    │  │
│  │   │  (Tracking, Invoice, Support, etc.) │                    │  │
│  │   │  - Entity extraction                │                    │  │
│  │   │  - Tool execution                   │                    │  │
│  │   │  - Response formatting              │                    │  │
│  │   └──────────────────┬──────────────────┘                    │  │
│  │                      │                                        │  │
│  │   ┌──────────────────┴──────────────────┐                    │  │
│  │   │          Tool System                │                    │  │
│  │   │  - RAG Tool (Knowledge Retrieval)   │                    │  │
│  │   │  - HTTP Tool (API Calls)            │                    │  │
│  │   │  - Custom Tools (Extensible)        │                    │  │
│  │   └─────────────────────────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │   RAG Service     │  │  LLM Manager     │  │  Escalation     │  │
│  │  - Doc processor  │  │  - Multi-provider│  │  - Auto-detect  │  │
│  │  - Embeddings     │  │  - OpenAI        │  │  - Human handoff│  │
│  │  - Vector search  │  │  - Anthropic     │  │  - Supporter    │  │
│  └─────────┬─────────┘  │  - Google GenAI  │  └─────────────────┘  │
│            │            └──────────────────┘                        │
└────────────┴───────────────────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────────────────────┐
│                     Data Access Layer                                 │
│                                                                       │
│  ┌────────────────────────┐    ┌──────────────────────────┐         │
│  │  PostgreSQL + pgvector │    │    Redis Cache           │         │
│  │  - Tenant data         │    │  - Session cache         │         │
│  │  - User/session data   │    │  - Agent state cache     │         │
│  │  - Agent configs       │    └──────────────────────────┘         │
│  │  - Tool configs        │                                          │
│  │  - Vector embeddings   │                                          │
│  └────────────────────────┘                                          │
└───────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. FastAPI Application (`main.py`)
**Responsibilities:**
- Initialize app with middleware and routes
- Configure CORS for frontend
- Set up database session management
- Register all API endpoints
- Health check endpoint

**Key Features:**
- Auto-generated OpenAPI/Swagger docs
- Async request handling
- Dependency injection for database sessions
- Structured logging

### 2. Multi-Agent Orchestration System

#### SupervisorAgent (`services/supervisor_agent.py`)
**Role:** Central routing and intent classification

**Workflow:**
1. Receives user message
2. Analyzes intent using LLM
3. Detects single intent, multiple intents, or unclear query
4. Routes to appropriate domain agent(s)
5. Handles escalation detection
6. Returns response or escalation flag

**Intent Detection:**
- Uses LLM with structured output
- Considers available agents for tenant
- Multi-language support
- Handles ambiguous queries

#### DomainAgent (`services/domain_agents.py`)
**Role:** Specialized agents for specific domains

**Workflow:**
1. Receives routed message from supervisor
2. Extracts required entities using LLM
3. Validates entities against tool input schemas
4. Executes tools with extracted entities
5. Formats response using output template
6. Returns structured result

**Key Features:**
- Dynamic tool loading based on agent config
- Entity extraction with LLM
- Missing parameter clarification
- Configurable output formatting

### 3. Tool System

#### Tool Loader (`services/tool_loader.py`)
**Responsibilities:**
- Load tool definitions from database
- Initialize tool instances with config
- Apply tenant permissions
- Provide tools to agents

**Tool Types:**
- **RAG Tool** (`tools/rag.py`): Knowledge retrieval
- **HTTP Tool** (`tools/http.py`): External API calls
- **Custom Tools**: Extensible framework

#### Tool Execution Flow:
```
Agent needs data
    ↓
Check tool requirements (input schema)
    ↓
Extract entities from user message (LLM)
    ↓
Validate entities match schema
    ↓
Execute tool with entities
    ↓
Return results to agent
```

### 4. RAG System (`services/rag_service.py`)

**Components:**
- **Document Processor** (`services/document_processor.py`): Parses PDF/DOCX
- **Embedding Service** (`services/embedding_service.py`): Generates vectors
- **Vector Store**: pgvector with HNSW index
- **Retrieval**: Cosine similarity search with tenant filtering

**RAG Pipeline:**
```
Document Upload
    ↓
Parse (PDF/DOCX → Text)
    ↓
Chunk (Text splitter)
    ↓
Embed (sentence-transformers)
    ↓
Store (pgvector with tenant_id metadata)
    ↓
Query Time: User message → Embed → Search (tenant-filtered) → Retrieve top-k → Generate
```

**Configuration:**
- Embedding model: all-MiniLM-L6-v2 (384 dimensions)
- Chunking: Configurable size and overlap
- Search: Top-k configurable per tenant
- Multi-tenancy: Metadata filtering ensures isolation

### 5. LLM Manager (`services/llm_manager.py`)

**Responsibilities:**
- Abstract LLM provider differences
- Route requests to correct provider
- Handle API keys (encrypted storage)
- Apply tenant-specific configs (temperature, max_tokens)

**Supported Providers:**
- **OpenAI**: GPT-3.5, GPT-4, GPT-4 Turbo
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku)
- **Google**: Gemini Pro, Gemini Pro Vision

**Features:**
- Streaming support for real-time responses
- Token counting with tiktoken
- Rate limiting per tenant
- Fallback handling

### 6. Multi-Tenancy Implementation

**Tenant Isolation Strategy:**
- Database level: All queries filtered by `tenant_id`
- Service level: Tenant context injected via middleware
- Agent level: Agent/tool permissions per tenant
- RAG level: Vector metadata filtering

**Tenant Configuration:**
- Custom LLM provider and model
- Agent and tool access permissions
- Widget customization
- Rate limits (RPM/TPM)

### 7. Conversation Memory (`services/conversation_memory.py`)

**Responsibilities:**
- Load chat history from database
- Format for LLM context window
- Manage context window limits
- Persist new messages

**Strategy:**
- Recent N messages loaded
- Sliding window approach
- Summarization for long conversations (future)

### 8. Checkpoint Service (`services/checkpoint_service.py`)

**Purpose:** LangGraph state persistence

**Usage:**
- Save agent graph state
- Resume interrupted conversations
- Debug agent workflows

### 9. Escalation System (`services/escalation_service.py`)

**Workflow:**
```
Auto-detection (sentiment, keywords, explicit request)
    ↓
Flag session for escalation
    ↓
Notify available supporters
    ↓
Assign supporter
    ↓
Handoff to human chat
    ↓
Supporter resolves
    ↓
Close escalation
```

**Features:**
- Automatic escalation detection
- Manual escalation trigger
- Supporter availability management
- Chat history transferred to supporter

## Data Architecture

See [data-models-backend.md](./data-models-backend.md) for complete schema.

**Key Relationships:**
- Tenants have users, sessions, configurations
- Sessions belong to chat users
- Messages belong to sessions
- Agents have tools (many-to-many)
- Tenants have agent/tool permissions

## API Design

See [api-contracts-backend.md](./api-contracts-backend.md) for complete API reference.

**Endpoint Organization:**
- `/api/{tenant_id}/chat` - Main chat endpoint
- `/api/auth/*` - Authentication
- `/api/admin/*` - Admin operations
- `/api/{tenant_id}/supporter/*` - Support interface
- `/api/public/widgets/*` - Unauthenticated widget endpoints

**Authentication:**
- JWT with RS256 algorithm
- Public key validation
- Claims: user_id, tenant_id, role, exp
- Bypass mode for local development

## Deployment Architecture

**Application Server:**
- Uvicorn ASGI server
- Multi-worker support
- Async request handling

**Database:**
- PostgreSQL 15+ with pgvector extension
- Connection pooling via SQLAlchemy
- Alembic for migrations

**Caching:**
- Redis for session and agent state
- TTL-based expiration
- Pub/sub for real-time updates

**Monitoring:**
- Structured logging with structlog
- Prometheus metrics (prometheus-client)
- Health check endpoint

**Security:**
- JWT authentication
- API key encryption (Fernet)
- SQL injection prevention (ORM)
- CORS configuration
- Rate limiting

## Development Workflow

**Local Setup:**
1. Create virtual environment
2. Install dependencies: `pip install -r requirements.txt`
3. Set up `.env` with database and API keys
4. Run migrations: `alembic upgrade head`
5. Start server: `python src/main.py`

**Testing:**
- Bruno API tests in `tests/Chatbot/`
- 56 test files covering all endpoints
- Manual testing via Swagger UI at `/docs`

**Code Quality:**
- black formatter (line length: 100)
- ruff linter
- mypy type checking
- pytest for unit tests (80% coverage target)

## Scalability Considerations

**Horizontal Scaling:**
- Stateless API (session in Redis)
- Multiple Uvicorn workers
- Load balancer distribution

**Database Scaling:**
- Read replicas for query distribution
- Connection pooling
- Index optimization

**Caching Strategy:**
- Agent configurations cached in Redis
- LLM responses cached (optional)
- Vector search results cached

**Performance Optimization:**
- Async I/O for LLM calls
- Batch processing for embeddings
- HNSW index for fast vector search
- Connection pooling for database

## Security Best Practices

**Data Protection:**
- Tenant isolation at database level
- Encrypted API keys (Fernet)
- Password hashing (bcrypt via Passlib)
- SQL injection prevention (SQLAlchemy ORM)

**Authentication:**
- JWT with RS256 (asymmetric)
- Token expiration
- Role-based access control
- Secure password reset flow

**API Security:**
- CORS configuration
- Rate limiting per tenant
- Input validation (Pydantic)
- Output sanitization

## Error Handling

**Strategy:**
- Structured error responses
- HTTP status codes
- Detailed error messages in development
- Generic messages in production
- Logging of all errors

**Common Errors:**
- 400: Bad Request (validation errors)
- 401: Unauthorized (missing/invalid JWT)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource doesn't exist)
- 422: Validation Error (Pydantic)
- 500: Internal Server Error (logged)

## Future Enhancements

**Planned Features:**
- WebSocket support for real-time chat
- Conversation summarization
- Advanced RAG (hybrid search, re-ranking)
- Agent analytics dashboard
- Multi-modal support (images, files)
- Agent workflow builder (LangGraph Studio)
