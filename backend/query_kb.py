"""
Simple script to query the knowledge base.

Usage:
    python query_kb.py "your query here"
    python query_kb.py "your query here" --top-k 10
    python query_kb.py "your query here" --section "Track and Trace"
"""
import sys
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.services.rag_service import get_rag_service


def query_knowledge_base(query: str, top_k: int = 5, section_filter: str = None, full_section: bool = False):
    """Query the knowledge base and display results."""

    # Configuration
    TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

    print("=" * 80)
    print("KNOWLEDGE BASE QUERY")
    print("=" * 80)
    print(f"Query: {query}")
    print(f"Top-K: {top_k}")
    if section_filter:
        print(f"Section Filter: {section_filter}")
    if full_section:
        print(f"Mode: FULL SECTION (auto-expand if results from same section)")
    else:
        print(f"Mode: TOP-K (semantic similarity only)")
    print(f"Tenant ID: {TENANT_ID}")
    print()

    try:
        # Get RAG service
        rag_service = get_rag_service()

        # Query knowledge base
        result = rag_service.query_knowledge_base(
            tenant_id=TENANT_ID,
            query=query,
            top_k=top_k,
            section_filter=section_filter,
            include_section_context=True,
            expand_to_full_section=full_section
        )

        if not result["success"]:
            print(f"❌ Query failed: {result.get('error')}")
            return

        # Display results
        print(f"✅ Found {result['total_results']} results")

        # Show if expanded to full section
        if result.get('expanded_to_full_section'):
            print(f"🔍 Auto-expanded to full section: {result.get('expanded_section')}")
            print(f"   (Top results were from same section, retrieved ALL {result['total_results']} chunks)")

        print("=" * 80)
        print()

        for doc in result["documents"]:
            # Extract metadata
            metadata = doc["metadata"]
            section_title = metadata.get("section_title", "Unknown")
            section_number = metadata.get("section_number", "")
            file_type = metadata.get("file_type", "unknown")
            distance = doc["distance"]
            rank = doc["rank"]

            # Display result
            print(f"[Result {rank}] Distance: {distance:.4f}")
            print(f"  Section: {section_number} {section_title}")
            print(f"  File Type: {file_type}")

            # Display formatted content (with section header)
            if "formatted_content" in doc:
                print(f"  Content:")
                # Show first 300 chars of formatted content
                content = doc["formatted_content"]
                if len(content) > 300:
                    print(f"    {content[:300]}...")
                else:
                    print(f"    {content}")
            else:
                # Fallback to raw content
                content = doc["content"]
                if len(content) > 200:
                    print(f"  Content: {content[:200]}...")
                else:
                    print(f"  Content: {content}")

            print()
            print("-" * 80)
            print()

        print("=" * 80)
        print(f"✅ Query completed successfully!")
        print("=" * 80)

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(
        description="Query the knowledge base",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Simple query (top-k semantic search)
  python query_kb.py "Quy trình tạo giá thuê ngoài FCL"

  # Increase results
  python query_kb.py "Quy trình thay đổi bảng giá bán" --top-k 10

  # Filter by section
  python query_kb.py "How to create booking?" --section "Booking"

  # Full section mode (auto-expand for procedures)
  python query_kb.py "How to create LCL booking?" --full-section

  # Combined: section filter + full section
  python query_kb.py "booking process" --section "4.8" --full-section
        """
    )

    parser.add_argument(
        "query",
        type=str,
        help="Search query"
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=3,
        help="Number of results to return (default: 5)"
    )

    parser.add_argument(
        "--section",
        type=str,
        default=None,
        help="Filter by section title or number (optional)"
    )

    parser.add_argument(
        "--full-section",
        action="store_true",
        help="Auto-expand to full section if top results are from same section (for procedures)"
    )

    args = parser.parse_args()

    # Validate top_k
    if args.top_k < 1 or args.top_k > 20:
        print("❌ Error: top-k must be between 1 and 20")
        sys.exit(1)

    # Run query
    query_knowledge_base(args.query, args.top_k, args.section, args.full_section)


if __name__ == "__main__":
    main()
