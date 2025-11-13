# RAG Customization Guide - Using Existing Tables

**Version:** 1.0
**Date:** 2025-11-10
**Approach:** Use `tool_configs.config` JSONB for RAG parameters (no new tables needed)

---

## Q2 Answer: Store RAG Configs in `tool_configs` Table ✅

### Extending RAGToolConfig (Minimal Code Changes)

**File:** `backend/src/tools/rag.py`

**Current (line 11-14):**
```python
class RAGToolConfig(BaseModel):
    """Configuration for RAG tool."""
    top_k: int = Field(default=5, ge=1, le=20, description="Number of documents to retrieve")
    collection_name: Optional[str] = Field(default=None, description="[Deprecated]")
```

**Extended (Add chunking + embedding parameters):**
```python
class RAGToolConfig(BaseModel):
    """Configuration for RAG tool."""
    # Retrieval parameters
    top_k: int = Field(default=5, ge=1, le=20, description="Number of documents to retrieve")

    # Chunking parameters (NEW)
    chunk_size: int = Field(default=600, ge=100, le=2000, description="Chunk size in characters")
    chunk_overlap: int = Field(default=200, ge=0, le=500, description="Overlap between chunks")
    separators: List[str] = Field(
        default=["\n\n", "\n", ". ", " ", ""],
        description="Text splitting separators"
    )

    # Embedding parameters (NEW)
    embedding_model: str = Field(
        default="all-MiniLM-L6-v2",
        description="HuggingFace model name"
    )
    embedding_dimension: int = Field(default=384, description="Embedding dimension")

    # Distance strategy (NEW)
    distance_strategy: str = Field(
        default="COSINE",
        description="Distance strategy: COSINE, EUCLIDEAN, or INNER_PRODUCT"
    )

    # Deprecated
    collection_name: Optional[str] = Field(default=None, description="[Deprecated]")
```

---

### Database Configuration Example

**Scenario:** Tenant A wants larger chunks for technical docs, Tenant B wants smaller chunks for chat logs

**Tenant A: RAG tool config (large chunks)**
```sql
-- Insert tool config for Tenant A
INSERT INTO tool_configs (
    tool_id,
    name,
    base_tool_id,
    config,
    input_schema,
    description
) VALUES (
    gen_random_uuid(),
    'knowledge_base_search_technical',
    (SELECT base_tool_id FROM base_tools WHERE handler_class = 'tools.rag.RAGTool'),
    '{
        "top_k": 5,
        "chunk_size": 1000,
        "chunk_overlap": 300,
        "separators": ["\\n\\n", "\\n", ". ", " ", ""],
        "embedding_model": "all-MiniLM-L6-v2",
        "embedding_dimension": 384,
        "distance_strategy": "COSINE"
    }'::jsonb,
    '{
        "properties": {
            "query": {"type": "string", "description": "Search query"}
        },
        "required": ["query"]
    }'::jsonb,
    'Search technical documentation knowledge base'
);

-- Grant permission to Tenant A
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled)
VALUES (
    'tenant-a-uuid',
    (SELECT tool_id FROM tool_configs WHERE name = 'knowledge_base_search_technical'),
    true
);
```

**Tenant B: RAG tool config (small chunks for chat)**
```sql
INSERT INTO tool_configs (
    tool_id,
    name,
    base_tool_id,
    config,
    input_schema,
    description
) VALUES (
    gen_random_uuid(),
    'knowledge_base_search_chat',
    (SELECT base_tool_id FROM base_tools WHERE handler_class = 'tools.rag.RAGTool'),
    '{
        "top_k": 10,
        "chunk_size": 300,
        "chunk_overlap": 50,
        "separators": ["\\n\\n", "\\n", ". ", " ", ""],
        "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
        "embedding_dimension": 384,
        "distance_strategy": "COSINE"
    }'::jsonb,
    '{...}'::jsonb,
    'Search chat logs knowledge base'
);

-- Grant permission to Tenant B
INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled)
VALUES ('tenant-b-uuid', (SELECT tool_id FROM tool_configs WHERE name = 'knowledge_base_search_chat'), true);
```

