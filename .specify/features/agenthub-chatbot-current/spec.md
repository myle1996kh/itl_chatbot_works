# Feature Specification: AgentHub Multi-Agent Chatbot Framework (Current System)

**Feature Branch**: `main` (current production system)
**Created**: 2025-11-06
**Status**: Production
**Version**: v2.0 (pgvector migration)
**Input**: Documentation of current AgentHub chatbot system with LangChain 0.3+, PostgreSQL+pgvector, multi-tenant architecture

---

## User Scenarios & Testing *(mandatory)*

<!--
  This specification documents the CURRENT/EXISTING AgentHub chatbot system.
  User stories reflect implemented capabilities in production.
-->

### User Story 1 - Natural Language Business Data Query (Priority: P1)

**As a** business user (customer service, sales, logistics)
**I want** to ask questions in natural language about business data (debt, shipments, invoices)
**So that** I can quickly access information without navigating complex ERP/CRM systems or writing SQL queries

**Why this priority**: CRITICAL - This is the core value proposition. Users interact with internal business systems (eFMS, eTMS, ERP) through conversational interface, reducing training costs and improving productivity.

**Independent Test**: Can be fully tested by:
1. User types: "What is the debt for customer with tax code 0123456789?"
2. System detects intent (AgentDebt), extracts entity (tax_code), calls API tool
3. Returns formatted debt information within 2.5 seconds
4. Delivers immediate value: natural language access to business data

**Acceptance Scenarios**:

1. **Given** user asks "What is my debt?" (Vietnamese: "Công nợ của tôi là bao nhiêu?")
   **When** SupervisorAgent analyzes message
   **Then** system routes to AgentDebt, extracts missing entity (tax_code), asks clarification question

2. **Given** user provides tax code "0123456789" in follow-up message
   **When** AgentDebt receives complete entities
   **Then** system calls get_customer_debt tool, returns structured JSON with debt details, format applied per tenant configuration

3. **Given** user asks about shipping status "Where is shipment VSG1234567890FM?"
   **When** SupervisorAgent analyzes message
   **Then** system routes to AgentShipping, extracts shipment_id, calls tracking API, returns real-time status

4. **Given** user asks multi-intent question "What is my debt and shipment status?"
   **When** SupervisorAgent detects multiple intents
   **Then** system returns clarification response asking user to focus on one question

**Constitution Alignment**:
- ✅ Principle II: Multi-Agent Architecture - each domain (Debt, Shipment) is separate agent
- ✅ Principle III: LangChain-First Orchestration - uses AgentExecutor + StructuredTool
- ✅ System Constraint A: Response time < 2.5s

---

### User Story 2 - Knowledge Base Question Answering (RAG) (Priority: P1)

**As a** employee or customer
**I want** to ask questions about company documents, policies, or product manuals
**So that** I can get accurate answers from trusted sources without manually searching through PDFs

**Why this priority**: CRITICAL - RAG (Retrieval-Augmented Generation) enables chatbot to answer questions from uploaded documents with source citations, reducing support workload and improving information accessibility.

**Independent Test**: Can be fully tested by:
1. Admin uploads eTMS user manual PDF to knowledge base
2. User asks: "How do I create a new shipment in eTMS?"
3. System searches pgvector knowledge base, retrieves relevant sections
4. LLM generates answer citing specific manual sections
5. Delivers immediate value: instant answers from company documentation

**Acceptance Scenarios**:

1. **Given** admin has uploaded 100-page eTMS manual to Tenant A knowledge base
   **When** system processes document
   **Then** text is chunked (512 tokens/chunk, 50-token overlap), embeddings generated (sentence-transformers all-MiniLM-L6-v2, 384 dimensions), stored in pgvector with tenant_id metadata

2. **Given** user asks "What are the shipping rates for LCL cargo?"
   **When** RAGTool executes search
   **Then** system generates query embedding, searches pgvector with tenant_id filter (cosine similarity), returns top-5 relevant chunks

3. **Given** RAGTool returns relevant document chunks
   **When** agent generates response
   **Then** LLM synthesizes answer from retrieved context, includes source citations (document name, section, page number)

4. **Given** user's question has no relevant documents in knowledge base
   **When** RAGTool search returns similarity score < 0.5 threshold
   **Then** system responds "I don't have information about that in my knowledge base. Please contact support."

**Constitution Alignment**:
- ✅ Principle I: Configuration Over Code - RAG tool configured in database (tool_configs table)
- ✅ Principle II: Multi-Tenant Architecture - pgvector uses tenant_id metadata filtering for isolation
- ✅ System Constraint C: Vector DB = pgvector (PostgreSQL extension)

---

### User Story 3 - Multi-Tenant Agent Configuration (Priority: P1)

