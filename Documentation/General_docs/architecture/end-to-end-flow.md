# End-to-End Flow

This sequence shows the main request path for a multi-tenant chat request, including authentication, rate limiting, RAG validation, and response handling.

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant API as FastAPI API
  participant MW as Auth Middleware
  participant LLM as LLMManager
  participant RL as RateLimiter (Redis)
  participant RAG as RAGService (PGVector)
  participant DB as PostgreSQL+pgvector

  U->>API: POST /{tenant_id}/chat
  API->>MW: Validate Authorization/JWT
  alt Auth bypass (development only)
    MW-->>API: Inject test tenant_id
  else Production violation
    MW-->>API: 500 SecurityError
  end

  API->>LLM: invoke_llm(messages)
  alt Rate limit exceeded
    LLM->>RL: check_rate_limit()
    RL-->>LLM: is_allowed=false
    LLM-->>API: HTTP 429 (+X-RateLimit headers)
    API-->>U: 429 Too Many Requests
  else Allowed
    LLM->>RL: check_rate_limit()
    RL-->>LLM: is_allowed=true
    LLM->>RAG: query_knowledge_base()
    RAG->>DB: similarity_search_with_score()
    RAG->>RAG: Post-query tenant_id validation
    alt Cross-tenant leak
      RAG->>API: raise SecurityError + metrics
      API-->>U: 500 (incident_id)
    else Validated
      RAG-->>LLM: documents
      LLM-->>API: response
      API-->>U: 200 OK
    end
  end
```

References
- Auth validation: `backend/src/middleware/auth.py`
- Rate limiting: `backend/src/services/llm_manager.py`, `backend/src/utils/rate_limiter.py`
- RAG validation: `backend/src/services/rag_service.py`
- Metrics: `backend/src/utils/metrics.py`
