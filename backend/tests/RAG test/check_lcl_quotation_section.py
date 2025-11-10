"""Check LCL Quotation section chunks in detail."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import psycopg2
from psycopg2.extras import RealDictCursor

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 120)
print("LCL QUOTATION SECTION ANALYSIS")
print("=" * 120)

# Find the correct section for LCL Quotation
print("\n1. SEARCH FOR LCL QUOTATION SECTIONS")
print("-" * 120)
cur.execute("""
    SELECT DISTINCT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        COUNT(*) as chunk_count
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND (
          cmetadata->>'section_title' ILIKE %s
          OR cmetadata->>'section_title' ILIKE %s
          OR cmetadata->>'section_title' ILIKE %s
      )
    GROUP BY cmetadata->>'section_number', cmetadata->>'section_title'
    ORDER BY cmetadata->>'section_number'
""", (TENANT_ID, '%LCL%quotation%', '%báo giá%LCL%', '%tạo%LCL%'))
sections = cur.fetchall()

if sections:
    print(f"Found {len(sections)} sections related to LCL Quotation:")
    for section in sections:
        print(f"  Section {section['section_number']}: {section['section_title']} ({section['chunk_count']} chunks)")
else:
    print("❌ No specific LCL Quotation section found. Searching broader...")

# Check section 4.4.2 (likely LCL Quotation based on 4.4.1 being FCL)
print("\n2. CHECK SECTION 4.4.2 (Expected LCL Quotation Section)")
print("-" * 120)
cur.execute("""
    SELECT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        cmetadata->>'paragraph_index' as para_idx,
        cmetadata->>'chunk_index' as chunk_idx,
        LENGTH(document) as doc_length,
        document
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' = %s
    ORDER BY
        (cmetadata->>'paragraph_index')::int NULLS LAST,
        (cmetadata->>'chunk_index')::int NULLS LAST
    LIMIT 30
""", (TENANT_ID, '4.4.2'))
chunks = cur.fetchall()

if chunks:
    print(f"✅ Found {len(chunks)} chunks in section 4.4.2")
    print(f"Section title: {chunks[0]['section_title']}")
    print(f"\nFull content (first 30 chunks):\n")

    for i, chunk in enumerate(chunks, 1):
        print(f"--- Chunk {i} (Para: {chunk['para_idx']}, Chunk: {chunk['chunk_idx']}, {chunk['doc_length']} chars) ---")
        print(chunk['document'])
        print()
else:
    print("❌ Section 4.4.2 not found")

# Check all sections in chapter 4.4
print("\n3. ALL SECTIONS IN CHAPTER 4.4 (Sales Quotations)")
print("-" * 120)
cur.execute("""
    SELECT DISTINCT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        COUNT(*) as chunk_count
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' LIKE %s
    GROUP BY cmetadata->>'section_number', cmetadata->>'section_title'
    ORDER BY cmetadata->>'section_number'
""", (TENANT_ID, '4.4%'))
chapter_sections = cur.fetchall()

for section in chapter_sections:
    print(f"  Section {section['section_number']}: {section['section_title']} ({section['chunk_count']} chunks)")

# Check if chunking broke the procedure
print("\n4. CHUNK SIZE ANALYSIS FOR SECTION 4.4.2")
print("-" * 120)
cur.execute("""
    SELECT
        MIN(LENGTH(document)) as min_length,
        MAX(LENGTH(document)) as max_length,
        AVG(LENGTH(document))::int as avg_length,
        COUNT(*) as total_chunks
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_number' = %s
""", (TENANT_ID, '4.4.2'))
size_stats = cur.fetchone()

if size_stats and size_stats['total_chunks'] > 0:
    print(f"Min chunk size: {size_stats['min_length']} chars")
    print(f"Max chunk size: {size_stats['max_length']} chars")
    print(f"Avg chunk size: {size_stats['avg_length']} chars")
    print(f"Total chunks: {size_stats['total_chunks']}")

    if size_stats['min_length'] < 50:
        print("\n⚠️  WARNING: Very small chunks detected (< 50 chars)")
        print("   This suggests procedural steps are being fragmented")

    if size_stats['max_length'] > 800:
        print("\n✅ Some large chunks exist, steps may be preserved")
else:
    print("No data for section 4.4.2")

print("\n" + "=" * 120)
print("ANALYSIS COMPLETE")
print("=" * 120)

cur.close()
conn.close()

print("\n💡 FINDINGS:")
print("1. If section 4.4.2 has fragmented chunks → chunk_size=400 is too small for procedures")
print("2. If section title doesn't match → section tracking issue during ingestion")
print("3. If section doesn't exist → document doesn't have LCL quotation procedure")