**As a** SaaS administrator
**I want** to configure different agents and tools for each tenant organization
**So that** each customer can have customized chatbot capabilities matching their business needs and API integrations

**Why this priority**: CRITICAL - Multi-tenancy is the foundation of SaaS business model. Each tenant (company) must have isolated data, custom agent configurations, and own API credentials.

**Independent Test**: Can be fully tested by:
1. Admin creates Tenant A with AgentDebt + get_customer_debt tool
2. Admin creates Tenant B with AgentShipping + get_shipment_status tool
3. Tenant A user cannot access AgentShipping (permission denied)
4. Tenant B user cannot see Tenant A's conversation history
5. Delivers immediate value: white-label chatbot per customer

**Acceptance Scenarios**:

1. **Given** admin creates new tenant via admin API (POST /admin/tenants)
   **When** tenant record is created
   **Then** system generates tenant_id (UUID), creates default tenant_llm_config, tenant_widget_config, sets status='active'

2. **Given** admin grants Tenant A permission to use AgentDebt
   **When** admin creates tenant_agent_permission (POST /admin/agents/{agent_id}/permissions)
   **Then** tenant_agent_permissions record created with enabled=true, SupervisorAgent loads AgentDebt in available_agents list for Tenant A

3. **Given** Tenant A has LLM config (GPT-4o, encrypted OpenAI API key)
   **When** agent needs to call LLM
   **Then** llm_manager decrypts tenant's API key (Fernet), initializes ChatOpenAI with tenant's rate limits (RPM/TPM from tenant_llm_configs)

4. **Given** Tenant A user sends chat message
   **When** message is stored in database
   **Then** session and message records include tenant_id, conversation history queries filter by tenant_id, preventing cross-tenant data access

**Constitution Alignment**:
- ✅ Principle II: Multi-Tenant Architecture (NON-NEGOTIABLE) - namespace isolation
- ✅ Principle IV: Security & Token Isolation - encrypted API keys, JWT validation
- ✅ System Constraint B: Redis namespace by tenant

---

### User Story 4 - Dynamic Tool Execution with API Integration (Priority: P2)

**As a** integration engineer
**I want** to configure tools that call external APIs (ERP, CRM, logistics systems)
**So that** chatbot can retrieve real-time business data without hardcoding API endpoints

**Why this priority**: HIGH VALUE - Database-driven tool configuration enables non-developers to add new API integrations through admin interface, reducing development cycles from weeks to minutes.

**Independent Test**: Can be fully tested by:
1. Admin creates tool_config for "get_customer_debt" (HTTP_GET type)
2. Admin configures endpoint URL, headers, input_schema (tax_code parameter)
3. Agent receives user message with tax_code entity
4. Tool executes HTTP request to ERP API with JWT token
5. Delivers immediate value: new business capability without code deployment

**Acceptance Scenarios**:

1. **Given** admin creates new tool via admin API (POST /admin/tools)
   **When** tool_config is saved
   **Then** database stores: base_tool_id (HTTP_GET), config (JSONB with endpoint, method, headers), input_schema (JSON Schema defining required parameters), output_format_id

2. **Given** agent needs to execute tool
   **When** tool_loader.load_agent_tools() is called
   **Then** system queries: tool_configs JOIN agent_tools JOIN tenant_tool_permissions, filters by tenant_id + enabled=true, orders by priority ASC, returns top-N tools (default 5)

3. **Given** tool requires tax_code parameter (defined in input_schema)
   **When** agent extracts entities from user message via LLM
   **Then** entity extraction prompt is built dynamically from tool.input_schema.properties, LLM extracts {"tax_code": "0123456789"}

4. **Given** tool executes HTTP request
   **When** tool invokes external API
   **Then** HTTPTool adds Authorization header from user JWT context, calls endpoint with extracted parameters, returns JSON response to agent

**Constitution Alignment**:
- ✅ Principle I: Configuration Over Code - tools defined in database, loaded at runtime
- ✅ Principle III: LangChain-First - tools use StructuredTool abstraction
- ✅ Principle IV: Security - JWT token passed in tool context, added to API headers

---

### User Story 5 - Structured Output Formatting (Priority: P2)

**As a** frontend developer
**I want** standardized JSON response format with rendering hints
**So that** I can build consistent UI components (tables, charts, cards) without parsing arbitrary text

**Why this priority**: HIGH VALUE - Structured output enables rich UI rendering (data tables, charts) instead of plain text, improving user experience and enabling data visualization.

**Independent Test**: Can be fully tested by:
1. Admin configures output_format "structured_json" with renderer_hint (type: table, fields: [customer, amount, due_date])
2. AgentDebt returns debt data
3. Response includes format="structured_json", data={rows: [...]}, renderer_hint
4. Frontend renders as data table with sorting/filtering
5. Delivers immediate value: rich data visualization

