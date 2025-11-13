#!/usr/bin/env python
"""
Custom Tenant Seeding Script - Create specific tenants with LLM configurations.

Creates exactly 2 tenants as specified:
1. eTMS with Google Gemini-2.0-Flash-Thinking-Exp-01-21
2. OpenRouter-LLM with OpenRouter Gemini-2.5-Flash

This script assumes base data (LLM models, tools, agents) already exists.
Run seed_all_data.py first to create base infrastructure.

Usage:
    cd backend
    python seed_custom_tenants.py
"""

import sys
import uuid
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).parent))

from src.config import SessionLocal
from src.models.tenant import Tenant
from src.models.llm_model import LLMModel
from src.models.tenant_llm_config import TenantLLMConfig
from src.models.permissions import TenantAgentPermission, TenantToolPermission
from src.models.agent import AgentConfig
from src.models.tool import ToolConfig
from src.utils.logging import get_logger

logger = get_logger(__name__)


def ensure_llm_models(db):
    """Ensure required LLM models exist in database."""
    print("\n→ Ensuring LLM Models...")

    models_to_create = [
        {
            "llm_model_id": uuid.UUID("a1b2c3d4-e5f6-4748-9394-a1b2c3d4e5f6"),
            "provider": "google",
            "model_name": "models/gemini-2.0-flash-thinking-exp-01-21",
            "context_window": 1000000,
            "cost_per_1k_input_tokens": Decimal("0.075"),
            "cost_per_1k_output_tokens": Decimal("0.3"),
            "is_active": True,
        },
        {
            "llm_model_id": uuid.UUID("b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7"),
            "provider": "openrouter",
            "model_name": "google/gemini-2.5-flash",
            "context_window": 1000000,
            "cost_per_1k_input_tokens": Decimal("0.075"),
            "cost_per_1k_output_tokens": Decimal("0.3"),
            "is_active": True,
        },
    ]

    for model_data in models_to_create:
        existing = db.query(LLMModel).filter(
            LLMModel.llm_model_id == model_data["llm_model_id"]
        ).first()

        if existing:
            print(f"  ⊘ {model_data['model_name']} already exists")
            continue

        model = LLMModel(**model_data)
        db.add(model)
        print(f"  ✅ Created: {model_data['model_name']} ({model_data['provider']})")

    db.commit()


def create_tenants(db):
    """Create the 2 custom tenants."""
    print("\n→ Creating Custom Tenants...")

    tenants = [
        {
            "tenant_id": uuid.UUID("2628802d-1dff-4a98-9325-704433c5d3ab"),
            "name": "eTMS",
            "domain": "etms",
            "status": "active",
            "llm_model_id": uuid.UUID("a1b2c3d4-e5f6-4748-9394-a1b2c3d4e5f6"),  # Google Gemini
            "api_key": "AIzaSyDhsD6edS4hdMq641a1Wx9aGYUHMYZfDuc",
        },
        {
            "tenant_id": uuid.UUID("3729903d-2f04-5b99-a437-815544d6e4bc"),
            "name": "OpenRouter-LLM",
            "domain": "openrouter",
            "status": "active",
            "llm_model_id": uuid.UUID("b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7"),  # OpenRouter Gemini
            "api_key": "sk-or-v1-test-key-placeholder",  # User should replace this
        },
    ]

    for tenant_data in tenants:
        # Check if tenant already exists
        existing = db.query(Tenant).filter(
            Tenant.tenant_id == tenant_data["tenant_id"]
        ).first()

        if existing:
            print(f"  ⊘ Tenant '{tenant_data['name']}' already exists")
            continue

        # Create tenant
        tenant = Tenant(
            tenant_id=tenant_data["tenant_id"],
            name=tenant_data["name"],
            domain=tenant_data["domain"],
            status=tenant_data["status"],
        )
        db.add(tenant)
        db.flush()  # Flush to ensure tenant_id is assigned

        # Create LLM config for tenant
        llm_config = TenantLLMConfig(
            tenant_id=tenant_data["tenant_id"],
            llm_model_id=tenant_data["llm_model_id"],
            encrypted_api_key=tenant_data["api_key"],
            rate_limit_rpm=60,
            rate_limit_tpm=10000,
        )
        db.add(llm_config)

        print(f"  ✅ Created: {tenant_data['name']} (domain: {tenant_data['domain']})")

    db.commit()


def grant_permissions(db):
    """Grant default permissions to tenants (agents & tools)."""
    print("\n→ Granting Permissions...")

    # Get all tenants we just created
    tenants = db.query(Tenant).filter(
        Tenant.name.in_(["eTMS", "OpenRouter-LLM"])
    ).all()

    # Get AgentGuidance agent
    agent = db.query(AgentConfig).filter(
        AgentConfig.name == "AgentGuidance"
    ).first()

    # Get knowledge_base_search tool
    tool = db.query(ToolConfig).filter(
        ToolConfig.name == "knowledge_base_search"
    ).first()

    if not agent:
        print("  ⚠️  AgentGuidance not found - skipping agent permissions")
    else:
        for tenant in tenants:
            existing = db.query(TenantAgentPermission).filter(
                TenantAgentPermission.tenant_id == tenant.tenant_id,
                TenantAgentPermission.agent_id == agent.agent_id
            ).first()

            if not existing:
                perm = TenantAgentPermission(
                    tenant_id=tenant.tenant_id,
                    agent_id=agent.agent_id,
                    enabled=True
                )
                db.add(perm)
                print(f"  ✅ Granted AgentGuidance to {tenant.name}")

    if not tool:
        print("  ⚠️  knowledge_base_search tool not found - skipping tool permissions")
    else:
        for tenant in tenants:
            existing = db.query(TenantToolPermission).filter(
                TenantToolPermission.tenant_id == tenant.tenant_id,
                TenantToolPermission.tool_id == tool.tool_id
            ).first()

            if not existing:
                perm = TenantToolPermission(
                    tenant_id=tenant.tenant_id,
                    tool_id=tool.tool_id,
                    enabled=True
                )
                db.add(perm)
                print(f"  ✅ Granted knowledge_base_search to {tenant.name}")

    db.commit()


def main():
    """Run custom tenant seeding."""
    db = SessionLocal()

    try:
        print("\n" + "="*60)
        print("Custom Tenant Seeding")
        print("="*60)

        ensure_llm_models(db)
        create_tenants(db)
        grant_permissions(db)

        print("\n" + "="*60)
        print("✅ Custom tenants seeded successfully!")
        print("="*60)
        print("\n📋 Created Tenants:")
        print("  1. eTMS (domain: etms)")
        print("     - Provider: Google")
        print("     - Model: gemini-2.0-flash-thinking-exp-01-21")
        print("\n  2. OpenRouter-LLM (domain: openrouter)")
        print("     - Provider: OpenRouter")
        print("     - Model: gemini-2.5-flash")
        print("\n⚠️  Important Notes:")
        print("  - Replace API keys in database before using in production")
        print("  - For eTMS: Update with your actual Google API key")
        print("  - For OpenRouter: Update with your actual OpenRouter API key")
        print("  - Use admin dashboard or direct database update to change API keys")
        print("\n" + "="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        logger.error("custom_seeding_failed", error=str(e))
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
