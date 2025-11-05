# ITL_PGVector Database Initialization Guide

Complete guide for initializing and seeding the ITL_PGVector database with all required data.

## Quick Start

### Fresh Database Setup (Development)

```bash
# Full initialization (schema + seed + demo tenant + PDFs)
python setup/init_database.py --full

# Or with custom config
python setup/init_database.py --full --config setup/config.yaml
```

This single command will:
1. ✅ Create database schema (14 tables via Alembic)
2. ✅ Seed base data (LLM models, tools, agents, formats)
3. ✅ Create demo tenant
4. ✅ Ingest sample PDF documents

### Database with Existing Schema

```bash
# Seed only (assumes schema exists)
python setup/init_database.py --seed-only
```

### Add Demo Tenant to Existing Database

```bash
# Create demo tenant and ingest PDFs
python setup/init_database.py --demo-only
```

---

## Configuration

All setup is driven by `setup/config.yaml`. Edit this file to customize:

### Database Configuration

```yaml
database:
  url: "postgresql://postgres:123456@localhost:5432/chatbot_db"
  pool_size: 20
  max_overflow: 10
```

**Environment Variable Override:**
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
python setup/init_database.py --full
```

### Demo Tenant Configuration

Customize the demo tenant in `config.yaml`:

```yaml
demo_tenant:
  enabled: true
  tenant_info:
    name: "Demo Company"
    domain: "demo.agenthub.local"
    status: "active"

  llm_config:
    provider: "openrouter"
    model_id: "gpt-4o-mini"
    api_key: "${OPENROUTER_API_KEY}"  # Reads from env var
```

**Provide API Key:**
```bash
export OPENROUTER_API_KEY="sk-or-v1-xxx"
python setup/init_database.py --full
```

### LLM Models

Customize available LLM models:

```yaml
base_data:
  llm_models:
    - id: "gpt-4o-mini"
      name: "GPT-4o Mini"
      provider: "openrouter"
      model_name: "openai/gpt-4o-mini"
      context_window: 128000
      is_active: true

    - id: "claude-3.5-sonnet"
      name: "Claude 3.5 Sonnet"
      provider: "openrouter"
      model_name: "anthropic/claude-3.5-sonnet"
      context_window: 200000
      is_active: true
```

### Tools

Define which tools are available:

```yaml
base_data:
  base_tools:
    - id: "rag"
      name: "RAG Knowledge Base Search"
      description: "Search tenant's knowledge base"
      handler_class: "tools.rag.RAGTool"
      is_active: true

    - id: "http_get"
      name: "HTTP GET Request"
      description: "Make HTTP GET requests"
      handler_class: "tools.http.HTTPGetTool"
      is_active: true
```

### Agents

Configure available agents:

```yaml
base_data:
  agents:
    - id: "agent_guidance"
      name: "AgentGuidance"
      description: "Provides guidance using RAG"
      llm_model_id: "gpt-4o-mini"
      prompt_template: |
        You are a helpful assistant...
      is_active: true
```

### RAG Documents

Specify PDFs to ingest for demo tenant:

```yaml
rag:
  enabled: true
  documents:
    - path: "setup/sample_docs/guide.pdf"
      name: "Product Guide"
      description: "General usage guide"

    - path: "setup/sample_docs/faq.pdf"
      name: "FAQs"
      description: "Common questions"
```

---

## Initialization Scripts

### init_database.py (Main Orchestrator)

Coordinates the complete initialization process.

**Usage:**
```bash
python setup/init_database.py [OPTIONS]

Options:
  --full              Full initialization (migrations + seed + demo + pdfs)
  --schema-only       Migrations only
  --seed-only         Seed only (assume schema exists)
  --demo-only         Demo tenant only
  --config PATH       Config file path (default: setup/config.yaml)
  --verbose           Show detailed progress
```

**Example:**
```bash
# Full setup with custom config
python setup/init_database.py --full --config my_config.yaml --verbose

# Production setup (schema only)
python setup/init_database.py --schema-only