**Acceptance Scenarios**:

1. **Given** tool_config specifies output_format_id
   **When** agent completes tool execution
   **Then** format_agent_response() applies output format from database (output_formats table), structures response as {data, agent, intent, format, renderer_hint, metadata}

2. **Given** output_format is "structured_json" with schema {type: "object", properties: {rows: array}}
   **When** tool returns raw API data
   **Then** OutputFormatter validates against schema, structures as {data: {rows: [...]}, format: "structured_json"}

3. **Given** output_format includes renderer_hint {type: "table", fields: ["col1", "col2"], sortable: true}
   **When** response is returned to frontend
   **Then** frontend reads renderer_hint, renders <DataTable> component with specified columns and sorting capability

4. **Given** tenant overrides output format via tenant_agent_permissions.output_override_id
   **When** agent response is formatted
   **Then** tenant-specific override format is used instead of agent's default format

**Constitution Alignment**:
- ✅ Principle V: Unified Output Format - standardized response structure
- ✅ Principle I: Configuration Over Code - formats defined in output_formats table

---

### User Story 6 - Conversation Memory & Session Management (Priority: P2)

**As a** chatbot user
**I want** system to remember context from earlier in conversation
**So that** I can ask follow-up questions without repeating information each time

**Why this priority**: HIGH VALUE - Conversation memory enables natural multi-turn dialogues, improving user experience and reducing friction in complex queries requiring clarification.

**Independent Test**: Can be fully tested by:
1. User asks "What is my debt?" (session created, agent asks for tax_code)
2. User replies "0123456789" (session continues, agent remembers context)
3. Agent uses tax_code from context, executes query
4. User asks "What about shipments?" (new session, context reset)
5. Delivers immediate value: natural conversational flow

**Acceptance Scenarios**:

1. **Given** user sends first message with optional session_id=null
   **When** chat endpoint processes request
   **Then** system creates new session: session_id (UUID), tenant_id, user_id, thread_id (format: "tenant_{id}__user_{id}__session_{id}"), stores in sessions table

2. **Given** user sends message with existing session_id
   **When** chat endpoint validates session
   **Then** system retrieves session from database (filter by session_id + tenant_id + user_id), updates last_message_at timestamp

3. **Given** agent needs conversation context
   **When** agent.invoke() is called with session_id
   **Then** conversation_memory service loads messages (query: SELECT * FROM messages WHERE session_id=? ORDER BY timestamp), builds LangChain message history, passes to agent

4. **Given** agent asks clarification question in message N
   **When** user responds in message N+1
   **Then** agent accesses full history (messages 1 through N+1), understands user's answer refers to previous question, continues reasoning

**Constitution Alignment**:
- ✅ Principle II: Multi-Tenant - sessions isolated by tenant_id
- ✅ System Constraint A: PostgreSQL connection pool for session queries
- ✅ Principle V: Observability - message metadata includes intent, tool_calls, tokens

---

### User Story 7 - Admin Configuration Interface (Priority: P3)

**As a** system administrator
**I want** admin API endpoints to manage agents, tools, and permissions
**So that** I can configure chatbot capabilities without database access or code changes

**Why this priority**: NICE TO HAVE - Admin API improves operational efficiency but system can function with direct database updates initially. Enables self-service configuration for technical users.

**Independent Test**: Can be fully tested by:
1. Admin calls POST /admin/agents with agent config JSON
2. Admin calls POST /admin/agents/{id}/tools to assign tools
3. Admin calls POST /admin/agents/{id}/permissions to grant tenant access
4. Agent appears in tenant's available_agents list immediately (or after cache TTL)
5. Delivers immediate value: self-service agent configuration

**Acceptance Scenarios**:

1. **Given** admin wants to create new agent
   **When** admin calls POST /admin/agents with {name, description, prompt_template, llm_model_id}
   **Then** system creates agent_configs record, returns agent_id, agent becomes available for permission assignment

2. **Given** admin wants to assign tools to agent
   **When** admin calls POST /admin/agents/{agent_id}/tools with {tool_id, priority}
   **Then** system creates agent_tools record (junction table), validates tool exists and is active, enforces priority ordering

3. **Given** admin wants to upload document to knowledge base
   **When** admin calls POST /admin/knowledge/upload with {file: PDF, tenant_id}
   **Then** system extracts text (document_processor), chunks intelligently (semantic chunks, 512 tokens, 50-token overlap), generates embeddings (all-MiniLM-L6-v2), stores in pgvector with metadata

4. **Given** admin wants to list sessions for debugging
   **When** admin calls GET /api/{tenant_id}/session?user_id={user}
   **Then** system returns session summaries (session_id, created_at, message_count, last_message_preview), filtered by tenant and user

