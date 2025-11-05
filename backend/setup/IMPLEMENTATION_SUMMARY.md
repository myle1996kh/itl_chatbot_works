# Setup System Implementation Summary

## Overview

Complete database initialization system for ITL_PGVector that enables:
- ✅ One-command database setup
- ✅ Configuration-driven initialization
- ✅ Tenant creation via API (no database access needed)
- ✅ Reusable setup scripts for any environment
- ✅ No redeployment for knowledge base updates

---

## What Was Implemented

### 1. Setup Scripts (4 files)

#### `setup/init_database.py` (Main Orchestrator)
- **Purpose**: Coordinates all initialization steps
- **Features**:
  - Runs Alembic migrations
  - Seeds base data
  - Creates demo tenant
  - Ingests PDF documents
  - Validates setup completion
- **Modes**: `--full`, `--schema-only`, `--seed-only`, `--demo-only`
- **Usage**: `python setup/init_database.py --full`

#### `setup/seed_base_data.py`
- **Purpose**: Seeds LLM models, tools, agents, output formats
- **Creates**:
  - 4 LLM models (GPT-4o, Claude, Gemini, etc.)
  - 5 base tools (HTTP_GET, HTTP_POST, RAG, DB_QUERY, OCR)
  - 3 agents (Guidance, Analysis, Supervisor)
  - 4 output formats (JSON, Markdown, Chart, Summary)
- **Idempotent**: Checks if data exists before inserting
- **Usage**: `python setup/seed_base_data.py`

#### `setup/seed_demo_tenant.py`
- **Purpose**: Creates complete demo tenant with configuration
- **Creates**:
  - Tenant record
  - LLM configuration
  - Widget configuration
  - Agent permissions
  - Tool permissions
  - RAG collection
- **Idempotent**: Checks if tenant exists
- **Usage**: `python setup/seed_demo_tenant.py`

#### `setup/ingest_demo_pdfs.py`
- **Purpose**: Ingests PDF documents into knowledge base
- **Features**:
  - Validates file paths
  - Processes PDFs (load → chunk → embed → store)
  - Shows progress
  - Reports statistics
- **Configuration-driven**: Reads PDF paths from config.yaml
- **Usage**: `python setup/ingest_demo_pdfs.py`

---

### 2. Configuration File

#### `setup/config.yaml`
Centralized configuration with:
- **Database**: Connection URL, pool settings
- **Demo Tenant**: Name, domain, LLM config, widget settings
- **LLM Models**: 4 models with provider/endpoint/context window
- **Base Tools**: 5 tool templates with input schemas
- **Output Formats**: 4 formats for agent responses
- **Agents**: 3 agent configs with prompts and tools
- **RAG Documents**: PDF paths and metadata
- **Advanced**: Idempotent mode, validation, verbose logging

**Example usage:**
```bash
# Override database
export DATABASE_URL="postgresql://user:pass@host/db"

# Override API key
export OPENROUTER_API_KEY="sk-or-v1-xxx"

# Run with custom config
python setup/init_database.py --full --config my_config.yaml
```

---

### 3. Tenant CRUD API Endpoints

Added to `backend/src/api/admin/tenants.py`:

#### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/admin/tenants` | Create tenant |
| GET | `/api/admin/tenants` | List tenants |
| GET | `/api/admin/tenants/{tenant_id}` | Get tenant details |
| PATCH | `/api/admin/tenants/{tenant_id}` | Update tenant |
| DELETE | `/api/admin/tenants/{tenant_id}` | Delete (soft) tenant |

**Features:**
- Domain uniqueness validation
- Proper error handling and logging
- Requires admin JWT role
- Returns structured responses with timestamps
- Soft delete (sets status to inactive)

**Example:**
```bash
# Create tenant
curl -X POST http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Company",
    "domain": "newcompany.com"
  }'
```

---

### 4. Documentation

#### `setup/README.md`
Comprehensive guide covering:
- Quick start (3-command setup)
- Configuration options
- Script descriptions
- Complete workflows
- Environment variables
- Troubleshooting
- API endpoint examples
- FAQ

---

## Key Features

### ✅ One-Command Setup

```bash
python setup/init_database.py --full
```

This runs:
1. Alembic migrations (creates 14 tables)
2. Seed base data (LLM models, tools, agents)
3. Create demo tenant
4. Ingest sample PDFs
5. Validate setup

### ✅ Configuration-Driven

