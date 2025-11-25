# RAG Flow Analysis & Improvements

Complete analysis of current RAG implementation, how agents use it, issues, and proposed improvements.

## 📊 Current RAG Flow

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Admin Knowledge API                       │
│              (backend/src/api/admin/knowledge.py)            │
├──────────────────────────────────────────────────────────────┤
│  1. Upload Document (PDF, DOCX, TXT)                         │
│  2. Ingest Documents (batch)                                 │
│  3. Get Knowledge Base Stats                                 │
│  4. Delete Documents                                         │
│  5. Upload PDF (DEPRECATED)                                  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              RAG Service & Document Processing               │
│    (src/services/rag_service.py + document_processor.py)    │
├──────────────────────────────────────────────────────────────┤
│  - Process documents (PDF, DOCX, TXT)                        │
│  - Chunk text (configurable size/overlap)                    │
│  - Generate embeddings (all-MiniLM-L6-v2, 384-dim)          │
│  - Store in PgVector (PostgreSQL + pgvector)                │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│           Vector Store (PgVector in PostgreSQL)              │
│         Multi-tenant isolation via tenant_id                 │
├──────────────────────────────────────────────────────────────┤
│  knowledge_documents table:                                  │
│  - id (document chunk ID)                                    │
│  - embedding (384-dimensional vector)                        │
│  - metadata (JSONB: tenant_id, source, etc.)                │
│  - content (text content of chunk)                          │
│  - created_at                                                │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    Agent RAG Tool                            │
│              (src/tools/rag.py - RAGTool)                   │
├──────────────────────────────────────────────────────────────┤
│  - Invoked by DomainAgent during conversation                │
│  - Query: Search knowledge base                              │
│  - Returns: Top-K similar documents                          │
│  - Used by: All agents with RAG enabled                      │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│            Domain Agents & Conversation                      │
│     (src/services/domain_agents.py - DomainAgent)           │
├──────────────────────────────────────────────────────────────┤
│  - Receive RAG tool search results                           │
│  - Incorporate into LLM context                              │
│  - Generate response using RAG-augmented knowledge           │
└──────────────────────────────────────────────────────────────┘
```

## 🔄 Step-by-Step Flow

### Step 1: Admin Uploads Document

**Endpoint**: `POST /api/admin/tenants/{tenant_id}/knowledge/upload-document`

```python
# Request
file: PDF/DOCX/TXT
document_name: Optional[str]

# Processing
1. Validate file format (.pdf, .docx, .doc, .txt)
2. Save to temporary file
3. Call rag_service.ingest_document(tenant_id, file_path, metadata)
```

### Step 2: Document Processing

**Service**: `document_processor.py`

```
Input: file_path (PDF/DOCX/TXT)
  │
  ├─→ Load Document
  │   ├─ PDF: PyPDF2 / pdfplumber
  │   ├─ DOCX: python-docx (with heading tracking)
  │   └─ TXT: Plain text read
  │
  ├─→ Extract Text
  │   └─ For DOCX: Preserve section hierarchy
  │
  ├─→ Chunk Text
  │   ├─ Size: 400-600 characters (configurable)
  │   ├─ Overlap: 200 characters
  │   └─ Separators: ["\n\n", "\n", ". ", " ", ""]
  │
  ├─→ Enrich Metadata
  │   ├─ file_type: .pdf, .docx, .txt
  │   ├─ section_title: (DOCX only)
  │   ├─ section_number: (DOCX only)
  │   ├─ paragraph_index: Position in document
  │   ├─ is_heading: Boolean flag
  │   ├─ source: "document"
  │   └─ original_filename: filename
  │
  └─→ Generate Embeddings
      └─ Model: all-MiniLM-L6-v2 (384 dimensions)
```

### Step 3: Store in PgVector

**Service**: `rag_service.py`

```sql
-- Database table structure (simplified)
CREATE TABLE langchain_pg_embedding (
    id BIGSERIAL PRIMARY KEY,
    collection_id UUID,
    embedding vector(384),
    document TEXT,
    cmetadata JSONB,  -- Contains tenant_id, source, etc.
    created_at TIMESTAMP
);

