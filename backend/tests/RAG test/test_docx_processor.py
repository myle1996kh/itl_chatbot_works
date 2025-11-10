"""
Test script for DOCX document processing with eTMS.docx file.

Usage:
    python test_docx_processor.py

This will process eTMS.docx with tenant: f160e26f-c41a-498f-9ab9-b3dbefbdbd50
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.services.document_processor import get_document_processor


def test_etms_docx():
    """Test DOCX processing with eTMS.docx file."""

    # Configuration
    TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"
    DOCX_FILE = "eTMS.docx"

    print("=" * 80)
    print("eTMS.docx Document Processing Test")
    print("=" * 80)
    print(f"\nFile: {DOCX_FILE}")
    print(f"Tenant ID: {TENANT_ID}\n")

    # Check file exists
    docx_path = Path(__file__).parent / DOCX_FILE
    if not docx_path.exists():
        print(f"❌ Error: File not found: {docx_path}")
        print(f"\nPlease place eTMS.docx in: {Path(__file__).parent}")
        return

    try:
        # Initialize processor
        processor = get_document_processor(
            chunk_size=400,
            chunk_overlap=200
        )

        print("✅ Processor initialized")
        print(f"   - Chunk size: 400 chars")
        print(f"   - Chunk overlap: 200 chars\n")

        # Process document
        print("⏳ Processing eTMS.docx...\n")
        chunks = processor.process_document(
            file_path=str(docx_path),
            tenant_id=TENANT_ID
        )

        print(f"✅ Document processed successfully!")
        print(f"   - Total chunks: {len(chunks)}")

        # Analyze metadata
        sections = set()
        section_numbers = set()
        headings = 0

        for chunk in chunks:
            if chunk.metadata.get('section_title'):
                sections.add(chunk.metadata['section_title'])
            if chunk.metadata.get('section_number'):
                section_numbers.add(chunk.metadata['section_number'])
            if chunk.metadata.get('is_heading'):
                headings += 1

        print(f"   - Unique sections: {len(sections)}")
        print(f"   - Section numbers found: {len(section_numbers)}")
        print(f"   - Heading paragraphs: {headings}\n")

        # Display first few chunks with metadata
        print("-" * 80)
        print("SAMPLE CHUNKS (First 5):")
        print("-" * 80)

        for i, chunk in enumerate(chunks[:5]):
            print(f"\n[Chunk {i+1}]")
            print(f"  Content: {chunk.page_content[:100]}...")
            print(f"  Metadata:")
            print(f"    - section_title: {chunk.metadata.get('section_title')}")
            print(f"    - section_number: {chunk.metadata.get('section_number')}")
            print(f"    - page: {chunk.metadata.get('page')}")
            print(f"    - paragraph_index: {chunk.metadata.get('paragraph_index')}")
            print(f"    - is_heading: {chunk.metadata.get('is_heading')}")
            print(f"    - tenant_id: {chunk.metadata.get('tenant_id')}")
            print(f"    - chunk_index: {chunk.metadata.get('chunk_index')}")

        # Display sections found
        print("\n" + "-" * 80)
        print("SECTIONS DETECTED:")
        print("-" * 80)

        for section in sorted(sections):
            # Count chunks in this section
            count = sum(1 for c in chunks if c.metadata.get('section_title') == section)
            print(f"  - {section}: {count} chunks")

        # Test specific section query
        print("\n" + "-" * 80)
        print("TESTING: Find 'Track and Trace' section chunks")
        print("-" * 80)

        track_chunks = [
            c for c in chunks
            if 'Track and Trace' in c.metadata.get('section_title', '')
        ]

        if track_chunks:
            print(f"\n✅ Found {len(track_chunks)} chunks in 'Track and Trace' section")
            print("\nFirst chunk from this section:")
            chunk = track_chunks[0]
            print(f"  Content: {chunk.page_content[:200]}...")
            print(f"  Section: {chunk.metadata.get('section_title')}")
            print(f"  Section Number: {chunk.metadata.get('section_number')}")
        else:
            print("\n⚠️  No 'Track and Trace' section found")
            print("   Available sections:")
            for section in sorted(sections)[:10]:
                print(f"     - {section}")

        # Verify tenant_id is set
        print("\n" + "-" * 80)
        print("TENANT ISOLATION CHECK:")
        print("-" * 80)

        tenant_verified = all(
            c.metadata.get('tenant_id') == TENANT_ID
            for c in chunks
        )

        if tenant_verified:
            print(f"✅ All chunks have correct tenant_id: {TENANT_ID}")
        else:
            print(f"❌ Some chunks missing tenant_id!")

        print("\n" + "=" * 80)
        print("✅ TEST COMPLETED SUCCESSFULLY!")
        print("=" * 80)

        return chunks

    except Exception as e:
        print(f"\n❌ Error processing document: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    chunks = test_etms_docx()

    if chunks:
        print(f"\n📊 Summary: {len(chunks)} chunks ready for embedding and RAG!")
