"""Check knowledge base documents in database."""
from sqlalchemy import create_engine, text
from src.config import settings

tenant_id = "3105b788-b5ff-4d56-88a9-532af4ab4ded"

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    # Count documents
    result = conn.execute(
        text("""
            SELECT COUNT(*) as count
            FROM langchain_pg_embedding
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """),
        {"tenant_id": tenant_id}
    )
    count = result.fetchone()[0]
    print(f"Documents found for tenant {tenant_id}: {count}")
    
    # Show sample documents
    if count > 0:
        result = conn.execute(
            text("""
                SELECT 
                    cmetadata->>'doc_id' as doc_id,
                    cmetadata->>'document_name' as document_name,
                    LEFT(document, 100) as content_preview
                FROM langchain_pg_embedding
                WHERE cmetadata->>'tenant_id' = :tenant_id
                LIMIT 5
            """),
            {"tenant_id": tenant_id}
        )
        print("\nSample documents:")
        for row in result:
            print(f"  - doc_id: {row.doc_id}, name: {row.document_name}")
            print(f"    preview: {row.content_preview}...")
