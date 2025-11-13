# AgentHub Configuration Analysis - What's Database vs. Code?

**Version:** 1.0
**Date:** 2025-11-10
**Purpose:** Identify configurability gaps and design improvements for dynamic tenant/agent configuration

---

## Executive Summary

**Current State:** AgentHub is **partially** database-driven. While agent/tool assignments are configurable, **critical components are code-fixed**, requiring redeployment for changes.

**Key Findings:**
- ✅ **Database-driven:** Agent/tool assignments, permissions, tool configs (endpoint, top_k)
- ❌ **Code-fixed:** Tool classes, RAG pipeline (chunk_size, embedding model), supervisor prompts
- ⚠️ **Problem:** Adding new tool types (e.g., OCR) requires code changes + redeployment

**Recommendation:** Migrate to **plugin architecture** for tools + **tenant-level RAG configs**

---

## Configuration Matrix

| Component | Current State | Configurable Via | Change Requires |
|-----------|---------------|------------------|-----------------|
| **Tenant Config** | ✅ Database | `tenant_llm_configs` | Database only |
| **Agent Assignment** | ✅ Database | `tenant_agent_permissions` | Database only |
| **Tool Assignment** | ✅ Database | `tenant_tool_permissions` | Database only |
| **Tool Config** (endpoint, params) | ✅ Database | `tool_configs.config` | Database only |
| **Tool Classes** (HTTPGet, RAG) | ❌ Code-fixed | `tool_loader.py:21-28` | **Code + redeploy** |
| **RAG Chunking** (chunk_size) | ❌ Code-fixed | `document_processor.py:30` | **Code + redeploy** |
| **RAG Embedding Model** | ❌ Code-fixed | `embedding_service` | **Code + redeploy** |
| **RAG top_k** | ✅ Database | `tool_configs.config` | Database only |
| **Supervisor Prompt** | ❌ Code-fixed | `supervisor_agent.py:19-36` | **Code + redeploy** |
| **Agent Prompts** | ✅ Database | `agent_configs.prompt_template` | Database only |

---

## Issue #1: Tool Classes Are Code-Fixed ⚠️

### Current Implementation

**File:** `backend/src/services/tool_loader.py`

```python
class ToolRegistry:
    def __init__(self):
        """Initialize tool registry with handler mapping."""
        self._cache: Dict[str, StructuredTool] = {}
        self._tool_handlers = {
            "tools.http.HTTPGetTool": HTTPGetTool,
            "tools.http.HTTPPostTool": HTTPPostTool,
            "tools.rag.RAGTool": RAGTool,
            # ⚠️ HARDCODED MAPPING
            # Additional handlers can be added here
            # "tools.db.DBQueryTool": DBQueryTool,
            # "tools.ocr.OCRTool": OCRTool,  # ← Your OCR example
        }
```

### Problem

**To add OCR tool, you MUST:**
1. ❌ Write OCR tool class in `backend/src/tools/ocr.py`
2. ❌ Modify `tool_loader.py` to add `"tools.ocr.OCRTool": OCRTool`
3. ❌ Redeploy entire application

**Cannot:**
- ✗ Add OCR tool by just inserting database row
- ✗ Deploy new tool without code changes

### Solution: Plugin Architecture

**Design: Dynamic Tool Loading from Python Modules**

```python
# tool_loader.py (IMPROVED)
import importlib
from pathlib import Path

class ToolRegistry:
    def __init__(self):
        self._cache: Dict[str, StructuredTool] = {}
        self._tool_handlers = {}

        # Auto-discover tools from tools/ directory
        self._load_tool_plugins()

    def _load_tool_plugins(self):
        """Auto-discover and load all tool classes from tools/ directory."""
        tools_dir = Path(__file__).parent.parent / "tools"

        for tool_file in tools_dir.glob("*.py"):
            if tool_file.stem == "__init__" or tool_file.stem == "base":
                continue

            module_name = f"src.tools.{tool_file.stem}"
            try:
                # Dynamically import module
                module = importlib.import_module(module_name)

                # Find tool classes (inherit from BaseTool)
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type) and
                        issubclass(attr, BaseTool) and
                        attr is not BaseTool):

                        # Register with full path
                        handler_path = f"tools.{tool_file.stem}.{attr_name}"
                        self._tool_handlers[handler_path] = attr

                        logger.info(
                            "tool_plugin_loaded",
                            handler_path=handler_path,
                            tool_class=attr_name
                        )
            except Exception as e:
                logger.error(
                    "tool_plugin_load_failed",
                    module=module_name,
                    error=str(e)
                )
```

