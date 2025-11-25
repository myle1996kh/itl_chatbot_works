# Chat Initiation & Full Flow

Complete breakdown of how a chat message flows through the system from initiation to response.

## 🔄 High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Chat Widget (Frontend)                                           │
│    User types message → Sends ChatRequest                           │
└────────────────────┬────────────────────────────────────────────────┘
                     │ POST /{tenant_id}/chat
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Chat Endpoint (backend/src/api/chat.py)                          │
│    - Validate tenant access                                          │
│    - Get or create session                                           │
│    - Save user message to DB                                         │
└────────────────────┬────────────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    ┌──────────────────┐  ┌─────────────────────────────┐
    │ Has agent_name?  │  │ Route to DirectAgent?       │
    │ (skip Supervisor)│  │ (Skip SupervisorAgent)      │
    └──────┬───────────┘  └──────────┬──────────────────┘
           │                         │
           │ YES                     │ YES
           ▼                         ▼
    ┌──────────────────┐  ┌─────────────────────────────┐
    │ _route_to_agent  │  │ SupervisorAgent             │
    │ Skip Supervisor  │  │ - Detect intent             │
    │ Go direct to     │  │ - Route to best agent       │
    │ DomainAgent      │  │ - Handle MULTI_INTENT       │
    └────────┬─────────┘  │ - Handle UNCLEAR            │
             │            └──────────┬──────────────────┘
             │                      │
             └──────────┬───────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. DomainAgent (backend/src/services/domain_agents.py)              │
│    - Load agent config from DB                                      │
│    - Load LLM for tenant                                            │
│    - Load tools available to this agent                             │
│    - Extract intent & entities from user message                    │
│    - Build system prompt with tools list                            │
│    - Invoke LLM with tools                                          │
│    - Execute tools if needed                                        │
│    - Format response                                                │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Save Response & Prepare Output                                   │
│    - Save assistant message to DB                                   │
│    - Build response metadata                                        │
│    - Check rate limits                                              │
│    - Format ChatResponse                                            │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Return to Widget                                                 │
│    ChatResponse (session_id, message_id, response, agent, etc.)     │
└─────────────────────────────────────────────────────────────────────┘
```

## 📋 Step-by-Step Breakdown

### Step 1: Chat Widget Initiates Message

**From**: Frontend chat widget
**To**: `POST /{tenant_id}/chat`
**Request Body**:
```json
{
  "message": "What is my invoice status?",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": null,  // null for new session
  "agent_name": null,  // null = use SupervisorAgent
  "metadata": {
    "jwt_token": "eyJhbGc..."
  }
}
```

**Widget Config Context**:
```
TenantWidgetConfig (from database):
├── widget_key: "public_identifier_for_embed"
├── theme: "light"
├── position: "bottom-right"
├── primary_color: "#3B82F6"
├── allowed_domains: ["example.com", "app.example.com"]
└── rate_limit_per_minute: 20
```

### Step 2: Chat Endpoint Validation & Session Management

**File**: `backend/src/api/chat.py:chat_endpoint()`
**Line**: 86-281

**Operations**:
1. **Validate Tenant**
   ```python
   tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
   if not tenant:
       raise HTTPException(status_code=404, detail="Tenant not found")
   ```

2. **Validate User & Create/Get Session**
   ```python
   session = await _get_or_create_session(
       db=db,
       tenant_id=tenant_id,
       session_id=request.session_id,  # None if new
       user_id=request.user_id
   )
   ```

   **Session Creation Logic** (`_get_or_create_session`):
   - Validate user_id UUID format
   - Check ChatUser exists (user must be created first)
   - If session_id provided: try to retrieve existing session
   - If not found: create new session with unique thread_id

   **Generated Session**:
   ```python
   ChatSession(
       session_id=str(uuid.uuid4()),              # e.g., "123e4567-e89b-12d3-a456-426614174000"
       tenant_id=tenant_id,
       user_id=user_id_uuid,
       thread_id=f"tenant_{tenant_id}__user_{user_id}__session_{session_id}",
       session_metadata={}
   )
   ```

3. **Save User Message**
   ```python
   user_message = Message(
       message_id=str(uuid.uuid4()),
       session_id=session.session_id,
       role="user",
       content=request.message,
       metadata=request.metadata or {}
   )
   db.add(user_message)
   db.commit()
   ```

### Step 3: Routing Decision

**Decision Point**: Is `agent_name` provided?

#### Option A: Direct Agent Routing (if `agent_name` provided)

```python
if request.agent_name:  # e.g., "InvoiceAgent"
    agent_response = await _route_to_agent(
        db=db,
        tenant_id=tenant_id,
        agent_name=request.agent_name,
        message=request.message,
        session_id=str(session.session_id),
        jwt_token=jwt_token
    )
