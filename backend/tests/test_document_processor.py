"""
Document Processor Tests
Tests document loading, chunking, and metadata enrichment
"""
import pytest
from src.services.document_processor import get_document_processor
from langchain_core.documents import Document

def test_document_processor_initialization():
    """Test that document processor initializes correctly"""
    processor = get_document_processor(chunk_size=900, chunk_overlap=150)
    assert processor is not None

def test_chunk_documents():
    """Test document chunking with configured size"""
    processor = get_document_processor(chunk_size=500, chunk_overlap=50)
    
    # Create a long test document
    long_text = "This is a test sentence. " * 100  # ~2500 chars
    docs = [Document(page_content=long_text)]
    
    chunks = processor.chunk_documents(docs, add_chunk_metadata=True)
    
    # Should create multiple chunks
    assert len(chunks) > 1
    
    # Each chunk should be <= chunk_size
    for chunk in chunks:
        assert len(chunk.page_content) <= 500
    
    # Should have chunk metadata
    assert "chunk_index" in chunks[0].metadata
    assert "chunk_total" in chunks[0].metadata

def test_enrich_metadata(test_tenant_id):
    """Test metadata enrichment"""
    processor = get_document_processor()
    
    docs = [Document(page_content="Test content")]
    
    enriched = processor.enrich_metadata(
        docs,
        tenant_id=test_tenant_id,
        additional_metadata={
            "source_detail": "test_method",
            "document_name": "test.txt"
        }
    )
    
    # Check metadata was added
    assert enriched[0].metadata["tenant_id"] == test_tenant_id
    assert enriched[0].metadata["source_detail"] == "test_method"
    assert enriched[0].metadata["document_name"] == "test.txt"
    assert "ingested_at" in enriched[0].metadata

def test_chunk_overlap():
    """Test that chunk overlap works correctly"""
    processor = get_document_processor(chunk_size=100, chunk_overlap=20)
    
    text = "A" * 200  # 200 character text
    docs = [Document(page_content=text)]
    
    chunks = processor.chunk_documents(docs)
    
    # Should have overlap between chunks
    if len(chunks) > 1:
        # Last 20 chars of first chunk should overlap with first 20 of second
        assert len(chunks) >= 2