**Database Schema (No Changes Needed):**

```sql
-- base_tools table already supports this!
INSERT INTO base_tools (name, category, handler_class, description)
VALUES (
    'ocr_tool',
    'document_processing',
    'tools.ocr.OCRTool',  -- ← New tool class
    'Extract text from images using OCR'
);

-- tool_configs table
INSERT INTO tool_configs (name, base_tool_id, config, input_schema)
VALUES (
    'extract_text_from_image',
    (SELECT base_tool_id FROM base_tools WHERE name = 'ocr_tool'),
    '{"api_endpoint": "https://ocr.api.com/v1/extract", "api_key": "..."}',
    '{"properties": {"image_url": {"type": "string"}}, "required": ["image_url"]}'
);
```

**To Add OCR Tool (After Plugin Architecture):**
1. ✅ Create `backend/src/tools/ocr.py` (tool class only)
2. ✅ Insert database rows (base_tools, tool_configs)
3. ✅ Restart application (auto-discovers new tool)
4. ✅ No code changes to tool_loader.py needed!

---

## Issue #2: RAG Pipeline Is Code-Fixed ⚠️

### Current Implementation

**File:** `backend/src/services/document_processor.py`

```python
class DocumentProcessor:
    def __init__(
        self,
        chunk_size: int = 600,        # ⚠️ HARDCODED
        chunk_overlap: int = 200,     # ⚠️ HARDCODED
        separators: Optional[List[str]] = None
    ):
        """Initialize document processor."""
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Default separators optimized for technical documentation
        self.separators = separators or [
            "\n\n",  # Paragraphs
            "\n",    # Lines
            ". ",    # Sentences
            " ",     # Words
            ""       # Characters (fallback)
        ]

# Singleton instance (lines 558-584)
_document_processor: Optional[DocumentProcessor] = None

def get_document_processor(
    chunk_size: int = 600,      # ⚠️ DEFAULTS HARDCODED
    chunk_overlap: int = 200
) -> DocumentProcessor:
    """Get or create document processor singleton."""
    global _document_processor

    if _document_processor is None:
        _document_processor = DocumentProcessor(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

    return _document_processor
```

**File:** `backend/src/services/rag_service.py`

```python
class RAGService:
    def __init__(self):
        # Get embedding service (singleton, cached model)
        self.embedding_service = get_embedding_service()
        # ⚠️ Embedding model hardcoded in embedding_service
        # Currently: "all-MiniLM-L6-v2", 384 dimensions
```

### Problem

**Cannot customize per tenant:**
- ✗ Different chunk_size for different document types
- ✗ Different embedding models (e.g., multilingual for Vietnamese tenants)
- ✗ Different chunking strategies (sentence vs. paragraph)

**All tenants share:**
- Same chunk_size (600)
- Same chunk_overlap (200)
- Same embedding model (all-MiniLM-L6-v2)

### Solution: Tenant-Level RAG Configs

**Step 1: Add database table for RAG configs**

```sql
-- New table: tenant_rag_configs
CREATE TABLE tenant_rag_configs (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id),

    -- Chunking configs
    chunk_size INTEGER DEFAULT 600,
    chunk_overlap INTEGER DEFAULT 200,
    separators JSONB DEFAULT '["\\n\\n", "\\n", ". ", " ", ""]',

    -- Embedding configs
    embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    embedding_dimension INTEGER DEFAULT 384,

    -- Retrieval configs
    default_top_k INTEGER DEFAULT 5,
    distance_strategy VARCHAR(50) DEFAULT 'COSINE',

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Example: Vietnamese tenant with multilingual model
INSERT INTO tenant_rag_configs (tenant_id, embedding_model, embedding_dimension, chunk_size)
VALUES (
    'vietnamese-tenant-uuid',
    'paraphrase-multilingual-MiniLM-L12-v2',
    384,
    800  -- Larger chunks for Vietnamese (fewer punctuation breaks)
);
```

**Step 2: Update DocumentProcessor to accept config**