---

### Code Changes Required

**1. Update RAGTool to pass config to RAGService**

**File:** `backend/src/tools/rag.py`

```python
class RAGTool(BaseTool):
    def __init__(
        self,
        config: Dict[str, Any],
        input_schema: Dict[str, Any],
        tenant_id: str,
        jwt_token: Optional[str] = None,
    ):
        super().__init__(config, input_schema, tenant_id, jwt_token)

        # Parse config (now includes chunking + embedding)
        self.rag_config = RAGToolConfig(**config)

        # Get RAG service
        self.rag_service = get_rag_service()

        logger.info(
            "rag_tool_initialized",
            tenant_id=tenant_id,
            top_k=self.rag_config.top_k,
            chunk_size=self.rag_config.chunk_size,  # NEW
            embedding_model=self.rag_config.embedding_model,  # NEW
            backend="pgvector"
        )

    def _execute(self, **kwargs) -> Dict[str, Any]:
        query = kwargs.get("query", "")

        if not query:
            return {"success": False, "error": "Query required", "documents": []}

        try:
            # Pass chunking config to RAG service
            result = self.rag_service.query_knowledge_base(
                tenant_id=self.tenant_id,
                query=query,
                top_k=self.rag_config.top_k,
                # NEW: Pass chunking config for dynamic processing
                chunk_config={
                    "chunk_size": self.rag_config.chunk_size,
                    "chunk_overlap": self.rag_config.chunk_overlap,
                    "separators": self.rag_config.separators
                },
                # NEW: Pass embedding config
                embedding_config={
                    "model": self.rag_config.embedding_model,
                    "dimension": self.rag_config.embedding_dimension
                }
            )

            return result

        except Exception as e:
            logger.error("rag_tool_execution_failed", error=str(e))
            return {"success": False, "error": str(e), "documents": []}
```

**2. Update RAGService to accept config**

**File:** `backend/src/services/rag_service.py`

```python
def query_knowledge_base(
    self,
    tenant_id: str,
    query: str,
    top_k: int = 5,
    chunk_config: Optional[Dict[str, Any]] = None,     # NEW
    embedding_config: Optional[Dict[str, Any]] = None,  # NEW
    section_filter: Optional[str] = None,
    ...
) -> Dict[str, Any]:
    """Query with configurable chunking and embedding."""

    # Use custom embedding model if provided
    if embedding_config:
        embedding_service = EmbeddingService(
            model_name=embedding_config.get("model"),
            dimension=embedding_config.get("dimension")
        )
        vector_store = PGVector(
            embeddings=embedding_service,
            collection_name=self.collection_name,
            connection=self.connection_string,
            distance_strategy=DistanceStrategy.COSINE
        )
    else:
        # Use default embedding service
        vector_store = self._get_vector_store(tenant_id)

    # Query as usual
    results = vector_store.similarity_search_with_score(
        query=query,
        k=top_k,
        filter={"tenant_id": str(tenant_id)}
    )

    # ... rest of method
```

---

## Q3 Answer: Should Supervisor Be in Database?

### **Yes! Add SupervisorAgent to `agent_configs` table** ✅

**Current Problem:**
- Supervisor is special (hardcoded class)
- Supervisor prompt is hardcoded
- Cannot customize supervisor per tenant

**Solution: Treat Supervisor as Regular Agent**

### Database Schema (No Changes Needed!)

**Just insert supervisor as an agent:**

