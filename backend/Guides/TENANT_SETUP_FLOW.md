# Tenant Setup Flow Guide

**Purpose**: Step-by-step guide for configuring a new tenant in the AgentHub Multi-Tenant Chatbot system

**Last Updated**: 2025-11-25

---

## Overview

Setting up a new tenant involves:
1. Creating tenant record and base configuration
2. Assigning LLM provider and encrypting API key
3. Granting agent and tool permissions
4. Uploading knowledge base documents
5. Testing chat functionality

**Time Required**: 10-15 minutes per tenant

---

## Prerequisites

- Backend server running (`python src/main.py`)
- Database migrations applied (`alembic upgrade head`)
- PostgreSQL with pgvector extension enabled
- Redis running for caching
- Admin credentials or `DISABLE_AUTH=true` for testing

---

## Step 1: Create Tenant

### API Call

```http
POST /api/admin/tenants
Content-Type: application/json

{
  "name": "Acme Corp",
  "domain": "acmecorp.com",
  "status": "active"
}
```

### Response

```json
{
  "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Acme Corp",
  "domain": "acmecorp.com",
  "status": "active",
  "created_at": "2025-11-25T10:00:00Z"
}
```

### Database State

**Table: `tenants`**
```sql
SELECT tenant_id, name, domain, status FROM tenants
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Result:
-- tenant_id                              | name       | domain         | status
-- a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Acme Corp  | acmecorp.com   | active
```

---

## Step 2: Configure LLM Provider

### API Call

```http
POST /api/admin/tenants/{tenant_id}/llm-config
Content-Type: application/json

{
  "llm_model_id": "existing-model-uuid",  // From llm_models table
  "api_key": "sk-your-actual-api-key-here",
  "rate_limit_rpm": 60,
  "rate_limit_tpm": 10000
}
```

### What Happens Behind the Scenes

1. **Encryption** (`utils/encryption.py`):
   ```python
   from cryptography.fernet import Fernet

   # Using FERNET_KEY from .env
   cipher = Fernet(settings.FERNET_KEY)
   encrypted_key = cipher.encrypt(api_key.encode())
   ```

2. **Database Insert**:
   ```sql
   INSERT INTO tenant_llm_configs (tenant_id, llm_model_id, encrypted_api_key, rate_limit_rpm, rate_limit_tpm)
   VALUES ('a1b2c3d4...', 'model-uuid', 'encrypted-blob', 60, 10000);
   ```

### Verify

```sql
SELECT tenant_id, llm_model_id, rate_limit_rpm, rate_limit_tpm
FROM tenant_llm_configs
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- encrypted_api_key will be a Fernet-encrypted blob (not readable)
```

### Available LLM Models

Check what models are available:

```http
GET /api/admin/llm-models
```

Common providers:
- `openrouter` - OpenRouter API (multi-model)
- `openai` - OpenAI GPT models
- `anthropic` - Claude models

---

## Step 3: Assign Agents to Tenant

Agents are **pre-configured** in `agent_configs` table. You grant tenants permission to use specific agents.

### List Available Agents

```http
GET /api/admin/agents
```

Response:
```json
[
  {
    "agent_id": "agent-tracking-uuid",
    "name": "TrackingAgent",
    "description": "Handles order tracking queries",
    "is_active": true
  },
  {
    "agent_id": "agent-invoice-uuid",
    "name": "InvoiceAgent",
    "description": "Handles invoice inquiries",
    "is_active": true
  }
]
```

### Grant Agent Permission

```http
POST /api/admin/tenants/{tenant_id}/agents
Content-Type: application/json

{
  "agent_id": "agent-tracking-uuid",
  "enabled": true
}
```

### Database State

**Table: `tenant_agent_permissions`**
```sql
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled)
VALUES ('a1b2c3d4...', 'agent-tracking-uuid', true);
```

### Verify

```sql
SELECT tap.tenant_id, ac.name, tap.enabled
FROM tenant_agent_permissions tap
JOIN agent_configs ac ON tap.agent_id = ac.agent_id
WHERE tap.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Result shows which agents this tenant can use
```

### What This Means at Runtime

When a chat message comes in for this tenant:

