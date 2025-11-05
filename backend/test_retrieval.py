#!/usr/bin/env python3
"""Test script to query the RAG system with 'Tạo giá vốn tuyến đường'."""
import sys
import os

# Add the backend/src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.services.rag_service import get_rag_service
from src.config import settings
from src.utils.logging import get_logger

# Setup logging
logger = get_logger(__name__)

def test_rag_query():
    """Test RAG retrieval with the given query and tenant_id."""
    query = "'Tạo giá vốn tuyến đường'"
    tenant_id = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"
    
    print(f"Query: {query}")
    print(f"Tenant ID: {tenant_id}")
    print("-" * 50)
    
    try:
        # Get RAG service instance
        rag_service = get_rag_service()
        
        # Query the knowledge base
        result = rag_service.query_knowledge_base(
            tenant_id=tenant_id,
            query=query,
            top_k=5  # Get top 5 results
        )
        
        # Print the results
        if result["success"]:
            print(f"Query successful. Found {result['total_results']} documents:")
            print()
            
            for i, doc in enumerate(result['documents'], 1):
                print(f"Document {i}:")
                print(f"  Content: {doc['content'][:200]}...")  # First 200 chars
                print(f"  Metadata: {doc['metadata']}")
                print(f"  Distance: {doc['distance']:.4f}")
                print(f"  Rank: {doc['rank']}")
                print("-" * 30)
        else:
            print(f"Query failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        logger.error(f"Error during RAG query: {str(e)}")
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_rag_query()