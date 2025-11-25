# Agent Architecture Deep Dive

Complete guide to agent configuration, domain agents, and the agent system architecture.

## 🎯 Agent System Overview

The agent system uses a **Supervisor-Domain Agent pattern** for intelligent message routing and handling:

```
┌─────────────────────────────────────────────────────────────────┐
│                      SupervisorAgent                            │
│  (Routes messages to appropriate domain agents)                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬─────────────┐
        │            │            │             │
        ▼            ▼            ▼             ▼
    ┌────────┐  ┌────────┐  ┌────────┐   ┌─────────┐
    │Invoice │  │Guideline│ │Support │  │ Custom  │
    │Agent   │  │Agent    │ │Agent   │  │ Agent   │
    └────────┘  └────────┘  └────────┘   └─────────┘
        │            │            │             │
        └────────────┼────────────┼─────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    [Tool 1]    [Tool 2]    [Tool N]
    (RAG)       (HTTP)      (Custom)
```

## 📊 Database Schema: Agent Configuration

### AgentConfig Table

**File**: `backend/src/models/agent.py:11-40`

```python
class AgentConfig(Base):
    __tablename__ = "agent_configs"

    agent_id: UUID              # Primary Key - Unique agent identifier
    name: str                   # Unique name (e.g., "InvoiceAgent")
    prompt_template: str        # System prompt for agent
    llm_model_id: UUID          # FK to llm_models (which LLM to use)
    default_output_format_id: UUID  # FK to output_formats
    description: str            # Human-readable description
    handler_class: str          # Python class path (default: "services.domain_agents.DomainAgent")
    is_active: bool             # Enable/disable agent
    created_at: datetime
    updated_at: datetime
```

**Example Agent Config Row**:
```sql
INSERT INTO agent_configs (
    agent_id, name, prompt_template, llm_model_id, is_active, created_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'InvoiceAgent',
    'You are an expert invoice assistant...',
    '660e8400-e29b-41d4-a716-446655440001',
    true,
    NOW()
);
```

### AgentTools Junction Table

**File**: `backend/src/models/agent.py:42-62`

```python
class AgentTools(Base):
    __tablename__ = "agent_tools"

    agent_id: UUID              # FK to agent_configs (part of PK)
    tool_id: UUID               # FK to tool_configs (part of PK)
    priority: int               # Tool priority (1=highest, higher numbers = lower priority)
    created_at: datetime
```

**Purpose**: Many-to-many relationship between agents and tools

**Example**:
```sql
INSERT INTO agent_tools (agent_id, tool_id, priority) VALUES
    ('550e8400...', 'tool-rag-001', 1),        -- RAG tool, highest priority
    ('550e8400...', 'tool-http-001', 2),       -- HTTP API tool, second
    ('550e8400...', 'tool-db-001', 3);         -- Database tool, third
```

## 🔀 SupervisorAgent: Intent Detection & Routing

**File**: `backend/src/services/supervisor_agent.py`

### SupervisorAgent Initialization

```python
class SupervisorAgent:
    def __init__(
        self,
        db: Session,
        tenant_id: str,
        jwt_token: str,
        session_id: Optional[str] = None
    ):
        self.db = db
        self.tenant_id = tenant_id
        self.jwt_token = jwt_token
        self.session_id = session_id

        # Load supervisor config (can be in database)
        self.supervisor_config = self._load_supervisor_config()

        # Initialize LLM for routing decisions
        self.llm = llm_manager.get_llm_for_tenant(db, tenant_id)

        # Load agents available to this tenant
        self.available_agents = self._load_available_agents()

        # Build supervisor prompt from database
        self.supervisor_prompt = self._build_supervisor_prompt_from_db()
```

### Load Available Agents

**SQL Query**:
```sql
SELECT ac.agent_id, ac.name, ac.description
FROM agent_configs ac
JOIN tenant_agent_permissions tap ON ac.agent_id = tap.agent_id
WHERE tap.tenant_id = ? AND tap.enabled = true
```

**Returns**: List of agents available to the current tenant

### Build Supervisor Prompt

