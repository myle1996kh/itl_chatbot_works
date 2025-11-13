#!/usr/bin/env python3
"""Step 6: Seed agent-tool mappings into database."""

import sys
import json
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import AgentConfig, ToolConfig
from src.config import SessionLocal
from sqlalchemy import text


def seed_agent_tools():
    """Seed agent-tool mappings by inserting into agent_tools junction table."""
    db = SessionLocal()
    try:
        print("Seeding agent-tool mappings...")

        # Define agent-tool mappings
        # SupervisorAgent gets: search_knowledge_base
        # GuidelineAgent gets: search_knowledge_base
        # DebtAgent gets: get_customer_debt_by_mst, get_salesman_debt
        # ShipmentAgent gets: track_shipment, update_shipment_status

        mappings = [
            ("SupervisorAgent", ["search_knowledge_base"]),
            ("GuidelineAgent", ["search_knowledge_base"]),
            ("DebtAgent", ["get_customer_debt_by_mst", "get_salesman_debt"]),
            ("ShipmentAgent", ["track_shipment", "update_shipment_status"])
        ]

        # Check if all mappings already exist
        total_expected = sum(len(tools) for _, tools in mappings)
        existing_count = db.execute(text("SELECT COUNT(*) FROM agent_tools")).scalar() or 0

        if existing_count >= total_expected:
            print(f"✓ All {total_expected} agent-tool mappings already seeded, skipping")
            return True

        mappings_count = 0
        priority = 1  # Tool priority for pre-filtering

        for agent_name, tool_names in mappings:
            agent = db.query(AgentConfig).filter_by(name=agent_name).first()

            if agent:
                for tool_name in tool_names:
                    tool = db.query(ToolConfig).filter_by(name=tool_name).first()

                    if tool:
                        # Insert into agent_tools junction table with priority
                        query = text("""
                            INSERT INTO agent_tools (agent_id, tool_id, priority, created_at)
                            SELECT :agent_id, :tool_id, :priority, :created_at
                            WHERE NOT EXISTS (
                                SELECT 1 FROM agent_tools
                                WHERE agent_id = :agent_id AND tool_id = :tool_id
                            )
                        """)
                        db.execute(query, {
                            "agent_id": str(agent.agent_id),
                            "tool_id": str(tool.tool_id),
                            "priority": priority,
                            "created_at": datetime.utcnow()
                        })
                        mappings_count += 1
                        priority += 1
                    else:
                        print(f"⚠ Warning: Tool '{tool_name}' not found for agent '{agent_name}'")
            else:
                print(f"⚠ Warning: Agent '{agent_name}' not found")

        db.commit()
        print(f"✅ {mappings_count} agent-tool mappings created")
        return True

    except Exception as e:
        print(f"❌ Error seeding agent-tool mappings: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 6: Seed Agent-Tool Mappings")
    print("="*60)

    success = seed_agent_tools()

    if success:
        print("✅ Step 6: Agent-tool mappings seeded successfully")
    else:
        print("❌ Step 6: Failed to seed agent-tool mappings")

    sys.exit(0 if success else 1)
