"""Fix tool handler class name in database."""
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
conn.autocommit = False
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 80)
print("FIXING TOOL HANDLER CLASS NAME")
print("=" * 80)

try:
    # Check current handler class
    cur.execute("""
        SELECT base_tool_id, type, handler_class
        FROM base_tools
        WHERE handler_class LIKE '%RAGTool%'
    """)
    base_tool = cur.fetchone()

    if base_tool:
        print(f"\nFound RAG base tool:")
        print(f"  ID: {base_tool['base_tool_id']}")
        print(f"  Type: {base_tool['type']}")
        print(f"  Current handler: {base_tool['handler_class']}")

        # Update handler class (remove "src." prefix)
        print(f"\nUpdating handler class...")
        cur.execute("""
            UPDATE base_tools
            SET handler_class = 'tools.rag.RAGTool'
            WHERE handler_class = 'src.tools.rag.RAGTool'
        """)

        affected_rows = cur.rowcount
        print(f"  ✅ Updated {affected_rows} row(s)")

        # Verify update
        cur.execute("""
            SELECT handler_class
            FROM base_tools
            WHERE base_tool_id = %s
        """, (base_tool['base_tool_id'],))
        updated = cur.fetchone()
        print(f"  New handler: {updated['handler_class']}")

        conn.commit()
        print(f"\n✅ Changes committed successfully")

    else:
        print("❌ No RAG base tool found")

    print("\n" + "=" * 80)
    print("ALL BASE TOOLS")
    print("=" * 80)

    # Show all base tools
    cur.execute("""
        SELECT type, handler_class
        FROM base_tools
        ORDER BY type
    """)
    all_tools = cur.fetchall()

    for tool in all_tools:
        print(f"  - {tool['type']}: {tool['handler_class']}")

    print("\n" + "=" * 80)
    print("✅ FIX COMPLETED")
    print("=" * 80)
    print("\nNow restart the server for changes to take effect.")

except Exception as e:
    conn.rollback()
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    cur.close()
    conn.close()
