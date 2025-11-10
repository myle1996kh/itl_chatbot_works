"""Diagnose RAG quality issues - check data and retrieval."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import psycopg2
from psycopg2.extras import RealDictCursor

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

# Database connection
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 100)
print("RAG QUALITY DIAGNOSIS")
print("=" * 100)

# 1. Check total chunks for tenant
print("\n1. CHUNK STATISTICS")
print("-" * 100)
cur.execute("""
    SELECT
        COUNT(*) as total_chunks,
        COUNT(DISTINCT cmetadata->>'section_title') as unique_sections,
        COUNT(DISTINCT cmetadata->>'section_number') as unique_section_numbers,
        COUNT(DISTINCT cmetadata->>'source') as unique_sources
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
stats = cur.fetchone()
print(f"Total chunks: {stats['total_chunks']}")
print(f"Unique sections: {stats['unique_sections']}")
print(f"Unique section numbers: {stats['unique_section_numbers']}")
print(f"Unique sources: {stats['unique_sources']}")

# 2. Check sections
print("\n2. SECTION BREAKDOWN")
print("-" * 100)
cur.execute("""
    SELECT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        COUNT(*) as chunk_count,
        AVG(LENGTH(document)) as avg_chunk_length
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
    GROUP BY cmetadata->>'section_number', cmetadata->>'section_title'
    ORDER BY cmetadata->>'section_number'
    LIMIT 20
""", (TENANT_ID,))
sections = cur.fetchall()
for section in sections:
    section_num = section['section_number'] or 'None'
    section_title = section['section_title'] or 'Unknown'
    print(f"Section {section_num}: {section_title[:60]} - {section['chunk_count']} chunks (avg {int(section['avg_chunk_length'])} chars)")

# 3. Check specific section example
print("\n3. EXAMPLE SECTION CHUNKS (First section with 'báo giá' or 'LCL')")
print("-" * 100)
cur.execute("""
    SELECT
        LEFT(document, 150) as content_preview,
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        cmetadata->>'chunk_index' as chunk_index,
        cmetadata->>'paragraph_index' as paragraph_index,
        LENGTH(document) as content_length
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND (
          cmetadata->>'section_title' ILIKE %s
          OR cmetadata->>'section_title' ILIKE %s
          OR document ILIKE %s
      )
    ORDER BY
        cmetadata->>'section_number',
        (cmetadata->>'paragraph_index')::int NULLS LAST,
        (cmetadata->>'chunk_index')::int NULLS LAST
    LIMIT 10
""", (TENANT_ID, '%báo giá%', '%LCL%', '%báo giá%LCL%'))
chunks = cur.fetchall()
if chunks:
    print(f"Found {len(chunks)} chunks related to 'báo giá' or 'LCL'")
    for i, chunk in enumerate(chunks, 1):
        section_num = chunk['section_number'] or 'None'
        section_title = chunk['section_title'] or 'Unknown'
        print(f"\nChunk {i}: Section {section_num}: {section_title}")
        print(f"  Para idx: {chunk['paragraph_index']}, Chunk idx: {chunk['chunk_index']}, Length: {chunk['content_length']}")
        print(f"  Content: {chunk['content_preview']}...")
else:
    print("❌ NO chunks found with 'báo giá' or 'LCL' - This is the problem!")

# 4. Test retrieval simulation
print("\n4. RETRIEVAL SIMULATION")
print("-" * 100)
print("Testing query: 'Hướng dẫn tạo mới bảng báo giá bán LCL?'")
print("\nUsing text search (no embedding - just to see content availability):")

cur.execute("""
    SELECT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        LEFT(document, 200) as content_preview,
        LENGTH(document) as content_length
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND (
          document ILIKE %s
          OR document ILIKE %s
          OR document ILIKE %s
      )
    ORDER BY (cmetadata->>'section_number'), (cmetadata->>'paragraph_index')::int NULLS LAST
    LIMIT 10
""", (TENANT_ID, '%tạo%báo giá%', '%báo giá%LCL%', '%quotation%LCL%'))
results = cur.fetchall()

if results:
    print(f"\n✅ Found {len(results)} chunks matching text search:")
    for i, result in enumerate(results, 1):
        section_num = result['section_number'] or 'None'
        section_title = result['section_title'] or 'Unknown'
        print(f"\n{i}. Section {section_num}: {section_title}")
        print(f"   Length: {result['content_length']} chars")
        print(f"   Preview: {result['content_preview']}...")
else:
    print("❌ NO chunks found with text search!")
    print("\nPossible reasons:")
    print("1. Document not uploaded yet")
    print("2. Wrong section tracking during ingestion")
    print("3. Content was filtered out during chunking")

# 5. Check metadata quality
print("\n5. METADATA QUALITY CHECK")
print("-" * 100)
cur.execute("""
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE cmetadata->>'section_title' = 'Unknown') as unknown_section,
        COUNT(*) FILTER (WHERE cmetadata->>'section_number' IS NULL) as null_section_number,
        COUNT(*) FILTER (WHERE cmetadata->>'is_heading' = 'true') as heading_chunks
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
""", (TENANT_ID,))
metadata_stats = cur.fetchone()
print(f"Total chunks: {metadata_stats['total']}")
print(f"Unknown section: {metadata_stats['unknown_section']} ({metadata_stats['unknown_section']/metadata_stats['total']*100:.1f}%)")
print(f"Null section_number: {metadata_stats['null_section_number']} ({metadata_stats['null_section_number']/metadata_stats['total']*100:.1f}%)")
print(f"Heading chunks: {metadata_stats['heading_chunks']}")

# 6. Sample random chunks to check quality
print("\n6. RANDOM SAMPLE OF CHUNKS")
print("-" * 100)
cur.execute("""
    SELECT
        id,
        LEFT(document, 120) as content_preview,
        cmetadata->>'section_title' as section_title,
        cmetadata->>'section_number' as section_number,
        LENGTH(document) as content_length
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
    ORDER BY RANDOM()
    LIMIT 5
""", (TENANT_ID,))
samples = cur.fetchall()
for i, sample in enumerate(samples, 1):
    print(f"\nSample {i}:")
    print(f"  ID: {sample['id']}")
    print(f"  Section: {sample['section_number']} - {sample['section_title']}")
    print(f"  Length: {sample['content_length']} chars")
    print(f"  Content: {sample['content_preview']}...")

print("\n" + "=" * 100)
print("DIAGNOSIS COMPLETE")
print("=" * 100)

cur.close()
conn.close()

print("\n📝 NEXT STEPS:")
print("1. If no chunks found → Need to re-ingest document")
print("2. If 'Unknown' sections are high → section tracking broken during ingestion")
print("3. If chunks exist but retrieval fails → embedding quality or query issue")
print("4. If steps are incomplete → chunking breaks multi-step procedures")
