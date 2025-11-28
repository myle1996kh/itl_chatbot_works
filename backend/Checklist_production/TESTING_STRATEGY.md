# Testing Coverage Strategy

**Project**: ITL Chatbot Multi-Tenant RAG System  
**Date**: 2025-11-27  
**Current Status**: ⚠️ Tests need to be created

---

## 📊 Current Testing Status

### Existing Tests
- **Tests Directory**: `backend/tests/` exists
- **Test Files**: Need to be created
- **Coverage**: 0% (no tests currently)

### Priority: HIGH
Testing is critical for production readiness, especially for:
- Multi-tenant isolation
- Authentication/authorization
- RAG pipeline accuracy
- Data security

---

## 🎯 Testing Strategy

### Phase 1: Critical Path Tests (Priority: HIGH)
Focus on security and core functionality first.

#### 1.1 Authentication & Authorization Tests
**File**: `tests/test_auth.py`

```python
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_auth_required():
    """Test that endpoints require authentication"""
    response = client.post("/api/v1/chat", json={"message": "test"})
    assert response.status_code == 401

def test_valid_jwt_token():
    """Test that valid JWT tokens are accepted"""
    # Use test token from jwt_private.pem
    token = "YOUR_TEST_TOKEN"
    response = client.post(
        "/api/v1/chat",
        json={"message": "test"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code in [200, 422]  # 422 if missing other fields

def test_invalid_jwt_token():
    """Test that invalid tokens are rejected"""
    response = client.post(
        "/api/v1/chat",
        json={"message": "test"},
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401

def test_expired_jwt_token():
    """Test that expired tokens are rejected"""
    # Create expired token
    expired_token = "..."
    response = client.post(
        "/api/v1/chat",
        json={"message": "test"},
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
```

#### 1.2 Tenant Isolation Tests
**File**: `tests/test_tenant_isolation.py`

```python
import pytest
from src.database.connection import get_db_session
from sqlalchemy import text

def test_tenant_data_isolation():
    """Test that tenants can only access their own data"""
    tenant_a = "tenant-a-uuid"
    tenant_b = "tenant-b-uuid"
    
    with get_db_session() as db:
        # Query for tenant A
        result_a = db.execute(text("""
            SELECT COUNT(*) FROM langchain_pg_embedding 
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """), {"tenant_id": tenant_a})
        
        # Query for tenant B
        result_b = db.execute(text("""
            SELECT COUNT(*) FROM langchain_pg_embedding 
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """), {"tenant_id": tenant_b})
        
        # Ensure no cross-tenant data
        assert result_a.scalar() >= 0
        assert result_b.scalar() >= 0

def test_rag_tool_tenant_isolation():
    """Test RAG tools are tenant-isolated"""
    # Test that RAG tools query includes tenant filter
    pass

def test_llm_config_tenant_isolation():
    """Test LLM configs are tenant-isolated"""
    # Test that LLM configs query includes tenant filter
    pass
```

#### 1.3 Document Processing Tests
**File**: `tests/test_document_processor.py`

```python
import pytest
from src.services.document_processor import get_document_processor
from pathlib import Path

def test_load_docx():
    """Test loading DOCX files"""
    processor = get_document_processor()
    # Use a test DOCX file
    docs = processor.load_docx("tests/fixtures/test.docx")
    assert len(docs) > 0
    assert all(hasattr(doc, 'page_content') for doc in docs)

def test_chunk_documents():
    """Test document chunking"""
    processor = get_document_processor(chunk_size=900, chunk_overlap=150)
    # Create test documents
    from langchain_core.documents import Document
    docs = [Document(page_content="Test content " * 100)]
    
    chunks = processor.chunk_documents(docs)
    assert len(chunks) > 0
    assert all(len(chunk.page_content) <= 900 for chunk in chunks)

def test_enrich_metadata():
    """Test metadata enrichment"""
    processor = get_document_processor()
    from langchain_core.documents import Document
    
    docs = [Document(page_content="Test")]
    tenant_id = "test-tenant-uuid"
    
    enriched = processor.enrich_metadata(
        docs,
        tenant_id=tenant_id,
        additional_metadata={"source_detail": "test"}
    )
    
    assert enriched[0].metadata["tenant_id"] == tenant_id
    assert enriched[0].metadata["source_detail"] == "test"
```

#### 1.4 Embedding Service Tests
**File**: `tests/test_embedding_service.py`

```python
import pytest
from src.services.embedding_service import get_embedding_service

def test_embed_text():
    """Test single text embedding"""
    service = get_embedding_service()
    embedding = service.embed_text("Test text")
    
    assert isinstance(embedding, list)
    assert len(embedding) == service.get_dimension()
    assert all(isinstance(v, float) for v in embedding)

def test_embed_texts_batch():
    """Test batch text embedding"""
    service = get_embedding_service()
    texts = ["Text 1", "Text 2", "Text 3"]
    
    embeddings = service.embed_texts(texts)
    
    assert len(embeddings) == 3
    assert all(len(emb) == service.get_dimension() for emb in embeddings)

def test_embedding_consistency():
    """Test that same text produces same embedding"""
    service = get_embedding_service()
    text = "Consistent test text"
    
    emb1 = service.embed_text(text)
    emb2 = service.embed_text(text)
    
    assert emb1 == emb2
```

#### 1.5 RAG Service Tests
**File**: `tests/test_rag_service.py`

