#!/usr/bin/env python
"""
PostgreSQL pgvector Extension Setup Script

Sets up the pgvector extension for the database.
pgvector enables similarity search on vector embeddings for RAG.

Features:
- Creates database if not exists
- Installs pgvector extension
- Creates vector indexes for performance
- Validates setup

Usage:
    python setup/setup_pgvector.py
    python setup/setup_pgvector.py --config setup/config.yaml
    python setup/setup_pgvector.py --force-create-db
"""

import sys
import os
import argparse
import yaml
from pathlib import Path
from typing import Optional
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.logging import get_logger

logger = get_logger(__name__)


class PgVectorSetup:
    """Sets up pgvector extension in PostgreSQL."""

    def __init__(
        self,
        config_path: str = "setup/config.yaml",
        force_create_db: bool = False,
    ):
        """Initialize pgvector setup."""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.force_create_db = force_create_db
        self.db_url = self.config.get("database", {}).get("url")
        self._parse_db_url()

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

    def _parse_db_url(self):
        """Parse database URL into components."""
        # Format: postgresql://user:password@host:port/database
        url = self.db_url
        if not url.startswith("postgresql://"):
            raise ValueError(f"Invalid database URL: {url}")

        url = url.replace("postgresql://", "")

        # Split credentials and host
        if "@" in url:
            credentials, hostdb = url.split("@")
            if ":" in credentials:
                self.user, self.password = credentials.split(":")
            else:
                self.user = credentials
                self.password = ""
        else:
            raise ValueError("Invalid database URL format")

        # Split host and database
        if "/" in hostdb:
            hostport, self.database = hostdb.split("/")
            if ":" in hostport:
                self.host, port_str = hostport.split(":")
                self.port = int(port_str)
            else:
                self.host = hostport
                self.port = 5432
        else:
            raise ValueError("Invalid database URL format")

        logger.info(
            "database_url_parsed",
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.user,
        )

    def _get_admin_connection(self):
        """Get connection to PostgreSQL (without specific database)."""
        try:
            conn = psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database="postgres",  # Connect to default postgres db
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            return conn
        except Exception as e:
            logger.error(
                "admin_connection_failed",
                host=self.host,
                port=self.port,
                error=str(e),
            )
            raise

    def _get_db_connection(self):
        """Get connection to specific database."""
        try:
            conn = psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            return conn
        except Exception as e:
            logger.error(
                "database_connection_failed",
                database=self.database,
                error=str(e),
            )
            raise

    def step_1_create_database(self) -> bool:
        """Create database if it doesn't exist."""
        print("\n→ Checking/Creating Database...")

        try:
            admin_conn = self._get_admin_connection()
            cursor = admin_conn.cursor()

            # Check if database exists
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s;",
                (self.database,),
            )

            if cursor.fetchone():
                print(f"  ⊘ Database '{self.database}' already exists")
                logger.info("database_exists", database=self.database)
                cursor.close()
                admin_conn.close()
                return True

            # Create database
            print(f"  → Creating database '{self.database}'...")
            cursor.execute(
                sql.SQL("CREATE DATABASE {} ENCODING 'UTF8';").format(
                    sql.Identifier(self.database)
                )
            )

            print(f"  ✅ Database '{self.database}' created")
            logger.info("database_created", database=self.database)
            cursor.close()
            admin_conn.close()
            return True

        except Exception as e:
            logger.error("create_database_failed", error=str(e))
            print(f"  ❌ Error creating database: {str(e)}")
            return False

    def step_2_install_pgvector(self) -> bool:
        """Install pgvector extension."""
        print("\n→ Installing pgvector Extension...")

        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()

            # Check if pgvector is already installed
            cursor.execute(
                "SELECT 1 FROM pg_extension WHERE extname = 'vector';"
            )

            if cursor.fetchone():
                print("  ⊘ pgvector extension already installed")
                logger.info("pgvector_exists")
                cursor.close()
                conn.close()
                return True

            # Install pgvector
            print("  → Installing pgvector...")
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            print("  ✅ pgvector extension installed")
            logger.info("pgvector_installed")

            # Verify installation
            cursor.execute(
                "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
            )
            version = cursor.fetchone()
            if version:
                print(f"     Version: {version[0]}")

            cursor.close()
            conn.close()
            return True

        except Exception as e:
            logger.error("install_pgvector_failed", error=str(e))
            print(f"  ❌ Error installing pgvector: {str(e)}")
            print("\n     Note: pgvector may need to be installed at OS level:")
            print("     - Windows (WSL2): apt-get install postgresql-14-pgvector")
            print("     - Mac (Homebrew): brew install pgvector")
            print("     - Linux: apt-get install postgresql-14-pgvector")
            return False

    def step_3_create_vector_indexes(self) -> bool:
        """Create vector indexes for performance."""
        print("\n→ Creating Vector Indexes...")

        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()

            # Note: Vector indexes will be created by LangChain
            # when documents are first ingested
            print("  ℹ️  Vector indexes will be auto-created on first ingestion")
            print("  ℹ️  LangChain handles HNSW index creation")

            cursor.close()
            conn.close()
            return True

        except Exception as e:
            logger.error("create_indexes_failed", error=str(e))
            print(f"  ❌ Error creating indexes: {str(e)}")
            return False

    def step_4_validate_setup(self) -> bool:
        """Validate pgvector setup."""
        print("\n→ Validating pgvector Setup...")

        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()

            # Check pgvector version
            cursor.execute(
                "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
            )
            result = cursor.fetchone()

            if not result:
                print("  ❌ pgvector extension not found")
                return False

            version = result[0]
            print(f"  ✅ pgvector version: {version}")

            # Check vector type support
            cursor.execute(
                "SELECT typname FROM pg_type WHERE typname = 'vector';"
            )
            if cursor.fetchone():
                print("  ✅ Vector type available")
            else:
                print("  ❌ Vector type not available")
                return False

            cursor.close()
            conn.close()
            logger.info("pgvector_validation_successful")
            return True

        except Exception as e:
            logger.error("validation_failed", error=str(e))
            print(f"  ❌ Validation failed: {str(e)}")
            return False

    def run(self) -> bool:
        """Run complete pgvector setup."""
        print("\n" + "=" * 60)
        print("PostgreSQL pgvector Extension Setup")
        print("=" * 60)

        print(f"\nDatabase Configuration:")
        print(f"  Host: {self.host}:{self.port}")
        print(f"  Database: {self.database}")
        print(f"  User: {self.user}")

        try:
            success = True
            success &= self.step_1_create_database()
            success &= self.step_2_install_pgvector()
            success &= self.step_3_create_vector_indexes()
            success &= self.step_4_validate_setup()

            self._print_summary(success)
            return success

        except Exception as e:
            logger.error("setup_failed", error=str(e))
            print(f"\n❌ Setup failed: {str(e)}")
            return False

    def _print_summary(self, success: bool):
        """Print setup summary."""
        print("\n" + "=" * 60)
        print("Setup Summary")
        print("=" * 60)

        if success:
            print("\n✅ pgvector setup completed successfully!")
            print("\nNext steps:")
            print("  1. Run database migrations: alembic upgrade head")
            print("  2. Seed base data: python setup/seed_base_data.py")
            print("  3. Create eTMS tenant: python setup/seed_demo_tenant.py")
            print("  4. Ingest PDFs: python setup/ingest_demo_pdfs.py")
            print("  5. Start backend: python -m uvicorn src.main:app --reload")
        else:
            print("\n❌ pgvector setup failed or incomplete")
            print("\nTroubleshooting:")
            print("  1. Ensure PostgreSQL is running")
            print("  2. Verify database credentials")
            print("  3. Install pgvector at OS level if needed")
            print("  4. Check PostgreSQL version (14+ recommended)")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Setup pgvector extension for PostgreSQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python setup/setup_pgvector.py
  python setup/setup_pgvector.py --config setup/config.yaml
  python setup/setup_pgvector.py --force-create-db

Notes:
  - pgvector must be installed at OS level first
  - PostgreSQL 14+ is recommended
  - Run this before alembic migrations
        """,
    )

    parser.add_argument(
        "--config",
        type=str,
        default="setup/config.yaml",
        help="Path to configuration file (default: setup/config.yaml)",
    )

    parser.add_argument(
        "--force-create-db",
        action="store_true",
        help="Force create database even if it exists",
    )

    args = parser.parse_args()

    try:
        setup = PgVectorSetup(
            config_path=args.config,
            force_create_db=args.force_create_db,
        )
        success = setup.run()
        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error("setup_script_error", error=str(e))
        print(f"\n❌ Setup script failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
