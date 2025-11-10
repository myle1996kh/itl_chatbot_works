"""Check stats after re-ingestion with chunk_size=600."""
import psycopg2

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

print("=" * 100)
print("CHECKING NEW STATS (chunk_size=600)")
print("=" * 100)

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
cur = conn.cursor()

# Get stats
cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
total_chunks = cur.fetchone()[0]

cur.execute("""
    SELECT
        MIN(LENGTH(document)) as min_len,
        MAX(LENGTH(document)) as max_len,
        AVG(LENGTH(document))::int as avg_len
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
stats = cur.fetchone()

cur.execute("""
    SELECT COUNT(*) FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' = '4.5.2'
""", (TENANT_ID,))
section_452_chunks = cur.fetchone()[0]

cur.execute("""
    SELECT
        COUNT(DISTINCT cmetadata->>'section_number') as unique_sections,
        COUNT(*) FILTER (WHERE cmetadata->>'section_title' = 'Unknown') as unknown_sections
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
section_stats = cur.fetchone()

print(f"\nTotal chunks: {total_chunks}")
print(f"Chunk sizes: Min={stats[0]}, Max={stats[1]}, Avg={stats[2]}")
print(f"Unique sections: {section_stats[0]}")
print(f"Unknown sections: {section_stats[1]} ({section_stats[1]/total_chunks*100:.1f}%)")

print(f"\nSection 4.5.2 (Bảng giá LCL): {section_452_chunks} chunks")

# Sample some chunks from section 4.5.2
print(f"\nSample chunks from Section 4.5.2:")
print("-" * 100)
cur.execute("""
    SELECT
        cmetadata->>'paragraph_index' as para_idx,
        cmetadata->>'chunk_index' as chunk_idx,
        LENGTH(document) as doc_len,
        LEFT(document, 100) as preview
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' = '4.5.2'
    ORDER BY (cmetadata->>'paragraph_index')::int, (cmetadata->>'chunk_index')::int
    LIMIT 5
""", (TENANT_ID,))

chunks = cur.fetchall()
for i, chunk in enumerate(chunks, 1):
    print(f"{i}. [Para:{chunk[0]:4s} Chunk:{chunk[1]:4s}] {chunk[2]:4d} chars: {chunk[3]}...")

cur.close()
conn.close()

print("\n" + "=" * 100)
print("COMPARISON")
print("=" * 100)
print("Before (chunk_size=400):")
print("  Total: 4,738 chunks, Avg: ~150 chars, Section 4.5.2: 99 chunks")
print(f"\nAfter (chunk_size=600):")
print(f"  Total: {total_chunks} chunks, Avg: {stats[2]} chars, Section 4.5.2: {section_452_chunks} chunks")

if total_chunks > 0:
    reduction = (4738 - total_chunks) / 4738 * 100
    section_reduction = (99 - section_452_chunks) / 99 * 100 if section_452_chunks < 99 else 0
    print(f"\nReduction:")
    print(f"  Total chunks: {reduction:.1f}%")
    print(f"  Section 4.5.2: {section_reduction:.1f}%")
    print(f"\n✅ Chunk size increased by {stats[2]/150:.1f}x (from ~150 to {stats[2]})")