```python
import pytest
from src.services.rag_service import get_rag_service

@pytest.fixture
def rag_service():
    return get_rag_service()

def test_retrieve_documents(rag_service):
    """Test document retrieval"""
    tenant_id = "test-tenant-uuid"
    query = "Test query"
    
    results = rag_service.retrieve(
        query=query,
        tenant_id=tenant_id,
        k=5
    )
    
    assert isinstance(results, list)
    assert len(results) <= 5

def test_tenant_filtering(rag_service):
    """Test that retrieval respects tenant filtering"""
    tenant_id = "test-tenant-uuid"
    query = "Test query"
    
    results = rag_service.retrieve(
        query=query,
        tenant_id=tenant_id,
        k=10
    )
    
    # All results should belong to the tenant
    for doc in results:
        assert doc.metadata.get("tenant_id") == tenant_id
```

---

### Phase 2: Integration Tests (Priority: MEDIUM)

#### 2.1 End-to-End RAG Pipeline Test
**File**: `tests/integration/test_rag_pipeline.py`

```python
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_full_rag_pipeline():
    """Test complete RAG flow: upload → chunk → embed → retrieve → generate"""
    # 1. Upload document
    # 2. Query the document
    # 3. Verify response
    pass

def test_multi_tenant_rag():
    """Test RAG with multiple tenants"""
    # Ensure tenant A can't access tenant B's documents
    pass
```

#### 2.2 Database Integration Tests
**File**: `tests/integration/test_database.py`

```python
import pytest
from src.database.connection import get_db_session

def test_database_connection():
    """Test database connectivity"""
    with get_db_session() as db:
        result = db.execute("SELECT 1")
        assert result.scalar() == 1

def test_pgvector_extension():
    """Test pgvector extension is installed"""
    with get_db_session() as db:
        result = db.execute("""
            SELECT * FROM pg_extension WHERE extname = 'vector'
        """)
        assert result.fetchone() is not None
```

---

### Phase 3: Performance Tests (Priority: LOW)

#### 3.1 Load Tests
**File**: `tests/performance/test_load.py`

```python
import pytest
import asyncio
from concurrent.futures import ThreadPoolExecutor

def test_concurrent_requests():
    """Test handling 50+ concurrent requests"""
    # Simulate 50 concurrent chat requests
    pass

def test_large_document_ingestion():
    """Test ingesting 50MB+ documents"""
    # Test with large files
    pass
```

---

## 🛠️ Setup Instructions

### 1. Install Testing Dependencies

```bash
# Add to pyproject.toml or install directly
uv add pytest pytest-asyncio pytest-cov httpx

# For coverage reporting
uv add coverage
```

### 2. Create Test Configuration

**File**: `tests/conftest.py`

```python
import pytest
import os
from dotenv import load_dotenv

# Load test environment
load_dotenv(".env.test")

@pytest.fixture(scope="session")
def test_tenant_id():
    return "3105b788-b5ff-4d56-88a9-532af4ab4ded"

@pytest.fixture(scope="session")
def test_jwt_token():
    # Load test token from jwt_private.pem
    return "YOUR_TEST_TOKEN"

@pytest.fixture(scope="function")
def db_session():
    from src.database.connection import get_db_session
    with get_db_session() as session:
        yield session
        session.rollback()  # Rollback after each test
```

### 3. Create Test Environment File

**File**: `.env.test`

```bash
# Test environment configuration
ENVIRONMENT=test
DISABLE_AUTH=false
JWT_PUBLIC_KEY="<your_test_public_key>"
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatbot_itl_test
REDIS_URL=redis://localhost:6379/1
LOG_LEVEL=DEBUG
```

### 4. Create Test Fixtures

**Directory**: `tests/fixtures/`
- `test.docx` - Sample DOCX file
- `test.pdf` - Sample PDF file
- `test.txt` - Sample text file

---

## 📊 Running Tests

### Run All Tests
```bash
pytest
```

### Run with Coverage
```bash
pytest --cov=src --cov-report=html --cov-report=term
```

### Run Specific Test File
```bash
pytest tests/test_auth.py
```

### Run Specific Test
```bash
pytest tests/test_auth.py::test_auth_required
```

### Run with Verbose Output
```bash
pytest -v
```

---

## 🎯 Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Authentication | 90%+ | HIGH |
| Tenant Isolation | 95%+ | HIGH |
| Document Processing | 80%+ | HIGH |
| Embedding Service | 80%+ | MEDIUM |
| RAG Service | 85%+ | HIGH |
| API Endpoints | 75%+ | MEDIUM |
| Database Layer | 70%+ | MEDIUM |

**Overall Target**: 80%+ coverage for production readiness

---

## ✅ Testing Checklist

### Setup
- [ ] Install pytest and dependencies
- [ ] Create `tests/conftest.py`
- [ ] Create `.env.test`
- [ ] Create test fixtures

### Unit Tests
- [ ] Authentication tests
- [ ] Tenant isolation tests
- [ ] Document processor tests
- [ ] Embedding service tests
- [ ] RAG service tests
- [ ] LLM manager tests

### Integration Tests
- [ ] End-to-end RAG pipeline
- [ ] Database integration
- [ ] Redis caching
- [ ] Multi-tenant scenarios

### Coverage
- [ ] Run coverage report
- [ ] Achieve 80%+ coverage
- [ ] Document untested areas

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
uv add pytest pytest-asyncio pytest-cov httpx

# 2. Create test configuration
cp .env .env.test
# Edit .env.test with test database

# 3. Create first test
mkdir -p tests
touch tests/conftest.py
touch tests/test_auth.py

# 4. Run tests
pytest -v

# 5. Check coverage
pytest --cov=src --cov-report=html
```

---

## 📝 Next Steps

1. **Immediate**: Create authentication tests (highest priority)
2. **This Week**: Create tenant isolation tests
3. **This Month**: Achieve 80%+ coverage
4. **Ongoing**: Add tests for new features

---

**Status**: ⚠️ Tests need to be created  
**Priority**: HIGH (required for production)  
**Estimated Effort**: 2-3 days for Phase 1
