# Complete Tenant Setup Guide

Step-by-step guide to onboard a new tenant from scratch, including LLM models, agents, tools, permissions, and widget configuration.

## 🎯 Overview: What Needs to Be Set Up

```
New Tenant
│
├─→ 1. Create Tenant (database)
│
├─→ 2. Configure LLM Models
│   ├─ Select provider (OpenAI, OpenRouter, Anthropic)
│   └─ Create llm_models entry
│
├─→ 3. Create Tenant LLM Config
│   ├─ Default LLM per tenant
│   ├─ Rate limits (RPM, TPM)
│   └─ Provider credentials
│
├─→ 4. Set Up Tools
│   ├─ RAG tool (built-in)
│   ├─ HTTP tool (built-in)
│   └─ Custom tools (if needed)
│
├─→ 5. Configure Agents
│   ├─ SupervisorAgent (routing)
│   └─ Domain Agents (invoice, guideline, support, etc.)
│
├─→ 6. Link Agents to Tools
│   └─ Create AgentTools with priority
│
├─→ 7. Set Up Permissions
│   ├─ TenantAgentPermission (which agents available)
│   └─ TenantToolPermission (which tools available)
│
├─→ 8. Create Widget Configuration
│   ├─ Theme, colors, position
│   ├─ Security (allowed domains)
│   └─ Behavior settings
│
└─→ 9. Test Setup
    ├─ Create test chat user
    └─ Send test messages
```

## 📝 Step 1: Create Tenant

### What is a Tenant?

A **Tenant** is an organization/customer that uses your chatbot system. Each tenant is:
- Completely isolated from other tenants
- Has their own agents, tools, LLM configurations
- Has their own users and chat sessions
- Has their own widget configuration
- Cannot access data from other tenants

### Create Tenant Record

**Database Query**:
```sql
INSERT INTO tenants (
    tenant_id,
    name,
    description,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),  -- Auto-generates UUID
    'Acme Corporation',
    'Invoice tracking and support chatbot',
    true,
    NOW(),
    NOW()
);
```

**Or via Admin API** (if endpoint exists):
```bash
curl -X POST \
  "http://localhost:8000/api/admin/tenants" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "description": "Invoice tracking and support chatbot",
    "is_active": true
  }'
```

**Response** (if API):
```json
{
  "tenant_id": "880e8400-e29b-41d4-a716-446655440003",
  "name": "Acme Corporation",
  "description": "Invoice tracking and support chatbot",
  "is_active": true,
  "created_at": "2025-11-19T10:00:00Z"
}
```