# Add demo later
python setup/init_database.py --demo-only
```

### seed_base_data.py

Seeds LLM models, tools, agents, and output formats.

**Usage:**
```bash
python setup/seed_base_data.py [--config PATH]
```

**Features:**
- Idempotent (checks if data exists before inserting)
- Creates LLM models, tools, agents, output formats
- Reports statistics (created, skipped, errors)

**Example:**
```bash
python setup/seed_base_data.py
python setup/seed_base_data.py --config setup/config.yaml
```

### seed_demo_tenant.py

Creates demo tenant with full configuration.

**Usage:**
```bash
python setup/seed_demo_tenant.py [--config PATH]
```

**What it creates:**
- Tenant record (name, domain)
- LLM configuration (with encrypted API key)
- Widget configuration (theme, colors, messages)
- Agent permissions
- Tool permissions
- RAG collection setup

**Example:**
```bash
export OPENROUTER_API_KEY="sk-or-v1-xxx"
python setup/seed_demo_tenant.py
```

### ingest_demo_pdfs.py

Ingests sample PDFs into demo tenant's knowledge base.

**Usage:**
```bash
python setup/ingest_demo_pdfs.py [--config PATH] [--tenant-id UUID]
```

**Features:**
- Validates file paths exist
- Processes each PDF (load → chunk → embed)
- Shows progress for each document
- Reports statistics (total, successful, failed, chunks)

**Example:**
```bash
# Use demo tenant from config
python setup/ingest_demo_pdfs.py

# Use specific tenant
python setup/ingest_demo_pdfs.py --tenant-id 550e8400-e29b-41d4-a716-446655440000
```

---

## Complete Workflow

### 1. First-Time Setup (Development)

```bash
# Clone repository
cd backend

# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL and Redis
docker-compose up -d

# Initialize database (full)
python setup/init_database.py --full

# Start backend
python -m uvicorn src.main:app --reload

# Access API docs: http://localhost:8000/docs
```

### 2. Fresh Database (Production)

```bash
# Set environment variables
export DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/prod_db"
export OPENROUTER_API_KEY="sk-or-v1-xxx"

# Schema only
python setup/init_database.py --schema-only

# Seed base data
python setup/seed_base_data.py

# Add demo tenant (optional)
python setup/seed_demo_tenant.py

# Create additional tenants via API
# POST /api/admin/tenants
```

### 3. Add New Tenant via API

Now that Tenant CRUD API is implemented, create tenants without scripts:

```bash
# Create tenant
curl -X POST http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "domain": "mycompany.com",
    "status": "active"
  }'

# Response:
# {
#   "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
#   "name": "My Company",
#   "domain": "mycompany.com",
#   "status": "active",
#   "created_at": "2024-11-05T10:30:00"
# }

# List tenants
curl http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT"

# Get specific tenant
curl http://localhost:8000/api/admin/tenants/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_JWT"

# Update tenant
curl -X PATCH http://localhost:8000/api/admin/tenants/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company Updated"
  }'

# Delete tenant (soft delete - sets status to inactive)
curl -X DELETE http://localhost:8000/api/admin/tenants/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_JWT"
```

### 4. Update Knowledge Base (No Redeployment!)

```bash
# Upload PDF
curl -X POST "http://localhost:8000/api/admin/tenants/{tenant_id}/knowledge/upload-pdf" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@document.pdf" \
  -F "document_name=My Document"

# Check stats
curl "http://localhost:8000/api/admin/tenants/{tenant_id}/knowledge/stats" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

---

## Environment Variables

### Database

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/chatbot_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
```

### APIs

```bash
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

### Authentication

```bash
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
FERNET_KEY="your-encryption-key"
```

### Environment

```bash
ENVIRONMENT=development  # or production
DISABLE_AUTH=false       # Set to true for local testing
```

---

## Troubleshooting

### Database Connection Failed

```
Error: Could not connect to database

Solution:
1. Check PostgreSQL is running: docker-compose ps
2. Verify DATABASE_URL is correct
3. Check database exists: createdb chatbot_db
```

### Alembic Migration Failed

```
Error: FAILED: Can't find an existing database

Solution:
1. Ensure PostgreSQL is running
2. Create database: createdb chatbot_db
3. Run again: python setup/init_database.py --schema-only
```

### LLM Model Not Found

```
Error: LLM model 'gpt-4o-mini' not found

Solution:
1. Check config.yaml has the model defined
2. Verify base_data seeding ran: python setup/seed_base_data.py
3. Query database: SELECT * FROM llm_models;
```

### API Key Not Found

```
Error: API key environment variable not set

Solution:
export OPENROUTER_API_KEY="your-key"
python setup/seed_demo_tenant.py
```

### PDF File Not Found

