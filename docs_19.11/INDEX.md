# Chat System Documentation (Nov 19, 2025)

Complete guide to understanding and testing the ITL ChatBot chat initiation flow, agent architecture, and API integration.

## 📋 Documentation Contents

### 1. **[CHAT_FLOW.md](./CHAT_FLOW.md)** - Chat Initiation & Full Flow
How a chat message is processed from start to finish:
- Chat widget initialization
- Session creation/retrieval
- Message validation and storage
- Agent routing (SupervisorAgent vs Direct routing)
- Response generation and formatting

### 2. **[AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md)** - Agent System Design
Deep dive into agent configuration and domain agents:
- Agent configuration database schema (`agent_configs` table)
- Supervisor agent routing logic
- Domain agent implementation and execution
- Tool loading and execution
- Entity extraction and intent detection
- Multi-tenant agent permissions

### 3. **[WIDGET_CONFIG_DATABASE.md](./WIDGET_CONFIG_DATABASE.md)** - Widget Configuration Mapping
How chat widget configurations connect to the database:
- `TenantWidgetConfig` model structure
- Widget appearance and behavior settings
- Security and embedding configuration
- Database-to-UI configuration mapping
- Widget lifecycle (creation, updates, regeneration)

### 4. **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API Reference
Comprehensive API documentation with test examples:
- Chat endpoint (`POST /{tenant_id}/chat`)
- Test endpoint (`POST /{tenant_id}/test/chat`)
- Request/Response schema definitions
- Authentication and authorization
- Error handling
- Rate limiting
- Specific test examples with cURL and Python

### 5. **[TENANT_SETUP_GUIDE.md](./TENANT_SETUP_GUIDE.md)** - Complete Tenant Onboarding
Step-by-step guide to set up a new tenant from scratch:
- Create tenant record
- Configure LLM models (OpenAI, OpenRouter, Anthropic)
- Create tenant LLM configuration with API keys
- Set up tools (RAG, HTTP, custom tools)
- Configure agents (SupervisorAgent, DomainAgents)
- Link agents to tools with priorities
- Set up permissions (TenantAgentPermission, TenantToolPermission)
- Create widget configuration for embedding
- Create test chat user
- Test the complete setup
- Complete setup checklist
- Quick reference for tenant IDs
- Common issues & solutions
- Customer handoff guide

## 🎯 Quick Start

**For onboarding a new tenant (first task):**
1. Start with [TENANT_SETUP_GUIDE.md](./TENANT_SETUP_GUIDE.md)
2. Follow step-by-step from tenant creation to testing
3. Use the complete setup checklist
4. Reference quick IDs summary for tracking

**For understanding the chat flow:**
1. Read [CHAT_FLOW.md](./CHAT_FLOW.md)
2. Review the sequence diagram and step-by-step breakdown
3. Check the database models involved

**For agent configuration:**
1. Study [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md)
2. Understand SupervisorAgent vs DomainAgent patterns
3. Learn how tools and permissions work
4. See real-world examples

**For widget integration:**
1. Review [WIDGET_CONFIG_DATABASE.md](./WIDGET_CONFIG_DATABASE.md)
2. See how settings persist in the database
3. Understand the embed code generation
4. Check security and domain whitelisting

**For testing the API:**
1. Read [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
2. Use the provided test examples (cURL, Python, Bash)
3. Test with curl or Python client
4. Check monitoring & debugging tips

## 🔑 Key Concepts

### Tenant Isolation
All operations are scoped by `tenant_id`. Tenants have:
- Dedicated configuration (agents, tools, LLM settings)
- Widget configurations
- User accounts and chat sessions
- Permission-based access to agents and tools

### Session Management
- Sessions are created automatically if not provided
- Each session has a unique `session_id` and `thread_id`
- Conversation history is loaded for context
- Sessions track metadata and escalation status

### Agent Routing
Two routing modes:
1. **SupervisorAgent** (default): Intent detection → routes to appropriate agent
2. **Direct Routing**: Skip SupervisorAgent, route directly to named agent

### Tools & Permissions
- Tools are attached to agents via `AgentTools` junction table
- Tenant permissions control which agents/tools are available
- Tools are loaded dynamically based on agent configuration

## 📊 Database Tables Involved

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `tenants` | Organization data | tenant_id, name |
| `chat_sessions` | User sessions | session_id, user_id, tenant_id |
| `messages` | Chat history | message_id, session_id, role, content |
| `agent_configs` | Agent definitions | agent_id, name, prompt_template, llm_model_id |
| `tenant_widget_configs` | Widget settings | config_id, tenant_id, theme, position, allowed_domains |
| `tenant_agent_permissions` | Agent access control | tenant_id, agent_id, enabled |
| `tenant_tool_permissions` | Tool access control | tenant_id, tool_id, enabled |

## 🔧 Technologies

- **Framework**: FastAPI with SQLAlchemy ORM
- **Agents**: LangChain 0.3+ with LangGraph 0.2+
- **Database**: PostgreSQL with pgvector
- **LLM Support**: OpenAI, OpenRouter, Anthropic
- **Authentication**: JWT (RS256)
- **Logging**: structlog with structured context

---

**Generated**: November 19, 2025
**Project**: AgentHub Multi-Agent Chatbot Framework
**Focus**: Chat system deep-dive for development and testing