```python
# document_processor.py (IMPROVED)
class DocumentProcessor:
    def __init__(
        self,
        chunk_size: int = 600,
        chunk_overlap: int = 200,
        separators: Optional[List[str]] = None
    ):
        # Keep constructor the same for flexibility
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

        self._init_splitter()

    def _init_splitter(self):
        """Initialize text splitter with current config."""
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=self.separators,
            is_separator_regex=False
        )

    def update_config(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        separators: Optional[List[str]] = None
    ):
        """Update processor config (for tenant-specific settings)."""
        if chunk_size:
            self.chunk_size = chunk_size
        if chunk_overlap:
            self.chunk_overlap = chunk_overlap
        if separators:
            self.separators = separators

        # Reinitialize splitter with new config
        self._init_splitter()


# Remove singleton pattern, use per-tenant instances
def get_document_processor_for_tenant(
    db: Session,
    tenant_id: str
) -> DocumentProcessor:
    """Get DocumentProcessor with tenant-specific configuration."""

    # Load tenant RAG config from database
    rag_config = db.query(TenantRAGConfig).filter(
        TenantRAGConfig.tenant_id == tenant_id
    ).first()

    if rag_config:
        return DocumentProcessor(
            chunk_size=rag_config.chunk_size,
            chunk_overlap=rag_config.chunk_overlap,
            separators=rag_config.separators  # JSONB array
        )
    else:
        # Use defaults
        return DocumentProcessor()
```

**Step 3: Update RAGService to use tenant-specific embedding**

```python
# rag_service.py (IMPROVED)
class RAGService:
    def __init__(self):
        self.connection_string = settings.DATABASE_URL
        self.engine = create_engine(self.connection_string)
        self.collection_name = "knowledge_documents"

        # Don't create singleton embedding service
        # Load per-tenant instead

    def _get_embedding_service_for_tenant(self, db: Session, tenant_id: str):
        """Get embedding service with tenant-specific model."""
        from src.services.embedding_service import EmbeddingService

        # Load tenant RAG config
        rag_config = db.query(TenantRAGConfig).filter(
            TenantRAGConfig.tenant_id == tenant_id
        ).first()

        if rag_config:
            return EmbeddingService(
                model_name=rag_config.embedding_model,
                dimension=rag_config.embedding_dimension
            )
        else:
            # Default model
            return get_embedding_service()  # Singleton default

    def _get_vector_store(self, db: Session, tenant_id: str) -> PGVector:
        """Get PGVector store with tenant-specific embedding model."""
        # Get tenant-specific embedding service
        embedding_service = self._get_embedding_service_for_tenant(db, tenant_id)

        vector_store = PGVector(
            embeddings=embedding_service,
            collection_name=self.collection_name,
            connection=self.connection_string,
            distance_strategy=DistanceStrategy.COSINE,
            use_jsonb=True
        )

        return vector_store
```

**Step 4: Update ingest_document to use tenant config**

```python
# rag_service.py (IMPROVED)
def ingest_document(
    self,
    db: Session,  # ← Add db session parameter
    tenant_id: str,
    file_path: str,
    additional_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Process and ingest document with TENANT-SPECIFIC chunking."""

    # Get tenant-specific document processor
    doc_processor = get_document_processor_for_tenant(db, tenant_id)

    # Process document with tenant's chunk config
    chunks = doc_processor.process_document(
        file_path=file_path,
        tenant_id=tenant_id,
        additional_metadata=additional_metadata
    )

    # Ingest with tenant-specific embedding model
    documents = [chunk.page_content for chunk in chunks]
    metadatas = [chunk.metadata for chunk in chunks]

    result = self.ingest_documents(
        db=db,  # Pass db for embedding service lookup
        tenant_id=tenant_id,
        documents=documents,
        metadatas=metadatas
    )

    return result
```

### Configurability Matrix (After Changes)

| Parameter | Before | After | Database Table |
|-----------|--------|-------|----------------|
| **chunk_size** | ❌ Code (600) | ✅ Database | `tenant_rag_configs.chunk_size` |
| **chunk_overlap** | ❌ Code (200) | ✅ Database | `tenant_rag_configs.chunk_overlap` |
| **separators** | ❌ Code | ✅ Database | `tenant_rag_configs.separators` (JSONB) |
| **embedding_model** | ❌ Code (all-MiniLM-L6-v2) | ✅ Database | `tenant_rag_configs.embedding_model` |
| **embedding_dimension** | ❌ Code (384) | ✅ Database | `tenant_rag_configs.embedding_dimension` |
| **top_k** | ✅ Database | ✅ Database | `tool_configs.config.top_k` |

---

## Issue #3: Supervisor Prompt Is Code-Fixed ⚠️

### Current Implementation

**File:** `backend/src/services/supervisor_agent.py`

