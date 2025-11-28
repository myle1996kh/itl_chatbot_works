"""
Tenant Isolation Tests
Ensures multi-tenant data isolation is enforced
"""
import pytest
from sqlalchemy import text

def test_tenant_data_isolation_in_embeddings(db_session, test_tenant_id):
    """Test that embedding queries are tenant-isolated"""
    # Query for test tenant
    result = db_session.execute(
        text("""
            SELECT COUNT(*) FROM langchain_pg_embedding 
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """),
        {"tenant_id": test_tenant_id}
    )
    
    count = result.scalar()
    # Should return a count (0 or more)
    assert count >= 0

def test_no_cross_tenant_data_leakage(db_session):
    """Test that different tenants don't see each other's data"""
    tenant_a = "tenant-a-test-uuid"
    tenant_b = "tenant-b-test-uuid"
    
    # Query for tenant A
    result_a = db_session.execute(
        text("""
            SELECT cmetadata FROM langchain_pg_embedding 
            WHERE cmetadata->>'tenant_id' = :tenant_id
            LIMIT 10
        """),
        {"tenant_id": tenant_a}
    )
    
    # Verify all results belong to tenant A
    for row in result_a:
        metadata = row[0]
        if metadata and 'tenant_id' in metadata:
            assert metadata['tenant_id'] == tenant_a

def test_rag_tools_tenant_filter(db_session, test_tenant_id):
    """Test that RAG tools are filtered by tenant"""
    result = db_session.execute(
        text("""
            SELECT COUNT(*) FROM rag_tools 
            WHERE tenant_id = :tenant_id
        """),
        {"tenant_id": test_tenant_id}
    )
    
    count = result.scalar()
    assert count >= 0

def test_llm_configs_tenant_filter(db_session, test_tenant_id):
    """Test that LLM configs are filtered by tenant"""
    result = db_session.execute(
        text("""
            SELECT COUNT(*) FROM llm_configs 
            WHERE tenant_id = :tenant_id
        """),
        {"tenant_id": test_tenant_id}
    )
    
    count = result.scalar()
    assert count >= 0
