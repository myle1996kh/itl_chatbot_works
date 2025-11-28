"""Test DELETE and verify it works."""
from sqlalchemy import create_engine, text
from src.config import settings

tenant_id = "3105b788-b5ff-4d56-88a9-532af4ab4ded"

engine = create_engine(settings.DATABASE_URL)

print("="*70)
print("BEFORE DELETE - Checking current state")
print("="*70)

with engine.connect() as conn:
    # Check current count
    result = conn.execute(
        text("""
            SELECT COUNT(*) as count
            FROM langchain_pg_embedding
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """),
        {"tenant_id": tenant_id}
    )
    count_before = result.fetchone()[0]
    print(f"\n✓ Documents for tenant {tenant_id}:")
    print(f"  Count: {count_before}")
    
    if count_before > 0:
        # Show sample
        result = conn.execute(
            text("""
                SELECT 
                    uuid,
                    cmetadata->>'tenant_id' as tenant_id,
                    cmetadata->>'doc_id' as doc_id,
                    cmetadata->>'document_name' as doc_name,
                    LEFT(document, 50) as preview
                FROM langchain_pg_embedding
                WHERE cmetadata->>'tenant_id' = :tenant_id
                LIMIT 3
            """),
            {"tenant_id": tenant_id}
        )
        print("\n  Sample documents:")
        for row in result:
            print(f"    - UUID: {row.uuid}")
            print(f"      tenant_id: {row.tenant_id}")
            print(f"      doc_id: {row.doc_id}")
            print(f"      doc_name: {row.doc_name}")
            print(f"      preview: {row.preview}...")
            print()

print("\n" + "="*70)
print("EXECUTING DELETE")
print("="*70)

with engine.connect() as conn:
    result = conn.execute(
        text("""
            DELETE FROM langchain_pg_embedding
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """),
        {"tenant_id": tenant_id}
    )
    conn.commit()
    deleted_count = result.rowcount
    print(f"\n✓ Deleted {deleted_count} rows")

print("\n" + "="*70)
print("AFTER DELETE - Verifying deletion")
print("="*70)

with engine.connect() as conn:
    # Check count after delete
    result = conn.execute(
        text("""
            SELECT COUNT(*) as count
            FROM langchain_pg_embedding
            WHERE cmetadata->>'tenant_id' = :tenant_id
        """),
        {"tenant_id": tenant_id}
    )
    count_after = result.fetchone()[0]
    print(f"\n✓ Documents for tenant {tenant_id}:")
    print(f"  Count: {count_after}")
    
    if count_after == 0:
        print("\n✅ SUCCESS! All documents deleted.")
    else:
        print(f"\n❌ PROBLEM! Still {count_after} documents remaining!")
        
        # Show what's left
        result = conn.execute(
            text("""
                SELECT 
                    uuid,
                    cmetadata->>'tenant_id' as tenant_id,
                    cmetadata as full_metadata
                FROM langchain_pg_embedding
                WHERE cmetadata->>'tenant_id' = :tenant_id
                LIMIT 3
            """),
            {"tenant_id": tenant_id}
        )
        print("\n  Remaining documents:")
        for row in result:
            print(f"    - UUID: {row.uuid}")
            print(f"      Metadata: {row.full_metadata}")

print("\n" + "="*70)
