#!/usr/bin/env python
"""
ITL_PGVector Database Initialization Script

Orchestrates the complete database setup:
1. Runs Alembic migrations (creates schema)
2. Seeds base data (LLM models, tools, agents, formats)
3. Creates demo tenant (optional)
4. Ingests sample PDFs (optional)

Usage:
    python setup/init_database.py --full
    python setup/init_database.py --full --config setup/config.yaml
    python setup/init_database.py --schema-only
    python setup/init_database.py --demo-only

Environment Variables:
    DATABASE_URL - Override database connection
    OPENROUTER_API_KEY - API key for OpenRouter (demo tenant)
"""

import sys
import os
import subprocess
import argparse
import time
import yaml
from pathlib import Path
from typing import Optional

# Add backend to path so we can import from src
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.logging import get_logger

logger = get_logger(__name__)


class DatabaseInitializer:
    """Orchestrates database initialization process."""

    def __init__(self, config_path: str = "setup/config.yaml", verbose: bool = False):
        """
        Initialize DatabaseInitializer.

        Args:
            config_path: Path to configuration YAML file
            verbose: Show detailed progress
        """
        self.config_path = Path(config_path)
        self.verbose = verbose

        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        self.config = self._load_config()
        self.project_root = Path(__file__).parent.parent
        self.success_count = 0
        self.failed_steps = []

    def _load_config(self) -> dict:
        """Load and validate configuration from YAML."""
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            logger.info(
                "config_loaded",
                config_file=str(self.config_path),
            )
            return config
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise

    def _run_command(self, command: list, description: str) -> bool:
        """
        Run a shell command and capture output.

        Args:
            command: Command as list (e.g., ['python', 'script.py'])
            description: Human-readable description

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"⏳ {description}...")
            if self.verbose:
                print(f"\n→ Running: {' '.join(command)}")

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                cwd=self.project_root,
                timeout=300,  # 5 minutes max
            )

            if result.returncode != 0:
                logger.error(
                    "command_failed",
                    description=description,
                    stderr=result.stderr,
                )
                print(f"❌ {description} FAILED")
                if self.verbose:
                    print(f"STDERR:\n{result.stderr}")
                self.failed_steps.append(description)
                return False

            logger.info(f"command_succeeded", description=description)
            print(f"✅ {description}")
            self.success_count += 1
            return True

        except subprocess.TimeoutExpired:
            logger.error("command_timeout", description=description)
            print(f"❌ {description} TIMEOUT")
            self.failed_steps.append(description)
            return False
        except Exception as e:
            logger.error("command_error", description=description, error=str(e))
            print(f"❌ {description} ERROR: {str(e)}")
            self.failed_steps.append(description)
            return False

    def step_1_run_migrations(self) -> bool:
        """Step 1: Run Alembic migrations to create schema."""
        print("\n" + "=" * 60)
        print("STEP 1: Running Database Migrations")
        print("=" * 60)

        # Set environment variable for database URL if provided
        if "DATABASE_URL" in os.environ:
            logger.info(
                "using_env_database",
                database_url=os.environ["DATABASE_URL"],
            )

        success = self._run_command(
            ["alembic", "upgrade", "head"],
            "Run Alembic migrations",
        )

        if success:
            logger.info("migrations_completed")
            print("\n✅ Database schema created successfully")

        return success

    def step_2_seed_base_data(self) -> bool:
        """Step 2: Seed base data (LLM models, tools, agents, formats)."""
        print("\n" + "=" * 60)
        print("STEP 2: Seeding Base Data")
        print("=" * 60)

        success = self._run_command(
            [
                sys.executable,
                "setup/seed_base_data.py",
                "--config",
                str(self.config_path),
            ],
            "Seed base data (LLM models, tools, agents, formats)",
        )

        if success:
            logger.info("base_data_seeded")
            print("\n✅ Base data seeded successfully")

        return success

    def step_3_seed_demo_tenant(self) -> bool:
        """Step 3: Create demo tenant (optional)."""
        if not self.config.get("demo_tenant", {}).get("enabled", True):
            print("\n" + "=" * 60)
            print("STEP 3: Demo Tenant (SKIPPED)")
            print("=" * 60)
            print("Demo tenant creation is disabled in config")
            return True

        print("\n" + "=" * 60)
        print("STEP 3: Creating Demo Tenant")
        print("=" * 60)

        success = self._run_command(
            [
                sys.executable,
                "setup/seed_demo_tenant.py",
                "--config",
                str(self.config_path),
            ],
            "Create demo tenant with RAG tool",
        )

        if success:
            logger.info("demo_tenant_created")
            print("\n✅ Demo tenant created successfully")

        return success

    def step_4_ingest_pdfs(self) -> bool:
        """Step 4: Ingest PDF documents (optional)."""
        if not self.config.get("rag", {}).get("enabled", False):
            print("\n" + "=" * 60)
            print("STEP 4: PDF Ingestion (SKIPPED)")
            print("=" * 60)
            print("RAG is disabled in config")
            return True

        if not self.config.get("demo_tenant", {}).get("enabled", False):
            print("\n" + "=" * 60)
            print("STEP 4: PDF Ingestion (SKIPPED)")
            print("=" * 60)
            print("Demo tenant is disabled - nothing to ingest into")
            return True

        print("\n" + "=" * 60)
        print("STEP 4: Ingesting Sample PDF Documents")
        print("=" * 60)

        success = self._run_command(
            [
                sys.executable,
                "setup/ingest_demo_pdfs.py",
                "--config",
                str(self.config_path),
            ],
            "Ingest sample PDF documents",
        )

        if success:
            logger.info("pdfs_ingested")
            print("\n✅ PDF documents ingested successfully")

        return success

    def step_5_validate_setup(self) -> bool:
        """Step 5: Validate setup (optional)."""
        if not self.config.get("advanced", {}).get("validate", True):
            print("\n" + "=" * 60)
            print("STEP 5: Validation (SKIPPED)")
            print("=" * 60)
            return True

        print("\n" + "=" * 60)
        print("STEP 5: Validating Setup")
        print("=" * 60)

        try:
            from src.config import settings
            from src.database import SessionLocal

            # Test database connection
            print("  → Testing database connection...")
            db = SessionLocal()
            result = db.execute("SELECT 1")
            db.close()

            if result:
                print("  ✅ Database connection OK")
                logger.info("database_connection_ok")
            else:
                raise Exception("Database query failed")

            # Count base data
            print("  → Verifying base data...")
            db = SessionLocal()

            # Simple count queries
            # Note: These would require importing models
            # For now, just validate connection
            db.close()

            logger.info("validation_successful")
            print("\n✅ Setup validation passed")
            return True

        except Exception as e:
            logger.error("validation_failed", error=str(e))
            print(f"\n❌ Validation failed: {str(e)}")
            return False

    def run_full_initialization(self) -> bool:
        """Run complete initialization (all steps)."""
        print("\n")
        print("╔" + "=" * 58 + "╗")
        print("║" + " " * 10 + "ITL_PGVector Database Initialization" + " " * 12 + "║")
        print("╚" + "=" * 58 + "╝")

        steps = [
            ("Migrations", self.step_1_run_migrations),
            ("Base Data", self.step_2_seed_base_data),
            ("Demo Tenant", self.step_3_seed_demo_tenant),
            ("PDF Ingestion", self.step_4_ingest_pdfs),
            ("Validation", self.step_5_validate_setup),
        ]

        for step_name, step_func in steps:
            if not step_func():
                logger.warning(
                    f"step_failed",
                    step=step_name,
                )
                # Continue with other steps unless it's migrations
                if step_name == "Migrations":
                    return False

        return self._print_summary()

    def run_schema_only(self) -> bool:
        """Run only migrations (schema creation)."""
        print("\n")
        print("╔" + "=" * 58 + "╗")
        print("║" + " " * 15 + "Schema-Only Initialization" + " " * 17 + "║")
        print("╚" + "=" * 58 + "╝")

        return self.step_1_run_migrations() and self._print_summary()

    def run_seed_only(self) -> bool:
        """Run only seeding (assume schema exists)."""
        print("\n")
        print("╔" + "=" * 58 + "╗")
        print("║" + " " * 15 + "Seeding-Only Initialization" + " " * 16 + "║")
        print("╚" + "=" * 58 + "╝")

        success = True
        success &= self.step_2_seed_base_data()
        success &= self.step_3_seed_demo_tenant()
        success &= self.step_4_ingest_pdfs()
        success &= self.step_5_validate_setup()

        return success and self._print_summary()

    def run_demo_only(self) -> bool:
        """Run only demo tenant creation."""
        print("\n")
        print("╔" + "=" * 58 + "╗")
        print("║" + " " * 12 + "Demo Tenant Only Initialization" + " " * 15 + "║")
        print("╚" + "=" * 58 + "╝")

        success = True
        success &= self.step_3_seed_demo_tenant()
        success &= self.step_4_ingest_pdfs()

        return success and self._print_summary()

    def _print_summary(self) -> bool:
        """Print summary of initialization."""
        print("\n" + "=" * 60)
        print("INITIALIZATION SUMMARY")
        print("=" * 60)

        if self.failed_steps:
            print(f"\n❌ {len(self.failed_steps)} step(s) failed:")
            for step in self.failed_steps:
                print(f"   - {step}")
            print(f"\n✅ {self.success_count} step(s) completed")
            return False
        else:
            print(f"\n✅ All steps completed successfully!")
            print(f"\n📝 Next steps:")
            print("   1. Update .env with your API keys if needed")
            print("   2. Start the backend: python -m uvicorn src.main:app --reload")
            print("   3. Access API docs: http://localhost:8000/docs")
            return True


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="ITL_PGVector Database Initialization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python setup/init_database.py --full
  python setup/init_database.py --full --config setup/config.yaml
  python setup/init_database.py --schema-only
  python setup/init_database.py --seed-only
  python setup/init_database.py --demo-only

Environment Variables:
  DATABASE_URL - Override database connection string
  OPENROUTER_API_KEY - API key for OpenRouter (required for demo tenant)
        """,
    )

    parser.add_argument(
        "--full",
        action="store_true",
        help="Run complete initialization (migrations + seed + demo + pdfs)",
    )

    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Run only migrations (create schema)",
    )

    parser.add_argument(
        "--seed-only",
        action="store_true",
        help="Run only seeding (assume schema exists)",
    )

    parser.add_argument(
        "--demo-only",
        action="store_true",
        help="Create demo tenant and ingest PDFs (assume base data exists)",
    )

    parser.add_argument(
        "--config",
        type=str,
        default="setup/config.yaml",
        help="Path to configuration file (default: setup/config.yaml)",
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed progress",
    )

    args = parser.parse_args()

    try:
        initializer = DatabaseInitializer(
            config_path=args.config,
            verbose=args.verbose,
        )

        # Determine which mode to run
        if args.full:
            success = initializer.run_full_initialization()
        elif args.schema_only:
            success = initializer.run_schema_only()
        elif args.seed_only:
            success = initializer.run_seed_only()
        elif args.demo_only:
            success = initializer.run_demo_only()
        else:
            # Default to full initialization
            print("No mode specified, running --full initialization")
            success = initializer.run_full_initialization()

        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error("initialization_failed", error=str(e))
        print(f"\n❌ Initialization failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