**Constitution Alignment**:
- ✅ Development Workflow C: No deploy for config changes
- ✅ Principle I: Configuration Over Code - admin API manages database configs
- ✅ Principle IV: Security - admin endpoints require JWT with admin role

---

### Edge Cases

1. **What happens when user JWT token is expired or invalid?**
   - Middleware validates JWT signature (RS256) against public key
   - If invalid: returns HTTP 401 Unauthorized
   - If expired: returns HTTP 401 with error message indicating token expiration
   - User must re-authenticate to get fresh token

2. **How does system handle LLM API rate limits or timeouts?**
   - llm_manager tracks tenant rate limits (RPM/TPM from tenant_llm_configs)
   - If limit exceeded: queues request or returns 429 Too Many Requests
   - If LLM timeout (> 30s): returns error, logs timeout, suggests retry
   - Conversation state preserved, user can retry same message

3. **What happens when agent cannot extract required entities?**
   - Agent compares extracted entities against tool.input_schema.required
   - If missing entities: generates clarification question ("I need your tax code to check debt")
   - If user provides entity in next message: agent extracts from context, executes tool
   - If user still doesn't provide: agent suggests alternative or transfers to human

4. **How does system handle multi-language input?**
   - SupervisorAgent detects language (simple heuristic: Vietnamese vs English)
   - Language code passed to agent for response generation
   - Agent prompt includes language instruction: "Respond in {detected_language}"
   - Clarification messages use detected language

5. **What happens when external API tool returns error (404, 500)?**
   - HTTPTool catches HTTP exceptions, returns error to agent
   - Agent receives error context, generates user-friendly message
   - Error logged with full context (tool_name, endpoint, status_code, tenant_id)
   - Agent suggests alternative action or retry

6. **How does pgvector handle tenant with no knowledge documents?**
   - RAGTool queries pgvector with tenant_id filter
   - If no results: RAGTool returns empty list
   - Agent detects empty RAG results, responds: "No knowledge base available. Please upload documents first."

7. **What happens when two agents could handle same query?**
   - SupervisorAgent's LLM routing is deterministic (given same prompt, returns same agent)
   - If ambiguous: SupervisorAgent returns "UNCLEAR" status code
   - System asks clarification: "Did you mean to ask about [Agent1 domain] or [Agent2 domain]?"
   - User clarifies, supervisor routes to specific agent

8. **How does system handle session expiration or orphaned sessions?**
   - Sessions don't expire automatically (no TTL)
   - Cleanup job can delete sessions older than N days (not yet implemented)
   - [NEEDS CLARIFICATION: Session retention policy not defined]

---

## Requirements *(mandatory)*

### Functional Requirements

#### Core Chat Functionality

- **FR-001**: System MUST accept chat messages via POST /api/{tenant_id}/chat endpoint with JSON body: {message, session_id?, user_id, metadata}

- **FR-002**: System MUST validate JWT token on every request (RS256 signature verification) and extract tenant_id from token claims

- **FR-003**: System MUST create new session if session_id is null or invalid, generating unique session_id (UUID) and thread_id (format: "tenant_{uuid}__user_{id}__session_{uuid}")

- **FR-004**: System MUST store user message in messages table with: message_id, session_id, role='user', content, timestamp, metadata (JSONB)

- **FR-005**: System MUST return chat response within 2.5 seconds for 95th percentile of requests (excluding external API latency)

#### Intent Detection & Routing

- **FR-006**: System MUST use SupervisorAgent to analyze user message and detect single intent, multiple intents, or unclear intent

- **FR-007**: System MUST load available agents for tenant from database (query: agent_configs JOIN tenant_agent_permissions WHERE tenant_id=? AND enabled=true AND is_active=true)

- **FR-008**: System MUST build supervisor prompt dynamically listing all available agent names and descriptions

- **FR-009**: System MUST route message to detected agent if single intent, return "MULTI_INTENT" clarification if multiple intents, return "UNCLEAR" if no match

- **FR-010**: System MUST detect user language (Vietnamese/English) using simple heuristic and pass to agent for localized responses

#### Domain Agent Execution

- **FR-011**: System MUST load agent configuration from database including: prompt_template, llm_model_id, default_output_format_id, handler_class

- **FR-012**: System MUST initialize LLM for agent using tenant's LLM config (decrypt API key with Fernet, apply rate limits RPM/TPM)

- **FR-013**: System MUST load agent's tools from database with priority ordering (query: tool_configs JOIN agent_tools JOIN tenant_tool_permissions ORDER BY priority ASC LIMIT 5)

- **FR-014**: System MUST extract entities from user message using LLM with dynamically built prompt from tools' input_schema.properties

