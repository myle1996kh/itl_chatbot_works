# RAG Pipeline Deep Dive

This document explains the retrieval flow, tenant validation, and configurable parameters for the PgVector‑backed RAG service.

```mermaid
flowchart TD
  Q[Query input (tenant_id, query, top_k)] --> VS[PGVector similarity_search_with_score]
  VS --> V{Validate doc.metadata.tenant_id == tenant_id}
  V -- mismatch --> L[Log error + rag_cross_tenant_leak_total.inc()]
  L --> P{enforce_validation?}
  P -- yes --> E1[Raise SecurityError]
  P -- no  --> F[Filter out invalid docs]
  V -- valid --> C[Collect validated results]
  subgraph Configurable
    CFG1[Chunking: chunk_size, chunk_overlap, separators]
    CFG2[Embedding: model, dimension]
    CFG3[Distance Strategy: COSINE/EUCLIDEAN/INNER_PRODUCT]
  end
  CFG1 -.-> VS
  CFG2 -.-> VS
  CFG3 -.-> VS
  C --> R[Return to caller]
```

Key Points
- Defense‑in‑depth: post‑query tenant validation on every result.
- Two modes:
  - Strict: raise `SecurityError` on mismatch.
  - Fail‑open: filter mismatches and continue.
- Metrics: increments `rag_cross_tenant_leak_total{tenant_id, leak_source="pgvector"}`.
- Configuration (per tenant or tool): chunking, embedding model/dimension, distance strategy.

References
- `backend/src/services/rag_service.py`
- `backend/src/utils/metrics.py`