**Dynamic Prompt Generation**:
```
You are a Supervisor Agent that routes user queries to specialized domain agents.

Available agents:
- InvoiceAgent: Handles invoice tracking and status inquiries
- GuidelineAgent: Provides company guidelines and policies
- SupportAgent: Escalates to human support

Your task:
1. Analyze the user's message carefully
2. Detect if the message contains ONE or MULTIPLE distinct intents
3. Respond with ONLY the agent name or status code

Detection Rules:
- SINGLE INTENT: User asks ONE clear question matching ONE agent → respond with agent name
- MULTIPLE INTENTS: User asks 2+ DIFFERENT questions → respond with "MULTI_INTENT"
- UNCLEAR: Ambiguous or not related to any agent → respond with "UNCLEAR"

Response Format:
Respond with ONLY ONE of these: InvoiceAgent, GuidelineAgent, SupportAgent, MULTI_INTENT, or UNCLEAR
NO explanations, NO additional text.
```

### Route Message

```python
async def route_message(self, user_message: str) -> Dict[str, Any]:
    """
    Route user message to appropriate domain agent.
    """
    try:
        # 1. Detect language (multi-language support)
        detected_language = self._detect_language(user_message)

        # 2. Invoke LLM to determine routing
        routing_response = await self.llm.ainvoke([
            SystemMessage(content=self.supervisor_prompt),
            HumanMessage(content=user_message)
        ])

        routing_decision = routing_response.content.strip().upper()

        # 3. Handle routing decisions
        if routing_decision == "MULTI_INTENT":
            # User asked multiple questions
            return format_clarification_response(
                "I detected multiple questions. Let me help with one at a time.",
                agent="Supervisor",
                renderer_hint={"type": "clarification"}
            )

        elif routing_decision == "UNCLEAR":
            # Message doesn't match any agent
            return format_clarification_response(
                "I'm not sure how to help with that. Could you clarify?",
                agent="Supervisor",
                renderer_hint={"type": "clarification"}
            )

        else:
            # routing_decision is agent name
            agent_id = self._get_agent_id_by_name(routing_decision)

            # Initialize and invoke the DomainAgent
            domain_agent = DomainAgent(
                db=self.db,
                agent_id=agent_id,
                tenant_id=self.tenant_id,
                jwt_token=self.jwt_token,
                session_id=self.session_id
            )

            agent_response = await domain_agent.invoke(user_message)
            return agent_response

    except Exception as e:
        logger.error("supervisor_routing_error", error=str(e))
        raise
```

## 🤖 DomainAgent: Execution & Tool Management

**File**: `backend/src/services/domain_agents.py`

### DomainAgent Initialization

```python
class DomainAgent:
    def __init__(
        self,
        db: Session,
        agent_id: str,
        tenant_id: str,
        jwt_token: str,
        session_id: Optional[str] = None
    ):
        self.db = db
        self.agent_id = agent_id
        self.tenant_id = tenant_id
        self.jwt_token = jwt_token
        self.session_id = session_id

        # 1. Load agent configuration
        self.agent_config = db.query(AgentConfig).filter(
            AgentConfig.agent_id == agent_id,
            AgentConfig.is_active == True
        ).first()

        if not self.agent_config:
            raise ValueError(f"Agent {agent_id} not found or inactive")

        # 2. Initialize LLM for this tenant
        self.llm = llm_manager.get_llm_for_tenant(
            db,
            tenant_id,
            str(self.agent_config.llm_model_id)
        )

        # 3. Load tools available to this agent (top 5)
        self.tools = tool_registry.load_agent_tools(
            db=db,
            agent_id=agent_id,
            tenant_id=tenant_id,
            jwt_token=jwt_token,
            top_n=5
        )
```

### Load Agent Tools

**SQL Query**:
```sql
SELECT tc.tool_id, tc.name, tc.description, tc.input_schema
FROM tool_configs tc
JOIN agent_tools at ON tc.tool_id = at.tool_id
WHERE at.agent_id = ? AND tc.is_active = true
ORDER BY at.priority ASC
LIMIT ?
```

**Returns**: List of Tool objects, ordered by priority

