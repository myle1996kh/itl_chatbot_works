"""
Database Security Migration
Creates indexes for tenant isolation and performance
Run this before production deployment
"""
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not set in .env file")
    exit(1)

print("=" * 70)
print("DATABASE SECURITY MIGRATION")
print("=" * 70)
print()

# Create engine
engine = create_engine(DATABASE_URL)

# SQL statements for indexes
indexes = [
    {
        "name": "idx_embedding_tenant",
        "sql": """
            CREATE INDEX IF NOT EXISTS idx_embedding_tenant 
            ON langchain_pg_embedding ((cmetadata->>'tenant_id'))
        """,
        "description": "Tenant isolation index for fast filtering"
    },
    {
        "name": "idx_embedding_source",
        "sql": """
            CREATE INDEX IF NOT EXISTS idx_embedding_source 
            ON langchain_pg_embedding ((cmetadata->>'source_detail'))
        """,
        "description": "Source detail index for filtering by ingestion method"
    },
    {
        "name": "idx_embedding_document",
        "sql": """
            CREATE INDEX IF NOT EXISTS idx_embedding_document 
            ON langchain_pg_embedding ((cmetadata->>'document_name'))
        """,
        "description": "Document name index for document-specific queries"
    },
    {
        "name": "idx_rag_tools_tenant",
        "sql": """
            CREATE INDEX IF NOT EXISTS idx_rag_tools_tenant 
            ON rag_tools (tenant_id)
        """,
        "description": "RAG tools tenant index"
    },
    {
        "name": "idx_llm_configs_tenant",
        "sql": """
            CREATE INDEX IF NOT EXISTS idx_llm_configs_tenant 
            ON llm_configs (tenant_id)
        """,
        "description": "LLM configs tenant index"
    }
]

print("Creating database indexes for security and performance...\n")

try:
    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()
        
        try:
            for idx in indexes:
                print(f"Creating {idx['name']}...")
                print(f"  Purpose: {idx['description']}")
                
                conn.execute(text(idx['sql']))
                print(f"  ✅ Created successfully\n")
            
            # Commit transaction
            trans.commit()
            
            print("=" * 70)
            print("✅ ALL INDEXES CREATED SUCCESSFULLY")
            print("=" * 70)
            print()
            print("Database is now optimized for:")
            print("  - Fast tenant isolation queries")
            print("  - Efficient source filtering")
            print("  - Document-specific searches")
            print()
            
            # Verify indexes
            print("Verifying indexes...")
            result = conn.execute(text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename IN ('langchain_pg_embedding', 'rag_tools', 'llm_configs')
                ORDER BY tablename, indexname
            """))
            
            print("\nCreated indexes:")
            for row in result:
                print(f"  - {row[0]}")
            
            print("\n✅ Migration complete!")
            
        except Exception as e:
            trans.rollback()
            print(f"\n❌ Error creating indexes: {e}")
            print("Transaction rolled back.")
            raise
            
except Exception as e:
    print(f"\n❌ Database connection failed: {e}")
    print("\nPlease verify:")
    print("  1. DATABASE_URL is correct in .env")
    print("  2. Database is running and accessible")
    print("  3. User has CREATE INDEX permissions")
    exit(1)