-- Tenant isolation via cmetadata JSONB filter
-- WHERE cmetadata->>'tenant_id' = ?
```

### Step 4: Agent Uses RAG Tool

**Flow**: User Message → DomainAgent → RAGTool → Search Query

```python
# In DomainAgent.invoke()

# 1. User sends message
user_message = "What are our shipping policies?"

# 2. Agent extracts intent & entities
intent = "query_policy"
entities = {"topic": "shipping policies"}

# 3. Agent has RAG tool loaded
if self.tools:
    # RAG tool is in the tools list
    rag_tool = self.tools[0]  # Often RAG is tool priority 1

# 4. LLM decides to call RAG tool
tool_call = {
    "tool_name": "rag_search",
    "tool_args": {
        "query": "shipping policies procedures",
        "top_k": 5
    }
}

# 5. RAGTool executes search
results = rag_tool.execute(tool_call["tool_args"])
# Returns: [{text: "...", metadata: {...}}, ...]

# 6. Agent formats response with RAG results
response = f"Based on our documentation: {results[0]['text']}\n..."
```

---

## 🔍 Analysis: Issues & Observations

### Issue 1: **Unused/Deprecated API - `upload_pdf`**

**Location**: `knowledge.py:342-362`

```python
@router.post("/tenants/{tenant_id}/knowledge/upload-pdf", ...)
async def upload_pdf(...):
    """DEPRECATED: Use /upload-document instead"""
    return await upload_document(...)
```

**Problem**:
- Marked as DEPRECATED but still in code
- Duplicate of `/upload-document` with same functionality
- Just redirects to `upload_document` (line 362)
- Creates API confusion (two endpoints doing same thing)
- Dead code: never called in tests or frontend

**Impact**:
- API bloat
- Documentation confusion
- Maintenance burden

**Recommendation**: ✂️ **REMOVE THIS ENDPOINT**

### Issue 2: **Unused/Redundant API - `ingest_documents`**

**Location**: `knowledge.py:26-101`

```python
@router.post("/tenants/{tenant_id}/knowledge", ...)
async def ingest_documents(
    request: DocumentIngestRequest,  # Raw documents + metadata
):
    # Creates collection (if not exists)
    # Ingests raw documents
```

**Problem**:
- Takes raw document strings and metadata
- No file parsing (already done)
- Less flexible than file upload (no DOCX section hierarchy)
- Duplicate endpoint pattern
- Unclear use case

**Current Usage**:
- Could be used for programmatic ingestion of pre-processed text
- But same can be done via `/upload-document` with TXT file

**Recommendation**:
- **KEEP** if used programmatically (e.g., from chat history)
- **DEPRECATE** otherwise (consolidate to one endpoint)

### Issue 3: **Inefficient Metadata Handling**

**Current**:
```python
additional_metadata = {
    "uploaded_by_admin": admin_payload.get("user_id"),
    "original_filename": file.filename,
    "source": "document",
    "source_detail": "upload_document",
}
# Plus inline metadata in document processing
```

**Issues**:
- Metadata duplicated (set in API, also in document processor)
- No standardized metadata schema
- Metadata inconsistency across ingestion methods
- No metadata versioning

### Issue 4: **No Query Optimization in RAGTool**

**Current Flow**:
```python
# RAGTool._search()
results = vector_store.similarity_search(
    query=query,
    k=top_k,  # Usually 5
    filter={"tenant_id": tenant_id}
)
# Returns raw results, no ranking or filtering
```

**Issues**:
- No semantic relevance threshold
- No duplicate detection in results
- No result deduplication by source document
- All results ranked equally (cosine similarity only)

**Improvement Opportunity**: Add score-based filtering

### Issue 5: **No Query Validation**

**Current**:
```python
tool_args = {
    "query": user_input,  # Raw, unvalidated
    "top_k": 5
}
```

**Issues**:
- No minimum query length check
- No spam/invalid query filtering
- Very short queries return low-quality results
- No query expansion or synonym handling

**Improvement**: Add query validation & expansion

### Issue 6: **Duplicate Collection Creation**

**Current**:
```python
# In upload_document()
rag_service = get_rag_service()
# No explicit collection creation