```sql
-- Insert supervisor as a special agent
INSERT INTO agent_configs (
    agent_id,
    name,
    prompt_template,  -- ← Customizable supervisor prompt!
    llm_model_id,
    handler_class,
    description,
    is_active
) VALUES (
    gen_random_uuid(),
    'SupervisorAgent',
    'You are a Supervisor Agent that routes user queries to specialized domain agents.

Available agents:
{agents_list}

Your task:
1. Analyze the user''s message carefully
2. Detect if the message contains ONE or MULTIPLE distinct questions/intents
3. Respond with ONLY the agent name or status code

Detection Rules:
- SINGLE INTENT: User asks ONE clear question matching ONE agent → respond with agent name
- MULTIPLE INTENTS: User asks 2+ DIFFERENT questions → respond with "MULTI_INTENT"
- UNCLEAR: Ambiguous or not related to any agent → respond with "UNCLEAR"

Response Format:
Respond with ONLY ONE of these: {agent_names}, "MULTI_INTENT", or "UNCLEAR"
NO explanations, NO additional text.',
    (SELECT llm_model_id FROM llm_models WHERE model_name = 'gpt-4o-mini' LIMIT 1),
    'services.supervisor_agent.SupervisorAgent',  -- ← Handler class
    'Routes user queries to specialized agents',
    true
);

-- Grant supervisor to all tenants (it's mandatory)
INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled)
SELECT
    t.tenant_id,
    (SELECT agent_id FROM agent_configs WHERE name = 'SupervisorAgent'),
    true
FROM tenants t;
```

### Code Changes: Load Supervisor from DB

**File:** `backend/src/services/supervisor_agent.py`

**Current (lines 19-36):**
```python
class SupervisorAgent:
    SUPERVISOR_PROMPT_TEMPLATE = """..."""  # Hardcoded

    def __init__(self, db, tenant_id, jwt_token, session_id):
        # ...
        self.supervisor_prompt = self._build_supervisor_prompt()
```

**Improved (Load from DB):**
```python
class SupervisorAgent:
    # Remove hardcoded template, load from DB instead

    def __init__(self, db, tenant_id, jwt_token, session_id):
        self.db = db
        self.tenant_id = tenant_id

        # Load supervisor config from database
        self.supervisor_config = self._load_supervisor_config()

        # Initialize LLM
        self.llm = llm_manager.get_llm_for_tenant(db, tenant_id)

        # Load available agents
        self.available_agents = self._load_available_agents()

        # Build prompt from database template
        self.supervisor_prompt = self._build_supervisor_prompt_from_db()

    def _load_supervisor_config(self):
        """Load supervisor agent config from database."""
        from src.models.agent import AgentConfig

        supervisor = self.db.query(AgentConfig).filter(
            AgentConfig.name == 'SupervisorAgent',
            AgentConfig.is_active == True
        ).first()

        if not supervisor:
            raise ValueError("SupervisorAgent not found in database. Run migration.")

        return supervisor

    def _build_supervisor_prompt_from_db(self) -> str:
        """Build supervisor prompt from database template."""

        # Get prompt template from database
        prompt_template = self.supervisor_config.prompt_template

        # Build agent list
        if not self.available_agents:
            agents_list = "- No agents available"
            agent_names = '"UNCLEAR"'
        else:
            agents_list = "\n".join([
                f"- {agent['name']}: {agent['description']}"
                for agent in self.available_agents
            ])
            agent_names = ", ".join([f'"{agent["name"]}"' for agent in self.available_agents]) + ', '

        # Format template with dynamic values
        prompt = prompt_template.format(
            agents_list=agents_list,
            agent_names=agent_names
        )

        logger.info(
            "supervisor_prompt_built_from_db",
            tenant_id=self.tenant_id,
            agent_count=len(self.available_agents)
        )

        return prompt
```

**Benefits:**
- ✅ Supervisor prompt customizable per tenant (via `prompt_template`)
- ✅ Supervisor can use different LLM models
- ✅ Consistent with other agents
- ✅ Admin can edit supervisor behavior without code changes

---

## RAG Validation - Explained Simply

### What Is "RAG Cross-Tenant Validation"?

**Scenario (The Problem):**

