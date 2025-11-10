"""Re-ingest eTMS.docx with chunk_size=600."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import psycopg2
from src.services.rag_service import get_rag_service
from src.services.document_processor import get_document_processor

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"
DOCX_PATH = "eTMS.docx"

print("=" * 100)
print("RE-INGESTING eTMS.docx WITH CHUNK_SIZE=600")
print("=" * 100)

# Step 1: Delete old data
print("\n1. DELETING OLD DATA")
print("-" * 100)
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
cur = conn.cursor()

# Count before delete
cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
before_count = cur.fetchone()[0]
print(f"Chunks before delete: {before_count}")

# Delete all chunks for this tenant
cur.execute("""
    DELETE FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
conn.commit()

# Count after delete
cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
after_count = cur.fetchone()[0]
print(f"Chunks after delete: {after_count}")
print(f"✅ Deleted {before_count - after_count} chunks")

cur.close()
conn.close()

# Step 2: Reset singleton to use new chunk_size
print("\n2. RESETTING DOCUMENT PROCESSOR")
print("-" * 100)
import src.services.document_processor as doc_proc_module
doc_proc_module._document_processor = None
print("✅ Singleton reset")

# Step 3: Re-ingest with chunk_size=600
print("\n3. RE-INGESTING DOCUMENT (chunk_size=600)")
print("-" * 100)

if not Path(DOCX_PATH).exists():
    print(f"❌ File not found: {DOCX_PATH}")
    print("   Please ensure eTMS.docx is in backend/ directory")
    sys.exit(1)

try:
    rag_service = get_rag_service()

    print(f"Ingesting: {DOCX_PATH}")
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Chunk size: 600 chars")
    print(f"Chunk overlap: 200 chars")
    print()

    result = rag_service.ingest_document(
        tenant_id=TENANT_ID,
        file_path=DOCX_PATH
    )

    if result["success"]:
        print(f"\n✅ INGESTION SUCCESSFUL")
        print(f"   Document count: {result.get('document_count', 'N/A')}")
        print(f"   Document IDs: {len(result.get('document_ids', []))} chunks")
    else:
        print(f"\n❌ INGESTION FAILED")
        print(f"   Error: {result.get('error')}")

except Exception as e:
    print(f"\n❌ Error during ingestion: {e}")
    import traceback
    traceback.print_exc()

# Step 4: Verify new data
print("\n4. VERIFYING NEW DATA")
print("-" * 100)
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
cur = conn.cursor()

# Count total chunks
cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
total_chunks = cur.fetchone()[0]

# Get chunk size stats
cur.execute("""
    SELECT
        MIN(LENGTH(document)) as min_length,
        MAX(LENGTH(document)) as max_length,
        AVG(LENGTH(document))::int as avg_length
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
stats = cur.fetchone()

# Count section 4.5.2 chunks
cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' = '4.5.2'
""", (TENANT_ID,))
section_452_chunks = cur.fetchone()[0]

print(f"Total chunks: {total_chunks}")
print(f"Chunk size - Min: {stats[0]} chars, Max: {stats[1]} chars, Avg: {stats[2]} chars")
print(f"Section 4.5.2 (Bảng giá LCL): {section_452_chunks} chunks")

# Compare with before
print(f"\nComparison:")
print(f"  Before (chunk_size=400): {before_count} total chunks, Section 4.5.2: ~99 chunks")
print(f"  After  (chunk_size=600): {total_chunks} total chunks, Section 4.5.2: {section_452_chunks} chunks")

reduction_pct = (before_count - total_chunks) / before_count * 100 if before_count > 0 else 0
print(f"  Reduction: {reduction_pct:.1f}%")

cur.close()
conn.close()

print("\n" + "=" * 100)
print("✅ RE-INGESTION COMPLETE")
print("=" * 100)
print("\nNext steps:")
print("1. Restart FastAPI server (if running)")
print("2. Test query: python backend/test_agent_with_rag.py")
