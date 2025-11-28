"""Check all possible tables for knowledge base data."""
from sqlalchemy import create_engine, text, inspect
from src.config import settings

tenant_id = "3105b788-b5ff-4d56-88a9-532af4ab4ded"

engine = create_engine(settings.DATABASE_URL)
inspector = inspect(engine)

print("=== Checking all tables for tenant data ===\n")

# Check langchain_pg_embedding (main vector store)
print("1. langchain_pg_embedding table:")
with engine.connect() as conn:
    result = conn.execute(
        text("""
            SELECT COUNT(*) as count
            FROM langchain_pg_embedding
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """),
        {"tenant_id": tenant_id}
    )
    count = result.fetchone()[0]
    print(f"   Documents: {count}")
    
    if count > 0:
        result = conn.execute(
            text("""
                SELECT 
                    cmetadata->>'doc_id' as doc_id,
                    cmetadata->>'document_name' as doc_name,
                    cmetadata->>'tenant_id' as tenant_id
                FROM langchain_pg_embedding
                WHERE cmetadata->>'tenant_id' = :tenant_id
                LIMIT 3
            """),
            {"tenant_id": tenant_id}
        )
        print("   Sample rows:")
        for row in result:
            print(f"     - doc_id: {row.doc_id}, name: {row.doc_name}, tenant: {row.tenant_id}")

# Check if there's a langchain_pg_collection table
print("\n2. langchain_pg_collection table:")
try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM langchain_pg_collection"))
        count = result.fetchone()[0]
        print(f"   Collections: {count}")
        
        result = conn.execute(text("SELECT name, cmetadata FROM langchain_pg_collection LIMIT 5"))
        for row in result:
            print(f"     - {row.name}: {row.cmetadata}")
except Exception as e:
    print(f"   Error or table doesn't exist: {e}")

# List all tables
print("\n3. All tables in database:")
tables = inspector.get_table_names()
for table in tables:
    if 'langchain' in table.lower() or 'embedding' in table.lower() or 'vector' in table.lower():
        print(f"   - {table}")
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.fetchone()[0]
            print(f"     Total rows: {count}")