- **FR-015**: System MUST execute tools if all required entities are present (validate against input_schema.required), or ask clarification questions if entities missing

#### Tool Execution

- **FR-016**: System MUST support tool types: HTTP_GET, HTTP_POST, RAG (knowledge search), with extensibility for future types (DB_QUERY, OCR)

- **FR-017**: System MUST pass user JWT token to tools via context, tools MUST add Authorization header when calling external APIs

- **FR-018**: System MUST load tool configuration from database including: base_tool_id, config (endpoint, method, headers), input_schema, output_format_id

- **FR-019**: System MUST validate tool input parameters against input_schema (JSON Schema) before execution

- **FR-020**: System MUST handle tool execution errors gracefully, returning user-friendly error messages and logging full error context

#### RAG (Knowledge Base)

- **FR-021**: System MUST use PostgreSQL with pgvector extension for vector storage (table: knowledge_documents)

- **FR-022**: System MUST generate embeddings using sentence-transformers model all-MiniLM-L6-v2 (384 dimensions)

- **FR-023**: System MUST chunk documents intelligently: semantic chunking with 512 tokens per chunk, 50-token overlap

- **FR-024**: System MUST store document chunks with metadata: tenant_id (for isolation), document_id, section_title, page_number, source, chunk_index

- **FR-025**: System MUST search pgvector using cosine similarity (HNSW index), filtered by tenant_id metadata, returning top-k results (default k=5)

- **FR-026**: System MUST filter RAG results by similarity threshold (default 0.5), excluding low-relevance chunks

#### Multi-Tenancy

- **FR-027**: System MUST isolate all tenant data by tenant_id: sessions, messages, tenant_agent_permissions, tenant_tool_permissions, tenant_llm_configs

- **FR-028**: System MUST filter all database queries by tenant_id extracted from JWT token

- **FR-029**: System MUST encrypt tenant API keys (LLM provider keys) using Fernet symmetric encryption, storing encrypted value in database

- **FR-030**: System MUST namespace Redis cache keys by tenant: "agenthub:{tenant_id}:cache:{key}"

- **FR-031**: System MUST prevent cross-tenant data access: user from Tenant A cannot see Tenant B's sessions, messages, or configurations

#### Output Formatting

- **FR-032**: System MUST apply output format from database (output_formats table) based on: tool.output_format_id → agent.default_output_format_id → tenant_agent_permissions.output_override_id (priority order)

- **FR-033**: System MUST return structured response: {session_id, message_id, response, agent, intent, format, renderer_hint, metadata}

- **FR-034**: System MUST validate response data against output_format.schema (JSON Schema) before returning

- **FR-035**: System MUST include metadata in response: {agent_id, tenant_id, duration_ms, status, llm_model, tool_calls, extracted_entities}

#### Conversation Memory

- **FR-036**: System MUST load conversation history from database when session_id is provided (query: SELECT * FROM messages WHERE session_id=? ORDER BY timestamp)

- **FR-037**: System MUST pass conversation history to agent as LangChain message history format

- **FR-038**: System MUST update session.last_message_at timestamp on every message

- **FR-039**: System MUST store agent response in messages table with role='assistant', content, metadata (agent, intent, tool_calls, llm_model, tokens)

#### Admin Configuration

- **FR-040**: System MUST provide admin endpoints to manage: agents (POST/PUT/GET/DELETE /admin/agents), tools (POST/PUT/GET/DELETE /admin/tools), permissions (POST/DELETE /admin/agents/{id}/permissions)

- **FR-041**: System MUST provide endpoint to upload knowledge documents (POST /admin/knowledge/upload) accepting PDF, DOCX, TXT files

- **FR-042**: System MUST process uploaded documents: extract text, chunk, generate embeddings, store in pgvector with tenant_id metadata

- **FR-043**: System MUST provide endpoint to list sessions for debugging (GET /api/{tenant_id}/session?user_id={user})

- **FR-044**: System MUST provide endpoint to retrieve session details with full message history (GET /api/{tenant_id}/session/{session_id})

### Key Entities *(data model)*

#### Core Tables (13 total)

**Tenant Management**:
- **tenants**: Organizations using the system
  - Attributes: tenant_id (PK), name, domain (unique), status, created_at, updated_at
  - Relationships: 1:N to sessions, agent_permissions, tool_permissions, llm_config, widget_config

**LLM Configuration**:
- **llm_models**: Available LLM providers/models catalog
  - Attributes: llm_model_id (PK), provider (openai/anthropic/openrouter), model_name, context_window, cost_per_1k_input, cost_per_1k_output, is_active, capabilities (JSONB)

