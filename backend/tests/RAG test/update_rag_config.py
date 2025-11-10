"""Update RAG tool config to use top_k=3."""
import psycopg2
import json

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
conn.autocommit = False
cur = conn.cursor()

print("=" * 80)
print("UPDATING RAG TOOL CONFIG")
print("=" * 80)

try:
    # Get RAG tool config
    cur.execute("""
        SELECT tc.tool_id, tc.name, tc.config
        FROM tool_configs tc
        JOIN base_tools bt ON tc.base_tool_id = bt.base_tool_id
        WHERE bt.type = 'rag'
    """)
    tools = cur.fetchall()

    if not tools:
        print("❌ No RAG tools found")
    else:
        for tool_id, name, config_json in tools:
            print(f"\nTool: {name}")
            print(f"Tool ID: {tool_id}")

            # Parse config
            config = json.loads(config_json) if isinstance(config_json, str) else config_json

            print(f"Current config: {json.dumps(config, indent=2)}")
            print(f"Current top_k: {config.get('top_k', 'not set')}")

            # Update top_k to 3
            config['top_k'] = 3

            # Update database
            cur.execute("""
                UPDATE tool_configs
                SET config = %s
                WHERE tool_id = %s
            """, (json.dumps(config), tool_id))

            print(f"✅ Updated top_k to 3")
            print(f"New config: {json.dumps(config, indent=2)}")

    conn.commit()
    print("\n" + "=" * 80)
    print("✅ UPDATE COMPLETE")
    print("=" * 80)
    print("\n⚠️  IMPORTANT: Restart server for changes to take effect")

except Exception as e:
    conn.rollback()
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    cur.close()
    conn.close()
