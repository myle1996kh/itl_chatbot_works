import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import sqlalchemy as sa
from src.config import settings

def check_table(table_name):
    engine = sa.create_engine(settings.DATABASE_URL)
    inspector = sa.inspect(engine)
    
    print(f"\n{table_name}:")
    print("="*60)
    try:
        columns = inspector.get_columns(table_name)
        for col in columns:
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            print(f"  {col['name']:35} {str(col['type']):20} {nullable}")
    except Exception as e:
        print(f"  ERROR: {str(e)}")

tables = [
    "tenants",
    "tenant_llm_configs",
    "tenant_agent_permissions",
    "tenant_tool_permissions"
]

for table in tables:
    check_table(table)