**Example Tools**:
- `RAGTool`: Knowledge retrieval from vector database
- `HTTPTool`: Make API calls to external services
- `DatabaseTool`: Query application database
- Custom tools: Application-specific logic

### Entity Extraction

**Purpose**: Extract structured information from user messages before tool invocation

```python
async def _extract_intent_and_entities(
    self,
    user_message: str
) -> tuple[str, Dict[str, Any]]:
    """
    Extract intent and entities from user message.
    """
    # 1. Build dynamic extraction prompt from tool schemas
    extraction_prompt = self._build_entity_extraction_prompt(user_message)

    # 2. Invoke LLM for extraction
    extraction_response = await self.llm.ainvoke([
        SystemMessage(content="You are an entity extraction expert. Extract structured data from text."),
        HumanMessage(content=extraction_prompt)
    ])

    # 3. Parse JSON response
    response_text = extraction_response.content.strip()
    # Handle markdown code blocks if present
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
    response_text = response_text.strip()

    extraction_data = json.loads(response_text)
    intent = extraction_data.get("intent", "query")
    entities = extraction_data.get("entities", {})

    return intent, entities
```

**Example Entity Extraction Prompt**:
```
Analyze the user's message and extract:
1. Intent: What is the user trying to do?
2. Entities: Extract the following entities if present:
- invoice_id: Invoice identifier (format: INV-XXXX-XXXXX)
- date: Date/time information
- status: Status inquiry type

User message: "Can you check the status of invoice INV-2025-001234 from last week?"

Respond ONLY with valid JSON (no markdown, no explanation):
{
    "intent": "check_invoice_status",
    "entities": {
        "invoice_id": "INV-2025-001234",
        "date": "last week"
    }
}
```

### Agent Invocation

```python
async def invoke(self, user_message: str) -> Dict[str, Any]:
    """
    Invoke agent with user message.
    """
    try:
        # 1. Extract intent and entities
        detected_intent, initial_entities = await self._extract_intent_and_entities(
            user_message
        )

        extracted_entities = initial_entities.copy()
        tool_calls_info = []
        tool_results = {}

        # 2. Build system prompt with tools
        system_prompt = self.agent_config.prompt_template

        if self.tools:
            # Build descriptions for each tool
            tool_descriptions = []
            for tool in self.tools:
                tool_desc = f'- "{tool.name}": {tool.description}'

                # Add required parameters from schema
                if hasattr(tool, 'args') and tool.args:
                    input_schema = tool.args
                    if isinstance(input_schema, dict) and 'required' in input_schema:
                        required_params = input_schema.get('required', [])
                        if required_params:
                            tool_desc += f" (requires: {', '.join(required_params)})"

                tool_descriptions.append(tool_desc)

            tools_list = "\n".join(tool_descriptions)

            # Append tool instructions to system prompt
            system_prompt += f"""

IMPORTANT: You have access to these tools:
{tools_list}

TOOL USAGE RULES:
1. When you have the required parameters for a tool, CALL IT IMMEDIATELY
2. Do NOT ask the user for missing information if you already have sufficient data
3. Match extracted entities to tool requirements
4. If a tool needs parameter X and you have entity X, use it

Available entities extracted from user message:
{json.dumps(extracted_entities, ensure_ascii=False, indent=2)}

For each tool:
- Check if you have all required parameters
- If YES → Call the tool with those parameters NOW
- If NO → Ask user for missing parameters (only if necessary)"""

        # 3. Create messages with conversation history
        messages = [SystemMessage(content=system_prompt)]

        # Load conversation history if available
        if self.session_id:
            history = get_conversation_history(
                self.db,
                self.session_id,
                max_messages=5
            )
            messages.extend(history)

        # Add current user message
        messages.append(HumanMessage(content=user_message))

        # 4. Invoke LLM
        llm_response = await self.llm.ainvoke(messages)

        # 5. Execute tools if LLM called any
        # (Tool calling mechanism depends on LLM implementation)

        # 6. Format response
        response_text = llm_response.content if hasattr(llm_response, 'content') else str(llm_response)

        return {
            "agent": self.agent_config.name,
            "intent": detected_intent,
            "data": response_text,
            "metadata": {
                "llm_model": llm_manager.get_llm_info(self.agent_config.llm_model_id),
                "tool_calls": tool_calls_info,
                "extracted_entities": extracted_entities,
                "agent_id": str(self.agent_id),
                "tenant_id": self.tenant_id
            },
            "status": "success"
        }

    except Exception as e:
        logger.error("domain_agent_error", agent_id=self.agent_id, error=str(e))
        return format_error_response(str(e), agent_id=str(self.agent_id))
```