- **tenant_llm_configs**: Tenant-specific LLM settings with encrypted API keys
  - Attributes: config_id (PK), tenant_id (FK unique), llm_model_id (FK), encrypted_api_key, rate_limit_rpm, rate_limit_tpm
  - Purpose: Isolated LLM credentials per tenant, rate limiting

**Agent Configuration**:
- **agent_configs**: Domain agent definitions
  - Attributes: agent_id (PK), name (unique), prompt_template (TEXT), llm_model_id (FK), default_output_format_id (FK), description, handler_class, is_active
  - Purpose: Agent behavior, LLM selection, output formatting

- **base_tools**: Tool type templates (HTTP_GET, HTTP_POST, RAG, DB_QUERY, OCR)
  - Attributes: base_tool_id (PK), type (unique), handler_class, description, default_config_schema (JSONB)
  - Purpose: Tool type catalog

- **tool_configs**: Specific tool instances with configuration
  - Attributes: tool_id (PK), name, base_tool_id (FK), config (JSONB: endpoint, method, headers), input_schema (JSONB: JSON Schema), output_format_id (FK), description, is_active
  - Purpose: Configurable tool instances

- **agent_tools**: Many-to-many junction between agents and tools
  - Attributes: agent_id (PK, FK), tool_id (PK, FK), priority (tool loading order)
  - Purpose: Agent-tool assignment with priority ranking

- **output_formats**: Response format definitions with rendering hints
  - Attributes: format_id (PK), name (unique), schema (JSONB), renderer_hint (JSONB), description
  - Purpose: Structured output formatting

**Permissions**:
- **tenant_agent_permissions**: Grants agent access to tenants
  - Attributes: tenant_id (PK, FK), agent_id (PK, FK), enabled, output_override_id (FK optional)
  - Purpose: Agent access control per tenant, optional output format override

- **tenant_tool_permissions**: Grants tool access to tenants
  - Attributes: tenant_id (PK, FK), tool_id (PK, FK), enabled
  - Purpose: Tool access control per tenant

**Runtime**:
- **sessions**: Conversation sessions
  - Attributes: session_id (PK), tenant_id (FK), user_id, agent_id (FK optional), thread_id, created_at, last_message_at, metadata (JSONB)
  - Purpose: Multi-turn conversation tracking

- **messages**: Chat message history
  - Attributes: message_id (PK), session_id (FK), role ('user'|'assistant'|'system'), content (TEXT), timestamp, metadata (JSONB: intent, tool_calls, tokens, llm_model)
  - Purpose: Conversation memory, audit trail

- **checkpoints**: LangGraph state persistence (optional)
  - Attributes: checkpoint_id (PK), thread_id, checkpoint_ns, parent_checkpoint_id, type, checkpoint (BYTEA), metadata (JSONB)
  - Purpose: Agent state serialization for complex workflows

**Knowledge Base (pgvector)**:
- **knowledge_documents**: Vector embeddings with content
  - Attributes: id (PK), tenant_id (FK), document_id, content (TEXT), embedding (vector[384]), metadata (JSONB: source, section_title, page_number, chunk_index), created_at
  - Indexes: HNSW index on embedding (cosine similarity), B-tree on tenant_id
  - Purpose: RAG knowledge base with tenant isolation

**Widget Configuration**:
- **tenant_widget_configs**: Iframe embed settings per tenant
  - Attributes: config_id (PK), tenant_id (FK unique), widget_key, widget_secret, theme, primary_color, position, custom_css, auto_open, welcome_message, allowed_domains (JSONB), rate_limit_per_minute
  - Purpose: Customizable chat widget per tenant

### Non-Functional Requirements

- **NFR-001**: Response time MUST be < 2.5 seconds for 95th percentile of chat requests (excluding external API latency)

- **NFR-002**: System MUST support 100+ concurrent tenants without performance degradation

- **NFR-003**: PostgreSQL connection pool MUST be configured with minimum 20 connections

- **NFR-004**: Redis cache MUST be used with TTL=1 hour for agent configurations

- **NFR-005**: JWT token validation MUST complete within 50ms

- **NFR-006**: Database queries MUST use indexes for tenant_id, session_id, timestamp columns

- **NFR-007**: System MUST handle LLM provider failures gracefully, retrying once before returning error

- **NFR-008**: pgvector similarity search MUST use HNSW index for sub-100ms query time

- **NFR-009**: System uptime MUST exceed 99.9% (excluding scheduled maintenance)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

#### Performance

- **SC-001**: 95th percentile response time < 2.5 seconds for chat requests (measured over 24-hour period)

- **SC-002**: 99th percentile response time < 5 seconds for chat requests

- **SC-003**: pgvector similarity search completes in < 100ms for top-5 results (measured per query)

- **SC-004**: JWT validation completes in < 50ms per request

- **SC-005**: System handles 100 concurrent chat requests without degradation (load testing validation)

