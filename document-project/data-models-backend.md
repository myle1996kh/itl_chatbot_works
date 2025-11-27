# Data Models - Backend

**Generated:** 2025-11-26
**Part:** Backend API
**Database:** PostgreSQL with pgvector extension
**ORM:** SQLAlchemy 2.0+
**Migrations:** Alembic

## Overview

The backend uses SQLAlchemy ORM with 15+ models implementing multi-tenant architecture. All tenant-scoped data includes `tenant_id` foreign key for data isolation.

## Core Models

### 1. Tenant (`tenant.py`)
**Table:** `tenants`
**Purpose:** Organization/company using the system

**Key Fields:**
- `id` (UUID, PK) - Tenant identifier
- `name` (String) - Tenant name
- `subdomain` (String, unique) - URL subdomain
- `settings` (JSON) - Custom tenant settings
- `created_at`, `updated_at` (Timestamp)

**Relationships:**
- One-to-many: Users, Sessions, Messages, Agents, Tools
- One-to-one: TenantLLMConfig, TenantWidgetConfig

### 2. User (`user.py`)
**Table:** `users`
**Purpose:** System users (admins, supporters)

**Key Fields:**
- `id` (UUID, PK)
- `email` (String, unique)
- `hashed_password` (String)
- `role` (Enum: admin, supporter, user)
- `tenant_id` (UUID, FK → tenants)
- `is_active` (Boolean)

**Relationships:**
- Many-to-one: Tenant

### 3. ChatUser (`chat_user.py`)
**Table:** `chat_users`
**Purpose:** End users/customers using the chat

**Key Fields:**
- `id` (UUID, PK)
- `email` (String, nullable)
- `name` (String, nullable)
- `tenant_id` (UUID, FK → tenants)
- `metadata` (JSON) - Custom user data

**Relationships:**
- Many-to-one: Tenant
- One-to-many: Sessions

### 4. Session (`session.py`)
**Table:** `sessions`
**Purpose:** Chat conversation sessions

**Key Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `chat_user_id` (UUID, FK → chat_users)
- `status` (Enum: active, ended, escalated)
- `metadata` (JSON)
- `started_at`, `ended_at` (Timestamp)

**Relationships:**
- Many-to-one: Tenant, ChatUser
- One-to-many: Messages
- One-to-one: Escalation (if escalated)

### 5. Message (`message.py`)
**Table:** `messages`
**Purpose:** Individual chat messages

**Key Fields:**
- `id` (UUID, PK)
- `session_id` (UUID, FK → sessions)
- `role` (Enum: user, assistant, system, supporter)
- `content` (Text)
- `agent_name` (String, nullable) - Which agent responded
- `metadata` (JSON)
- `created_at` (Timestamp)

**Relationships:**
- Many-to-one: Session

## Agent Configuration Models

### 6. AgentConfig (`agent.py`)
**Table:** `agent_configs`
**Purpose:** Domain agent definitions

**Key Fields:**
- `id` (UUID, PK)
- `name` (String) - Agent identifier
- `description` (Text)
- `system_prompt` (Text) - LLM instructions
- `output_format_id` (UUID, FK → output_formats)
- `is_active` (Boolean)

**Relationships:**
- Many-to-many: ToolConfigs (via agent_tools junction)
- Many-to-one: OutputFormat

### 7. BaseTool (`base_tool.py`)
**Table:** `base_tools`
**Purpose:** Tool type templates

**Key Fields:**
- `id` (UUID, PK)
- `name` (String) - Tool type (e.g., "rag", "http")
- `category` (String)
- `description` (Text)

**Relationships:**
- One-to-many: ToolConfigs

### 8. ToolConfig (`tool.py`)
**Table:** `tool_configs`
**Purpose:** Specific tool instances

**Key Fields:**
- `id` (UUID, PK)
- `base_tool_id` (UUID, FK → base_tools)
- `name` (String) - Tool instance name
- `config` (JSON) - Tool-specific configuration
- `input_schema` (JSON) - Expected input format

**Relationships:**
- Many-to-one: BaseTool
- Many-to-many: AgentConfigs (via agent_tools junction)

### 9. OutputFormat (`output_format.py`)
**Table:** `output_formats`
**Purpose:** Response formatting templates

**Key Fields:**
- `id` (UUID, PK)
- `name` (String)
- `template` (Text) - Jinja2 template
- `schema` (JSON) - Output structure

**Relationships:**
- One-to-many: AgentConfigs

## LLM Configuration Models

### 10. LLMModel (`llm_model.py`)
**Table:** `llm_models`
**Purpose:** Available LLM providers and models

**Key Fields:**
- `id` (UUID, PK)
- `provider` (String) - openai, anthropic, google
- `model_name` (String) - gpt-4, claude-3, etc.
- `supports_streaming` (Boolean)
- `context_window` (Integer)

**Relationships:**
- One-to-many: TenantLLMConfig

### 11. TenantLLMConfig (`tenant_llm_config.py`)
**Table:** `tenant_llm_configs`
**Purpose:** Per-tenant LLM settings

**Key Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants, unique)
- `llm_model_id` (UUID, FK → llm_models)
- `temperature` (Float)
- `max_tokens` (Integer)
- `api_key_encrypted` (String)

