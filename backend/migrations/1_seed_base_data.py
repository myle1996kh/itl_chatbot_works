#!/usr/bin/env python3
"""Step 1: Seed base tools and output formats into database."""

import sys
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import BaseTool, OutputFormat
from src.config import SessionLocal
from sqlalchemy.dialects.postgresql import insert


def seed_base_tools():
    """Seed base tool types into database."""
    db = SessionLocal()
    try:
        # Check if all 3 base tools already exist
        http_get = db.query(BaseTool).filter_by(type="http_get").first()
        http_post = db.query(BaseTool).filter_by(type="http_post").first()
        rag = db.query(BaseTool).filter_by(type="rag").first()

        if http_get and http_post and rag:
            print("✓ All base tools already seeded, skipping")
            return True

        print("Seeding base tools...")

        base_tools_data = [
            {
                "type": "rag",
                "handler_class": "tools.rag.RAGTool",
                "description": "Retrieval-Augmented Generation tool for knowledge base search",
                "default_config_schema": {
                    "query": {"type": "string"},
                    "top_k": {"type": "integer", "default": 3}
                }
            },
            {
                "type": "http_get",
                "handler_class": "tools.http.HTTPGetTool",
                "description": "HTTP GET request tool for API calls",
                "default_config_schema": {
                    "url": {"type": "string"},
                    "headers": {"type": "object"}
                }
            },
            {
                "type": "http_post",
                "handler_class": "tools.http.HTTPPostTool",
                "description": "HTTP POST request tool for API calls",
                "default_config_schema": {
                    "url": {"type": "string"},
                    "body": {"type": "object"},
                    "headers": {"type": "object"}
                }
            }
        ]

        for tool_data in base_tools_data:
            tool = BaseTool(
                base_tool_id=uuid.uuid4(),
                type=tool_data["type"],
                handler_class=tool_data["handler_class"],
                description=tool_data["description"],
                default_config_schema=tool_data["default_config_schema"]
            )
            db.add(tool)

        db.commit()
        print(f"✅ {len(base_tools_data)} base tools seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding base tools: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def seed_output_formats():
    """Seed output format templates."""
    db = SessionLocal()
    try:
        # Check if all 3 output formats already exist
        formats_count = db.query(OutputFormat).count()
        if formats_count >= 3:
            print("✓ All output formats already seeded, skipping")
            return True

        print("Seeding output formats...")

        output_formats_data = [
            {
                "name": "default",
                "description": "Default plain text output format",
                "format_template": "{response}",
                "is_active": True
            },
            {
                "name": "json",
                "description": "JSON structured output format",
                "format_template": '{"response": "{response}", "timestamp": "{timestamp}"}',
                "is_active": True
            },
            {
                "name": "markdown",
                "description": "Markdown formatted output",
                "format_template": "# Response\n\n{response}",
                "is_active": True
            }
        ]

        for fmt_data in output_formats_data:
            fmt = OutputFormat(
                format_id=uuid.uuid4(),
                name=fmt_data["name"],
                description=fmt_data.get("description"),
                schema={"template": fmt_data.get("format_template", "{response}")}
            )
            db.add(fmt)

        db.commit()
        print(f"✅ {len(output_formats_data)} output formats seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding output formats: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 1: Seed Base Data")
    print("="*60)

    success = seed_base_tools() and seed_output_formats()

    if success:
        print("✅ Step 1: Base data seeded successfully")
    else:
        print("❌ Step 1: Failed to seed base data")

    sys.exit(0 if success else 1)