```python
class SupervisorAgent:
    """Supervisor agent for intent detection and routing."""

    SUPERVISOR_PROMPT_TEMPLATE = """You are a Supervisor Agent that routes user queries to specialized domain agents.

Available agents:
{agents_list}

Your task:
1. Analyze the user's message carefully
2. Detect if the message contains ONE or MULTIPLE distinct questions/intents
3. Respond with ONLY the agent name or status code

Detection Rules:
- SINGLE INTENT: User asks ONE clear question matching ONE agent → respond with agent name
- MULTIPLE INTENTS: User asks 2+ DIFFERENT questions → respond with "MULTI_INTENT"
- UNCLEAR: Ambiguous or not related to any agent → respond with "UNCLEAR"

Response Format:
Respond with ONLY ONE of these: {agent_names}MULTI_INTENT", or "UNCLEAR"
NO explanations, NO additional text."""

    def __init__(self, db: Session, tenant_id: str, jwt_token: str, session_id: Optional[str] = None):
        # ...
        self.supervisor_prompt = self._build_supervisor_prompt()  # Line 58
```

### Problem

**Cannot customize:**
- ✗ Change supervisor instructions per tenant
- ✗ Add brand-specific language
- ✗ Adjust routing logic without redeploying

**Example use case:**
- Tenant A wants: "Route to debt agent if customer mentions 'payment'"
- Tenant B wants: "Route to support agent if customer sounds frustrated"

### Solution: Database-Driven Supervisor Prompts

**Step 1: Add supervisor_prompt_override to tenant config**

```sql
-- Add column to existing tenant_llm_configs table
ALTER TABLE tenant_llm_configs
ADD COLUMN supervisor_prompt_override TEXT DEFAULT NULL;

-- Example: Custom prompt for specific tenant
UPDATE tenant_llm_configs
SET supervisor_prompt_override = 'You are a Customer Support Router for ACME Corp.

Available agents:
{agents_list}

Routing Rules:
- If customer mentions "bill" or "payment" → AgentDebt
- If customer sounds angry or frustrated → AgentSupport (priority)
- Otherwise follow standard intent detection

Respond with: {agent_names}MULTI_INTENT", or "UNCLEAR"'
WHERE tenant_id = 'acme-corp-tenant-uuid';
```

**Step 2: Update SupervisorAgent to use override**

```python
# supervisor_agent.py (IMPROVED)
class SupervisorAgent:
    SUPERVISOR_PROMPT_TEMPLATE = """..."""  # Default template

    def __init__(self, db: Session, tenant_id: str, jwt_token: str, session_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.jwt_token = jwt_token
        self.session_id = session_id

        # Initialize LLM
        self.llm = llm_manager.get_llm_for_tenant(db, tenant_id)

        # Load available agents
        self.available_agents = self._load_available_agents()

        # ✅ Build prompt with override support
        self.supervisor_prompt = self._build_supervisor_prompt_with_override()

    def _build_supervisor_prompt_with_override(self) -> str:
        """Build supervisor prompt with tenant-specific override."""

        # Check for tenant-specific prompt override
        from src.models.tenant_llm_config import TenantLLMConfig

        config = self.db.query(TenantLLMConfig).filter(
            TenantLLMConfig.tenant_id == self.tenant_id
        ).first()

        # Use override if available, else default template
        prompt_template = (
            config.supervisor_prompt_override
            if config and config.supervisor_prompt_override
            else self.SUPERVISOR_PROMPT_TEMPLATE
        )

        # Build agent list
        if not self.available_agents:
            agents_list = "- No agents available"
            agent_names = '"UNCLEAR"'
        else:
            agents_list = "\n".join([
                f"- {agent['name']}: {agent['description']}"
                for agent in self.available_agents
            ])
            agent_names_str = ", ".join([
                f'"{agent["name"]}"'
                for agent in self.available_agents
            ])
            agent_names = agent_names_str + ', '

        # Format prompt
        prompt = prompt_template.format(
            agents_list=agents_list,
            agent_names=agent_names
        )

        logger.info(
            "supervisor_prompt_built",
            tenant_id=self.tenant_id,
            using_override=bool(config and config.supervisor_prompt_override),
            agent_count=len(self.available_agents)
        )

        return prompt
```

---

## Configuration Flow Analysis

### Current Flow: Tenant → Agent → Tool

