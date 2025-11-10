"""Clear old data and show comparison - then you can re-ingest via API."""
import psycopg2

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

print("=" * 100)
print("CLEARING OLD DATA & SHOWING STATS")
print("=" * 100)

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
cur = conn.cursor()

# Step 1: Get stats BEFORE delete
print("\n1. STATISTICS BEFORE DELETE (chunk_size=400)")
print("-" * 100)

cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
before_total = cur.fetchone()[0]

cur.execute("""
    SELECT
        MIN(LENGTH(document)) as min_len,
        MAX(LENGTH(document)) as max_len,
        AVG(LENGTH(document))::int as avg_len
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
before_stats = cur.fetchone()

cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' = '4.5.2'
""", (TENANT_ID,))
before_section_452 = cur.fetchone()[0]

print(f"Total chunks: {before_total}")
print(f"Chunk sizes: Min={before_stats[0]}, Max={before_stats[1]}, Avg={before_stats[2]}")
print(f"Section 4.5.2 chunks: {before_section_452}")

# Step 2: Delete all data for tenant
print("\n2. DELETING ALL DATA FOR TENANT")
print("-" * 100)

confirm = input(f"⚠️  Delete {before_total} chunks for tenant {TENANT_ID}? (yes/no): ")

if confirm.lower() != 'yes':
    print("❌ Aborted by user")
    cur.close()
    conn.close()
    exit(0)

cur.execute("""
    DELETE FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
conn.commit()

cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
after_delete = cur.fetchone()[0]

print(f"✅ Deleted {before_total - after_delete} chunks")
print(f"   Remaining: {after_delete}")

cur.close()
conn.close()

print("\n" + "=" * 100)
print("✅ DATA CLEARED")
print("=" * 100)

print("\nNEXT STEPS:")
print("1. Go to http://localhost:8000/docs")
print("2. Navigate to: POST /api/admin/tenants/{tenant_id}/knowledge/upload-document")
print(f"3. Upload eTMS.docx for tenant: {TENANT_ID}")
print("4. Wait for processing (chunk_size=600 will be used)")
print("5. Check new stats with: python check_new_stats.py")
print("\nOr use curl:")
print(f'''
curl -X POST "http://localhost:8000/api/admin/tenants/{TENANT_ID}/knowledge/upload-document" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@eTMS.docx"
''')
