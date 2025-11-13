#!/usr/bin/env python3
"""Step 9: Seed tenant permissions for agents and tools."""

import sys
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import (
    TenantAgentPermission, TenantToolPermission,
    Tenant, AgentConfig, ToolConfig
)
from src.config import SessionLocal


def seed_agent_permissions():
    """Seed tenant-agent permissions from mapping JSON."""
    db = SessionLocal()
    try:
        print("Seeding tenant-agent permissions...")

        # Load mapping from JSON
        data_file = Path(__file__).parent / "data" / "tenant_agent_mapping.json"
        with open(data_file, 'r') as f:
            mappings_data = json.load(f)

        # Count expected permissions
        expected_permissions = len(mappings_data)
        existing_count = db.query(TenantAgentPermission).count()

        if existing_count >= expected_permissions:
            print(f"✓ All {expected_permissions} agent permissions already seeded, skipping")
            return True

        permissions_count = 0
        for mapping in mappings_data:
            # Get tenant by name from mapping
            tenant = db.query(Tenant).filter_by(name=mapping["tenant_name"]).first()

            # Get agent by name
            agent = db.query(AgentConfig).filter_by(
                name=mapping["agent_name"]
            ).first()

            if tenant and agent:
                # Check if permission already exists
                existing_perm = db.query(TenantAgentPermission).filter_by(
                    tenant_id=tenant.tenant_id,
                    agent_id=agent.agent_id
                ).first()

                if not existing_perm:
                    permission = TenantAgentPermission(
                        tenant_id=tenant.tenant_id,
                        agent_id=agent.agent_id,
                        enabled=mapping.get("enabled", True)
                    )
                    db.add(permission)
                    permissions_count += 1
            else:
                if not tenant:
                    print(f"⚠ Warning: Tenant '{mapping['tenant_name']}' not found")
                if not agent:
                    print(f"⚠ Warning: Agent '{mapping['agent_name']}' not found")

        db.commit()
        print(f"✅ {permissions_count} agent permissions seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding agent permissions: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def seed_tool_permissions():
    """Seed tenant-tool permissions (all tools available to all tenants)."""
    db = SessionLocal()
    try:
        print("Seeding tenant-tool permissions...")

        tenants = db.query(Tenant).all()
        tools = db.query(ToolConfig).all()

        # Count expected permissions
        expected_permissions = len(tenants) * len(tools)
        existing_count = db.query(TenantToolPermission).count()

        if existing_count >= expected_permissions:
            print(f"✓ All {expected_permissions} tool permissions already seeded, skipping")
            return True

        permissions_count = 0
        for tenant in tenants:
            for tool in tools:
                # Check if permission already exists
                existing_perm = db.query(TenantToolPermission).filter_by(
                    tenant_id=tenant.tenant_id,
                    tool_id=tool.tool_id
                ).first()

                if not existing_perm:
                    # All tools available to all tenants by default
                    permission = TenantToolPermission(
                        tenant_id=tenant.tenant_id,
                        tool_id=tool.tool_id,
                        enabled=True
                    )
                    db.add(permission)
                    permissions_count += 1

        db.commit()
        print(f"✅ {permissions_count} tool permissions seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding tool permissions: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 9: Seed Permissions")
    print("="*60)

    success = seed_agent_permissions() and seed_tool_permissions()

    if success:
        print("✅ Step 9: Permissions seeded successfully")
    else:
        print("❌ Step 9: Failed to seed permissions")

    sys.exit(0 if success else 1)
