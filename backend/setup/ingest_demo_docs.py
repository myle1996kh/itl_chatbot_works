#!/usr/bin/env python
"""
Ingest Demo Documents Script

Ingests sample documents (PDF, DOCX) into demo tenant's RAG knowledge base.

Features:
- Reads document paths from configuration
- Validates files exist before ingestion
- Shows progress for each document
- Returns statistics after completion

Usage:
    python setup/ingest_demo_docs.py
    python setup/ingest_demo_docs.py --config setup/config.yaml
    python setup/ingest_demo_docs.py --tenant-id <uuid>
"""

import sys
import os
import argparse
import yaml
from pathlib import Path
from typing import Optional, List, Dict, Any
import uuid

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.logging import get_logger
from src.database import SessionLocal
from src.models.tenant import Tenant
from src.services.rag_service import get_rag_service

logger = get_logger(__name__)


class DocIngester:
    """Ingests various document types into tenant's RAG knowledge base."""

    def __init__(
        self,
        config_path: str = "setup/config.yaml",
        tenant_id: Optional[str] = None,
    ):
        """Initialize PDF ingester."""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.tenant_id = tenant_id
        self.db = SessionLocal()
        self.rag_service = get_rag_service()
        self.stats = {
            "total": 0,
            "successful": 0,
            "failed": 0,
            "skipped": 0,
            "chunks": 0,
        }

    def _load_config(self) -> dict:
        """Load configuration from YAML."""
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            logger.info("config_loaded", config_file=str(self.config_path))
            return config
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise

    def _find_tenant_id(self) -> Optional[str]:
        """Find tenant ID from config (demo tenant)."""
        if self.tenant_id:
            return self.tenant_id

        # Try to find demo tenant by domain
        demo_domain = self.config.get("demo_tenant", {}).get("tenant_info", {}).get("domain")

        if demo_domain:
            tenant = self.db.query(Tenant).filter(
                Tenant.domain == demo_domain
            ).first()

            if tenant:
                return str(tenant.tenant_id)

        logger.error("tenant_not_found")
        return None

    def _validate_doc_path(self, file_path: str) -> bool:
        """Validate that document file exists."""
        path = Path(file_path)

        # Try relative path from backend/
        if not path.exists():
            relative_path = Path(__file__).parent.parent / file_path
            if relative_path.exists():
                return True
            logger.warning("doc_file_not_found", path=file_path)
            return False

        return True

    def _resolve_doc_path(self, file_path: str) -> str:
        """Resolve document path to absolute path."""
        path = Path(file_path)

        if path.exists():
            return str(path.absolute())

        # Try relative to backend/
        relative_path = Path(__file__).parent.parent / file_path
        if relative_path.exists():
            return str(relative_path.absolute())

        return file_path

    def ingest_document(
        self,
        file_path: str,
        document_name: str,
        description: str = "",
    ) -> bool:
        """
        Ingest a single document.

        Args:
            file_path: Path to document file
            document_name: Name for the document
            description: Optional description

        Returns:
            True if successful, False otherwise
        """
        try:
            # Validate file exists
            if not self._validate_doc_path(file_path):
                logger.warning("doc_validation_failed", path=file_path)
                print(f"  ⚠️  File not found: {file_path}")
                self.stats["skipped"] += 1
                return False

            # Resolve path
            resolved_path = self._resolve_doc_path(file_path)

            print(f"\n  → Ingesting: {document_name}")
            print(f"    File: {resolved_path}")

            # Prepare metadata
            metadata = {
                "document_name": document_name,
            }
            if description:
                metadata["description"] = description

            # Ingest document using the generic method
            result = self.rag_service.ingest_document(
                tenant_id=self.tenant_id,
                file_path=resolved_path,
                additional_metadata=metadata,
            )

            if result.get("success"):
                chunk_count = result.get("document_count", 0)
                self.stats["chunks"] += chunk_count
                self.stats["successful"] += 1
                print(f"    ✅ Ingested ({chunk_count} chunks)")
                logger.info(
                    "document_ingested",
                    tenant_id=self.tenant_id,
                    document_name=document_name,
                    chunks=chunk_count,
                )
                return True
            else:
                error = result.get("error", "Unknown error")
                self.stats["failed"] += 1
                print(f"    ❌ Error: {error}")
                logger.error(
                    "document_ingestion_failed",
                    tenant_id=self.tenant_id,
                    document_name=document_name,
                    error=error,
                )
                return False

        except Exception as e:
            logger.error(
                "document_ingestion_error",
                tenant_id=self.tenant_id,
                file_path=file_path,
                error=str(e),
            )
            self.stats["failed"] += 1
            print(f"    ❌ Exception: {str(e)}")
            return False

    def run(self) -> bool:
        """Run document ingestion for all documents in config."""
        print("\n" + "=" * 60)
        print("Ingesting Documents")
        print("=" * 60)

        overall_success = True
        try:
            if not self.config.get("rag", {}).get("enabled", False):
                print("\n⊘ RAG is disabled in config")
                return True

            # Get documents from config
            documents_to_ingest = self.config.get("rag", {}).get("documents", [])

            if not documents_to_ingest:
                print("\n⊘ No documents specified in config")
                return True

            # Iterate through each tenant defined in demo_tenants
            for tenant_config in self.config.get("demo_tenants", []):
                if not tenant_config.get("enabled", True):
                    print(f"\n⊘ Tenant '{tenant_config.get('tenant_info', {}).get('name')}' is disabled, skipping document ingestion.")
                    continue

                tenant_name = tenant_config.get('tenant_info', {}).get('name', 'Unknown Tenant')
                print(f"\n--- Ingesting documents for Tenant: {tenant_name} ---")

                # Find tenant ID for the current tenant
                self.tenant_id = self._find_tenant_id(tenant_config)
                if not self.tenant_id:
                    print(f"\n❌ Could not find tenant ID for {tenant_name}, skipping document ingestion.")
                    overall_success = False
                    continue

                print(f"\nTenant ID: {self.tenant_id}")

                self.stats["total"] = len(documents_to_ingest)
                self.stats["successful"] = 0
                self.stats["failed"] = 0
                self.stats["skipped"] = 0
                self.stats["chunks"] = 0

                # Ingest each document for the current tenant
                for doc in documents_to_ingest:
                    success = self.ingest_document(
                        file_path=doc.get("path"),
                        document_name=doc.get("name", doc.get("path")),
                        description=doc.get("description", ""),
                    )
                    if not success:
                        overall_success = False

                # Print summary for current tenant
                self._print_summary(tenant_name)

            return overall_success

        except Exception as e:
            logger.error("document_ingestion_run_failed", error=str(e))
            print(f"\n❌ Document ingestion failed: {str(e)}")
            return False

        finally:
            self.db.close()

    def _print_summary(self, tenant_name: str = "Overall"):
        """Print ingestion summary."""
        print("\n" + "=" * 60)
        print(f"Ingestion Summary for {tenant_name}")
        print("=" * 60)
        print(f"Total Documents: {self.stats['total']}")
        print(f"✅ Successful: {self.stats['successful']}")
        print(f"❌ Failed: {self.stats['failed']}")
        print(f"⊘ Skipped: {self.stats['skipped']}")
        print(f"📄 Total Chunks: {self.stats['chunks']}")

        if self.stats["failed"] == 0:
            print("\n✅ All documents ingested successfully for this tenant!")
        else:
            print(f"\n⚠️  {self.stats['failed']} document(s) failed to ingest for this tenant")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest documents into tenant's RAG knowledge base"
    )

    parser.add_argument(
        "--config",
        type=str,
        default="setup/config.yaml",
        help="Path to configuration file (default: setup/config.yaml)",
    )

    parser.add_argument(
        "--tenant-id",
        type=str,
        help="Override tenant ID (for non-demo tenants)",
    )

    args = parser.parse_args()

    try:
        ingester = DocIngester(
            config_path=args.config,
            tenant_id=args.tenant_id,
        )
        success = ingester.run()
        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error("document_ingestion_failed", error=str(e))
        print(f"\n❌ Document ingestion failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