# In ingest_documents()
collection_result = rag_service.create_tenant_collection(...)
# Explicitly creates collection
```

**Issues**:
- `upload_document` doesn't check if collection exists first
- `ingest_documents` explicitly creates (safer but redundant code)
- Inconsistent patterns
- Potential for race conditions

### Issue 7: **No Batch Processing Optimization**

**Current**:
- Each file upload processed sequentially
- No streaming for large files
- No async processing for document chunking
- Blocking I/O for file reading

**Improvement**: Add async processing, streaming for large uploads

---

## 🚀 Proposed Improvements

### Improvement 1: Consolidate Upload Endpoints ✂️

**Current State**:
```
POST /tenants/{tenant_id}/knowledge/upload-pdf       [DEPRECATED]
POST /tenants/{tenant_id}/knowledge/upload-document  [ACTIVE]
POST /tenants/{tenant_id}/knowledge                  [BATCH INGEST]
```

**Proposed**:
```
POST /tenants/{tenant_id}/knowledge/upload           [Single: handles PDF, DOCX, TXT]
POST /tenants/{tenant_id}/knowledge/batch-ingest     [Batch: raw documents + metadata]
DELETE /tenants/{tenant_id}/knowledge/{doc_id}       [Delete single doc]
GET /tenants/{tenant_id}/knowledge/stats             [Stats, unchanged]
```

**Benefits**:
- Clearer API surface
- Remove confusion (no deprecated endpoint)
- Consistent naming

### Improvement 2: Add Query Validation & Expansion

```python
def _validate_and_expand_query(query: str) -> str:
    """
    Validate RAG query and expand if needed.

    Rules:
    - Minimum 3 characters
    - Remove common stop words
    - Expand acronyms if known
    - Add synonyms for better matching
    """
    if len(query.strip()) < 3:
        raise ValueError("Query too short")

    # Expand common terms
    expansions = {
        "SSO": "single sign on authentication",
        "API": "application programming interface",
        "FAQ": "frequently asked questions",
    }

    for acronym, expansion in expansions.items():
        query = query.replace(acronym, f"{acronym} {expansion}")

    return query
```

### Improvement 3: Add Result Score Filtering

```python
def _filter_results_by_score(
    results: List[Dict],
    min_score: float = 0.5
) -> List[Dict]:
    """
    Filter RAG results by semantic relevance score.

    - Filter out low-quality matches
    - Deduplicate by source document
    - Sort by relevance
    """
    filtered = []
    seen_sources = set()

    for result in results:
        # Skip if score too low
        if result.get("score", 0) < min_score:
            continue

        # Skip if source already included
        source = result.get("metadata", {}).get("original_filename")
        if source in seen_sources:
            continue

        filtered.append(result)
        seen_sources.add(source)

    return filtered
```

### Improvement 4: Standardize Metadata Schema

```python
# Define standard metadata structure
class DocumentMetadata:
    # Upload context
    uploaded_by: str          # Admin user ID
    uploaded_at: datetime
    upload_method: str        # "file_upload", "batch_ingest"

    # Document info
    source_filename: str
    source_type: str          # ".pdf", ".docx", ".txt"
    source: str               # "document", "chat_history"
    source_detail: str        # Specific origin

    # DOCX-specific
    section_title: Optional[str]
    section_number: Optional[str]

    # Chunk info
    chunk_index: int
    is_heading: bool
    paragraph_index: int

    # Versioning
    version: int              # For document updates
    deprecated: bool
