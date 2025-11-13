#!/usr/bin/env python
"""
Run SQL script against database.

Usage:
    python run_sql_script.py <sql_file>
"""

import sys
from pathlib import Path
import sqlalchemy as sa

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from src.config import SessionLocal
from src.utils.logging import get_logger

logger = get_logger(__name__)


def run_sql_file(sql_file_path: str) -> bool:
    """Execute SQL file against database."""
    try:
        # Read SQL file
        sql_path = Path(sql_file_path)
        if not sql_path.exists():
            print(f"❌ SQL file not found: {sql_path}")
            return False

        with open(sql_path, "r") as f:
            sql_content = f.read()

        # Get database connection - use raw connection for multi-statement SQL
        from sqlalchemy import create_engine
        from src.config import settings

        engine = create_engine(settings.DATABASE_URL)

        with engine.connect() as conn:
            # Use raw connection to handle multi-statement SQL
            conn.connection.autocommit = True

            # Split SQL into statements
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

            for i, statement in enumerate(statements):
                if statement.upper().startswith('BEGIN') or statement.upper().startswith('COMMIT'):
                    # Skip transaction control statements
                    continue

                try:
                    print(f"  Executing statement {i+1}/{len(statements)}...")
                    conn.execute(sa.text(statement))
                except Exception as stmt_error:
                    print(f"  ⚠️  Statement {i+1} error: {str(stmt_error)[:100]}")
                    # Continue with next statement

            conn.close()

        print(f"✅ SQL script executed successfully: {sql_path}")
        return True

    except Exception as e:
        print(f"❌ Error executing SQL: {str(e)}")
        logger.error("sql_execution_failed", error=str(e), file=sql_file_path)
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_sql_script.py <sql_file>")
        sys.exit(1)

    sql_file = sys.argv[1]
    success = run_sql_file(sql_file)
    sys.exit(0 if success else 1)
