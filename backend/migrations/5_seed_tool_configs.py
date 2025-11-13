#!/usr/bin/env python3
"""Step 5: Seed tool configurations into database."""

import sys
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import ToolConfig, BaseTool
from src.config import SessionLocal


def seed_tool_configs():
    """Load and seed tool configurations from JSON file."""
    db = SessionLocal()
    try:
        print("Seeding tool configurations...")

        # Load data from JSON
        data_file = Path(__file__).parent / "data" / "tool_configs.json"
        with open(data_file, 'r') as f:
            tool_configs_data = json.load(f)

        # Check if all expected tool configs already exist by name
        expected_tool_names = [tool["name"] for tool in tool_configs_data]
        existing_tool_names = [
            t.name for t in db.query(ToolConfig).all()
        ]

        if all(name in existing_tool_names for name in expected_tool_names):
            print(f"✓ All {len(expected_tool_names)} tool configs already seeded, skipping")
            return True

        tools_count = 0
        for tool_data in tool_configs_data:
            # Check if tool config already exists
            existing_tool = db.query(ToolConfig).filter_by(
                name=tool_data["name"]
            ).first()

            if not existing_tool:
                # Get base tool
                base_tool = db.query(BaseTool).filter_by(
                    type=tool_data["tool_type"]
                ).first()

                if base_tool:
                    tool = ToolConfig(
                        tool_id=uuid.uuid4(),
                        base_tool_id=base_tool.base_tool_id,
                        name=tool_data["name"],
                        description=tool_data.get("description", ""),
                        is_active=tool_data.get("is_active", True),
                        input_schema=tool_data.get("input_schema", {}),
                        config=tool_data.get("config", {})
                    )
                    db.add(tool)
                    tools_count += 1
                else:
                    print(f"⚠ Warning: Base tool '{tool_data['tool_type']}' not found, skipping config")

        db.commit()
        print(f"✅ {tools_count} tool configs seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding tool configs: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 5: Seed Tool Configurations")
    print("="*60)

    success = seed_tool_configs()

    if success:
        print("✅ Step 5: Tool configs seeded successfully")
    else:
        print("❌ Step 5: Failed to seed tool configs")

    sys.exit(0 if success else 1)
