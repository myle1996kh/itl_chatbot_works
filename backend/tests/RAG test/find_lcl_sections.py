"""Find ALL sections related to LCL."""
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
print("FINDING ALL LCL-RELATED SECTIONS")
print("=" * 120)

# Search for all LCL sections
cur.execute("""
    SELECT DISTINCT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        COUNT(*) as chunk_count
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_title' ILIKE %s
    GROUP BY cmetadata->>'section_number', cmetadata->>'section_title'
    ORDER BY cmetadata->>'section_number'
""", (TENANT_ID, '%LCL%'))
sections = cur.fetchall()

print(f"\nFound {len(sections)} sections with 'LCL' in title:\n")
for i, section in enumerate(sections, 1):
    sec_num = section['section_number'] or 'None'
    print(f"{i:2d}. Section {sec_num}: {section['section_title']} ({section['chunk_count']} chunks)")

# Now search specifically for LCL Quotation/Báo giá
print("\n" + "=" * 120)
print("SECTIONS SPECIFICALLY ABOUT LCL QUOTATION/BÁO GIÁ")
print("=" * 120)

cur.execute("""
    SELECT DISTINCT
        cmetadata->>'section_number' as section_number,
        cmetadata->>'section_title' as section_title,
        COUNT(*) as chunk_count
    FROM langchain_pg_embedding
    WHERE cmetadata->>'tenant_id' = %s
      AND cmetadata->>'section_title' ILIKE %s
      AND (
          cmetadata->>'section_title' ILIKE %s
          OR cmetadata->>'section_title' ILIKE %s
      )
    GROUP BY cmetadata->>'section_number', cmetadata->>'section_title'
    ORDER BY cmetadata->>'section_number'
""", (TENANT_ID, '%LCL%', '%quotation%', '%báo giá%'))
quotation_sections = cur.fetchall()

if quotation_sections:
    print(f"\n✅ Found {len(quotation_sections)} sections about LCL Quotation:")
    for section in quotation_sections:
        sec_num = section['section_number'] or 'None'
        print(f"  Section {sec_num}: {section['section_title']} ({section['chunk_count']} chunks)")
else:
    print("\n❌ No sections found with both 'LCL' and 'quotation/báo giá'")
    print("   Trying broader search...")

    # Try section numbers 4.5.x (if 4.4 is FCL, 4.5 might be LCL)
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
    """, (TENANT_ID, '4.5%'))
    chapter_45 = cur.fetchall()

    if chapter_45:
        print("\n📋 Chapter 4.5 sections:")
        for section in chapter_45:
            sec_num = section['section_number'] or 'None'
            print(f"  Section {sec_num}: {section['section_title']} ({section['chunk_count']} chunks)")

cur.close()
conn.close()

print("\n" + "=" * 120)
