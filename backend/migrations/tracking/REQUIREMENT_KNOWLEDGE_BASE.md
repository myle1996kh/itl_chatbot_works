# Requirement: Knowledge Base Statistics & Metadata

**Status:** Pending Implementation
**Assigned To:** Dev Agent 3
**Created:** 2025-11-11
**Priority:** HIGH - Enables knowledge base management
**Estimated Hours:** 3 hours

---

## 🎯 Objective

Implement endpoints to retrieve knowledge base statistics, document count, and metadata with tenant isolation via pgvector.

**Current Issue:**
```
GET /api/{tenant_id}/knowledge/stats
Status: 200 OK
Response: Empty or zeros
UI: "0 documents" (no KB visible)
```

**Desired State:**
```
GET /api/{tenant_id}/knowledge/stats
Status: 200 OK
Response: {
  "total_documents": 42,
  "total_chunks": 156,
  "vector_dimension": 384,
  "embedding_model": "all-MiniLM-L6-v2",
  "last_updated": "2025-11-10T15:30:00Z",
  "disk_usage_mb": 2.45
}

GET /api/{tenant_id}/knowledge/documents?limit=20&offset=0
Status: 200 OK
Response: [
  {
    "document_id": "uuid",
    "filename": "eTMS_Guidelines_v2.pdf",
    "document_type": "pdf",
    "size_bytes": 1024000,
    "chunk_count": 12,
    "uploaded_at": "2025-11-10T10:00:00Z"
  },
  ...
]
UI: Knowledge base displays with statistics
```

---

## 🔍 Root Cause Analysis

**Problem:** Frontend shows "0 documents" in knowledge base

**Why:** Backend endpoints don't query knowledge_documents table or pgvector statistics

**Solution:** Database schema ready with:
- pgvector extension enabled
- knowledge_documents table with tenant isolation
- Vector embeddings with all-MiniLM-L6-v2 (384 dimensions)

---

## 📋 Requirements

### Requirement 1: Knowledge Base Stats Endpoint

**What:** Create `GET /api/{tenant_id}/knowledge/stats` endpoint

**Where:** `backend/src/api/knowledge.py` (new file)

**Implementation:**
```python
@router.get("/knowledge/stats", response_model=KnowledgeStatsResponse)
async def get_knowledge_stats(
    tenant_id: str,
    db: Session = Depends(get_db)
) -> KnowledgeStatsResponse:
    """Get knowledge base statistics for a tenant."""
    # 1. Validate tenant_id exists
    # 2. Query knowledge_documents:
    #    - COUNT documents
    #    - SUM chunks
    #    - Get last_updated timestamp
    # 3. Get embedding model config from settings
    # 4. Calculate disk usage (rough estimate)
    # 5. Return stats
```

**Response Schema (KnowledgeStatsResponse):**
```python
class KnowledgeStatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    vector_dimension: int = 384  # all-MiniLM-L6-v2
    embedding_model: str = "all-MiniLM-L6-v2"
    last_updated: Optional[datetime]
    disk_usage_mb: float
```

**Acceptance Criteria:**
- [ ] Endpoint created at `GET /api/{tenant_id}/knowledge/stats`
- [ ] Returns 200 with accurate document count
- [ ] Returns total chunks from knowledge_documents
- [ ] Shows last_updated from most recent document
- [ ] Includes embedding model name and dimension
- [ ] Calculates disk usage estimate
- [ ] Tenant isolation enforced
- [ ] Fast response (< 50ms)
- [ ] Handles empty knowledge base gracefully

---

### Requirement 2: Documents List Endpoint

**What:** Create `GET /api/{tenant_id}/knowledge/documents` endpoint

**Where:** `backend/src/api/knowledge.py`

**Implementation:**
```python
@router.get("/knowledge/documents", response_model=DocumentListResponse)
async def get_knowledge_documents(
    tenant_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("uploaded_at", regex="^(uploaded_at|filename|size)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
) -> DocumentListResponse:
    """Get paginated list of documents in knowledge base."""
    # 1. Validate tenant_id exists
    # 2. Query knowledge_documents:
    #    - Filter by tenant_id
    #    - Order by sort_by column
    #    - Apply limit/offset
    # 3. For each document, count chunks
    # 4. Return paginated response
```

**Response Schema (DocumentListResponse):**
```python
class DocumentInfo(BaseModel):
    document_id: UUID
    filename: str
    document_type: str  # pdf, txt, docx, etc.
    size_bytes: int
    chunk_count: int
    uploaded_at: datetime
    uploaded_by: str

class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]
    total: int
    limit: int
    offset: int
    has_more: bool
```

**Acceptance Criteria:**
- [ ] Endpoint created at `GET /api/{tenant_id}/knowledge/documents`
- [ ] Returns paginated list with metadata
- [ ] Filters by tenant_id
- [ ] Supports sorting (uploaded_at, filename, size)
- [ ] Supports ascending/descending order
- [ ] Includes chunk count for each document
- [ ] Shows file type and size
- [ ] Tenant isolation enforced
- [ ] Fast response (< 100ms for 100+ documents)
- [ ] Returns pagination metadata

---

### Requirement 3: Document Search Endpoint

**What:** Create `GET /api/{tenant_id}/knowledge/search` endpoint for semantic search

**Where:** `backend/src/api/knowledge.py`

**Implementation:**
```python
@router.post("/knowledge/search", response_model=SearchResultResponse)
async def search_knowledge(
    tenant_id: str,
    query: SearchQuery,
    db: Session = Depends(get_db)
) -> SearchResultResponse:
    """Search knowledge base using semantic similarity."""
    # 1. Validate tenant_id exists
    # 2. Embed query using sentence-transformers
    # 3. Query pgvector for similar chunks:
    #    - Use cosine similarity
    #    - Filter by tenant_id
    #    - Order by similarity score
    #    - Limit to top_k results
    # 4. Return results with scores
```

