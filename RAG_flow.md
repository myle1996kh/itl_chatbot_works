RAG System Architecture Overview
I've analyzed the RAG workflow in your backend. Here's how it works end-to-end:
1. DATA INGESTION FLOW
Admin API Request
    ↓
POST /api/admin/tenants/{tenant_id}/knowledge/upload-pdf
    ↓
[knowledge.py:226-324]
    - Validates PDF file
    - Saves to temp location
    - Calls RAG Service
    ↓
RAGService.ingest_pdf()
[rag_service.py:430-492]
    ↓
DocumentProcessor.process_pdf()
[document_processor.py:221-281]
    │
    ├─→ 1. Load PDF (PyPDFLoader)
    │       Returns: List of Documents (one per page)
    │       Metadata: {source, page}
    │
    ├─→ 2. Chunk Documents (RecursiveCharacterTextSplitter)
    │       Splits: 1000 chars per chunk, 200 char overlap
    │       Adds: chunk_index, chunk_total to metadata
    │
    └─→ 3. Enrich Metadata
            Adds: tenant_id, ingested_at, custom fields
            [document_processor.py:165-219]
    ↓
RAGService.ingest_documents()
[rag_service.py:177-251]
    - For each document chunk:
        • Generate embedding (384-dim vector)
        • Add to metadata: tenant_id, doc_id
    ↓
PGVector Store
    - Table: langchain_pg_embedding
    - Stores: embedding vectors + JSONB metadata
    - Multi-tenant isolation: tenant_id in metadata
Key Details:
EmbeddingService [embedding_service.py]: Uses all-MiniLM-L6-v2 (384 dimensions)
Batch Processing: Embeddings generated via SentenceTransformer
Database: PostgreSQL with pgvector extension
Storage: All tenants share same table, isolated by tenant_id field
2. RETRIEVAL FLOW (RAG Query)
Agent/User Query
    ↓
RAGTool.execute()
[tools/rag.py:59-110]
    ↓
RAGService.query_knowledge_base()
[rag_service.py:253-320]
    │
    ├─→ Get PGVector Store Instance
    │   [rag_service.py:65-104]
    │   - Connection: PostgreSQL + pgvector extension
    │   - Distance Strategy: COSINE
    │
    ├─→ Similarity Search
    │   vector_store.similarity_search_with_score(
    │       query=query_text,
    │       k=top_k (default 5),
    │       filter={"tenant_id": tenant_id}  ← Multi-tenant isolation
    │   )
    │
    └─→ Format Results
        For each result (Document, score):
        - content: doc.page_content
        - metadata: doc.metadata
        - distance: cosine distance (0=identical, 2=opposite)
        - rank: 1, 2, 3...
    ↓
Return Results
    {
        "success": True,
        "tenant_id": tenant_id,
        "query": query_text,
        "documents": [
            {
                "content": "...",
                "metadata": {...},
                "distance": 0.15,
                "rank": 1
            },
            ...
        ],
        "total_results": 5
    }
Multi-Tenancy Isolation:
All tenants share the same table langchain_pg_embedding
Queries filtered by: WHERE cmetadata->>'tenant_id' = :tenant_id
No cross-tenant data leakage
3. GENERATION FLOW (Agent Integration)
Agent Message Processing
    ↓
Agent Tool Registry
    │
    └─→ RAGTool.create_langchain_tool()
        [tools/rag.py:113-178]
        │
        ├─→ Creates Pydantic InputModel from schema
        │   Input: {query: str}
        │
        ├─→ Wraps as LangChain StructuredTool
        │   Name: "knowledge_base_search" (configurable)
        │   Description: "Search company knowledge base"
        │
        └─→ Returns: StructuredTool
    ↓
Agent LLM Calls Tool
    Agent decides → "I need to search for information"
    ↓
Tool Executes
    RAGTool._execute(**kwargs)
    - Extracts query from kwargs
    - Validates not empty
    - Calls RAGService.query_knowledge_base()
    ↓
Documents Retrieved
    Top-k relevant documents with scores
    ↓
Agent Uses Results
    Agent incorporates retrieved docs into LLM context
    LLM generates response using knowledge base info
4. DATA FLOW DIAGRAM
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  PDF File → Load → Chunk → Enrich → Embed → PGVector DB    │
│   (bytes)    (text)  (1K)   (meta)  (384d)  (multi-tenant) │
│                                                               │
│  Storage: langchain_pg_embedding table                       │
│  Metadata (JSONB): {tenant_id, doc_id, page, chunk_index}  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   RETRIEVAL PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Query → Embed → Similarity Search → Filter by tenant_id   │
│  (text)  (384d)  (cosine distance)   (multi-tenant)         │
│                                                               │
│  ↓                                                            │
│                                                               │
│  Return: Top-k documents with metadata & scores             │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  GENERATION PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Agent decides to use RAG tool                              │
│       ↓                                                       │
│  RAGTool executes with query                                │
│       ↓                                                       │
│  Retrieved documents added to LLM context                   │
│       ↓                                                       │
│  LLM generates response using knowledge base                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
5. KEY COMPONENTS BREAKDOWN
Component	File	Purpose
EmbeddingService	embedding_service.py	Generates 384-dim embeddings using all-MiniLM-L6-v2
DocumentProcessor	document_processor.py	Loads PDFs, chunks (1K chars, 200 overlap), enriches metadata
RAGService	rag_service.py	Core RAG logic: ingest, query, delete documents
RAGTool	tools/rag.py	LangChain-compatible tool wrapper for agents
Admin API	api/admin/knowledge.py	HTTP endpoints for PDF upload & knowledge management
Database	PostgreSQL + pgvector	Stores vectors & metadata with multi-tenant isolation
6. MULTI-TENANCY ISOLATION
# Ingestion: tenant_id added to metadata
metadata["tenant_id"] = str(tenant_id)

# Retrieval: filtered by tenant_id
filter={"tenant_id": str(tenant_id)}

# Raw SQL fallback
WHERE cmetadata->>'tenant_id' = :tenant_id
Guarantees:
✅ No cross-tenant data access
✅ All queries isolated by tenant_id
✅ Works with shared PostgreSQL table
7. ERROR HANDLING
Each component has:
Try/except blocks with structured logging
Returns {"success": True/False, "error": "..."} format
Logs events: ingestion, retrieval, errors with context
Update Todos

Analyze RAG data ingestion flow

Analyze RAG retrieval mechanism

Analyze RAG tool integration with agent

Create comprehensive documentation
Summary
Your RAG system is a 3-stage pipeline:
INGEST (Admin API → PDF Upload): Load PDF → Split into chunks → Generate embeddings → Store in PgVector
RETRIEVE (Agent Query): Embed user query → Similarity search → Filter by tenant_id → Return top-k docs
GENERATE (LLM Response): RAGTool provides retrieved docs to agent → LLM incorporates knowledge → Response generated
The system ensures multi-tenant isolation at every stage by filtering/storing the tenant_id field in the PostgreSQL metadata.