1. **Tenant A** uploads confidential document: "Q4 2024 Financial Report"
2. **Tenant B** uploads document: "Public Product Catalog"
3. Both documents stored in same PgVector table: `langchain_pg_embedding`

**Metadata Filtering (Current Protection):**
```python
# When Tenant B queries, filter by tenant_id
results = vector_store.similarity_search_with_score(
    query="financial report",
    filter={"tenant_id": "tenant-b-uuid"}  # ← Should only return Tenant B's docs
)
```

**Expected:** Tenant B gets 0 results (they have no financial docs)

**What Could Go Wrong?**
- PgVector metadata filter fails (bug, version issue, operator error)
- Database returns Tenant A's confidential document to Tenant B
- **DATA BREACH** 🚨

---

### Simple Example

**Without Validation (Current):**
```python
# Tenant B queries
results = vector_store.similarity_search(query="salary", filter={"tenant_id": "B"})

# PgVector returns:
results = [
    Document(content="CEO salary: $500k", metadata={"tenant_id": "A"}),  # ← WRONG TENANT!
    Document(content="Product pricing", metadata={"tenant_id": "B"})
]

# Code trusts results and returns BOTH to Tenant B
# → Tenant B sees Tenant A's CEO salary! 🚨
```

**With Validation (Recommended):**
```python
# Query
results = vector_store.similarity_search(query="salary", filter={"tenant_id": "B"})

# Validate EVERY document
for doc in results:
    if doc.metadata["tenant_id"] != "B":
        # ⚠️ SECURITY VIOLATION DETECTED!
        logger.error("Cross-tenant leak!", expected="B", actual=doc.metadata["tenant_id"])
        raise SecurityError("Data leakage detected!")

# Only return validated results
# → Tenant B sees ONLY their own documents ✅
```

---

### Why Is This Important?

**Defense in Depth:**
- Layer 1: PgVector metadata filter (primary protection)
- Layer 2: **Post-query validation** (backup protection)

If Layer 1 fails → Layer 2 catches the breach before it reaches the user

**Risk without validation:**
- Silent data leakage between tenants
- Compliance violations (GDPR, SOC 2)
- Reputation damage

