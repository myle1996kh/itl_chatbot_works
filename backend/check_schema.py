#!/usr/bin/env python
"""Check database schema."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.config import SessionLocal
import sqlalchemy as sa

def check_table_schema(table_name: str):
    """Get table schema."""
    db = SessionLocal()
    try:
        inspector = sa.inspect(sa.create_engine(
            'postgresql://postgres:123456@localhost:5432/chatbot_itl'
        ))

        print(f"\n{'='*60}")
        print(f"Table: {table_name}")
        print(f"{'='*60}")

        columns = inspector.get_columns(table_name)
        for col in columns:
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            print(f"  {col['name']:30} {str(col['type']):20} {nullable}")

    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        db.close()


if __name__ == "__main__":
    tables = [
        "llm_models",
        "base_tools",
        "tool_configs",
        "output_formats",
        "agent_configs",
        "agent_tools"
    ]

    for table in tables:
        check_table_schema(table)