```
┌────────────────────────────────────────────────────────────────┐
│                     TENANT CONFIGURATION                        │
└────────────────────────────────────────────────────────────────┘

User Request
    │
    ▼
┌─────────────────────────┐
│ 1. Authentication       │
│    (JWT → tenant_id)    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 2. Load Tenant LLM Config                       │
│    ┌──────────────────────────────────────┐    │
│    │ tenant_llm_configs                   │    │
│    │ ├─ tenant_id (FK)                    │    │
│    │ ├─ llm_model_id (FK)                 │    │
│    │ ├─ encrypted_api_key                 │    │
│    │ ├─ rate_limit_rpm                    │    │
│    │ └─ rate_limit_tpm                    │    │
│    └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 3. Initialize SupervisorAgent                   │
│    ├─ Load available agents for tenant          │
│    │   (query: tenant_agent_permissions)        │
│    │                                             │
│    │   SELECT agent_configs.*                   │
│    │   FROM agent_configs                       │
│    │   INNER JOIN tenant_agent_permissions      │
│    │     ON agent_id = agent_id                 │
│    │   WHERE tenant_id = ?                      │
│    │     AND enabled = true                     │
│    │                                             │
│    ├─ Build supervisor prompt (HARDCODED)       │
│    └─ Initialize LLM client                     │
└─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 4. Route to Domain Agent                        │
│    ├─ SupervisorAgent detects intent            │
│    ├─ Selects agent from available_agents       │
│    └─ Loads agent configuration from DB         │
│        ┌──────────────────────────────────┐    │
│        │ agent_configs                    │    │
│        │ ├─ name                          │    │
│        │ ├─ prompt_template (✅ DATABASE) │    │
│        │ ├─ llm_model_id                  │    │
│        │ ├─ handler_class                 │    │
│        │ └─ is_active                     │    │
│        └──────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 5. Load Tools for Agent                         │
│    ├─ Query agent_tools (with priority)         │
│    │                                             │
│    │   SELECT tool_configs.*                    │
│    │   FROM tool_configs                        │
│    │   INNER JOIN agent_tools                   │
│    │     ON tool_id = tool_id                   │
│    │   INNER JOIN tenant_tool_permissions       │
│    │     ON tool_id = tool_id                   │
│    │   WHERE agent_id = ?                       │
│    │     AND tenant_id = ?                      │
│    │     AND enabled = true                     │
│    │   ORDER BY priority ASC                    │
│    │                                             │
│    └─ For each tool:                            │
│        ├─ Load base_tool.handler_class          │
│        ├─ Load tool_configs.config (✅ DATABASE)│
│        └─ Create LangChain StructuredTool       │
│            ┌──────────────────────────────┐    │
│            │ tool_configs                 │    │
│            │ ├─ name                      │    │
│            │ ├─ base_tool_id (FK)         │    │
│            │ ├─ config (JSONB) ✅         │    │
│            │ │   {                        │    │
│            │ │     "endpoint": "...",     │    │
│            │ │     "top_k": 5             │    │
│            │ │   }                        │    │
│            │ ├─ input_schema (JSONB)      │    │
│            │ └─ is_active                 │    │
│            └──────────────────────────────┘    │
└─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 6. Execute Domain Agent with Tools              │
│    ├─ Extract entities from user message        │
│    ├─ Invoke tool if entities match schema      │
│    └─ Format response                           │
└─────────────────────────────────────────────────┘
```

### What Happens When You Change Configurations?

#### Scenario A: Change Agent Prompt Template

```sql
-- Update agent prompt in database
UPDATE agent_configs
SET prompt_template = 'New prompt template...'
WHERE name = 'AgentDebt';
```

**Effect:** ✅ **Immediate** (next request uses new prompt)
**Reason:** Agent prompt loaded from DB on each request (line 113-117 in supervisor_agent.py)

---

#### Scenario B: Add New Tool Config

```sql
-- Add new tool instance
INSERT INTO tool_configs (name, base_tool_id, config, input_schema)
VALUES (...);

-- Grant permission to tenant
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled)
VALUES (...);
```

**Effect:** ✅ **Immediate** (next request loads new tool)
**Reason:** Tools loaded from DB on each agent initialization

---

#### Scenario C: Change Supervisor Prompt (Current)

**Action:** Edit `supervisor_agent.py` line 19-36

**Effect:** ❌ **Requires redeploy**
**Reason:** SUPERVISOR_PROMPT_TEMPLATE is hardcoded in class

---

#### Scenario D: Add New Tool Type (e.g., OCR)

