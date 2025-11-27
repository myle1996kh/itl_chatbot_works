# Integration Architecture

**Generated:** 2025-11-26
**Repository Type:** Multi-part
**Parts:** Backend API + Frontend Web App

## Overview

The ITL Chatbot system follows a **client-server architecture** with clear separation between the React frontend and FastAPI backend. Integration occurs primarily through RESTful HTTP APIs with JWT authentication. The architecture supports multiple deployment scenarios: unified deployment, separate deployment, and embedded widget integration.

## Integration Points

### 1. Frontend → Backend API

**Protocol:** HTTPS REST API
**Authentication:** JWT (JSON Web Tokens)
**Data Format:** JSON

#### API Base URL Configuration

**Development:**
```typescript
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000'
```

**Production:**
```typescript
const API_BASE_URL = 'https://api.itlchatbot.com'
```

#### Authentication Flow

```
┌────────────┐                           ┌────────────┐
│  Frontend  │                           │  Backend   │
└──────┬─────┘                           └──────┬─────┘
       │                                        │
       │  1. POST /api/auth/login               │
       │    {email, password}                   │
       ├───────────────────────────────────────>│
       │                                        │
       │  2. JWT Token + User Data              │
       │<───────────────────────────────────────┤
       │                                        │
       │  Store token (localStorage/cookie)     │
       │                                        │
       │  3. Subsequent requests                │
       │    Authorization: Bearer <token>       │
       ├───────────────────────────────────────>│
       │                                        │
       │  4. Validate token, process request    │
       │<───────────────────────────────────────┤
       │                                        │
```

#### API Integration Patterns

**Chat Integration:**
```typescript
// Frontend: Send chat message
const response = await fetch(`${API_BASE_URL}/api/${tenantId}/chat`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    session_id: sessionId,
    message: userMessage,
    user_id: userId
  })
});

const data = await response.json();
// Backend returns: { response: string, agent: string, metadata: {} }
```

**Admin Operations:**
```typescript
// Frontend: Get agents
const agents = await fetch(`${API_BASE_URL}/api/admin/agents`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(res => res.json());

// Frontend: Create agent
await fetch(`${API_BASE_URL}/api/admin/agents`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(agentConfig)
});
```

### 2. Widget → Backend API

**Protocol:** HTTPS REST API
**Authentication:** Widget Token (auto-generated)
**Deployment:** Embedded iframe or script tag

#### Widget Initialization Flow

```
┌────────────┐              ┌────────────┐              ┌────────────┐
│  External  │              │   Widget   │              │  Backend   │
│  Website   │              │  (iframe)  │              │    API     │
└──────┬─────┘              └──────┬─────┘              └──────┬─────┘
       │                           │                           │
       │  1. Load widget.html      │                           │
       ├──────────────────────────>│                           │
       │                           │                           │
       │                           │  2. GET /api/public/      │
       │                           │     widgets/{tenant}/config│
       │                           ├──────────────────────────>│
       │                           │                           │
       │                           │  3. Widget config (colors,│
       │                           │     welcome message)      │
       │                           │<──────────────────────────┤
       │                           │                           │
       │                           │  4. Render styled widget  │
       │                           │                           │
       │  User types message       │                           │
       ├──────────────────────────>│                           │
       │                           │  5. POST /api/public/     │
       │                           │     widgets/{tenant}/chat │
       │                           ├──────────────────────────>│
       │                           │                           │
       │                           │  6. Agent response        │
       │                           │<──────────────────────────┤
       │                           │                           │
       │  Display response         │                           │
       │<──────────────────────────┤                           │
       │                           │                           │
```

### 3. Backend → PostgreSQL Database

**Protocol:** PostgreSQL wire protocol
**Connection:** SQLAlchemy connection pool
**ORM:** SQLAlchemy 2.0+

**Connection Configuration:**
```python
# Backend config
DATABASE_URL = "postgresql://user:pass@host:5432/dbname"

# SQLAlchemy engine with pooling
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)
```

**Query Pattern (with tenant isolation):**
```python
# All queries automatically filtered by tenant_id
async with session.begin():
    sessions = await session.execute(
        select(Session)
        .where(Session.tenant_id == tenant_id)
        .where(Session.status == 'active')
    )
```

### 4. Backend → Redis Cache

**Protocol:** Redis protocol (RESP)
**Client:** redis-py
**Purpose:** Session caching, agent state, rate limiting