1. **SupervisorAgent** (`services/supervisor_agent.py`) loads available agents:
   ```python
   def load_available_agents(tenant_id):
       agents = db.query(AgentConfig).join(
           TenantAgentPermission
       ).filter(
           TenantAgentPermission.tenant_id == tenant_id,
           TenantAgentPermission.enabled == True
       ).all()
   ```

2. **Only** TrackingAgent (and any other permitted agents) will be available for intent routing

---

## Step 4: Assign Tools to Tenant

Tools are also pre-configured. Grant permission per tenant.

### List Available Tools

```http
GET /api/admin/tools
```

Response:
```json
[
  {
    "tool_id": "tool-rag-uuid",
    "name": "RAGTool",
    "base_tool_id": "base-tool-rag-uuid",
    "category": "knowledge",
    "description": "Retrieves relevant documents from knowledge base"
  },
  {
    "tool_id": "tool-http-uuid",
    "name": "HTTPTool",
    "base_tool_id": "base-tool-http-uuid",
    "category": "api",
    "description": "Makes HTTP API calls to external systems"
  }
]
```

### Grant Tool Permission

```http
POST /api/admin/tenants/{tenant_id}/tools
Content-Type: application/json

{
  "tool_id": "tool-rag-uuid",
  "enabled": true
}
```

### Database State

**Table: `tenant_tool_permissions`**
```sql
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled)
VALUES ('a1b2c3d4...', 'tool-rag-uuid', true);
```

### What This Means at Runtime

When a domain agent needs to execute a tool:

1. **ToolLoader** (`services/tool_loader.py`) loads permitted tools:
   ```python
   def load_tools_for_agent(agent_id, tenant_id):
       tools = db.query(ToolConfig).join(
           AgentTools
       ).join(
           TenantToolPermission
       ).filter(
           AgentTools.agent_id == agent_id,
           TenantToolPermission.tenant_id == tenant_id,
           TenantToolPermission.enabled == True
       ).all()
   ```

2. **Only** permitted tools are available to the agent

---

## Step 5: Upload Knowledge Base Documents

This is what makes RAG (Retrieval-Augmented Generation) work.

### Upload Document

```http
POST /api/admin/knowledge/upload
Content-Type: multipart/form-data

tenant_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
files: product_catalog.pdf, faq_document.docx
```

### What Happens Behind the Scenes

1. **Document Processing** (`services/document_processor.py`):
   ```python
   # Extract text from PDF/DOCX
   text = extract_text_from_pdf(file)

   # Split into chunks (e.g., 500 tokens per chunk)
   chunks = split_text(text, chunk_size=500)
   ```

2. **Embedding Generation** (`services/embedding_service.py`):
   ```python
   from sentence_transformers import SentenceTransformer

   model = SentenceTransformer('all-MiniLM-L6-v2')  # 384 dimensions
   embeddings = model.encode(chunks)
   ```

3. **Vector Storage** (`services/rag_service.py`):
   ```python
   # Store in PostgreSQL pgvector with tenant metadata
   for chunk, embedding in zip(chunks, embeddings):
       vector_store.add_documents([
           Document(
               page_content=chunk,
               metadata={
                   "tenant_id": str(tenant_id),  # CRITICAL for isolation
                   "document_id": doc_id,
                   "filename": "product_catalog.pdf",
                   "chunk_index": i
               }
           )
       ], embeddings=[embedding])
   ```

### Database State

**PgVector Collection**: `knowledge_documents`

```sql
-- Check document count for tenant
SELECT COUNT(*) FROM langchain_pg_embedding
WHERE cmetadata->>'tenant_id' = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- View sample documents
SELECT
    id,
    document,  -- The text chunk
    cmetadata->>'filename' as filename,
    cmetadata->>'tenant_id' as tenant_id
FROM langchain_pg_embedding
WHERE cmetadata->>'tenant_id' = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
LIMIT 5;
```

### Verify Upload

```http
GET /api/admin/knowledge/stats?tenant_id={tenant_id}
```

Response:
```json
{
  "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "document_count": 2,
  "chunk_count": 45,
  "total_size_bytes": 1048576
}
```

---

## Step 6: Test Chat Functionality

Now the tenant is fully configured. Test the chat flow.

### Create Chat Session

```http
POST /api/{tenant_id}/chat
Content-Type: application/json

{
  "message": "What products do you offer?",
  "user_id": "test-user-123"
}
```