Edit `setup/config.yaml` to customize:
- Database connection
- LLM models and providers
- Tool definitions
- Agent prompts
- Demo tenant settings
- PDF documents to ingest

No code changes needed.

### ✅ Idempotent

All scripts safely check if data exists before inserting:
```python
existing = db.query(LLMModel).filter(LLMModel.llm_model_id == model_id).first()
if existing:
    print("Already exists - skipping")
    continue
```

Can run multiple times without duplicates.

### ✅ Tenant Creation via API

Added 5 new REST endpoints for tenant management:

```bash
# No longer need database access to create tenants!
curl -X POST http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{"name":"Company","domain":"company.com"}'
```

### ✅ No Redeployment for Updates

**Knowledge Base**: Upload PDFs, update agents, grant permissions - all via API

```bash
# Upload new PDF without redeployment!
curl -X POST "http://localhost:8000/api/admin/tenants/{tenant_id}/knowledge/upload-pdf" \
  -F "file=@document.pdf"
```

### ✅ Modular Design

Each script has single responsibility:
- `init_database.py` → Orchestration
- `seed_base_data.py` → Base data
- `seed_demo_tenant.py` → Tenant setup
- `ingest_demo_pdfs.py` → Document ingestion

Can run individually or together.

### ✅ Structured Logging

All scripts use structured logging:
```python
logger.info("tenant_created", tenant_id=tenant_id, domain=domain)
```

Enables monitoring, debugging, and audit trails.

---

## Usage Examples

### Development: Fresh Start

```bash
cd backend
python setup/init_database.py --full
python -m uvicorn src.main:app --reload
```

### Production: Schema Only

```bash
export DATABASE_URL="postgresql://prod:pass@prod-host:5432/prod_db"
python setup/init_database.py --schema-only
# Seed separately in different step
python setup/seed_base_data.py
```

### Add New Tenant at Runtime

```bash
# Via API - no code changes!
curl -X POST http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "name": "Acme Corp",
    "domain": "acme.example.com"
  }'
```

### Update Knowledge Base

```bash
# Upload PDF without redeployment!
curl -X POST "http://localhost:8000/api/admin/tenants/{uuid}/knowledge/upload-pdf" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@acme_guide.pdf"
```

### Different Environment

```bash
# Create custom config for production
cp setup/config.yaml setup/config.prod.yaml
# Edit config.prod.yaml

# Run with custom config
python setup/init_database.py --full --config setup/config.prod.yaml
```

---

## Files Created/Modified

### New Files Created
```
backend/setup/
├── config.yaml                 # Configuration file
├── init_database.py            # Main orchestrator (380 lines)
├── seed_base_data.py           # Base data seeder (350 lines)
├── seed_demo_tenant.py         # Tenant seeder (450 lines)
├── ingest_demo_pdfs.py         # PDF ingestion (320 lines)
├── README.md                   # Comprehensive guide (550 lines)
└── IMPLEMENTATION_SUMMARY.md   # This file
```

### Files Modified
```
backend/src/api/admin/tenants.py
├── Added TenantCreateRequest schema
├── Added TenantUpdateRequest schema
├── Added TenantResponse schema
├── Added TenantListResponse schema
├── Added create_tenant endpoint
├── Added list_tenants endpoint
├── Added get_tenant endpoint
├── Added update_tenant endpoint
├── Added delete_tenant endpoint
└── Kept existing permission endpoints
```

---

## Test It Out

### 1. Full Initialization

```bash
cd backend

# Initialize everything
python setup/init_database.py --full --verbose

# Output:
# ╔════════════════════════════════════════════════╗
# ║   ITL_PGVector Database Initialization         ║
# ╚════════════════════════════════════════════════╝
# ✅ Run Alembic migrations
# ✅ Seed base data (LLM models, tools, agents, formats)
# ✅ Create demo tenant with RAG tool
# ✅ Ingest sample PDF documents
# ✅ Validate Setup
```

### 2. Start Backend

```bash
python -m uvicorn src.main:app --reload
```

Visit: `http://localhost:8000/docs`

### 3. Test New Tenant CRUD API

```bash
# Create tenant
TENANT_RESPONSE=$(curl -X POST http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "domain": "test.example.com"
  }')

TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.tenant_id')

# List tenants
curl http://localhost:8000/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_JWT" | jq

# Get tenant details
curl http://localhost:8000/api/admin/tenants/$TENANT_ID \
  -H "Authorization: Bearer $ADMIN_JWT" | jq

# Update tenant
curl -X PATCH http://localhost:8000/api/admin/tenants/$TENANT_ID \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Company Updated"}' | jq

# Delete tenant
curl -X DELETE http://localhost:8000/api/admin/tenants/$TENANT_ID \
  -H "Authorization: Bearer $ADMIN_JWT"
```

