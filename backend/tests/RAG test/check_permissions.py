"""Check tenant tool permissions."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)

cur = conn.cursor(cursor_factory=RealDictCursor)

TENANT_ID = 'f160e26f-c41a-498f-9ab9-b3dbefbdbd50'
TOOL_ID = '9dfbd691-2221-4ed6-99f0-4eff03b22386'

print("=" * 80)
print("CHECKING TENANT TOOL PERMISSION")
print("=" * 80)

# Check if permission exists
cur.execute("""
    SELECT *
    FROM tenant_tool_permissions
    WHERE tenant_id = %s
    AND tool_id = %s
""", (TENANT_ID, TOOL_ID))
permission = cur.fetchone()

if permission:
    print(f"✅ Permission EXISTS")
    print(f"   Tenant ID: {permission['tenant_id']}")
    print(f"   Tool ID: {permission['tool_id']}")
    print(f"   Enabled: {permission['enabled']}")
    print(f"   Created: {permission['created_at']}")
else:
    print(f"❌ Permission DOES NOT EXIST")
    print(f"   Tenant: {TENANT_ID}")
    print(f"   Tool: {TOOL_ID}")
    print()
    print("   This is why the tool is not being loaded by the agent!")

print()
print("=" * 80)
print("ALL TENANT TOOL PERMISSIONS")
print("=" * 80)

# Show all permissions for this tenant
cur.execute("""
    SELECT ttp.*, tc.name as tool_name
    FROM tenant_tool_permissions ttp
    JOIN tool_configs tc ON ttp.tool_id = tc.tool_id
    WHERE ttp.tenant_id = %s
    ORDER BY ttp.created_at DESC
""", (TENANT_ID,))
all_permissions = cur.fetchall()

if all_permissions:
    print(f"\nFound {len(all_permissions)} permissions for tenant {TENANT_ID}:")
    for perm in all_permissions:
        status = "✅ ENABLED" if perm['enabled'] else "❌ DISABLED"
        print(f"  {status} - {perm['tool_name']} ({perm['tool_id']})")
else:
    print(f"\n❌ NO permissions found for tenant {TENANT_ID}")

cur.close()
conn.close()