**Connection:**
```python
REDIS_URL = "redis://localhost:6379/0"
redis_client = redis.from_url(REDIS_URL, decode_responses=True)
```

**Usage Patterns:**
```python
# Cache agent config
redis_client.setex(f"agent:{agent_id}", 300, json.dumps(config))

# Cache session data
redis_client.setex(f"session:{session_id}", 3600, json.dumps(session))

# Rate limiting
redis_client.incr(f"rate_limit:{tenant_id}:{minute}")
redis_client.expire(f"rate_limit:{tenant_id}:{minute}", 60)
```

### 5. Backend → LLM Providers

**Providers:** OpenAI, Anthropic, Google GenAI
**Protocol:** HTTPS REST API
**Integration:** LangChain abstractions

#### OpenAI Integration
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4",
    temperature=0.7,
    api_key=encrypted_key,
    streaming=True
)
```

#### Anthropic Integration
```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-3-sonnet-20240229",
    anthropic_api_key=encrypted_key,
    max_tokens=4096
)
```

#### Google GenAI Integration
```python
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-pro",
    google_api_key=encrypted_key
)
```

### 6. Backend → External APIs (via HTTP Tool)

**Tool:** HTTP Tool (`tools/http.py`)
**Purpose:** External service integration
**Configuration:** Per-tool basis

**Flow:**
```
Agent needs external data
    ↓
Selects HTTP tool
    ↓
Tool makes HTTP request to external API
    ↓
Parses response
    ↓
Returns data to agent
    ↓
Agent uses data in response
```

## Data Flow Diagrams

### Complete Chat Flow

```
┌──────────┐     1      ┌──────────┐     2      ┌─────────────────┐
│ Frontend │ ────────> │ Backend  │ ────────> │   PostgreSQL    │
│  (React) │   HTTP    │ FastAPI  │   SQL     │  (Load session) │
└──────────┘           └────┬─────┘           └─────────────────┘
                            │ 3
                            ▼
                    ┌───────────────┐
                    │  Supervisor   │
                    │    Agent      │
                    └───────┬───────┘
                            │ 4
                            ▼
                    ┌───────────────┐
                    │  Domain Agent │
                    │  (e.g.,       │
                    │  TrackingAgent)│
                    └───────┬───────┘
                            │ 5
                    ┌───────┴────────┐
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌──────────────┐
            │   RAG Tool   │   │  HTTP Tool   │
            └──────┬───────┘   └──────┬───────┘
                   │ 6                 │ 7
                   ▼                   ▼
           ┌──────────────┐   ┌──────────────┐
           │   pgvector   │   │  External    │
           │   (Search)   │   │     API      │
           └──────┬───────┘   └──────┬───────┘
                  │ 8                 │ 9
                  └─────────┬─────────┘
                            │ 10
                            ▼
                    ┌───────────────┐
                    │  LLM Provider │
                    │  (OpenAI,     │
                    │  Anthropic,   │
                    │  Google)      │
                    └───────┬───────┘
                            │ 11
                            ▼
                    ┌───────────────┐
                    │   Response    │
                    │  Generation   │
                    └───────┬───────┘
                            │ 12
                            ▼
                     Backend returns
                            │ 13
                            ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │ (Save message)│
                    └──────┬───────┘
                           │ 14
                           ▼
                   Response to Frontend
```

**Steps:**
1. User sends message from frontend
2. Backend loads session from PostgreSQL
3. Supervisor agent detects intent
4. Routes to appropriate domain agent
5. Domain agent executes tools
6. RAG tool searches vector database
7. HTTP tool calls external API (if needed)
8. Retrieve relevant documents
9. Get external data
10. Combine context and send to LLM
11. LLM generates response
12. Format response
13. Save message to database
14. Return response to frontend

### Widget Embedding Flow

```
External Website
    │
    │ 1. Embed widget
    ├── <iframe src="widget.html?tenant=abc">
    │   OR
    └── <script src="widget.js"></script>
        │
        │ 2. Load widget app
        ▼
    Widget Frontend
        │
        │ 3. Fetch config
        ├──> GET /api/public/widgets/{tenant}/config
        │<── Widget styling & settings
        │
        │ 4. User interacts
        ├──> POST /api/public/widgets/{tenant}/chat
        │<── Agent response
        │
        └── Display in chat UI