**Store this tenant_id**: `880e8400-e29b-41d4-a716-446655440003` (you'll use it for all subsequent steps)

---

## 🤖 Step 2: Configure LLM Models

### Decide Which LLM Provider to Use

| Provider | Models | Cost | Speed | Recommended For |
|----------|--------|------|-------|-----------------|
| OpenAI | GPT-4, GPT-4o-mini, GPT-3.5 | $$$ | Fast | Production, high quality |
| OpenRouter | 100+ models | Varies | Varies | Testing, cost optimization |
| Anthropic | Claude 3 family | $$ | Fast | High quality, reasoning |
| Local | Ollama, LLaMA | Free | Slow | Development, privacy |

### Register LLM Model in Database

**For OpenAI GPT-4o-mini**:
```sql
INSERT INTO llm_models (
    llm_model_id,
    provider,
    model_name,
    model_class,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'openai',
    'gpt-4o-mini',
    'ChatOpenAI',
    'Fast, cost-effective OpenAI model',
    true,
    NOW()
);
```

**For OpenRouter**:
```sql
INSERT INTO llm_models (
    llm_model_id,
    provider,
    model_name,
    model_class,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'openrouter',
    'openrouter/auto',
    'ChatOpenRouter',
    'Auto-selects best available model',
    true,
    NOW()
);
```

**For Anthropic Claude**:
```sql
INSERT INTO llm_models (
    llm_model_id,
    provider,
    model_name,
    model_class,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'anthropic',
    'claude-3-5-sonnet-20241022',
    'ChatAnthropic',
    'Advanced reasoning capabilities',
    true,
    NOW()
);
```

**Retrieve the llm_model_id** (you'll need this for next step):
```sql
SELECT llm_model_id FROM llm_models WHERE provider = 'openai' AND model_name = 'gpt-4o-mini';
-- Returns: 550e8400-e29b-41d4-a716-446655440010
```

---

## 🔐 Step 3: Create Tenant LLM Configuration

### Purpose

Each tenant has their own LLM settings:
- Which LLM model to use
- API keys/credentials
- Rate limits (requests per minute, tokens per minute)

### Create TenantLLMConfig

**Prerequisite Data**:
- `tenant_id`: From Step 1 (e.g., `880e8400-e29b-41d4-a716-446655440003`)
- `llm_model_id`: From Step 2 (e.g., `550e8400-e29b-41d4-a716-446655440010`)

**Database Query**:
```sql
INSERT INTO tenant_llm_configs (
    config_id,
    tenant_id,
    llm_model_id,
    api_key,  -- Encrypted
    api_key_encrypted,
    rate_limit_rpm,  -- Requests per minute
    rate_limit_tpm,  -- Tokens per minute
    temperature,  -- 0.0 = deterministic, 1.0 = creative
    max_tokens,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '880e8400-e29b-41d4-a716-446655440003',  -- tenant_id
    '550e8400-e29b-41d4-a716-446655440010',  -- llm_model_id (OpenAI)
    'sk-proj-...',  -- Your OpenAI API key (should be encrypted before storing)
    true,  -- api_key_encrypted flag
    100,  -- 100 requests per minute
    10000,  -- 10,000 tokens per minute
    0.7,  -- Balanced (not too deterministic, not too random)
    2000,  -- Max 2000 tokens per response
    NOW(),
    NOW()
);
```

**Important: API Key Encryption**

Never store raw API keys! Use Fernet encryption:

```python
from cryptography.fernet import Fernet
import os

# Load encryption key from environment
FERNET_KEY = os.getenv("FERNET_KEY")
cipher = Fernet(FERNET_KEY)

# Encrypt API key before inserting
raw_api_key = "sk-proj-xxxxx"
encrypted_api_key = cipher.encrypt(raw_api_key.encode()).decode()

# Store encrypted_api_key in database
# When retrieving: cipher.decrypt(encrypted_api_key.encode()).decode()
```

**How to Get API Keys**:

1. **OpenAI**:
   - Go to https://platform.openai.com/account/api-keys
   - Create new secret key
   - Copy and encrypt before storing

2. **OpenRouter**:
   - Go to https://openrouter.ai/keys
   - Create new API key
   - Use in tenant config

3. **Anthropic**:
   - Go to https://console.anthropic.com
   - Create API key
   - Configure in tenant settings

---

## 🛠️ Step 4: Set Up Tools

### Built-in Tools

Your system has these tools available:

**1. RAG Tool** (Knowledge Retrieval)
```sql
INSERT INTO tool_configs (
    tool_id,
    name,
    description,
    tool_type,
    is_active,
    input_schema,
    created_at
) VALUES (
    gen_random_uuid(),
    'rag_search',
    'Search knowledge base for information about company policies, invoices, and guidelines',
    'built-in',
    true,
    '{
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query for knowledge base"
        },
        "top_k": {
          "type": "integer",
          "description": "Number of results to return",
          "default": 3
        }
      },
      "required": ["query"]
    }'::jsonb,
    NOW()
);
```

**2. HTTP Tool** (External API Calls)
```sql
INSERT INTO tool_configs (
    tool_id,
    name,
    description,
    tool_type,
    is_active,
    input_schema,
    created_at
) VALUES (
    gen_random_uuid(),
    'http_request',
    'Make HTTP requests to external APIs',
    'built-in',
    true,
    '{
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "API endpoint URL"
        },
        "method": {
          "type": "string",
          "enum": ["GET", "POST", "PUT", "DELETE"],
          "default": "GET"
        },
        "body": {
          "type": "object",
          "description": "Request body (for POST/PUT)"
        }
      },
      "required": ["url"]
    }'::jsonb,
    NOW()
);
```

### Custom Tools (Example: Invoice Lookup)

```sql
INSERT INTO tool_configs (
    tool_id,
    name,
    description,
    tool_type,
    handler_class,
    is_active,
    input_schema,
    created_at
) VALUES (
    gen_random_uuid(),
    'lookup_invoice',
    'Look up invoice status, amount, and tracking information',
    'custom',
    'src.tools.invoice.InvoiceLookupTool',
    true,
    '{
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string",
          "description": "Invoice ID (format: INV-XXXX-XXXXX)"
        }
      },
      "required": ["invoice_id"]
    }'::jsonb,
    NOW()
);
```

**Get tool IDs** (you'll use these when linking to agents):
```sql
SELECT tool_id, name FROM tool_configs
WHERE name IN ('rag_search', 'http_request', 'lookup_invoice');
```

---

## 🤖 Step 5: Configure Agents

### Create SupervisorAgent

The SupervisorAgent routes messages to appropriate domain agents.

```sql
INSERT INTO agent_configs (
    agent_id,
    name,
    prompt_template,
    llm_model_id,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'SupervisorAgent',
    'You are a Supervisor Agent that routes user queries to specialized domain agents.

Available agents will be provided at runtime.

Your task:
1. Analyze the user message carefully
2. Detect if the message contains ONE or MULTIPLE distinct intents
3. Respond with ONLY the agent name or status code

Detection Rules:
- SINGLE INTENT: User asks ONE clear question → respond with agent name
- MULTIPLE INTENTS: User asks 2+ DIFFERENT questions → respond with "MULTI_INTENT"
- UNCLEAR: Ambiguous or not related to any agent → respond with "UNCLEAR"

Response Format:
Respond with ONLY ONE of these: agent_name, MULTI_INTENT, or UNCLEAR
NO explanations, NO additional text.',
    '550e8400-e29b-41d4-a716-446655440010',  -- llm_model_id
    'Routes messages to appropriate domain agents',
    true,
    NOW()
);
```

### Create Domain Agents

**InvoiceAgent** (handles invoice-related queries):
```sql
INSERT INTO agent_configs (
    agent_id,
    name,
    prompt_template,
    llm_model_id,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'InvoiceAgent',
    'You are an expert invoice assistant. Help users track invoices, check status, and resolve billing issues.

When a user asks about an invoice:
1. Use the lookup_invoice tool to find status and details
2. Provide clear information about amount, date, and tracking
3. Help with payment issues or disputes if needed

Be professional and helpful.',
    '550e8400-e29b-41d4-a716-446655440010',  -- llm_model_id
    'Specialized agent for invoice management',
    true,
    NOW()
);
```

**GuidelineAgent** (company policies and guidelines):
```sql
INSERT INTO agent_configs (
    agent_id,
    name,
    prompt_template,
    llm_model_id,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'GuidelineAgent',
    'You are a company guidelines assistant. Help users understand company policies, procedures, and guidelines.

When a user asks about policies:
1. Search the knowledge base using the rag_search tool
2. Provide clear, accurate information
3. Refer to official documentation when available

Be concise and helpful.',
    '550e8400-e29b-41d4-a716-446655440010',  -- llm_model_id
    'Provides company guidelines and policies',
    true,
    NOW()
);
```

**SupportAgent** (escalation and general support):
```sql
INSERT INTO agent_configs (
    agent_id,
    name,
    prompt_template,
    llm_model_id,
    description,
    is_active,
    created_at
) VALUES (
    gen_random_uuid(),
    'SupportAgent',
    'You are a support agent. Help users with general inquiries and escalate complex issues to human support.

When helping users:
1. Try to solve the issue if it is general knowledge
2. If specialized help is needed, offer to escalate to human support
3. Collect relevant information for escalation

Be empathetic and professional.',
    '550e8400-e29b-41d4-a716-446655440010',  -- llm_model_id
    'General support and escalation agent',
    true,
    NOW()
);
```

**Store agent IDs** (you'll need these for linking to tools):
```sql
SELECT agent_id, name FROM agent_configs
WHERE name IN ('InvoiceAgent', 'GuidelineAgent', 'SupportAgent');
```

---

## 🔗 Step 6: Link Agents to Tools

### Purpose

Specify which tools each agent can use, with priority ordering.

**Priority**: Lower numbers = higher priority (tool is used first)

### Link InvoiceAgent to Tools

```sql
-- RAG tool (priority 1 - highest)
INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
VALUES (
    'agent_id_for_InvoiceAgent',
    'tool_id_for_rag_search',
    1,
    NOW()
);

-- Lookup invoice tool (priority 2)
INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
VALUES (
    'agent_id_for_InvoiceAgent',
    'tool_id_for_lookup_invoice',
    2,
    NOW()
);

-- HTTP tool (priority 3 - for external APIs)
INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
VALUES (
    'agent_id_for_InvoiceAgent',
    'tool_id_for_http_request',
    3,
    NOW()
);
```

### Link GuidelineAgent to Tools

```sql
-- RAG tool (priority 1)
INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
VALUES (
    'agent_id_for_GuidelineAgent',
    'tool_id_for_rag_search',
    1,
    NOW()
);
```

### Link SupportAgent to Tools

```sql
-- HTTP tool (priority 1 - for escalation tickets)
INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
VALUES (
    'agent_id_for_SupportAgent',
    'tool_id_for_http_request',
    1,
    NOW()
);

-- RAG tool (priority 2)
INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
VALUES (
    'agent_id_for_SupportAgent',
    'tool_id_for_rag_search',
    2,
    NOW()
);
```

---

## 🔐 Step 7: Set Up Permissions

### Create Tenant-Agent Permissions

**Grant tenant access to agents**:

```sql
-- InvoiceAgent
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled, created_at)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',  -- tenant_id
    'agent_id_for_InvoiceAgent',
    true,
    NOW()
);

-- GuidelineAgent
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled, created_at)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',
    'agent_id_for_GuidelineAgent',
    true,
    NOW()
);

-- SupportAgent
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled, created_at)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',
    'agent_id_for_SupportAgent',
    true,
    NOW()
);
```

### Create Tenant-Tool Permissions

**Grant tenant access to tools**:

```sql
-- RAG Search
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled, created_at)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',
    'tool_id_for_rag_search',
    true,
    NOW()
);

-- HTTP Request
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled, created_at)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',
    'tool_id_for_http_request',
    true,
    NOW()
);

-- Invoice Lookup
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled, created_at)
VALUES (
    '880e8400-e29b-41d4-a716-446655440003',
    'tool_id_for_lookup_invoice',
    true,
    NOW()
);
```

### Verify Permissions Setup

```sql
-- Check which agents are available to tenant
SELECT ac.name, ac.description
FROM agent_configs ac
JOIN tenant_agent_permissions tap ON ac.agent_id = tap.agent_id
WHERE tap.tenant_id = '880e8400-e29b-41d4-a716-446655440003'
  AND tap.enabled = true;

-- Check which tools are available to tenant
SELECT tc.name, tc.description
FROM tool_configs tc
JOIN tenant_tool_permissions ttp ON tc.tool_id = ttp.tool_id
WHERE ttp.tenant_id = '880e8400-e29b-41d4-a716-446655440003'
  AND ttp.enabled = true;
```

---

## 🎨 Step 8: Create Widget Configuration

### Purpose

Widget configuration controls how the chat widget appears on customer websites.

### Create TenantWidgetConfig

```sql
INSERT INTO tenant_widget_configs (
    config_id,
    tenant_id,
    widget_key,
    widget_secret,
    theme,
    primary_color,
    position,
    auto_open,
    welcome_message,
    placeholder_text,
    allowed_domains,
    max_session_duration,
    rate_limit_per_minute,
    enable_conversation_history,
    embed_script_url,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '880e8400-e29b-41d4-a716-446655440003',  -- tenant_id
    'widget_' || SUBSTR(gen_random_uuid()::text, 1, 20),  -- Generate widget_key
    'encrypted_secret_key',  -- Should be encrypted
    'light',  -- Theme: light, dark, auto
    '#3B82F6',  -- Primary color (blue)
    'bottom-right',  -- Position
    false,  -- Don't auto-open
    'Hi! How can we help you today? 👋',  -- Welcome message
    'Ask me anything...',  -- Input placeholder
    '["example.com", "app.example.com", "*.example.com"]'::jsonb,  -- Allowed domains
    3600,  -- Session timeout: 1 hour
    20,  -- Rate limit: 20 messages per minute
    true,  -- Show conversation history
    'https://cdn.example.com/widgets/chat-widget-v1.0.js',
    NOW(),
    NOW()
);
```

### Retrieve Widget Information

```sql
SELECT
    config_id,
    widget_key,
    embed_script_url,
    embed_code_snippet
FROM tenant_widget_configs
WHERE tenant_id = '880e8400-e29b-41d4-a716-446655440003';
```

### Embed Code for Customer Website

The system should auto-generate this, or you can provide to customer:

```html
<!-- Copy this to your website (in <head> or before </body>) -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.example.com/widgets/chat-widget-v1.0.js';
    script.setAttribute('data-widget-key', 'widget_550e8400e29b41d4');
    script.setAttribute('data-tenant-id', '880e8400-e29b-41d4-a716-446655440003');
    script.setAttribute('data-position', 'bottom-right');
    script.setAttribute('data-theme', 'light');
    document.head.appendChild(script);
  })();
</script>
```

---

## 👤 Step 9: Create Test Chat User

### Purpose

Before testing the chat, you need to create a ChatUser for your tenant.

### Create ChatUser

```sql
INSERT INTO chat_users (
    user_id,
    tenant_id,
    user_email,
    user_name,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '880e8400-e29b-41d4-a716-446655440003',  -- tenant_id
    'testuser@example.com',
    'Test User',
    true,
    NOW(),
    NOW()
);
```

**Store this user_id**: `550e8400-e29b-41d4-a716-446655440000` (you'll use this for testing)

---

## ✅ Step 10: Test the Complete Setup

### Test 1: Basic Chat Message

**Using cURL**:
```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is my invoice status?",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": null,
    "agent_name": null,
    "metadata": {}
  }'
```

**Expected Response**:
```json
{
  "session_id": "660e8400-e29b-41d4-a716-446655440111",
  "message_id": "770e8400-e29b-41d4-a716-446655440222",
  "response": {
    "text": "I can help you check your invoice status. Could you provide the invoice ID?"
  },
  "agent": "InvoiceAgent",
  "intent": "check_invoice_status",
  "metadata": {
    "status": "success",
    "duration_ms": 1234.5
  }
}
```

### Test 2: Direct Agent Routing

```bash
curl -X POST \
  "http://localhost:8000/api/880e8400-e29b-41d4-a716-446655440003/test/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your return policy?",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_name": "GuidelineAgent",
    "metadata": {}
  }'
```

**Expected**: GuidelineAgent responds with knowledge base information

### Test 3: Verify Database Entries

```sql
-- Check chat session was created
SELECT * FROM chat_sessions
WHERE tenant_id = '880e8400-e29b-41d4-a716-446655440003'
ORDER BY created_at DESC LIMIT 1;

-- Check messages were saved
SELECT role, content FROM messages
WHERE session_id = 'session_id_from_response'
ORDER BY created_at;

-- Check agent selection was logged
SELECT agent, intent FROM messages
WHERE session_id = 'session_id_from_response'
AND role = 'assistant';
```

---

## 📋 Complete Setup Checklist

### Phase 1: Foundation
- [ ] Created Tenant record
- [ ] Stored `tenant_id`
- [ ] Created LLM Model record
- [ ] Stored `llm_model_id`
- [ ] Created TenantLLMConfig with API key
- [ ] Verified LLM credentials are encrypted

### Phase 2: Tools & Agents
- [ ] Verified/created RAG tool
- [ ] Verified/created HTTP tool
- [ ] Created/verified custom tools (e.g., lookup_invoice)
- [ ] Stored tool IDs
- [ ] Created SupervisorAgent
- [ ] Created InvoiceAgent
- [ ] Created GuidelineAgent
- [ ] Created SupportAgent
- [ ] Stored agent IDs

### Phase 3: Linking & Permissions
- [ ] Linked InvoiceAgent to tools (RAG, lookup_invoice, HTTP)
- [ ] Linked GuidelineAgent to tools (RAG)
- [ ] Linked SupportAgent to tools (HTTP, RAG)
- [ ] Created TenantAgentPermission for all 3 agents
- [ ] Created TenantToolPermission for all tools
- [ ] Verified permissions with SELECT queries

### Phase 4: Widget & Testing
- [ ] Created TenantWidgetConfig
- [ ] Generated embed code
- [ ] Created ChatUser for testing
- [ ] Tested chat endpoint (basic message)
- [ ] Tested direct agent routing
- [ ] Verified database entries (sessions, messages)
- [ ] Checked logs for errors

### Phase 5: Production Ready
- [ ] Provided widget embed code to customer
- [ ] Customer added widget to their website
- [ ] Tested widget from customer's website
- [ ] Verified domain whitelist works
- [ ] Set up monitoring/logging
- [ ] Documented tenant credentials and setup

---

## 🔧 Quick Reference: IDs You'll Need

Create a setup document like this for each tenant:

```
TENANT SETUP SUMMARY
===================

Tenant Name: Acme Corporation
Setup Date: 2025-11-19

IDs:
- Tenant ID: 880e8400-e29b-41d4-a716-446655440003
- LLM Model ID: 550e8400-e29b-41d4-a716-446655440010
- Test User ID: 550e8400-e29b-41d4-a716-446655440000
- Widget Key: widget_550e8400e29b41d4

Agents Enabled:
- InvoiceAgent (agent_id_xxx)
- GuidelineAgent (agent_id_yyy)
- SupportAgent (agent_id_zzz)

Widget Configuration:
- Embed Code: <script>...</script>
- Allowed Domains: example.com, app.example.com
- Theme: light
- Position: bottom-right

API Testing:
POST /api/880e8400-e29b-41d4-a716-446655440003/test/chat

Support Contact: __________
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Tenant not found"
**Cause**: Tenant ID doesn't exist in database
**Solution**:
```sql
SELECT tenant_id, name FROM tenants WHERE name LIKE '%Acme%';
-- Verify the correct tenant_id
```

### Issue 2: "Agent not found or inactive"
**Cause**: Agent doesn't exist or `is_active = false`
**Solution**:
```sql
SELECT agent_id, name, is_active FROM agent_configs WHERE name = 'InvoiceAgent';
-- Update if needed: UPDATE agent_configs SET is_active = true WHERE name = 'InvoiceAgent';
```

### Issue 3: "Chat user not found"
**Cause**: ChatUser doesn't exist for this tenant+user combination
**Solution**:
```sql
INSERT INTO chat_users (user_id, tenant_id, user_name, is_active)
VALUES (gen_random_uuid(), '880e8400-e29b-41d4-a716-446655440003', 'Test User', true);
```

### Issue 4: "Agent not available for tenant"
**Cause**: TenantAgentPermission missing or disabled
**Solution**:
```sql
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled)
VALUES ('880e8400-e29b-41d4-a716-446655440003', 'agent_id', true);
```

### Issue 5: API returns "Internal server error"
**Cause**: Check logs for detailed error
**Solution**:
```bash
# Check application logs
docker logs <backend_container_name>

# Or check database connection
psql -h localhost -U agenthub -d agenthub -c "SELECT 1;"
```

---

## 📞 After Setup: Customer Handoff

**Provide to your customer**:
1. ✅ Embed code snippet (HTML to copy)
2. ✅ Documentation on using the widget
3. ✅ List of available agents and their capabilities
4. ✅ Support contact information
5. ✅ Rate limiting information (20 messages/minute default)
6. ✅ Domain whitelist confirmation
7. ✅ Links to API documentation

---

**Complete! Your tenant is now fully configured and ready for use.** 🎉

This guide ensures:
- Tenant isolation (no data leakage)
- Proper LLM configuration (credentials encrypted)
- Agent-tool linking with priorities
- Permission-based access control
- Widget embedding on customer site
- Full testing and verification

---

**Last Updated**: November 19, 2025
**Template for**: New Tenant Onboarding
**Estimated Setup Time**: 30-60 minutes (excluding custom tool development)