**Fix time:** 30 minutes (see REFACTORING_PLAN.md Issue #2)

---

## RAG Flow - Complete Pipeline

### You Asked: "What about the FLOW, not just parameters?"

**Correct! Let me explain the ENTIRE pipeline:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCUMENT INGESTION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

User uploads document.docx
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. LOAD DOCUMENT                                                 │
│    File: document_processor.py                                   │
│    Method: load_docx() or load_pdf()                            │
│                                                                   │
│    For DOCX:                                                     │
│    ├─ Extract paragraphs using python-docx                       │
│    ├─ Detect headings (Heading 1, Heading 2, etc.)             │
│    ├─ Track current section while processing                     │
│    └─ Create Document objects with metadata:                     │
│        {                                                          │
│          "source": "document.docx",                              │
│          "section_title": "2.3 Track and Trace",                │
│          "section_number": "2.3",                                │
│          "paragraph_index": 45,                                  │
│          "is_heading": false                                     │
│        }                                                          │
│                                                                   │
│    For PDF:                                                      │
│    ├─ Extract text per page using PyPDFLoader                   │
│    └─ Create Document objects with metadata:                     │
│        {"source": "doc.pdf", "page": 5}                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CHUNK DOCUMENTS                                               │
│    File: document_processor.py                                   │
│    Method: chunk_documents()                                     │
│    Strategy: RecursiveCharacterTextSplitter                      │
│                                                                   │
│    Parameters (CONFIGURABLE via tool_configs):                   │
│    ├─ chunk_size: 600 characters (default)                       │
│    ├─ chunk_overlap: 200 characters (default)                    │
│    └─ separators: ["\n\n", "\n", ". ", " ", ""]                │
│                                                                   │
│    How it works:                                                 │
│    1. Try to split on "\n\n" (paragraphs)                       │
│    2. If chunk > 600 chars, try "\n" (lines)                    │
│    3. If still too big, try ". " (sentences)                    │
│    4. If still too big, split on " " (words)                    │
│    5. Last resort: split on characters                           │
│                                                                   │
│    Output:                                                        │
│    [                                                              │
│      Document(content="Chunk 1...", metadata={...}),            │
│      Document(content="Chunk 2...", metadata={...}),  # ← Preserves section_title!
│      ...                                                          │
│    ]                                                              │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ENRICH METADATA                                               │
│    File: document_processor.py                                   │
│    Method: enrich_metadata()                                     │
│                                                                   │
│    Adds to EVERY chunk:                                          │
│    ├─ tenant_id: "abc-123" (CRITICAL for isolation)            │
│    ├─ ingested_at: "2024-01-15T10:30:00Z"                       │
│    └─ Any custom metadata provided by user                       │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. GENERATE EMBEDDINGS                                           │
│    File: embedding_service.py                                    │
│    Model: all-MiniLM-L6-v2 (default, CONFIGURABLE)             │
│    Dimension: 384 (CONFIGURABLE)                                 │
│                                                                   │
│    For each chunk:                                               │
│    chunk_text → embedding_model.encode() → vector[384]          │
│                                                                   │
│    Example:                                                       │
│    "Track shipment status" → [0.12, -0.45, 0.89, ..., 0.34]    │
│                             (384 numbers)                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. STORE IN PGVECTOR                                             │
│    Table: langchain_pg_embedding                                 │
│                                                                   │
│    INSERT INTO langchain_pg_embedding (                          │
│      id,                                                          │
│      embedding vector(384),  -- ← Vector column                  │
│      cmetadata jsonb,         -- ← Metadata                      │
│      document text            -- ← Chunk text                    │
│    )                                                              │
│                                                                   │
│    Metadata stored:                                              │
│    {                                                              │
│      "tenant_id": "abc-123",         ← CRITICAL                 │
│      "section_title": "Track and Trace",                         │
│      "source": "document.docx",                                  │
│      "chunk_index": 5,                                           │
│      "ingested_at": "2024-01-15T10:30:00Z"                      │
│    }                                                              │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                      RETRIEVAL FLOW (QUERY)                      │
└─────────────────────────────────────────────────────────────────┘

User asks: "How to track shipment?"
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. GENERATE QUERY EMBEDDING                                      │
│    File: rag_service.py                                          │
│    Method: query_knowledge_base()                                │
│                                                                   │
│    "How to track shipment?" → embedding_model.encode()           │
│                            → query_vector[384]                    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SIMILARITY SEARCH                                             │
│    Database: PostgreSQL with pgvector extension                  │
│    Index: HNSW (Hierarchical Navigable Small World)            │
│                                                                   │
│    SQL Query (simplified):                                       │
│    SELECT                                                         │
│      document,                                                    │
│      cmetadata,                                                   │
│      embedding <=> query_vector AS distance  -- Cosine distance  │
│    FROM langchain_pg_embedding                                   │
│    WHERE cmetadata->>'tenant_id' = 'abc-123'  -- ← Filter       │
│    ORDER BY distance ASC                                         │
│    LIMIT 5;  -- top_k                                            │
│                                                                   │
│    How HNSW works:                                               │
│    1. Navigate hierarchical graph of vectors                     │
│    2. Find approximate nearest neighbors                          │
│    3. Much faster than brute-force comparison                    │
│    4. Trade-off: 95%+ accuracy, 100x faster                     │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. POST-QUERY VALIDATION (RECOMMENDED)                          │
│    Status: ⚠️ NOT IMPLEMENTED (Issue #2)                        │
│                                                                   │
│    For each result:                                              │
│      if result.metadata["tenant_id"] != current_tenant_id:      │
│        raise SecurityError("Cross-tenant leak!")                 │
│                                                                   │
│    Why needed:                                                    │
│    - Defense in depth (backup if PgVector filter fails)          │
│    - Detect silent data leakage                                  │
│    - Compliance requirement (SOC 2, ISO 27001)                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FORMAT RESULTS                                                │
│    File: rag_service.py                                          │
│                                                                   │
│    For each retrieved chunk:                                     │
│    {                                                              │
│      "content": "To track shipment, go to...",                   │
│      "formatted_content": "[Section 2.3: Track and Trace]\n\n..." │
│      "metadata": {...},                                           │
│      "distance": 0.23,  -- Lower = more similar                 │
│      "rank": 1                                                    │
│    }                                                              │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. GENERATE RESPONSE (Agent + LLM)                              │
│    File: domain_agents.py                                        │
│                                                                   │
│    Agent receives:                                               │
│    - User query: "How to track shipment?"                        │
│    - Retrieved chunks: [...5 relevant chunks...]                 │
│                                                                   │
│    Agent prompt:                                                 │
│    "You are a support agent. Use the following context to       │
│     answer the user's question:                                  │
│                                                                   │
│     [Section 2.3: Track and Trace]                              │
│     To track shipment, navigate to...                            │
│                                                                   │
│     [Section 2.3.1: API Integration]                            │
│     For API access, use endpoint...                              │
│                                                                   │
│     User question: How to track shipment?                        │
│                                                                   │
│     Answer:"                                                      │
│                                                                   │
│    LLM generates response based on retrieved context             │
└─────────────────────────────────────────────────────────────────┘
```

---

### Key Customization Points in the Flow

| Step | What You Can Customize | How | Impact |
|------|------------------------|-----|--------|
| **1. Load** | Document type support | Add new loader in `document_processor.py` | Support .xlsx, .pptx, .html |
| **2. Chunk** | Chunking strategy | `chunk_size`, `chunk_overlap`, `separators` | Better context windows |
| **2. Chunk** | Splitting logic | Change to `SentenceTransformersTokenTextSplitter` | Token-aware chunking |
| **3. Metadata** | Section tracking | Enhance DOCX heading detection | Better section context |
| **4. Embedding** | Model selection | Change to multilingual model | Support Vietnamese |
| **4. Embedding** | Dimension | Use 768D or 1536D models | Higher accuracy |
| **5. Index** | Distance metric | COSINE vs. EUCLIDEAN vs. INNER_PRODUCT | Different similarity |
| **5. Index** | HNSW parameters | `m=16`, `ef_construction=64` | Speed vs. accuracy |
| **Retrieval** | top_k | Retrieve 3 vs. 5 vs. 10 chunks | Context size |
| **Retrieval** | Filtering | Add section_filter, date_range | Targeted search |
| **Retrieval** | Reranking | Add cross-encoder reranking | Better relevance |

---

## Summary for BMad

### Your Questions Answered:

**Q2: Any other way besides new table?**
✅ **Yes! Use `tool_configs.config` JSONB** - Extend RAGToolConfig with chunking + embedding parameters

**Q3: Should supervisor be in DB?**
✅ **Yes! Insert supervisor as regular agent** - Makes prompt customizable per tenant

**RAG Validation?**
✅ **Defense in depth** - Verify every retrieved document belongs to requesting tenant (catch PgVector filter failures)

**RAG Flow?**
✅ **Full pipeline documented** - Load → Chunk → Embed → Store → Query → Validate → Generate

---

## Next Steps

**Option A: Implement RAG config in tool_configs (4 hours)**
1. Extend RAGToolConfig class
2. Update RAGTool to pass config to RAGService
3. Update database with example configs

**Option B: Add supervisor to database (2 hours)**
1. Insert supervisor into agent_configs
2. Modify supervisor_agent.py to load from DB
3. Test with custom prompt

**Option C: Implement RAG validation (30 min)**
1. Add post-query validation loop
2. Add SecurityError exception
3. Add logging and metrics

**Your choice?** 🎯