```
Error: PDF file not found: setup/sample_docs/guide.pdf

Solution:
1. Check file exists at that path
2. Create sample PDFs in setup/sample_docs/
3. Update config.yaml with correct paths
```

---

## API Endpoints (New Tenant CRUD)

### Create Tenant
```
POST /api/admin/tenants
Authorization: Bearer {admin_jwt}

Request:
{
  "name": "Company Name",
  "domain": "company.com",
  "status": "active"
}

Response: 201 Created
{
  "tenant_id": "uuid",
  "name": "Company Name",
  "domain": "company.com",
  "status": "active",
  "created_at": "2024-11-05T10:30:00"
}
```

### List Tenants
```
GET /api/admin/tenants?limit=100&offset=0
Authorization: Bearer {admin_jwt}

Response: 200 OK
{
  "total": 5,
  "tenants": [
    {
      "tenant_id": "uuid",
      "name": "Company 1",
      ...
    }
  ]
}
```

### Get Tenant
```
GET /api/admin/tenants/{tenant_id}
Authorization: Bearer {admin_jwt}

Response: 200 OK
{
  "tenant_id": "uuid",
  "name": "Company Name",
  ...
}
```

### Update Tenant
```
PATCH /api/admin/tenants/{tenant_id}
Authorization: Bearer {admin_jwt}

Request:
{
  "name": "New Name"
}

Response: 200 OK
{
  "tenant_id": "uuid",
  "name": "New Name",
  ...
}
```

### Delete Tenant
```
DELETE /api/admin/tenants/{tenant_id}
Authorization: Bearer {admin_jwt}

Response: 204 No Content
```

---

## File Structure

```
backend/
├── setup/
│   ├── config.yaml                 # Configuration file
│   ├── init_database.py            # Main orchestrator
│   ├── seed_base_data.py           # Base data seeding
│   ├── seed_demo_tenant.py         # Demo tenant setup
│   ├── ingest_demo_pdfs.py         # PDF ingestion
│   ├── sample_docs/                # Sample PDF documents
│   │   ├── sample_guide.pdf
│   │   └── faq.pdf
│   └── README.md                   # This file

├── alembic/
│   ├── versions/
│   │   ├── 001_complete_schema.py  # Initial schema
│   │   └── 002_pgvector.py         # PgVector setup
│   └── alembic.ini

├── migrations/
│   ├── seed_test_data.py           # Test data
│   └── seed_etms_tenant.py         # eTMS tenant

├── src/
│   ├── api/admin/
│   │   ├── tenants.py              # ✨ NEW: Tenant CRUD endpoints
│   │   ├── agents.py
│   │   ├── tools.py
│   │   └── knowledge.py
│   ├── models/
│   ├── services/
│   └── ...

└── docker-compose.yml
```

---

## FAQ

### Q: Can I use a different LLM provider?

**A:** Yes! Add to config.yaml:
```yaml
base_data:
  llm_models:
    - id: "my-model"
      provider: "openai"
      base_url: "https://api.openai.com/v1"
      model_name: "gpt-4"
      ...
```

### Q: How do I add custom tools?

**A:** Define in config.yaml base_tools section, then implement the tool handler class in `src/tools/`.

Note: Current implementation requires code changes for new tool types. See `Docs/DYNAMIC_TOOL_LOADING.md` for roadmap to make this fully dynamic.

### Q: Can I skip demo tenant creation?

**A:** Yes, disable in config.yaml:
```yaml
demo_tenant:
  enabled: false
```

### Q: How do I update database schema after initialization?

**A:** Use Alembic:
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head
```

### Q: Can I restore from backup?

**A:** Use pg_dump/pg_restore:
```bash
# Backup
pg_dump chatbot_db > backup.sql

# Restore
psql chatbot_db < backup.sql
```

---

## Next Steps

1. ✅ **Database initialized** - Schema and data seeded
2. ✅ **Demo tenant created** - Ready for testing
3. ✅ **API endpoints available** - Create more tenants without scripts
4. ⬜ **Deploy to production** - Use environment variables
5. ⬜ **Add custom tools** - Implement tool handlers
6. ⬜ **Configure agents** - Customize prompts and tools
7. ⬜ **Ingest documents** - Upload PDFs for RAG

---

## Support

For issues or questions:
1. Check `Troubleshooting` section above
2. Review logs: `docker-compose logs -f postgres redis`
3. Check database directly: `psql chatbot_db`
4. Review code: `src/utils/logging.py` for structured logs
