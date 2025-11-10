"""Setup new tenant eTMS_V1 with same agent/tool config as original tenant."""
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
import json

# Original tenant (source for config)
SOURCE_TENANT_ID = "f160e26f-c41a-498f-9ab9-b3dbefbdbd50"

# New tenant
NEW_TENANT_NAME = "eTMS_V1"
NEW_TENANT_DOMAIN = "etms-v1.local"

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="chatbot_itl",
    user="postgres",
    password="123456"
)
conn.autocommit = False
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 100)
print(f"SETTING UP NEW TENANT: {NEW_TENANT_NAME}")
print("=" * 100)

try:
    # Step 1: Create new tenant
    print("\n1. CREATING NEW TENANT")
    print("-" * 100)

    new_tenant_id = str(uuid.uuid4())

    cur.execute("""
        INSERT INTO tenants (tenant_id, name, domain, status, created_at, updated_at)
        VALUES (%s, %s, %s, 'active', NOW(), NOW())
        RETURNING tenant_id, name, domain
    """, (new_tenant_id, NEW_TENANT_NAME, NEW_TENANT_DOMAIN))

    new_tenant = cur.fetchone()
    print(f"✅ Created tenant:")
    print(f"   ID: {new_tenant['tenant_id']}")
    print(f"   Name: {new_tenant['name']}")
    print(f"   Domain: {new_tenant['domain']}")

    # Step 2: Get source tenant's LLM config
    print("\n2. COPYING LLM CONFIGURATION")
    print("-" * 100)

    cur.execute("""
        SELECT llm_model_id, encrypted_api_key, rate_limit_rpm, rate_limit_tpm
        FROM tenant_llm_configs
        WHERE tenant_id = %s
        LIMIT 1
    """, (SOURCE_TENANT_ID,))

    source_llm_config = cur.fetchone()

    if source_llm_config:
        config_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO tenant_llm_configs
            (config_id, tenant_id, llm_model_id, encrypted_api_key, rate_limit_rpm, rate_limit_tpm, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING config_id
        """, (
            config_id,
            new_tenant_id,
            source_llm_config['llm_model_id'],
            source_llm_config['encrypted_api_key'],
            source_llm_config['rate_limit_rpm'],
            source_llm_config['rate_limit_tpm']
        ))

        llm_config = cur.fetchone()
        print(f"✅ Copied LLM config:")
        print(f"   Model ID: {source_llm_config['llm_model_id']}")
        print(f"   Rate limit RPM: {source_llm_config['rate_limit_rpm']}")
        print(f"   Rate limit TPM: {source_llm_config['rate_limit_tpm']}")
    else:
        print("⚠️  No LLM config found for source tenant")

    # Step 3: Copy agent permissions
    print("\n3. COPYING AGENT PERMISSIONS")
    print("-" * 100)

    cur.execute("""
        SELECT agent_id, enabled
        FROM tenant_agent_permissions
        WHERE tenant_id = %s
    """, (SOURCE_TENANT_ID,))

    agent_permissions = cur.fetchall()

    if agent_permissions:
        for perm in agent_permissions:
            cur.execute("""
                INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled, created_at, updated_at)
                VALUES (%s, %s, %s, NOW(), NOW())
                ON CONFLICT (tenant_id, agent_id) DO NOTHING
            """, (new_tenant_id, perm['agent_id'], perm['enabled']))

        print(f"✅ Copied {len(agent_permissions)} agent permissions:")

        # Get agent names
        for perm in agent_permissions:
            cur.execute("""
                SELECT name, description
                FROM agent_configs
                WHERE agent_id = %s
            """, (perm['agent_id'],))
            agent = cur.fetchone()
            if agent:
                status = "Enabled" if perm['enabled'] else "Disabled"
                print(f"   - {agent['name']}: {status}")
    else:
        print("⚠️  No agent permissions found for source tenant")

    # Step 4: Copy tool permissions
    print("\n4. COPYING TOOL PERMISSIONS")
    print("-" * 100)

    cur.execute("""
        SELECT tool_id, enabled
        FROM tenant_tool_permissions
        WHERE tenant_id = %s
    """, (SOURCE_TENANT_ID,))

    tool_permissions = cur.fetchall()

    if tool_permissions:
        for perm in tool_permissions:
            cur.execute("""
                INSERT INTO tenant_tool_permissions (tenant_id, tool_id, enabled, created_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (tenant_id, tool_id) DO NOTHING
            """, (new_tenant_id, perm['tool_id'], perm['enabled']))

        print(f"✅ Copied {len(tool_permissions)} tool permissions:")

        # Get tool names
        for perm in tool_permissions:
            cur.execute("""
                SELECT name, description
                FROM tool_configs
                WHERE tool_id = %s
            """, (perm['tool_id'],))
            tool = cur.fetchone()
            if tool:
                status = "Enabled" if perm['enabled'] else "Disabled"
                print(f"   - {tool['name']}: {status}")
    else:
        print("⚠️  No tool permissions found for source tenant")

    # Step 5: Skip widget config for now
    print("\n5. WIDGET CONFIGURATION")
    print("-" * 100)
    print("⏭️  Skipping widget config - will configure manually later")

    # Commit all changes
    conn.commit()

    print("\n" + "=" * 100)
    print("✅ TENANT SETUP COMPLETE")
    print("=" * 100)

    print(f"\nNew Tenant Details:")
    print(f"  ID: {new_tenant_id}")
    print(f"  Name: {NEW_TENANT_NAME}")
    print(f"  Domain: {NEW_TENANT_DOMAIN}")

    print(f"\nConfiguration Copied:")
    print(f"  ✅ LLM Config: {1 if source_llm_config else 0}")
    print(f"  ✅ Agent Permissions: {len(agent_permissions) if agent_permissions else 0}")
    print(f"  ✅ Tool Permissions: {len(tool_permissions) if tool_permissions else 0}")
    print(f"  ⏭️  Widget Config: Skipped (configure manually)")

    print(f"\n📝 NEXT STEPS:")
    print(f"1. Upload knowledge base for new tenant:")
    print(f"   curl -X POST 'http://localhost:8000/api/admin/tenants/{new_tenant_id}/knowledge/upload-document' \\")
    print(f"     -H 'Content-Type: multipart/form-data' \\")
    print(f"     -F 'file=@eTMS.docx'")
    print(f"\n2. Test chat API:")
    print(f"   curl -X POST 'http://localhost:8000/api/{new_tenant_id}/chat' \\")
    print(f"     -H 'Content-Type: application/json' \\")
    print(f"     -d '{{\"message\": \"Hướng dẫn tạo mới bảng báo giá bán LCL?\", \"user_id\": \"test_user_001\"}}'")
    print(f"\n3. Access via Swagger UI: http://localhost:8000/docs")

    # Save tenant info to file for reference
    with open("new_tenant_info.txt", "w") as f:
        f.write(f"Tenant ID: {new_tenant_id}\n")
        f.write(f"Name: {NEW_TENANT_NAME}\n")
        f.write(f"Domain: {NEW_TENANT_DOMAIN}\n")

    print(f"\n💾 Tenant info saved to: new_tenant_info.txt")

except Exception as e:
    conn.rollback()
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
finally:
    cur.close()
    conn.close()