**Relationships:**
- One-to-one: Tenant
- Many-to-one: LLMModel

## Widget Configuration

### 12. TenantWidgetConfig (`tenant_widget_config.py`)
**Table:** `tenant_widget_configs`
**Purpose:** Chat widget customization per tenant

**Key Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants, unique)
- `primary_color` (String)
- `welcome_message` (Text)
- `position` (Enum: bottom-right, bottom-left)
- `enabled` (Boolean)

**Relationships:**
- One-to-one: Tenant

## Escalation/Support Models

### 13. Supporter (`supporter.py`)
**Table:** `supporters`
**Purpose:** Support staff for human escalation

**Key Fields:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `tenant_id` (UUID, FK → tenants)
- `status` (Enum: available, busy, offline)
- `max_concurrent_sessions` (Integer)

**Relationships:**
- Many-to-one: User, Tenant
- One-to-many: Escalations

### Escalation (inferred from models)
**Table:** `escalations` (likely)
**Purpose:** Track sessions escalated to human support

**Key Fields:**
- `id` (UUID, PK)
- `session_id` (UUID, FK → sessions, unique)
- `supporter_id` (UUID, FK → supporters, nullable)
- `reason` (Text)
- `status` (Enum: pending, assigned, resolved)
- `escalated_at`, `resolved_at` (Timestamp)

## Permission Models

### 14. TenantAgentPermission (`permissions.py`)
**Table:** `tenant_agent_permissions`
**Purpose:** Grant agent access per tenant

**Key Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `agent_id` (UUID, FK → agent_configs)
- `granted_at` (Timestamp)

**Unique Constraint:** (tenant_id, agent_id)

### 15. TenantToolPermission (`permissions.py`)
**Table:** `tenant_tool_permissions`
**Purpose:** Grant tool access per tenant

**Key Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `tool_id` (UUID, FK → tool_configs)
- `granted_at` (Timestamp)

**Unique Constraint:** (tenant_id, tool_id)

## Junction Tables

### AgentTools
**Table:** `agent_tools`
**Purpose:** Many-to-many relationship between agents and tools

**Fields:**
- `agent_id` (UUID, FK → agent_configs)
- `tool_id` (UUID, FK → tool_configs)

**Composite Primary Key:** (agent_id, tool_id)

## Vector Storage (RAG)

### KnowledgeDocument (inferred)
**Table:** `knowledge_documents`
**Purpose:** Uploaded documents for RAG

**Key Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK → tenants)
- `filename` (String)
- `content_type` (String)
- `status` (Enum: uploaded, processing, indexed, failed)
- `embedding_vector` (Vector) - pgvector column
- `metadata` (JSON)
- `uploaded_at` (Timestamp)

**Indexes:**
- HNSW index on `embedding_vector` for fast similarity search
- B-tree index on `tenant_id` for tenant filtering

## Database Schema Patterns

### Multi-Tenancy Pattern
All tenant-scoped tables include:
```python
tenant_id = Column(UUID, ForeignKey('tenants.id'), nullable=False, index=True)
```

### Soft Delete Pattern
Models use `is_active` or `deleted_at` for soft deletes:
```python
is_active = Column(Boolean, default=True)
```

### Timestamps Pattern
All models include:
```python
created_at = Column(DateTime(timezone=True), server_default=func.now())
updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### UUID Primary Keys
All models use UUID v4 for primary keys:
```python
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
```

## Migrations

**Location:** `backend/alembic/versions/`
**Tool:** Alembic
**Auto-generation:** `alembic revision --autogenerate -m "description"`
**Commands:**
- Apply: `alembic upgrade head`
- Rollback: `alembic downgrade -1`
- History: `alembic history`

## Database Indexes

### Performance Indexes
- `tenant_id` on all tenant-scoped tables
- `email` on users and chat_users tables
- `session_id` on messages table
- `created_at` on messages and sessions (for time-based queries)
- HNSW vector index on embeddings (cosine similarity)

### Unique Constraints
- `email` on users (per tenant)
- `subdomain` on tenants (global)
- `(tenant_id, agent_id)` on tenant_agent_permissions
- `(tenant_id, tool_id)` on tenant_tool_permissions

## Data Relationships Summary

```
tenants (1) ──┬── (N) users
              ├── (N) chat_users
              ├── (N) sessions
              ├── (1) tenant_llm_config
              └── (1) tenant_widget_config

chat_users (1) ── (N) sessions

sessions (1) ── (N) messages

agent_configs (N) ── (N) tool_configs [via agent_tools]

tenants (N) ──┬── (N) agent_configs [via tenant_agent_permissions]
              └── (N) tool_configs [via tenant_tool_permissions]
```

## Vector Search (RAG)

**Extension:** pgvector
**Embedding Model:** sentence-transformers (all-MiniLM-L6-v2)
**Dimensions:** 384
**Distance Metric:** Cosine similarity
**Index Type:** HNSW (Hierarchical Navigable Small World)

**Query Pattern:**
```sql
SELECT * FROM knowledge_documents
WHERE tenant_id = ?
ORDER BY embedding_vector <=> ?
LIMIT 5
```