```

**`_route_to_agent` Logic** (`chat.py:443-515`):
1. Look up agent by name: `db.query(AgentConfig).filter(AgentConfig.name == agent_name)`
2. Check agent is active: `agent.is_active == True`
3. Check tenant has permission:
   ```python
   TenantAgentPermission
       .tenant_id == tenant_id
       .agent_id == agent.agent_id
       .enabled == True
   ```
4. Initialize DomainAgent and invoke
5. Return agent response

#### Option B: Supervisor Agent Routing (if no `agent_name`)

```python
else:
    supervisor = SupervisorAgent(
        db=db,
        tenant_id=tenant_id,
        jwt_token=jwt_token,
        session_id=str(session.session_id)
    )
    agent_response = await supervisor.route_message(request.message)
```

**SupervisorAgent Logic** (`supervisor_agent.py:68-150`):
1. **Detect Language**: Multi-language support
2. **Load Available Agents**:
   ```sql
   SELECT agent_id FROM tenant_agent_permissions
   WHERE tenant_id = ? AND enabled = True
   ```
3. **Build Supervisor Prompt**: List all available agents
4. **Invoke LLM**: Ask LLM which agent should handle this
   - Returns: Single agent name, "MULTI_INTENT", or "UNCLEAR"
5. **Route Based on Response**:
   - Single intent → Initialize DomainAgent and invoke
   - MULTI_INTENT → Return clarification request
   - UNCLEAR → Return clarification request

### Step 4: DomainAgent Invocation

**File**: `backend/src/services/domain_agents.py`

**Initialization** (`DomainAgent.__init__`):
```python
DomainAgent(
    db=db,
    agent_id=agent_id,              # UUID from agent_configs
    tenant_id=tenant_id,
    jwt_token=jwt_token,            # For tool API calls
    session_id=session_id           # For conversation memory
)
```

**DomainAgent Setup**:
1. **Load Agent Config**:
   ```python
   self.agent_config = db.query(AgentConfig).filter(
       AgentConfig.agent_id == agent_id,
       AgentConfig.is_active == True
   ).first()
   ```

2. **Initialize LLM**:
   ```python
   self.llm = llm_manager.get_llm_for_tenant(
       db, tenant_id, str(self.agent_config.llm_model_id)
   )
   ```

3. **Load Tools** (up to 5 top tools):
   ```python
   self.tools = tool_registry.load_agent_tools(
       db=db,
       agent_id=agent_id,
       tenant_id=tenant_id,
       jwt_token=jwt_token,
       top_n=5
   )
   ```

**Agent Execution** (`DomainAgent.invoke`):

1. **Extract Intent & Entities**:
   ```python
   detected_intent, initial_entities = await self._extract_intent_and_entities(
       user_message
   )
   ```
   - Builds dynamic prompt from tool schemas
   - Asks LLM to extract structured data
   - Returns: (intent, {entity_name: value, ...})

2. **Build System Prompt**:
   ```
   System Prompt Template (from agent_config.prompt_template)
   +
   List of available tools with descriptions
   +
   Extracted entities in JSON format
   +
   Tool usage instructions
   ```

3. **Invoke LLM with Tools**:
   - If tools available: LLM can call tools
   - LLM sees available tools and extracted entities
   - Makes tool calls as needed

4. **Execute Tools**:
   - For each tool call: Invoke tool with parameters
   - Collect results
   - Pass results back to LLM

5. **Format Response**:
   ```python
   agent_response = {
       "agent": agent_name,
       "intent": detected_intent,
       "data": extracted_response_text,
       "metadata": {
           "llm_model": llm_model_info,
           "tool_calls": [list of tool calls],
           "extracted_entities": entities,
           "agent_id": agent_id,
           "tenant_id": tenant_id
       },
       "status": "success"
   }
   ```

### Step 5: Save Response & Prepare Output

**Save Assistant Message**:
```python
assistant_message = Message(
    message_id=str(uuid.uuid4()),
    session_id=session.session_id,
    role="assistant",
    content=_extract_display_text(agent_response),  # Text only for display
    message_metadata={
        "agent": agent_response.get("agent"),
        "intent": agent_response.get("intent"),
        "llm_model": agent_response["metadata"]["llm_model"],
        "tool_calls": agent_response["metadata"]["tool_calls"],
        "extracted_entities": agent_response["metadata"]["extracted_entities"],
        "status": agent_response.get("status")
    }
)
db.add(assistant_message)
```

**Update Session Metadata**:
```python
session.last_message_at = datetime.now(timezone.utc)
db.commit()
```

**Calculate Performance**:
```python
duration_ms = (time.time() - start_time) * 1000
if duration_ms > 2500:
    logger.warning("chat_response_slow", duration_ms=duration_ms)