#### Accuracy & Quality

- **SC-006**: Intent detection accuracy > 85% (measured on 100-message test set with ground truth labels)

- **SC-007**: Entity extraction completeness > 80% (percentage of messages where agent correctly identifies all required entities)

- **SC-008**: RAG answer relevance > 70% (user feedback: "Was this answer helpful?")

- **SC-009**: Tool execution success rate > 95% (excluding external API failures)

#### Operational

- **SC-010**: Zero cross-tenant data leaks detected in security testing (100+ test scenarios)

- **SC-011**: New agent setup time < 5 minutes (from admin API calls to agent available in production)

- **SC-012**: New tool configuration time < 3 minutes (from admin API call to tool usable by agents)

- **SC-013**: System uptime > 99.9% over 30-day rolling window

- **SC-014**: Knowledge document upload and indexing completes within 2 minutes for 100-page PDF

#### User Experience

- **SC-015**: 90% of users successfully complete primary task (query business data) on first attempt without clarification

- **SC-016**: Average conversation length < 5 messages to resolve query

---

## Technical Constraints

### Technology Stack (CURRENT)

- **Backend Framework**: Python 3.11+, FastAPI 0.104+, Uvicorn
- **Agent Framework**: LangChain 0.3+, LangGraph 0.2+ (for complex workflows)
- **Database**: PostgreSQL 15+ with pgvector extension (vector storage)
- **ORM**: SQLAlchemy 2.0+, Alembic for migrations
- **Caching**: Redis 7.x
- **Vector Search**: pgvector with sentence-transformers (all-MiniLM-L6-v2, 384 dimensions)
- **Security**: JWT RS256, Fernet encryption for API keys
- **Logging**: structlog (structured JSON logs)
- **Testing**: pytest, pytest-asyncio, pytest-cov (target: 80% coverage)

### Infrastructure

- **Container Orchestration**: Docker Compose (development), Kubernetes (production)
- **Database Connection Pool**: Minimum 20 connections, maximum 100
- **Redis**: Single instance (development), Redis Cluster (production)
- **LLM Providers**: OpenAI, Anthropic, OpenRouter (configurable per tenant)

### Performance Constraints

- Response time: < 2.5s (95th percentile)
- pgvector search: < 100ms per query
- JWT validation: < 50ms per request
- LLM timeout: 30 seconds (then retry once)
- Database query timeout: 10 seconds

### Security Constraints (NON-NEGOTIABLE per Constitution)

- JWT validation: RS256 signature verification on EVERY request
- API key encryption: Fernet symmetric encryption for tenant LLM keys
- Token passing: User JWT passed to tools, added to external API Authorization headers
- Multi-tenancy: ALL queries filtered by tenant_id extracted from JWT

---

## Dependencies

### External Dependencies

- PostgreSQL 15+ with pgvector extension installed
- Redis 7.x for caching
- LLM provider APIs: OpenAI, Anthropic, or OpenRouter
- sentence-transformers Python library for embeddings
- External business APIs (ERP, CRM, logistics systems) for tool integration

### Internal Dependencies

- JWT public key for RS256 verification (configured in environment)
- Fernet encryption key for API key encryption/decryption
- Database connection string (DATABASE_URL environment variable)
- Redis connection string (REDIS_URL environment variable)

---

## Out of Scope (Current System)

The following are explicitly OUT OF SCOPE for the current system (may be future enhancements):

1. **Row-Level Security (RLS)** - Currently application-level filtering only; database-level RLS policies not implemented

2. **Audit logging** - No audit_logs table; configuration changes not tracked with who/what/when

3. **Usage metrics** - Token usage and costs not tracked in database (logged but not persisted)

4. **Tenant quotas** - No automated quota enforcement; unlimited usage per tenant

5. **Configuration versioning** - No version history for agent/tool configs; no rollback capability

6. **Real-time cache invalidation** - No Redis pub/sub for config updates; relies on TTL expiration

7. **Multi-region deployment** - Single-region only; no cross-region replication

8. **Voice input** - Text-only interface; no speech-to-text integration

9. **File upload in chat** - No document upload in conversation; only via admin API

10. **Soft delete** - Hard deletes only; no deleted_at pattern for configurations

---

## Assumptions

1. **Single region deployment**: All components (app servers, PostgreSQL, Redis) in same AWS region/data center

2. **PostgreSQL version**: Production database is PostgreSQL 15+ (pgvector 0.5+ available)

3. **Tenant count**: Optimized for 100-500 tenants; additional optimization needed for 1000+ tenants

4. **External API availability**: Business APIs (ERP, CRM) have 99% uptime; chatbot tolerates failures gracefully

5. **LLM provider availability**: OpenAI/Anthropic APIs have 99.9% uptime per their SLAs

