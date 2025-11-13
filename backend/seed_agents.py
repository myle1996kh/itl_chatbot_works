"""Seed initial agents for the system."""
import uuid
from src.config import SessionLocal
from src.models.agent import AgentConfig
from src.models.llm_model import LLMModel

# Agent configurations to seed
AGENTS_TO_SEED = [
    {
        "name": "GuidelineAgent",
        "description": "Provides guidance on company policies and procedures",
        "prompt_template": (
            "You are a helpful assistant that provides guidance on company policies, "
            "procedures, and best practices. Answer user questions about guidelines "
            "based on the knowledge base."
        ),
    },
    {
        "name": "ShipmentAgent",
        "description": "Handles shipment tracking and logistics inquiries",
        "prompt_template": (
            "You are a shipment tracking specialist. Help users track their shipments, "
            "understand delivery status, and resolve shipping-related issues."
        ),
    },
    {
        "name": "DebtAgent",
        "description": "Assists with debt management and financial inquiries",
        "prompt_template": (
            "You are a financial advisor specializing in debt management. "
            "Help users understand their debt, payment options, and financial planning."
        ),
    },
]


def seed_agents():
    """Seed initial agents into database."""
    db = SessionLocal()
    try:
        # Get the first available LLM model
        llm_model = db.query(LLMModel).filter(LLMModel.is_active == True).first()
        if not llm_model:
            print("Error: No active LLM model found. Please seed LLM models first.")
            return False

        print(f"Using LLM model: {llm_model.provider}/{llm_model.model_name}")

        # Check which agents already exist
        existing_agents = db.query(AgentConfig).filter(
            AgentConfig.name.in_([agent["name"] for agent in AGENTS_TO_SEED])
        ).all()

        existing_names = {agent.name for agent in existing_agents}

        # Seed new agents
        created_count = 0
        for agent_config in AGENTS_TO_SEED:
            if agent_config["name"] in existing_names:
                print(f"Skipping {agent_config['name']} - already exists")
                continue

            agent = AgentConfig(
                agent_id=uuid.uuid4(),
                name=agent_config["name"],
                description=agent_config["description"],
                prompt_template=agent_config["prompt_template"],
                llm_model_id=llm_model.llm_model_id,
                is_active=True,
            )

            db.add(agent)
            created_count += 1
            print(f"Created agent: {agent_config['name']}")

        if created_count > 0:
            db.commit()
            print(f"\nSuccessfully seeded {created_count} new agents!")
            return True
        else:
            print("\nNo new agents to seed - all agents already exist.")
            return True

    except Exception as e:
        print(f"Error seeding agents: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_agents()
    exit(0 if success else 1)