```

## Cross-Origin Resource Sharing (CORS)

**Backend CORS Configuration:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Frontend dev
        "https://app.itlchatbot.com",  # Production frontend
        "*"  # Allow all for widget embedding
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
```

## Security Considerations

### JWT Token Flow

**Token Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "admin",
  "tenant_id": "abc-123",
  "exp": 1234567890
}
```

**Token Validation:**
1. Extract token from Authorization header
2. Verify signature with RS256 public key
3. Check expiration
4. Extract claims (user_id, tenant_id, role)
5. Inject into request context

### API Key Encryption

**Backend encrypts API keys at rest:**
```python
from cryptography.fernet import Fernet

# Encrypt before storing
encrypted = fernet.encrypt(api_key.encode())

# Decrypt when using
api_key = fernet.decrypt(encrypted).decode()
```

### Tenant Isolation

**Enforcement Points:**
1. **Middleware:** Extract tenant_id from JWT or path parameter
2. **Database:** All queries filtered by tenant_id
3. **Services:** Tenant context passed through call stack
4. **RAG:** Vector search metadata filtering
5. **Caching:** Cache keys include tenant_id

## Deployment Topologies

### Topology 1: Unified Deployment

```
┌─────────────────────────────────────────┐
│          Single Server/Container         │
│                                          │
│  ┌──────────┐           ┌──────────┐   │
│  │ Frontend │           │ Backend  │   │
│  │  (Nginx) │◄─────────►│ (Uvicorn)│   │
│  └──────────┘           └──────┬───┘   │
│                                │        │
└────────────────────────────────┼────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼───────┐     ┌──────────▼────┐
            │  PostgreSQL   │     │     Redis     │
            └───────────────┘     └───────────────┘
```

### Topology 2: Separated Deployment

```
┌──────────────┐          ┌──────────────┐
│   Frontend   │          │   Backend    │
│   Server     │          │   Server(s)  │
│   (Nginx)    │◄────────►│  (Uvicorn)   │
└──────────────┘   HTTPS  └──────┬───────┘
                                  │
                     ┌────────────┴────────────┐
                     │                         │
             ┌───────▼───────┐     ┌──────────▼────┐
             │  PostgreSQL   │     │     Redis     │
             │   (RDS/Cloud) │     │  (ElastiCache)│
             └───────────────┘     └───────────────┘
```

### Topology 3: Widget-Only Integration

```
┌─────────────────────┐
│   Customer Website  │
│                     │
│  ┌───────────────┐  │
│  │ Embedded      │  │
│  │ Widget        │──┼──────> Backend API
│  │ (iframe)      │  │        (Public endpoints)
│  └───────────────┘  │
│                     │
└─────────────────────┘
```

## Performance Considerations

### Caching Strategy

**Frontend Caching:**
- Static assets (versioned, long cache)
- API responses (short TTL for dynamic data)
- LocalStorage for user preferences

**Backend Caching:**
- Agent configurations (Redis, 5 minutes)
- Tool definitions (Redis, 5 minutes)
- Session data (Redis, 1 hour)
- RAG results (optional, short TTL)

### Connection Pooling

**Database:**
- Pool size: 10 connections
- Max overflow: 20
- Pre-ping: enabled

**HTTP Clients:**
- Keep-alive connections
- Connection pooling
- Timeout configuration

### Load Balancing

**Frontend:**
- CDN for static assets
- Geographic distribution

**Backend:**
- Multiple Uvicorn workers
- Load balancer (Nginx, ALB, etc.)
- Health checks

## Monitoring & Observability

### Integration Points to Monitor

1. **Frontend → Backend:**
   - Request latency
   - Error rates (4xx, 5xx)
   - Token expiration issues

2. **Backend → Database:**
   - Query performance
   - Connection pool saturation
   - Deadlocks

3. **Backend → LLM Providers:**
   - API latency
   - Rate limit hits
   - Token usage

4. **Backend → Redis:**
   - Cache hit/miss ratio
   - Connection errors
   - Memory usage

### Logging Integration

**Frontend:**
- Console errors
- API call failures
- User actions (analytics)

**Backend:**
- Structured logging (structlog)
- Request/response logging
- Error tracking with stack traces
- Performance metrics

## Future Integration Enhancements

**Planned:**
- WebSocket for real-time bidirectional communication
- Server-Sent Events (SSE) for streaming responses
- GraphQL API (alternative to REST)
- Webhooks for external system notifications
- Event-driven architecture (message queue)
- Microservices decomposition