**Request Schema (SearchQuery):**
```python
class SearchQuery(BaseModel):
    query: str  # Search text
    top_k: int = 5  # Number of results
    similarity_threshold: float = 0.5
```

**Response Schema (SearchResultResponse):**
```python
class SearchResult(BaseModel):
    chunk_id: UUID
    document_id: UUID
    filename: str
    content: str
    similarity_score: float
    position: int  # Chunk position in document

class SearchResultResponse(BaseModel):
    query: str
    results: List[SearchResult]
    count: int
    elapsed_ms: float
```

**Acceptance Criteria:**
- [ ] Endpoint created at `POST /api/{tenant_id}/knowledge/search`
- [ ] Embeds query using sentence-transformers
- [ ] Returns top_k results by cosine similarity
- [ ] Filters by similarity_threshold
- [ ] Includes source document metadata
- [ ] Tenant isolation enforced
- [ ] Fast response (< 200ms)
- [ ] Handles no results gracefully

---

### Requirement 4: Tenant Isolation via pgvector

**What:** Ensure all queries filter by tenant_id in metadata

**Why:** Prevent data leakage between tenants

**Implementation:**
```python
# Query structure with metadata filtering
query = db.query(KnowledgeChunk)\
    .filter(KnowledgeChunk.tenant_id == tenant_id)\
    .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))\
    .limit(top_k)
```

**Acceptance Criteria:**
- [ ] All queries include tenant_id filter
- [ ] Metadata stored with each embedding
- [ ] Vector index respects tenant isolation
- [ ] Cross-tenant queries return 0 results
- [ ] No document leakage in search results

---

## 🗄️ Database Schema (Ready - Seeded via Phase 3)

```sql
CREATE TABLE knowledge_documents (
    document_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    filename VARCHAR(255) NOT NULL,
    document_type VARCHAR(50),
    content TEXT,
    size_bytes INTEGER,
    uploaded_by UUID REFERENCES users(user_id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_uploaded_at (uploaded_at DESC)
);

CREATE TABLE knowledge_chunks (
    chunk_id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES knowledge_documents(document_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    content TEXT NOT NULL,
    embedding vector(384),  -- all-MiniLM-L6-v2 dimension
    position INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_document_id (document_id)
);

CREATE INDEX idx_embedding_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 📊 Test Data

**Ready to Test:**
- ✅ 3 tenants (eTMS, eFMS, Vela)
- ✅ Sample documents can be uploaded via `POST /api/{tenant_id}/knowledge/upload`
- ✅ pgvector extension installed and enabled

**Manual Test:**
1. Upload PDF to knowledge base via admin endpoint
2. Call `GET /api/{tenant_id}/knowledge/stats` → verify count
3. Call `GET /api/{tenant_id}/knowledge/documents` → verify list
4. Call `POST /api/{tenant_id}/knowledge/search` with query → verify results

---

## 🔗 Related Components

| Component | Status | Notes |
|-----------|--------|-------|
| pgvector Extension | ✅ Required | Must be installed: `CREATE EXTENSION vector;` |
| Embedding Service | ✅ Ready | sentence-transformers available |
| Knowledge Models | ✅ Ready | In `src/models/knowledge.py` |
| Database Schema | ✅ Ready | Tables created via alembic |
| Tenant Isolation | ✅ Ready | tenant_id filtering enforced |

---

## ✅ Definition of Done (DoD)

1. **Code Complete**
   - [ ] GET /knowledge/stats endpoint
   - [ ] GET /knowledge/documents endpoint
   - [ ] POST /knowledge/search endpoint
   - [ ] Response schemas defined
   - [ ] Pagination logic working
   - [ ] Proper error handling

2. **Tests Passing**
   - [ ] Unit tests for query logic (100% coverage)
   - [ ] Integration tests for all endpoints
   - [ ] E2E test: Upload → Stats → Search
   - [ ] Tenant isolation verified

3. **Documentation**
   - [ ] Docstrings on all endpoints
   - [ ] Response schemas documented
   - [ ] Error codes documented
   - [ ] Example queries provided

4. **Performance**
   - [ ] Stats query < 50ms
   - [ ] Document list < 100ms
   - [ ] Search query < 200ms
   - [ ] Proper indexes used

5. **Security**
   - [ ] Tenant isolation verified
   - [ ] Input validation on all params
   - [ ] Query injection prevention
   - [ ] Rate limiting if needed

6. **Frontend Integration**
   - [ ] Frontend can fetch stats
   - [ ] Knowledge base displays in UI
   - [ ] Document count shows correctly
   - [ ] Search works from chat interface

---

## 🚀 Implementation Notes

**Key Files to Modify:**
1. `backend/src/api/knowledge.py` - Create new endpoints
2. `backend/src/schemas/knowledge.py` - Add response schemas
3. `backend/src/services/embedding_service.py` - Use for search embeddings
4. `backend/src/main.py` - Register router

**Estimated Complexity:** Medium (3 hours)

**Blockers:** None - database ready, pgvector installed

**Dependencies:**
- Phase 3 complete (database seeded)
- pgvector extension enabled
- Embedding service working

---

## 📞 Questions to Resolve

- Should deleted documents be soft-deleted or hard-deleted?
- Should search results include chunk position in document?
- Should stats include approximate row counts or exact counts?

---

**Status:** Ready for Dev Agent 3 implementation
**Next Step:** Begin endpoint implementation after database migration runs successfully