**Current Steps:**
1. ❌ Write `tools/ocr.py` class
2. ❌ Edit `tool_loader.py` to add handler mapping
3. ❌ Redeploy application
4. ✅ Insert database rows

**Effect:** ❌ **Requires code + redeploy**

**After Plugin Architecture:**
1. ✅ Write `tools/ocr.py` class only
2. ✅ Insert database rows
3. ✅ Restart application (auto-discovers)

**Effect:** ✅ **No code changes to tool_loader.py**

---

## Recommendations Summary

### Priority 1: Critical for Flexibility

**1. Implement Tool Plugin Architecture**
- **Benefit:** Add new tools without modifying tool_loader.py
- **Effort:** 4 hours
- **Impact:** HIGH (enables tenant-specific custom tools)

**2. Add Tenant-Level RAG Configs**
- **Benefit:** Customize chunk_size, embedding model per tenant
- **Effort:** 6 hours
- **Impact:** HIGH (better RAG quality for different use cases)

**3. Add Supervisor Prompt Override**
- **Benefit:** Customize routing logic per tenant
- **Effort:** 1 hour
- **Impact:** MEDIUM (better brand alignment)

---

### Priority 2: Nice to Have

**4. Add Agent Prompt Template Variables**
- **Benefit:** Inject tenant-specific context into prompts
- **Effort:** 2 hours
- **Impact:** MEDIUM

**5. Add Tool Config Hot Reload**
- **Benefit:** Update tool configs without restarting
- **Effort:** 3 hours
- **Impact:** LOW (current restart is acceptable)

---

## Implementation Plan

### Phase 1: Plugin Architecture (Week 1)

**Day 1-2: Tool Plugin System**
- Implement `_load_tool_plugins()` in ToolRegistry
- Test with existing tools (HTTPGet, RAG)
- Add OCR tool as proof of concept

**Day 3: Testing**
- Unit tests for plugin discovery
- Integration tests for new tool loading

---

### Phase 2: Tenant RAG Configs (Week 2)

**Day 1: Database Schema**
- Create `tenant_rag_configs` table
- Add Alembic migration
- Seed with defaults

**Day 2-3: Update Services**
- Modify `DocumentProcessor` to accept config
- Modify `RAGService` to use tenant-specific embedding
- Update `ingest_document` API to pass db session

**Day 4: Testing**
- Test different chunk sizes
- Test different embedding models
- Verify tenant isolation

---

### Phase 3: Supervisor Prompt Override (Week 3)

**Day 1: Implementation**
- Add `supervisor_prompt_override` column
- Update `_build_supervisor_prompt_with_override()`
- Test with custom prompt

---

## Configuration Best Practices

### When to Use Database Config

✅ **Use Database for:**
- Values that vary per tenant
- Values that change frequently
- Values that need admin UI control
- Business logic parameters (top_k, thresholds)

❌ **Don't Use Database for:**
- Application code (Python classes)
- System-level settings (ports, timeouts)
- Security keys (use environment variables)

### When to Use Code

✅ **Use Code for:**
- Tool implementations (business logic)
- Default values and fallbacks
- System architecture (supervisor pattern)
- Data validation rules

❌ **Don't Use Code for:**
- Tenant-specific prompts
- API endpoints (tool configs)
- Feature flags per tenant

---

## Testing Strategy

### Testing Configuration Changes

**Test Matrix:**

| Change Type | Test Method | Expected Outcome |
|-------------|-------------|------------------|
| Agent prompt | Update DB, send message | New prompt used immediately |
| Tool config | Update DB, restart agent | New config loaded |
| Supervisor prompt | Update DB, send message | New routing logic applied |
| RAG chunk_size | Update DB, ingest doc | New chunk size used |
| Embedding model | Update DB, ingest doc | New model used for embeddings |

### Regression Testing

**Critical Flows to Test:**
1. Multi-tenant isolation (tenant A changes don't affect tenant B)
2. Permission enforcement (disabled tools not loaded)
3. Cache invalidation (config changes reflected)
4. Fallback behavior (missing config uses defaults)

---

## Conclusion

**Current State:**
- 60% database-driven (agent/tool assignments, configs)
- 40% code-fixed (tool classes, RAG pipeline, prompts)

**After Improvements:**
- 85% database-driven
- 15% code-fixed (only tool implementations)

**Result:**
- ✅ Add new tools without redeploying
- ✅ Customize RAG pipeline per tenant
- ✅ Brand-specific supervisor prompts
- ✅ True multi-tenant configurability

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Next Review:** After Phase 1 implementation