## 🔐 Multi-Tenant Agent Permissions

### Permission Tables

**TenantAgentPermission**:
```sql
CREATE TABLE tenant_agent_permissions (
    tenant_id UUID,
    agent_id UUID,
    enabled BOOLEAN,
    created_at TIMESTAMP,
    PRIMARY KEY (tenant_id, agent_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (agent_id) REFERENCES agent_configs(agent_id)
);
```

**TenantToolPermission**:
```sql
CREATE TABLE tenant_tool_permissions (
    tenant_id UUID,
    tool_id UUID,
    enabled BOOLEAN,
    created_at TIMESTAMP,
    PRIMARY KEY (tenant_id, tool_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (tool_id) REFERENCES tool_configs(tool_id)
);
```

### Permission Checking

**In SupervisorAgent** (`_load_available_agents`):
```sql
SELECT ac.* FROM agent_configs ac
JOIN tenant_agent_permissions tap ON ac.agent_id = tap.agent_id
WHERE tap.tenant_id = ? AND tap.enabled = true AND ac.is_active = true
```

**In DomainAgent** (`tool_registry.load_agent_tools`):
```sql
SELECT tc.* FROM tool_configs tc
JOIN agent_tools at ON tc.tool_id = at.tool_id
JOIN tenant_tool_permissions ttp ON tc.tool_id = ttp.tool_id
WHERE at.agent_id = ? AND ttp.tenant_id = ? AND ttp.enabled = true
```

## 📋 Agent Setup Example

### Step 1: Create LLM Configuration

```sql
INSERT INTO llm_models (llm_model_id, provider, model_name, is_active)
VALUES ('660e8400-e29b-41d4-a716-446655440001', 'openai', 'gpt-4o-mini', true);
```

### Step 2: Create Agent Config

```sql
INSERT INTO agent_configs (
    agent_id, name, prompt_template, llm_model_id, description, is_active
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'InvoiceAgent',
    'You are an expert invoice assistant. Help users track invoices, check status, and resolve billing issues.',
    '660e8400-e29b-41d4-a716-446655440001',
    'Specialized agent for invoice management',
    true
);
```

### Step 3: Create Tools (if custom)

```sql
INSERT INTO tool_configs (tool_id, name, description, tool_type, handler_class, is_active)
VALUES (
    '770e8400-e29b-41d4-a716-446655440002',
    'lookup_invoice',
    'Look up invoice status and details',
    'custom',
    'src.tools.invoice.InvoiceStatusTool',
    true
);
```

### Step 4: Link Agent to Tools

```sql
INSERT INTO agent_tools (agent_id, tool_id, priority)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440002',
    1
);
```

### Step 5: Grant Tenant Permissions

```sql
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled)
VALUES ('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', true);

INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled)
VALUES ('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440002', true);
```

## 🛠️ Tool Registry & Loading

**File**: `backend/src/services/tool_loader.py`

### Tool Registry