```

**Build Response Metadata**:
```python
response_metadata = {
    "agent_id": agent_metadata.get("agent_id"),
    "tenant_id": tenant_id,
    "duration_ms": duration_ms,
    "status": agent_response.get("status"),
    "llm_model": agent_metadata.get("llm_model"),
    "tool_calls": agent_metadata.get("tool_calls", []),
    "extracted_entities": agent_metadata.get("extracted_entities", {})
}
```

**Check Rate Limits**:
```python
if llm_manager.rate_limiter:
    actual_limits = llm_manager.rate_limiter.get_remaining_limits(
        str(tenant_id),
        tenant_config.rate_limit_rpm,
        tenant_config.rate_limit_tpm
    )
    response.headers["X-RateLimit-Limit-RPM"] = str(actual_limits["rpm_limit"])
    response.headers["X-RateLimit-Remaining-RPM"] = str(actual_limits["rpm_remaining"])
    # ... more headers
```

### Step 6: Return ChatResponse

**Response Structure**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "message_id": "660e8400-e29b-41d4-a716-446655440111",
  "response": {
    "text": "Your invoice #INV-2025-001234 was shipped on 2025-11-15..."
  },
  "agent": "InvoiceAgent",
  "intent": "track_invoice",
  "format": "text",
  "renderer_hint": {},
  "metadata": {
    "agent_id": "agent-uuid",
    "tenant_id": "tenant-uuid",
    "duration_ms": 1234.5,
    "status": "success",
    "llm_model": {
      "llm_model_id": "model-uuid",
      "model_class": "ChatOpenAI",
      "model_name": "gpt-4o-mini"
    },
    "tool_calls": [
      {
        "tool_name": "lookup_invoice",
        "tool_args": {"invoice_id": "INV-2025-001234"},
        "tool_id": "tool-uuid"
      }
    ],
    "extracted_entities": {
      "invoice_id": "INV-2025-001234"
    }
  }
}
```

## 🗄️ Database Models Involved

### ChatSession
```python
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id: UUID              # Primary key
    tenant_id: UUID               # FK to tenants
    user_id: UUID                 # FK to chat_users
    thread_id: str                # LangGraph thread ID
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime
    session_metadata: dict        # JSONB
```

### Message
```python
class Message(Base):
    __tablename__ = "messages"

    message_id: UUID              # Primary key
    session_id: UUID              # FK to chat_sessions
    role: str                     # "user", "assistant", "system"
    content: str                  # Message text
    message_metadata: dict        # JSONB (agent, intent, tool_calls, etc.)
    created_at: datetime
```

### AgentConfig
```python
class AgentConfig(Base):
    __tablename__ = "agent_configs"

    agent_id: UUID                # Primary key
    name: str                     # e.g., "InvoiceAgent"
    prompt_template: str          # System prompt
    llm_model_id: UUID            # FK to llm_models
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

### TenantAgentPermission
```python
class TenantAgentPermission(Base):
    __tablename__ = "tenant_agent_permissions"

    tenant_id: UUID               # FK to tenants (part of PK)
    agent_id: UUID                # FK to agent_configs (part of PK)
    enabled: bool                 # Access control
    created_at: datetime
```

## 🔐 Security & Validation

### Tenant Isolation
- Every query filters by `tenant_id`
- Permissions validate agent access per tenant
- Cross-tenant access is impossible (enforced at DB level)

### User Validation
- ChatUser must exist before creating session
- User UUID format validated
- User belongs to tenant (validated in ChatUser creation)

### Agent Validation
- Agent must be active (`is_active == True`)
- Agent must have permission for tenant (`TenantAgentPermission.enabled == True`)
- Agent config must exist in DB

### JWT Authentication
- Optional (disabled if `DISABLE_AUTH=true`)
- Token passed as metadata and available to tools
- Used for external API calls

### Rate Limiting
- Per-tenant limits (RPM: requests per minute, TPM: tokens per minute)
- Headers returned: `X-RateLimit-Limit-RPM`, `X-RateLimit-Remaining-RPM`
- Enforced at LLM manager level

## 📊 Performance Metrics

**Tracked in Logs** (structlog):
- `user_message_received`: When user message arrives
- `supervisor_agent_routing`: When routing to supervisor
- `direct_agent_routing`: When routing directly to agent
- `chat_response_completed`: When response is ready
- `chat_response_slow`: When duration > 2500ms (warning)
- `chat_endpoint_error`: Any exceptions

**Response Metadata**:
- `duration_ms`: Total time from request to response
- `status`: "success" or "error"
- Tool calls and entities logged for debugging

---

## 📌 Summary

**Chat flow is highly efficient and multi-layered**:
1. **Tenant validation** ensures isolation
2. **Session management** maintains conversation continuity
3. **Smart routing** (supervisor or direct) adapts to use case
4. **Dynamic agent loading** per tenant configuration
5. **Tool execution** with entity extraction
6. **Response formatting** with rich metadata
7. **Performance tracking** for optimization

This design enables secure, scalable multi-tenant chatbot operations.