6. **JWT token validity**: JWT tokens are short-lived (24h max), issued by trusted authentication service

7. **Admin authentication**: Admin endpoints use same JWT authentication with admin role claim

8. **Document formats**: Knowledge base supports PDF, DOCX, TXT files; other formats (PPT, XLS) not supported

---

## Known Limitations

1. **No Row-Level Security**: Tenant isolation relies on application-level filtering; developer error could leak data (see improvement spec for RLS implementation)

2. **No real-time config updates**: Agent/tool config changes require cache TTL expiration (up to 1 hour) or manual cache flush

3. **Limited entity extraction**: Entity extraction depends on LLM accuracy; no structured NER model

4. **No agent chaining**: Agents work independently; no workflow orchestration for multi-step processes requiring multiple agents

5. **pgvector single-collection**: All tenants share same knowledge_documents table with metadata filtering; no per-tenant collections

6. **No conversation analytics**: Limited metrics on conversation success, user satisfaction, or agent performance

7. **No A/B testing**: Cannot compare different prompts or agent configurations with traffic splitting

---

## Constitution Alignment Verification

This specification is fully aligned with `.specify/memory/constitution_agenthub_chatbot.md`:

✅ **Principle I: Configuration Over Code**
- All agents, tools, prompts in database (agent_configs, tool_configs, base_tools)
- Runtime loading via factories and registries

✅ **Principle II: Multi-Agent & Multi-Tenant Architecture**
- Distinct domain agents (Debt, Shipment, etc.)
- Tenant isolation via tenant_id on all scoped tables
- Namespace isolation in Redis

✅ **Principle III: LangChain-First Orchestration**
- All agents use AgentExecutor
- All tools use StructuredTool
- SupervisorAgent for routing

✅ **Principle IV: Security & Token Isolation (NON-NEGOTIABLE)**
- JWT RS256 validation on every request
- User token passed to tools, added to API Authorization headers
- LLM API keys Fernet-encrypted in database

✅ **Principle V: Unified Output Format & Observability**
- Standardized response format from output_formats table
- Structured logging with structlog
- Metadata tracking (llm_model, tool_calls, tokens, latency)

✅ **System Constraint A: Performance**
- Response time < 2.5s (measured in SC-001)
- Redis cache TTL 1 hour (NFR-004)
- PostgreSQL pool minimum 20 connections (NFR-003)

✅ **System Constraint B: Security Standards**
- JWT RS256, TTL 24h (Assumption 6)
- Redis namespace by tenant (FR-030)
- API key encryption, never logged (FR-029)

✅ **System Constraint C: Technology Stack**
- FastAPI async backend ✅
- LangChain 0.3+ ✅
- Redis 7.x ✅
- PostgreSQL 15 ✅
- pgvector (replaces ChromaDB) ✅
- JWT RS256 + Fernet ✅

---

## Related Documents

- **Constitution**: `.specify/memory/constitution_agenthub_chatbot.md` (principles & constraints)
- **Architecture Analysis**: `SYSTEM_ARCHITECTURE_ANALYSIS.md` (detailed technical documentation)
- **Business Spec (legacy)**: `spec_business_chatbot.md` (Vietnamese, references ChromaDB - outdated)
- **Improvement Spec**: `.specify/features/multi-tenant-db-security/spec.md` (future enhancements: RLS, audit trails, quotas)
- **Database Architecture**: `DATABASE_ARCHITECTURE_PLAN.md` (ERD, schema details)
- **Design Principles**: `DESIGN_PRINCIPLES.md` (database design, multi-tenancy patterns)

---

## Testing Evidence

Current system has been validated with:

1. **Unit Tests**: 80%+ coverage for services layer (supervisor_agent, domain_agents, rag_service, tool_loader)

2. **Integration Tests**: End-to-end chat flow tested with mock database and Redis

3. **Notebook Testing**: `notebook_test_pgvector/rag_complete_testing.ipynb` validates:
   - Document chunking and embedding generation
   - pgvector similarity search with tenant_id filtering
   - Top-k retrieval accuracy
   - Section statistics and chunk analysis

4. **Manual Testing**: test-chatbot.html provides interactive testing interface

5. **Load Testing**: System tested with 100 concurrent users (locust framework)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-06 | Architecture Team | Initial specification documenting current system |
| 1.1 | 2025-11-06 | Architecture Team | Updated ChromaDB → pgvector, added 13-table schema details |

---

## Approval Signatures

**Product Owner**: ___________________________ Date: __________

**Technical Lead**: ___________________________ Date: __________

**Last Updated**: 2025-11-06

---

**Status**: ✅ PRODUCTION - This spec documents the current live system (v2.0 with pgvector migration)