```python
class ToolRegistry:
    """Central registry for all available tools."""

    def __init__(self):
        self.tools = {}

    def register_tool(self, name: str, tool_class):
        """Register a tool implementation."""
        self.tools[name] = tool_class

    def load_agent_tools(
        self,
        db: Session,
        agent_id: str,
        tenant_id: str,
        jwt_token: str,
        top_n: int = 5
    ) -> List[BaseTool]:
        """
        Load tools for an agent, ordered by priority.
        """
        # Query tools linked to agent, sorted by priority
        agent_tools = db.query(AgentTools).filter(
            AgentTools.agent_id == agent_id
        ).order_by(AgentTools.priority).limit(top_n).all()

        loaded_tools = []
        for agent_tool in agent_tools:
            tool_config = agent_tool.tool

            # Check tenant permission
            permission = db.query(TenantToolPermission).filter(
                TenantToolPermission.tenant_id == tenant_id,
                TenantToolPermission.tool_id == tool_config.tool_id,
                TenantToolPermission.enabled == True
            ).first()

            if not permission:
                continue  # Skip if tenant doesn't have permission

            # Instantiate tool
            tool_instance = self._instantiate_tool(
                tool_config,
                jwt_token
            )
            loaded_tools.append(tool_instance)

        return loaded_tools
```

## 🔄 Workflow: End-to-End Agent Example

**Scenario**: User asks "What's the status of invoice INV-2025-001234?"

### 1. SupervisorAgent Routes

```
Input: "What's the status of invoice INV-2025-001234?"

Supervisor Prompt: "You are a supervisor... Available agents: InvoiceAgent, GuidelineAgent..."

LLM Response: "InvoiceAgent"

Decision: Route to InvoiceAgent
```

### 2. InvoiceAgent Initializes

```python
agent = DomainAgent(
    db=db,
    agent_id="550e8400...",  # InvoiceAgent ID
    tenant_id="880e8400...",
    jwt_token="eyJhbGc...",
    session_id="session-123"
)
```

**Loaded Configuration**:
- Agent: InvoiceAgent
- LLM: gpt-4o-mini (from OpenAI)
- Tools: [lookup_invoice, RAGTool]
- Prompt: "You are an expert invoice assistant..."

### 3. Entity Extraction

```
User Message: "What's the status of invoice INV-2025-001234?"

Extraction Prompt: "Extract entities..."

LLM Response:
{
    "intent": "check_invoice_status",
    "entities": {
        "invoice_id": "INV-2025-001234"
    }
}
```

### 4. Build System Prompt with Tools

```
System Prompt:
You are an expert invoice assistant...

IMPORTANT: You have access to these tools:
- "lookup_invoice": Look up invoice status and details (requires: invoice_id)
- "rag_search": Search knowledge base for invoicing policies

TOOL USAGE RULES:
1. When you have the required parameters for a tool, CALL IT IMMEDIATELY

Available entities extracted from user message:
{
    "invoice_id": "INV-2025-001234"
}

For each tool:
- Check if you have all required parameters
- If YES → Call the tool with those parameters NOW
```

### 5. LLM Invokes Tool

```
LLM: "I'll look up that invoice for you."

Tool Call: lookup_invoice(invoice_id="INV-2025-001234")

Tool Result: {
    "invoice_id": "INV-2025-001234",
    "status": "shipped",
    "date": "2025-11-15",
    "amount": "$5,432.10",
    "tracking": "TRK-123456"
}
```

### 6. LLM Formats Final Response

```
Your invoice INV-2025-001234 was shipped on November 15, 2025.
Amount: $5,432.10
Tracking: TRK-123456
```

### 7. Response Returned to Chat Endpoint

```json
{
    "agent": "InvoiceAgent",
    "intent": "check_invoice_status",
    "data": "Your invoice INV-2025-001234 was shipped...",
    "metadata": {
        "llm_model": {
            "provider": "openai",
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
        },
        "agent_id": "550e8400...",
        "tenant_id": "880e8400..."
    },
    "status": "success"
}
```

## ✅ Checklist for Adding New Agent

- [ ] Create LLM model config if using new provider
- [ ] Create `AgentConfig` row with prompt template
- [ ] Create/verify tools exist
- [ ] Add `AgentTools` links for each tool with priority
- [ ] Grant `TenantAgentPermission` for each tenant that uses it
- [ ] Grant `TenantToolPermission` for tools
- [ ] Test via `/api/{tenant_id}/test/chat` with `agent_name` parameter
- [ ] Verify agent appears in Supervisor available agents
- [ ] Monitor logs for errors

---

This architecture ensures flexible, scalable, and secure agent management in a multi-tenant environment.
