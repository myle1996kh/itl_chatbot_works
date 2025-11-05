#!/usr/bin/env python
"""
Ingest Demo PDFs Script

Ingests sample PDF documents into demo tenant's RAG knowledge base.

Features:
- Reads PDF paths from configuration
- Validates files exist before ingestion
- Shows progress for each document
- Returns statistics after completion

Usage:
    python setup/ingest_demo_pdfs.py
    python setup/ingest_demo_pdfs.py --config setup/config.yaml
    python setup/ingest_demo_pdfs.py --tenant-id <uuid>
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


class PDFIngester:
    """Ingests PDF documents into tenant's RAG knowledge base."""

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

    def _validate_pdf_path(self, pdf_path: str) -> bool:
        """Validate that PDF file exists."""
        path = Path(pdf_path)

        # Try relative path from backend/
        if not path.exists():
            relative_path = Path(__file__).parent.parent / pdf_path
            if relative_path.exists():
                return True
            logger.warning("pdf_file_not_found", path=pdf_path)
            return False

        return True

    def _resolve_pdf_path(self, pdf_path: str) -> str:
        """Resolve PDF path to absolute path."""
        path = Path(pdf_path)

        if path.exists():
            return str(path.absolute())

        # Try relative to backend/
        relative_path = Path(__file__).parent.parent / pdf_path
        if relative_path.exists():
            return str(relative_path.absolute())

        return pdf_path

    def ingest_pdf(
        self,
        pdf_path: str,
        document_name: str,
        description: str = "",
    ) -> bool:
        """
        Ingest a single PDF document.

        Args:
            pdf_path: Path to PDF file
            document_name: Name for the document
            description: Optional description

        Returns:
            True if successful, False otherwise
        """
        try:
            # Validate file exists
            if not self._validate_pdf_path(pdf_path):
                logger.warning("pdf_validation_failed", path=pdf_path)
                print(f"  ⚠️  File not found: {pdf_path}")
                self.stats["skipped"] += 1
                return False

            # Resolve path
            resolved_path = self._resolve_pdf_path(pdf_path)

            print(f"\n  → Ingesting: {document_name}")
            print(f"    File: {resolved_path}")

            # Prepare metadata
            metadata = {
                "document_name": document_name,
            }
            if description:
                metadata["description"] = description

            # Ingest PDF
            result = self.rag_service.ingest_pdf(
                tenant_id=self.tenant_id,
                pdf_path=resolved_path,
                additional_metadata=metadata,
            )

            if result.get("success"):
                chunk_count = result.get("document_count", 0)
                self.stats["chunks"] += chunk_count
                self.stats["successful"] += 1
                print(f"    ✅ Ingested ({chunk_count} chunks)")
                logger.info(
                    "pdf_ingested",
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
                    "pdf_ingestion_failed",
                    tenant_id=self.tenant_id,
                    document_name=document_name,
                    error=error,
                )
                return False

        except Exception as e:
            logger.error(
                "pdf_ingestion_error",
                tenant_id=self.tenant_id,
                pdf_path=pdf_path,
                error=str(e),
            )
            self.stats["failed"] += 1
            print(f"    ❌ Exception: {str(e)}")
            return False

    def run(self) -> bool:
        """Run PDF ingestion for all documents in config."""
        print("\n" + "=" * 60)
        print("Ingesting PDF Documents")
        print("=" * 60)

        try:
            if not self.config.get("rag", {}).get("enabled", False):
                print("\n⊘ RAG is disabled in config")
                return True

            # Find tenant ID
            self.tenant_id = self._find_tenant_id()
            if not self.tenant_id:
                print("\n❌ Could not find tenant ID")
                return False

            print(f"\nTenant ID: {self.tenant_id}")

            # Get documents from config
            documents = self.config.get("rag", {}).get("documents", [])

            if not documents:
                print("\n⊘ No documents specified in config")
                return True

            self.stats["total"] = len(documents)

            # Ingest each document
            for doc in documents:
                self.ingest_pdf(
                    pdf_path=doc.get("path"),
                    document_name=doc.get("name", doc.get("path")),
                    description=doc.get("description", ""),
                )

            # Print summary
            self._print_summary()
            return self.stats["failed"] == 0

        except Exception as e:
            logger.error("pdf_ingestion_run_failed", error=str(e))
            print(f"\n❌ PDF ingestion failed: {str(e)}")
            return False

        finally:
            self.db.close()

    def _print_summary(self):
        """Print ingestion summary."""
        print("\n" + "=" * 60)
        print("Ingestion Summary")
        print("=" * 60)
        print(f"Total Documents: {self.stats['total']}")
        print(f"✅ Successful: {self.stats['successful']}")
        print(f"❌ Failed: {self.stats['failed']}")
        print(f"⊘ Skipped: {self.stats['skipped']}")
        print(f"📄 Total Chunks: {self.stats['chunks']}")

        if self.stats["failed"] == 0:
            print("\n✅ All documents ingested successfully!")
        else:
            print(f"\n⚠️  {self.stats['failed']} document(s) failed to ingest")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest PDF documents into tenant's RAG knowledge base"
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
        ingester = PDFIngester(
            config_path=args.config,
            tenant_id=args.tenant_id,
        )
        success = ingester.run()
        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error("pdf_ingestion_failed", error=str(e))
        print(f"\n❌ PDF ingestion failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
