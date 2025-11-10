"""Debug: Check if agent loads tools correctly."""
import sys
from pathlib import Path
import asyncio

sys.path.insert(0, str(Path(__file__).parent))

from src.config import get_db
from src.services.domain_agents import DomainAgent

AGENT_ID = "0569db87-0208-4798-972c-b323942171a0"
TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"
JWT_TOKEN = "fake_token_for_testing"

async def main():
    print("=" * 80)
    print("DEBUG: AGENT TOOL LOADING")
    print("=" * 80)

    db = next(get_db())

    try:
        # Create agent instance (this is what happens when processing a request)
        agent = DomainAgent(
            db=db,
            agent_id=AGENT_ID,
            tenant_id=TENANT_ID,
            jwt_token=JWT_TOKEN
        )

        print(f"\nAgent: {agent.agent_config.name}")
        print(f"Agent ID: {agent.agent_id}")
        print(f"Tenant ID: {agent.tenant_id}")
        print()

        print(f"Loaded Tools: {len(agent.tools)}")
        if agent.tools:
            for i, tool in enumerate(agent.tools, 1):
                print(f"  {i}. {tool.name}")
                print(f"     Description: {tool.description}")
                print(f"     Args schema: {tool.args_schema}")
        else:
            print("  ❌ NO TOOLS LOADED!")
            print()
            print("  Possible reasons:")
            print("  1. Server hasn't been restarted after database update")
            print("  2. Tool permission issue")
            print("  3. agent_tools junction table not set correctly")

        print()
        print(f"Prompt Preview (first 500 chars):")
        print(agent.agent_config.prompt_template[:500])
        print("...")

        print()
        print("=" * 80)
        print("LLM CONFIGURATION")
        print("=" * 80)
        print(f"LLM Class: {agent.llm.__class__.__name__}")
        print(f"Model Name: {getattr(agent.llm, 'model_name', 'unknown')}")

        # Check if LLM supports function calling
        if hasattr(agent.llm, 'bind_tools'):
            print(f"✅ LLM supports bind_tools (function calling)")
        else:
            print(f"❌ LLM does NOT support bind_tools")

        print()
        print("=" * 80)

        # Try to bind tools
        if agent.tools:
            print("TESTING TOOL BINDING")
            print("=" * 80)
            try:
                llm_with_tools = agent.llm.bind_tools(agent.tools)
                print(f"✅ Successfully bound {len(agent.tools)} tools to LLM")
                print(f"   LLM with tools class: {llm_with_tools.__class__.__name__}")
            except Exception as e:
                print(f"❌ Failed to bind tools: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