### What Happens (Complete Flow)

1. **Authentication** (`middleware/auth.py`):
   ```python
   # Extract tenant_id from JWT token (or use test tenant if DISABLE_AUTH=true)
   tenant_id = get_tenant_id_from_jwt(request.headers['Authorization'])
   ```

2. **Session Creation/Retrieval** (`api/chat.py`):
   ```python
   # Find existing session or create new one
   session = db.query(ChatSession).filter(
       ChatSession.tenant_id == tenant_id,
       ChatSession.user_id == user_id
   ).first()

   if not session:
       session = ChatSession(tenant_id=tenant_id, user_id=user_id)
       db.add(session)
   ```

3. **Message Storage**:
   ```sql
   INSERT INTO messages (session_id, role, content, timestamp)
   VALUES (session.session_id, 'user', 'What products do you offer?', NOW());
   ```

4. **Intent Detection** (`services/supervisor_agent.py`):
   ```python
   # SupervisorAgent analyzes intent and routes to appropriate domain agent
   available_agents = load_available_agents(tenant_id)  # Only permitted agents

   intent = llm.invoke([
       {"role": "system", "content": "Detect user intent from available agents"},
       {"role": "user", "content": message}
   ])

   selected_agent = match_intent_to_agent(intent, available_agents)
   ```

5. **Domain Agent Execution** (`services/domain_agents.py`):
   ```python
   # Load tools for this agent + tenant
   tools = load_tools_for_agent(agent_id=selected_agent.agent_id, tenant_id=tenant_id)

   # If RAGTool is enabled, it will retrieve from knowledge base
   if "RAGTool" in tools:
       relevant_docs = rag_service.retrieve_documents(
           query=message,
           tenant_id=tenant_id,  # Filtered by tenant metadata
           top_k=5
       )

   # Generate response using agent's prompt + tools + docs
   response = domain_agent.invoke(message, tools, context=relevant_docs)
   ```

6. **Response Storage**:
   ```sql
   INSERT INTO messages (session_id, role, content, timestamp)
   VALUES (session.session_id, 'assistant', response, NOW());
   ```

### Response

```json
{
  "session_id": "session-uuid",
  "message": "We offer the following products: [info from uploaded documents]...",
  "intent": "product_inquiry",
  "agent_used": "TrackingAgent",
  "tools_called": ["RAGTool"],
  "metadata": {
    "documents_retrieved": 3,
    "tokens_used": 450
  }
}
```

### Verify in Database

```sql
-- Check session was created
SELECT session_id, tenant_id, user_id, created_at
FROM sessions
WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Check messages were stored
SELECT m.message_id, m.role, m.content, m.timestamp
FROM messages m
JOIN sessions s ON m.session_id = s.session_id
WHERE s.tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY m.timestamp DESC
LIMIT 10;
```

---

## Step 7: Verify Multi-Tenant Isolation

**Critical Test**: Ensure this tenant cannot access other tenants' data.

### Test 1: Knowledge Base Isolation

Create another tenant and upload different documents:

```http
POST /api/admin/tenants
{
  "name": "Beta Corp",
  "domain": "betacorp.com"
}
```

Upload different document to Beta Corp with different content.

Then query from Acme Corp:

```http
POST /api/{acme_tenant_id}/chat
{
  "message": "Tell me about [content only in Beta Corp's documents]"
}
```

**Expected**: RAG should NOT retrieve Beta Corp's documents. Response should be "I don't have information about that."

**Verify in logs**:
```
# Should see metadata filtering
rag_service.py: Retrieving documents with filter: {"tenant_id": "acme-tenant-uuid"}
```

### Test 2: Session Isolation

List sessions for Acme Corp:

```http
GET /api/{acme_tenant_id}/sessions?user_id=test-user-123
```

**Expected**: Only see sessions for Acme Corp, NOT Beta Corp's sessions.

### Test 3: LLM API Key Isolation

Each tenant should use their own encrypted API key:

```python
# In llm_manager.py, check logs:
logger.info("Using LLM for tenant", extra={"tenant_id": tenant_id})

# Each tenant's requests should use their configured LLM model
```

---

## Complete Setup Checklist

Use this checklist for each new tenant:

