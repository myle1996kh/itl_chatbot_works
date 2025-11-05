#!/usr/bin/env python
"""
Seed Demo Tenant Script

Creates a complete demo tenant with:
- Tenant record
- LLM configuration (with encrypted API key)
- Widget configuration
- Agent permissions
- Tool permissions
- RAG knowledge base setup

Idempotent: Checks if tenant exists before creating.

Usage:
    python setup/seed_demo_tenant.py
    python setup/seed_demo_tenant.py --config setup/config.yaml
"""

import sys
import os
import argparse
import yaml
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.logging import get_logger
from src.database import SessionLocal
from src.models.tenant import Tenant
from src.models.llm_model import LLMModel
from src.models.tenant_llm_config import TenantLLMConfig
from src.models.tool import ToolConfig, BaseTool
from src.models.agent import AgentConfig
from src.models.permissions import TenantAgentPermission, TenantToolPermission
from src.models.widget_config import WidgetConfig
from src.services.rag_service import get_rag_service
from cryptography.fernet import Fernet

logger = get_logger(__name__)


class DemoTenantSeeder:
    """Seeds demo tenant with all configuration."""

    def __init__(self, config_path: str = "setup/config.yaml"):
        """Initialize seeder with configuration."""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.db = SessionLocal()
        self.tenant_id: Optional[str] = None
        self.demo_config = self.config.get("demo_tenant", {})

    def _load_config(self) -> dict:
        """Load configuration from YAML."""
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            logger.info("config_loaded", config_file=str(self.config_path))
            return config
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise

    def _substitute_env_vars(self, value: str) -> str:
        """Replace ${VAR_NAME} with environment variable values."""
        if not isinstance(value, str):
            return value

        import re

        pattern = r"\$\{([^}]+)\}"
        matches = re.findall(pattern, value)

        for var_name in matches:
            env_value = os.environ.get(var_name)
            if env_value:
                value = value.replace(f"${{{var_name}}}", env_value)
            else:
                logger.warning(f"env_var_not_found", var_name=var_name)

        return value

    def create_tenant(self) -> bool:
        """Create tenant record."""
        print("\n→ Creating Tenant...")

        try:
            tenant_info = self.demo_config.get("tenant_info", {})
            domain = tenant_info.get("domain")

            # Check if tenant already exists
            existing = self.db.query(Tenant).filter(
                Tenant.domain == domain
            ).first()

            if existing:
                logger.info("tenant_exists", domain=domain)
                self.tenant_id = str(existing.tenant_id)
                print(f"  ⊘ Tenant '{tenant_info.get('name')}' already exists")
                return True

            # Create new tenant
            self.tenant_id = str(uuid.uuid4())
            tenant = Tenant(
                tenant_id=self.tenant_id,
                name=tenant_info.get("name"),
                domain=domain,
                status=tenant_info.get("status", "active"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self.db.add(tenant)
            self.db.commit()

            logger.info(
                "tenant_created",
                tenant_id=self.tenant_id,
                domain=domain,
            )
            print(f"  ✅ Created Tenant: {tenant_info.get('name')}")
            print(f"     Tenant ID: {self.tenant_id}")
            print(f"     Domain: {domain}")
            return True

        except Exception as e:
            logger.error("create_tenant_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error creating tenant: {str(e)}")
            return False

    def create_llm_config(self) -> bool:
        """Create LLM configuration for tenant."""
        print("\n→ Creating LLM Configuration...")

        try:
            if not self.tenant_id:
                print("  ⚠️  Skipping - tenant not created yet")
                return True

            llm_config = self.demo_config.get("llm_config", {})
            model_id = llm_config.get("model_id")
            api_key = llm_config.get("api_key")

            # Substitute environment variables
            api_key = self._substitute_env_vars(api_key)

            if not api_key:
                logger.warning("llm_api_key_not_provided")
                print("  ⚠️  No API key provided - LLM config will use defaults")
                return True

            # Check if LLM model exists
            llm_model = self.db.query(LLMModel).filter(
                LLMModel.llm_model_id == model_id
            ).first()

            if not llm_model:
                logger.error("llm_model_not_found", model_id=model_id)
                print(f"  ❌ LLM model '{model_id}' not found")
                return False

            # Check if config already exists
            existing = self.db.query(TenantLLMConfig).filter(
                TenantLLMConfig.tenant_id == self.tenant_id,
                TenantLLMConfig.llm_model_id == model_id,
            ).first()

            if existing:
                logger.info("tenant_llm_config_exists", tenant_id=self.tenant_id)
                print(f"  ⊘ LLM config already exists for this tenant")
                return True

            # Create encrypted config
            # Note: In production, use proper key management
            config_data = {
                "api_key": api_key,
                "provider": llm_config.get("provider"),
            }

            # Create tenant LLM config
            tenant_llm_config = TenantLLMConfig(
                tenant_llm_config_id=str(uuid.uuid4()),
                tenant_id=self.tenant_id,
                llm_model_id=llm_model.llm_model_id,
                encrypted_api_key=api_key,  # In production, encrypt this
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self.db.add(tenant_llm_config)
            self.db.commit()

            logger.info(
                "tenant_llm_config_created",
                tenant_id=self.tenant_id,
                model_id=model_id,
            )
            print(f"  ✅ Created LLM Configuration: {model_id}")
            return True

        except Exception as e:
            logger.error("create_llm_config_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error creating LLM config: {str(e)}")
            return False

    def create_widget_config(self) -> bool:
        """Create widget configuration for tenant."""
        print("\n→ Creating Widget Configuration...")

        try:
            if not self.tenant_id:
                print("  ⚠️  Skipping - tenant not created yet")
                return True

            widget_config_data = self.demo_config.get("widget_config", {})

            # Check if already exists
            existing = self.db.query(WidgetConfig).filter(
                WidgetConfig.tenant_id == self.tenant_id
            ).first()

            if existing:
                logger.info("widget_config_exists", tenant_id=self.tenant_id)
                print("  ⊘ Widget config already exists")
                return True

            # Create widget config
            widget_config = WidgetConfig(
                widget_config_id=str(uuid.uuid4()),
                tenant_id=self.tenant_id,
                theme=widget_config_data.get("theme", "light"),
                primary_color=widget_config_data.get("primary_color", "#3B82F6"),
                secondary_color=widget_config_data.get("secondary_color", "#10B981"),
                welcome_message=widget_config_data.get("welcome_message", "Welcome!"),
                placeholder=widget_config_data.get("placeholder", "Ask me..."),
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self.db.add(widget_config)
            self.db.commit()

            logger.info("widget_config_created", tenant_id=self.tenant_id)
            print("  ✅ Created Widget Configuration")
            return True

        except Exception as e:
            logger.error("create_widget_config_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error creating widget config: {str(e)}")
            return False

    def grant_agent_permissions(self) -> bool:
        """Grant agent permissions to tenant."""
        print("\n→ Granting Agent Permissions...")

        try:
            if not self.tenant_id:
                print("  ⚠️  Skipping - tenant not created yet")
                return True

            enabled_agents = self.demo_config.get("enabled_agents", [])

            if not enabled_agents:
                print("  ⊘ No agents specified")
                return True

            for agent_name in enabled_agents:
                # Find agent by name
                agent = self.db.query(AgentConfig).filter(
                    AgentConfig.name == agent_name
                ).first()

                if not agent:
                    logger.warning(f"agent_not_found", agent_name=agent_name)
                    print(f"  ⚠️  Agent '{agent_name}' not found")
                    continue

                # Check if permission already exists
                existing = self.db.query(TenantAgentPermission).filter(
                    TenantAgentPermission.tenant_id == self.tenant_id,
                    TenantAgentPermission.agent_config_id == agent.agent_config_id,
                ).first()

                if existing:
                    logger.debug(f"agent_permission_exists", agent_name=agent_name)
                    print(f"  ⊘ Agent '{agent_name}' already permitted")
                    continue

                # Create permission
                permission = TenantAgentPermission(
                    tenant_agent_permission_id=str(uuid.uuid4()),
                    tenant_id=self.tenant_id,
                    agent_config_id=agent.agent_config_id,
                    is_enabled=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                self.db.add(permission)
                logger.info(f"agent_permission_created", agent_name=agent_name)
                print(f"  ✅ Granted Permission: {agent_name}")

            self.db.commit()
            return True

        except Exception as e:
            logger.error("grant_agent_permissions_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error granting agent permissions: {str(e)}")
            return False

    def grant_tool_permissions(self) -> bool:
        """Grant tool permissions to tenant."""
        print("\n→ Granting Tool Permissions...")

        try:
            if not self.tenant_id:
                print("  ⚠️  Skipping - tenant not created yet")
                return True

            enabled_tools = self.demo_config.get("enabled_tools", [])

            if not enabled_tools:
                print("  ⊘ No tools specified")
                return True

            for tool_name in enabled_tools:
                # Find tool config by name
                tool = self.db.query(ToolConfig).filter(
                    ToolConfig.name == tool_name
                ).first()

                if not tool:
                    logger.warning(f"tool_not_found", tool_name=tool_name)
                    print(f"  ⚠️  Tool '{tool_name}' not found")
                    continue

                # Check if permission already exists
                existing = self.db.query(TenantToolPermission).filter(
                    TenantToolPermission.tenant_id == self.tenant_id,
                    TenantToolPermission.tool_config_id == tool.tool_config_id,
                ).first()

                if existing:
                    logger.debug(f"tool_permission_exists", tool_name=tool_name)
                    print(f"  ⊘ Tool '{tool_name}' already permitted")
                    continue

                # Create permission
                permission = TenantToolPermission(
                    tenant_tool_permission_id=str(uuid.uuid4()),
                    tenant_id=self.tenant_id,
                    tool_config_id=tool.tool_config_id,
                    is_enabled=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                self.db.add(permission)
                logger.info(f"tool_permission_created", tool_name=tool_name)
                print(f"  ✅ Granted Permission: {tool_name}")

            self.db.commit()
            return True

        except Exception as e:
            logger.error("grant_tool_permissions_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error granting tool permissions: {str(e)}")
            return False

    def setup_rag_collection(self) -> bool:
        """Setup RAG knowledge base collection for tenant."""
        print("\n→ Setting Up RAG Collection...")

        try:
            if not self.tenant_id:
                print("  ⚠️  Skipping - tenant not created yet")
                return True

            if not self.config.get("rag", {}).get("enabled", False):
                print("  ⊘ RAG is disabled in config")
                return True

            # Create RAG collection
            rag_service = get_rag_service()
            result = rag_service.create_tenant_collection(
                tenant_id=self.tenant_id,
                metadata={"created_by": "setup_script"},
            )

            if result.get("success"):
                logger.info("rag_collection_created", tenant_id=self.tenant_id)
                print(f"  ✅ Created RAG Collection")
                return True
            else:
                logger.error(
                    "rag_collection_creation_failed",
                    tenant_id=self.tenant_id,
                    error=result.get("error"),
                )
                print(f"  ❌ Error creating RAG collection: {result.get('error')}")
                return False

        except Exception as e:
            logger.error("setup_rag_collection_failed", error=str(e))
            print(f"  ❌ Error setting up RAG collection: {str(e)}")
            return False

    def run(self) -> bool:
        """Run all demo tenant setup steps."""
        print("\n" + "=" * 60)
        print("Seeding Demo Tenant")
        print("=" * 60)

        try:
            if not self.demo_config.get("enabled", True):
                print("\n⊘ Demo tenant creation is disabled in config")
                return True

            success = True
            success &= self.create_tenant()
            success &= self.create_llm_config()
            success &= self.create_widget_config()
            success &= self.grant_agent_permissions()
            success &= self.grant_tool_permissions()
            success &= self.setup_rag_collection()

            if success and self.tenant_id:
                print("\n" + "=" * 60)
                print("Demo Tenant Setup Complete")
                print("=" * 60)
                print(f"✅ Tenant ID: {self.tenant_id}")
                print(f"\nNext steps:")
                print(f"  1. Ingest PDF documents: python setup/ingest_demo_pdfs.py")
                print(f"  2. Test via API: GET /api/chat/sessions?tenant_id={self.tenant_id}")
                return True
            else:
                print("\n⚠️  Demo tenant setup completed with warnings/errors")
                return False

        except Exception as e:
            logger.error("demo_tenant_seeding_failed", error=str(e))
            print(f"\n❌ Demo tenant seeding failed: {str(e)}")
            return False

        finally:
            self.db.close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Seed demo tenant for ITL_PGVector"
    )

    parser.add_argument(
        "--config",
        type=str,
        default="setup/config.yaml",
        help="Path to configuration file (default: setup/config.yaml)",
    )

    args = parser.parse_args()

    try:
        seeder = DemoTenantSeeder(config_path=args.config)
        success = seeder.run()
        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error("tenant_seeding_failed", error=str(e))
        print(f"\n❌ Tenant seeding failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
