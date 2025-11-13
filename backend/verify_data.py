import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from src.config import SessionLocal
from src.models.llm_model import LLMModel
from src.models.agent import AgentConfig
from src.models.base_tool import BaseTool
from src.models.tenant import Tenant

db = SessionLocal()

print("\n=== Data Verification ===\n")

# Check LLM Models
llm_count = db.query(LLMModel).count()
print(f"LLM Models: {llm_count}")
for m in db.query(LLMModel).all():
    print(f"  - {m.model_name} ({m.provider})")

# Check Agents
agent_count = db.query(AgentConfig).count()
print(f"\nAgent Configs: {agent_count}")
for a in db.query(AgentConfig).all():
    print(f"  - {a.name}")

# Check Base Tools
tool_count = db.query(BaseTool).count()
print(f"\nBase Tools: {tool_count}")
for t in db.query(BaseTool).all():
    print(f"  - {t.type}")

# Check Tenants
tenant_count = db.query(Tenant).count()
print(f"\nTenants: {tenant_count}")
for t in db.query(Tenant).all():
    print(f"  - {t.name}")

db.close()