### 4. Test Knowledge Base (No Redeployment!)

```bash
# Upload PDF
curl -X POST "http://localhost:8000/api/admin/tenants/$TENANT_ID/knowledge/upload-pdf" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@document.pdf" \
  -F "document_name=My Document"

# Check stats
curl "http://localhost:8000/api/admin/tenants/$TENANT_ID/knowledge/stats" \
  -H "Authorization: Bearer $ADMIN_JWT" | jq
```

---

## Flexibility Achieved

### Before This Implementation
- ❌ Cannot create tenants without database access
- ❌ Must use seed scripts for new tenants
- ❌ No standard initialization procedure
- ❌ Configuration scattered in code
- ❌ Difficult to replicate setup

### After This Implementation
- ✅ Create tenants via REST API
- ✅ Configuration in single YAML file
- ✅ One-command setup
- ✅ Reusable across any environment
- ✅ Idempotent - safe to run multiple times
- ✅ Modular - run individual steps
- ✅ No code changes needed for most customization

---

## Known Limitations & Future Work

### Limitation: Hardcoded Tool Handler Registry

Currently in `backend/src/services/tool_loader.py:21-28`:
```python
self._tool_handlers = {
    "tools.http.HTTPGetTool": HTTPGetTool,      # HARDCODED
    "tools.rag.RAGTool": RAGTool,
}
```

**Status**: Documented in `Docs/DYNAMIC_TOOL_LOADING.md`
**Roadmap**: Use `importlib` for dynamic loading (future enhancement)

### What This Means
- ✅ Can create new tool **instances** via API
- ❌ Adding new tool **types** requires code changes

**Workaround**: For new tool types, implement handler class in `src/tools/` and update `tool_loader.py`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  Single Command: python setup/init_database.py --full
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌─────────┐ ┌──────────┐ ┌──────────┐
    │Alembic  │ │Base Data │ │Demo      │
    │Migration│ │ Seeding  │ │Tenant    │
    └─────────┘ └──────────┘ └──────────┘
         │           │           │
         └───────────┼───────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │  PDF Ingestion       │
         │  (Optional)          │
         └──────────────────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │  Validation          │
         │  (Optional)          │
         └──────────────────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │ ✅ Database Ready    │
         │ ✅ APIs Available    │
         │ ✅ Demo Tenant Ready │
         └──────────────────────┘
```

---

## Summary

**Complete Database Initialization System** that:
- ✅ Initializes fresh PostgreSQL database in one command
- ✅ Seeds all base data (LLM models, tools, agents)
- ✅ Creates demo tenant with RAG and guidelines
- ✅ Ingests sample PDF documents
- ✅ Provides Tenant CRUD API (no database access needed)
- ✅ Configuration-driven (customize via YAML)
- ✅ Idempotent (safe to run multiple times)
- ✅ Modular (run individual steps)
- ✅ Fully documented with examples and troubleshooting

**Result**: Can initialize any database (dev/staging/prod) with **one command**, create new tenants via **API calls**, and update knowledge bases **without redeployment**.

---

## Next Steps

1. **Test Setup**: Run `python setup/init_database.py --full`
2. **Verify APIs**: Test new Tenant CRUD endpoints
3. **Try Knowledge Base Update**: Upload PDF without redeploying
4. **Create Custom Tenant**: Use API instead of database
5. **Custom Config**: Create custom config.yaml for your environment
6. **Dynamic Tool Loading** (Future): Implement `importlib`-based tool handler loading

---

## Files Delivered

| File | Lines | Purpose |
|------|-------|---------|
| `setup/config.yaml` | 200 | Configuration file |
| `setup/init_database.py` | 380 | Main orchestrator |
| `setup/seed_base_data.py` | 350 | Base data seeding |
| `setup/seed_demo_tenant.py` | 450 | Tenant creation |
| `setup/ingest_demo_pdfs.py` | 320 | PDF ingestion |
| `setup/README.md` | 550 | Comprehensive guide |
| `api/admin/tenants.py` (modified) | +300 | Tenant CRUD API |
| **TOTAL** | **~2550** | Complete setup system |