```

### Improvement 5: Add Batch Processing with Progress Tracking

```python
@router.post("/tenants/{tenant_id}/knowledge/batch-ingest")
async def batch_ingest_documents(
    tenant_id: str,
    request: BatchDocumentsRequest,  # List of documents
    db: Session = Depends(get_db),
    admin_payload: dict = Depends(require_admin_role),
):
    """
    Batch ingest documents with progress tracking.

    - Validate all documents before processing
    - Process in parallel (async)
    - Track progress (completed/failed)
    - Rollback on critical errors
    """

    results = {
        "total": len(request.documents),
        "successful": 0,
        "failed": 0,
        "errors": []
    }

    for doc in request.documents:
        try:
            result = await _ingest_single_document(doc)
            results["successful"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "document": doc.name,
                "error": str(e)
            })

    return results
```

### Improvement 6: Add Query Performance Caching

```python
class RAGQueryCache:
    """Cache RAG query results to avoid redundant similarity searches."""

    def __init__(self, ttl_seconds: int = 3600):
        self.cache = {}
        self.ttl = ttl_seconds

    def get(self, tenant_id: str, query: str) -> Optional[List]:
        """Get cached results if recent enough."""
        key = f"{tenant_id}:{query}"
        if key in self.cache:
            result, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return result
        return None

    def set(self, tenant_id: str, query: str, results: List):
        """Cache query results."""
        key = f"{tenant_id}:{query}"
        self.cache[key] = (results, time.time())
```

---

## 📋 API Endpoint Analysis

### ✅ KEEP Endpoints

| Endpoint | Status | Why |
|----------|--------|-----|
| `POST /upload-document` | Active | Main file upload, flexible format support |
| `POST /batch-ingest` | Should add | Programmatic batch ingestion |
| `GET /knowledge/stats` | Active | Essential for monitoring |
| `DELETE /knowledge/{doc_id}` | Active | Document cleanup |

### ❌ REMOVE Endpoints

| Endpoint | Status | Why |
|----------|--------|-----|
| `POST /upload-pdf` | DEPRECATED | Redundant with `/upload-document` |

### 🤔 REVIEW Endpoints

| Endpoint | Status | Recommendation |
|----------|--------|-----------------|
| `POST /knowledge` (ingest_documents) | Active | Deprecate if only used internally |

---

## 🎯 Implementation Priority

### Priority 1: IMMEDIATE (Security + Performance)
- ✂️ Remove deprecated `/upload-pdf` endpoint
- ✨ Add query validation in RAGTool
- 🔒 Add result score filtering (minimum relevance)

### Priority 2: HIGH (Quality)
- 📊 Standardize metadata schema
- ✅ Add result deduplication by source
- 📈 Add performance metrics logging

### Priority 3: MEDIUM (UX)
- 🔄 Add batch progress tracking
- 💾 Add query result caching
- 📝 Improve error messages

### Priority 4: NICE-TO-HAVE (Advanced)
- 🚀 Async document processing
- 🔍 Query expansion with synonyms
- 📊 Relevance score tuning UI

---

## 💻 Implementation Files to Update

1. **`backend/src/api/admin/knowledge.py`** ← MAIN TARGET
   - Remove `/upload-pdf` endpoint
   - Add query validation to RAGTool integration
   - Improve error handling
   - Add metadata standardization

2. **`backend/src/services/rag_service.py`**
   - Add result filtering by score
   - Add deduplication logic
   - Add query validation

3. **`backend/src/tools/rag.py`**
   - Add query validation
   - Add result filtering
   - Add performance metrics

4. **`backend/src/schemas/admin.py`**
   - Add/update metadata schema
   - Add validation models

---

## 📝 Summary

**Current State**:
- ✅ Core RAG functionality works (PgVector + embeddings)
- ✅ Multi-tenant isolation enforced
- ✅ File format support (PDF, DOCX, TXT)
- ⚠️ Deprecated endpoint still in code
- ⚠️ No query validation
- ⚠️ No result relevance filtering
- ⚠️ Metadata handling inconsistent

**After Improvements**:
- ✅ Cleaner API (no deprecated endpoints)
- ✅ Better result quality (score filtering, deduplication)
- ✅ Safer operations (query validation)
- ✅ Consistent metadata across all methods
- ✅ Better monitoring (metrics, caching)

---

**Next**: See optimized `knowledge.py` file for implementation details.