- [ ] **Step 1**: Create tenant record (`POST /api/admin/tenants`)
- [ ] **Step 2**: Configure LLM with encrypted API key (`POST /api/admin/tenants/{id}/llm-config`)
- [ ] **Step 3**: Grant agent permissions (1+ agents)
- [ ] **Step 4**: Grant tool permissions (at minimum: RAGTool)
- [ ] **Step 5**: Upload knowledge base documents (`POST /api/admin/knowledge/upload`)
- [ ] **Step 6**: Test chat functionality (`POST /api/{tenant_id}/chat`)
- [ ] **Step 7**: Verify isolation (knowledge base, sessions, API keys)
- [ ] **Verify**: Check database state for all tables
- [ ] **Document**: Record tenant_id, domain, assigned agents/tools

---

## Troubleshooting

### Issue: "Tenant not found"

**Check**:
```sql
SELECT * FROM tenants WHERE tenant_id = 'your-tenant-uuid';
```

**Solution**: Verify tenant_id is correct UUID from Step 1 response.

### Issue: "No agents available"

**Check**:
```sql
SELECT * FROM tenant_agent_permissions WHERE tenant_id = 'your-tenant-uuid';
```

**Solution**: Ensure you granted at least one agent permission in Step 3.

### Issue: "Knowledge base returns no results"

**Check**:
```sql
SELECT COUNT(*) FROM langchain_pg_embedding
WHERE cmetadata->>'tenant_id' = 'your-tenant-uuid';
```

**Solution**:
- Verify documents were uploaded (Step 5)
- Check pgvector extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'vector';`
- Verify embedding service is working (check logs for errors)

### Issue: "Cross-tenant data leakage"

**Check**:
```python
# Enable debug logging in rag_service.py
logger.debug("Retrieved documents", extra={
    "count": len(results),
    "tenant_ids": [doc.metadata.get("tenant_id") for doc, _ in results]
})
```

**Solution**:
- All tenant_ids in results should match the requesting tenant
- If not, there's a bug in metadata filtering (file issue)

### Issue: "Rate limit exceeded"

**Note**: Rate limiting is **currently stored but not enforced** (see CHANGELOG_FIXES.md Issue #6)

**Check**:
```sql
SELECT rate_limit_rpm, rate_limit_tpm FROM tenant_llm_configs
WHERE tenant_id = 'your-tenant-uuid';
```

**Workaround**: Until Phase 2 fixes are implemented, rate limits are not enforced.

---

## Database Schema Quick Reference

### Key Tables for Tenant Setup

```
tenants (1)
  ├─ tenant_llm_configs (1:1)
  ├─ tenant_agent_permissions (1:*)
  ├─ tenant_tool_permissions (1:*)
  ├─ tenant_widget_configs (1:1)
  └─ sessions (1:*)
       └─ messages (1:*)

agent_configs (shared)
  ├─ agent_tools (junction) → tool_configs (shared)
  └─ tenant_agent_permissions (per-tenant)

tool_configs (shared)
  ├─ agent_tools (junction)
  └─ tenant_tool_permissions (per-tenant)
```

---

## API Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/tenants` | POST | Create tenant |
| `/api/admin/tenants/{id}/llm-config` | POST | Set LLM config |
| `/api/admin/tenants/{id}/agents` | POST | Grant agent permission |
| `/api/admin/tenants/{id}/tools` | POST | Grant tool permission |
| `/api/admin/knowledge/upload` | POST | Upload documents |
| `/api/{tenant_id}/chat` | POST | Send chat message |
| `/api/{tenant_id}/sessions` | GET | List sessions |
| `/api/admin/agents` | GET | List available agents |
| `/api/admin/tools` | GET | List available tools |
| `/api/admin/knowledge/stats` | GET | Knowledge base stats |

---

## Next Steps After Setup

1. **Monitor logs** for errors during chat interactions
2. **Review session history** to verify conversations are stored
3. **Test edge cases** (empty knowledge base, unknown intents, etc.)
4. **Configure widget** (if using embeddable widget feature)
5. **Set up monitoring** (Phase 2 will add Prometheus metrics)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-25
**Maintained By**: Engineering Team

For backend setup from scratch, see: [BACKEND_SETUP.md](./BACKEND_SETUP.md)
For configuration reference, see: [CONFIGURATION.md](./CONFIGURATION.md)
