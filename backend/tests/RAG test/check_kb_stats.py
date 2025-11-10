"""
Quick script to check knowledge base statistics.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.services.rag_service import get_rag_service

TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

rag_service = get_rag_service()
stats = rag_service.get_collection_stats(TENANT_ID)

print("=" * 60)
print("KNOWLEDGE BASE STATISTICS")
print("=" * 60)
print(f"Tenant ID: {TENANT_ID}")
print(f"Success: {stats['success']}")

if stats['success']:
    print(f"Document Count: {stats['document_count']}")

    if stats['document_count'] == 0:
        print("\n⚠️  WARNING: Knowledge base is EMPTY!")
        print("   Agent cannot use RAG tool without data.")
        print("\n📋 Next step: Upload eTMS.docx via:")
        print(f"   POST /api/admin/tenants/{TENANT_ID}/knowledge/upload-document")
else:
    print(f"Error: {stats.get('error')}")

print("=" * 60)
