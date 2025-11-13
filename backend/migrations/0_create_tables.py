#!/usr/bin/env python3
"""Step 0: Create all database tables using Alembic migrations."""

import sys
import os
import subprocess
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def run_migrations():
    """Run Alembic migrations to create all tables."""
    print("\n" + "="*60)
    print("Step 0: Creating Database Tables")
    print("="*60)

    try:
        # Change to backend directory
        backend_dir = Path(__file__).parent.parent
        os.chdir(backend_dir)

        print(f"Working directory: {os.getcwd()}")
        print("Running: alembic upgrade head")

        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )

        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)

        if result.returncode != 0:
            print(f"❌ Alembic migration failed with code {result.returncode}")
            return False

        print("✅ Step 0: Database tables created successfully")
        return True

    except Exception as e:
        print(f"❌ Error running migrations: {e}")
        return False


if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
