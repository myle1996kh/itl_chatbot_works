#!/usr/bin/env python3
"""Step 4: Seed agents into database."""

import sys
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import AgentConfig, LLMModel
from src.config import SessionLocal


def seed_agents():
    """Load and seed agents from JSON file."""
    db = SessionLocal()
    try:
        # Check if SupervisorAgent exists (critical agent that defines complete seeding)
        supervisor = db.query(AgentConfig).filter_by(name="SupervisorAgent").first()
        if supervisor:
            print("✓ Agents already seeded (SupervisorAgent found), skipping")
            return True

        print("Seeding agents...")

        # Load data from JSON
        data_file = Path(__file__).parent / "data" / "agents.json"
        with open(data_file, 'r') as f:
            agents_data = json.load(f)

        # Get default LLM model (use first available)
        default_llm = db.query(LLMModel).first()
        if not default_llm:
            print("❌ No LLM models found. Run seed_llm_models.py first.")
            return False

        agents_count = 0
        for agent_data in agents_data:
            # Check if agent already exists
            existing_agent = db.query(AgentConfig).filter_by(
                name=agent_data["name"]
            ).first()

            if not existing_agent:
                # Use system_prompt from JSON as prompt_template
                prompt_template = agent_data.get("system_prompt", f"You are {agent_data['name']}")

                agent = AgentConfig(
                    agent_id=uuid.uuid4(),
                    name=agent_data["name"],
                    prompt_template=prompt_template,
                    llm_model_id=default_llm.llm_model_id,
                    description=agent_data.get("description", ""),
                    handler_class="services.domain_agents.DomainAgent",
                    is_active=agent_data.get("is_active", True)
                )
                db.add(agent)
                agents_count += 1

        db.commit()
        print(f"✅ {agents_count} agents seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding agents: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 4: Seed Agents")
    print("="*60)

    success = seed_agents()

    if success:
        print("✅ Step 4: Agents seeded successfully")
    else:
        print("❌ Step 4: Failed to seed agents")

    sys.exit(0 if success else 1)
