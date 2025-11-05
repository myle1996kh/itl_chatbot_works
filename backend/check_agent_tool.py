"""Check agent and tool in database."""
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

print("=" * 80)
print("CHECKING AGENT")
print("=" * 80)

# Find agent
cur.execute("""
    SELECT agent_id, name, description,
           LEFT(prompt_template, 300) as prompt_preview
    FROM agent_configs
    WHERE agent_id = '0569db87-0208-4798-972c-b323942171a0'
""")
agent = cur.fetchone()

if agent:
    print(f"Agent Found: {agent['name']}")
    print(f"  ID: {agent['agent_id']}")
    print(f"  Description: {agent['description']}")
    print(f"  Prompt Preview:")
    print(f"    {agent['prompt_preview']}...")
    print()

    # Get current tools
    cur.execute("""
        SELECT tc.tool_id, tc.name, tc.description
        FROM tool_configs tc
        JOIN agent_tools at ON tc.tool_id = at.tool_id
        WHERE at.agent_id = '0569db87-0208-4798-972c-b323942171a0'
    """)
    tools = cur.fetchall()

    print("  Current Tools:")
    if tools:
        for tool in tools:
            print(f"    - {tool['name']} ({tool['tool_id']})")
    else:
        print("    (No tools assigned)")
else:
    print("Agent NOT found")

print()
print("=" * 80)
print("CHECKING TOOL")
print("=" * 80)

# Find tool
cur.execute("""
    SELECT tool_id, name, description
    FROM tool_configs
    WHERE tool_id = '9dfbd691-2221-4ed6-99f0-4eff03b22386'
""")
tool = cur.fetchone()

if tool:
    print(f"Tool Found: {tool['name']}")
    print(f"  ID: {tool['tool_id']}")
    print(f"  Description: {tool['description']}")
else:
    print("Tool NOT found")

print()
print("=" * 80)
print("CHECKING IF TOOL IS ALREADY ASSIGNED")
print("=" * 80)

# Check if already assigned
cur.execute("""
    SELECT * FROM agent_tools
    WHERE agent_id = '0569db87-0208-4798-972c-b323942171a0'
    AND tool_id = '9dfbd691-2221-4ed6-99f0-4eff03b22386'
""")
existing = cur.fetchone()

if existing:
    print("✅ Tool is ALREADY assigned to agent")
else:
    print("❌ Tool is NOT assigned to agent")

cur.close()
conn.close()
