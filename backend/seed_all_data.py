#!/usr/bin/env python
"""
Seed all database data (base data + tenants).
Replaces unreliable SQL script approach with Python ORM.
"""

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.config import SessionLocal
from src.models.llm_model import LLMModel
from src.models.base_tool import BaseTool
from src.models.tool import ToolConfig
from src.models.output_format import OutputFormat
from src.models.agent import AgentConfig, AgentTools
from src.models.tenant import Tenant
from src.models.permissions import TenantAgentPermission, TenantToolPermission
from src.models.tenant_llm_config import TenantLLMConfig
from src.utils.logging import get_logger

logger = get_logger(__name__)

def seed_llm_models(db):
    """Seed LLM models."""
    print("\n→ Seeding LLM Models...")

    models = [
        {
            "llm_model_id": uuid.UUID("a1b2c3d4-e5f6-4748-9394-a1b2c3d4e5f6"),
            "provider": "google",
            "model_name": "models/gemini-1.5-flash-latest",
            "context_window": 1000000,
            "cost_per_1k_input_tokens": 0.075,
            "cost_per_1k_output_tokens": 0.3,
        },
        {
            "llm_model_id": uuid.UUID("b2c3d4e5-f6a7-4859-a5a7-b2c3d4e5f6a7"),
            "provider": "openrouter",
            "model_name": "openai/gpt-4o-mini",
            "context_window": 128000,
            "cost_per_1k_input_tokens": 0.15,
            "cost_per_1k_output_tokens": 0.6,
        },
    ]

    for model_data in models:
        existing = db.query(LLMModel).filter(
            LLMModel.llm_model_id == model_data["llm_model_id"]
        ).first()

        if existing:
            print(f"  ⊘ {model_data['model_name']} already exists")
            continue

        model = LLMModel(**model_data, is_active=True)
        db.add(model)
        print(f"  ✅ Created: {model_data['model_name']}")

    db.commit()

def seed_base_tools(db):
    """Seed base tools."""
    print("\n→ Seeding Base Tools...")

    tools = [
        {
            "base_tool_id": uuid.UUID("11111111-1111-1111-1111-111111111111"),
            "type": "RAG",
            "handler_class": "tools.rag.RAGTool",
            "description": "Retrieve information from knowledge base",
        },
    ]

    for tool_data in tools:
        existing = db.query(BaseTool).filter(
            BaseTool.base_tool_id == tool_data["base_tool_id"]
        ).first()

        if existing:
            print(f"  ⊘ {tool_data['type']} already exists")
            continue

        tool = BaseTool(**tool_data)
        db.add(tool)
        print(f"  ✅ Created: {tool_data['type']}")

    db.commit()

def seed_output_formats(db):
    """Seed output formats."""
    print("\n→ Seeding Output Formats...")

    formats = [
        {
            "format_id": uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            "name": "text",
            "description": "Plain text response",
        },
    ]

    for fmt_data in formats:
        existing = db.query(OutputFormat).filter(
            OutputFormat.format_id == fmt_data["format_id"]
        ).first()

        if existing:
            print(f"  ⊘ {fmt_data['name']} already exists")
            continue

        fmt = OutputFormat(**fmt_data)
        db.add(fmt)
        print(f"  ✅ Created: {fmt_data['name']}")

    db.commit()

def seed_tool_configs(db):
    """Seed tool configs."""
    print("\n→ Seeding Tool Configs...")

    base_tool = db.query(BaseTool).filter(BaseTool.type == "RAG").first()
    if not base_tool:
        print("  ❌ Base RAG tool not found")
        return

    configs = [
        {
            "tool_id": uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "name": "knowledge_base_search",
            "base_tool_id": base_tool.base_tool_id,
            "description": "Search knowledge base with RAG",
            "config": {
                "top_k": 5,
                "chunk_size": 600,
                "chunk_overlap": 200,
                "embedding_model": "all-MiniLM-L6-v2",
                "distance_strategy": "COSINE"
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"}
                },
                "required": ["query"]
            },
        },
    ]

    for cfg_data in configs:
        existing = db.query(ToolConfig).filter(
            ToolConfig.tool_id == cfg_data["tool_id"]
        ).first()

        if existing:
            print(f"  ⊘ {cfg_data['name']} already exists")
            continue

        cfg = ToolConfig(**cfg_data, is_active=True)
        db.add(cfg)
        print(f"  ✅ Created: {cfg_data['name']}")

    db.commit()

def seed_agents(db):
    """Seed agent configs."""
    print("\n→ Seeding Agent Configs...")

    # Get GPT-4o-mini model
    llm_model = db.query(LLMModel).filter(
        LLMModel.model_name == "openai/gpt-4o-mini"
    ).first()

    if not llm_model:
        print("  ❌ LLM model not found")
        return

    # Get output format
    output_fmt = db.query(OutputFormat).filter(
        OutputFormat.name == "text"
    ).first()

    agents = [
        {
            "agent_id": uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "name": "AgentGuidance",
            "description": "Guidance agent using knowledge base",
            "prompt_template": "You are a helpful guidance agent.",
            "handler_class": "services.domain_agents.DomainAgent",
            "llm_model_id": llm_model.llm_model_id,
            "default_output_format_id": output_fmt.format_id if output_fmt else None,
        },
    ]

    for agent_data in agents:
        existing = db.query(AgentConfig).filter(
            AgentConfig.agent_id == agent_data["agent_id"]
        ).first()

        if existing:
            print(f"  ⊘ {agent_data['name']} already exists")
            continue

        agent = AgentConfig(**agent_data, is_active=True)
        db.add(agent)
        print(f"  ✅ Created: {agent_data['name']}")

    db.commit()

def seed_agent_tools(db):
    """Link agents to tools."""
    print("\n→ Seeding Agent-Tool Links...")

    agent = db.query(AgentConfig).filter(AgentConfig.name == "AgentGuidance").first()
    tool = db.query(ToolConfig).filter(ToolConfig.name == "knowledge_base_search").first()

    if not agent or not tool:
        print("  ❌ Agent or tool not found")
        return

    existing = db.query(AgentTools).filter(
        AgentTools.agent_id == agent.agent_id,
        AgentTools.tool_id == tool.tool_id
    ).first()

    if existing:
        print(f"  ⊘ Link already exists")
        return

    link = AgentTools(
        agent_id=agent.agent_id,
        tool_id=tool.tool_id,
        priority=1
    )
    db.add(link)
    db.commit()
    print(f"  ✅ Linked AgentGuidance to knowledge_base_search")

def seed_tenants(db):
    """Seed tenants."""
    print("\n→ Seeding Tenants...")

    tenants = [
        {
            "tenant_id": uuid.UUID("f160e26f-c41a-498f-9ab9-b3dbefbdbd50"),
            "name": "eTMS",
            "domain": "etms.agenthub.local",
            "status": "active",
        },
        {
            "tenant_id": uuid.UUID("1193a40f-1d03-4ecd-a601-901a55589f56"),
            "name": "Google Tenant",
            "domain": "google.agenthub.local",
            "status": "active",
        },
    ]

    for tenant_data in tenants:
        existing = db.query(Tenant).filter(
            Tenant.tenant_id == tenant_data["tenant_id"]
        ).first()

        if existing:
            print(f"  ⊘ {tenant_data['name']} already exists")
            continue

        tenant = Tenant(**tenant_data)
        db.add(tenant)
        print(f"  ✅ Created: {tenant_data['name']}")

    db.commit()

def seed_tenant_llm_configs(db):
    """Seed tenant LLM configs."""
    print("\n→ Seeding Tenant LLM Configs...")

    # Get models
    gemini = db.query(LLMModel).filter(LLMModel.provider == "google").first()
    gpt = db.query(LLMModel).filter(LLMModel.model_name == "openai/gpt-4o-mini").first()

    if not (gemini and gpt):
        print("  ❌ LLM models not found")
        return

    # Get tenants
    etms = db.query(Tenant).filter(Tenant.name == "eTMS").first()
    google = db.query(Tenant).filter(Tenant.name == "Google Tenant").first()

    if not (etms and google):
        print("  ❌ Tenants not found")
        return

    configs = [
        {
            "config_id": uuid.UUID("11111111-1111-2222-3333-444444444441"),
            "tenant_id": etms.tenant_id,
            "llm_model_id": gpt.llm_model_id,
            "encrypted_api_key": "sk-or-v1-xxx",
        },
        {
            "config_id": uuid.UUID("11111111-1111-2222-3333-444444444442"),
            "tenant_id": google.tenant_id,
            "llm_model_id": gemini.llm_model_id,
            "encrypted_api_key": "AIzaSyDhsD6edS4hdMq641a1Wx9aGYUHMYZfDuc",
        },
    ]

    for cfg_data in configs:
        existing = db.query(TenantLLMConfig).filter(
            TenantLLMConfig.config_id == cfg_data["config_id"]
        ).first()

        if existing:
            print(f"  ⊘ Config already exists")
            continue

        cfg = TenantLLMConfig(**cfg_data, rate_limit_rpm=60, rate_limit_tpm=10000)
        db.add(cfg)
        print(f"  ✅ Created LLM config")

    db.commit()

def seed_tenant_permissions(db):
    """Seed tenant permissions."""
    print("\n→ Seeding Tenant Permissions...")

    # Get tenants
    etms = db.query(Tenant).filter(Tenant.name == "eTMS").first()
    google = db.query(Tenant).filter(Tenant.name == "Google Tenant").first()

    # Get agents
    supervisor = db.query(AgentConfig).filter(AgentConfig.name == "SupervisorAgent").first()
    guidance = db.query(AgentConfig).filter(AgentConfig.name == "AgentGuidance").first()

    # Get tools
    rag_tool = db.query(ToolConfig).filter(ToolConfig.name == "knowledge_base_search").first()

    if not (etms and google):
        print("  ❌ Tenants not found")
        return

    # Grant agent permissions
    for tenant in [etms, google]:
        for agent in [supervisor, guidance]:
            if not agent:
                continue

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
                print(f"  ✅ Granted {agent.name} to {tenant.name}")

    # Grant tool permissions
    if rag_tool:
        for tenant in [etms, google]:
            existing = db.query(TenantToolPermission).filter(
                TenantToolPermission.tenant_id == tenant.tenant_id,
                TenantToolPermission.tool_id == rag_tool.tool_id
            ).first()

            if not existing:
                perm = TenantToolPermission(
                    tenant_id=tenant.tenant_id,
                    tool_id=rag_tool.tool_id,
                    enabled=True
                )
                db.add(perm)
                print(f"  ✅ Granted knowledge_base_search to {tenant.name}")

    db.commit()

def main():
    """Run all seeding operations."""
    db = SessionLocal()

    try:
        print("\n" + "="*60)
        print("Seeding All Database Data")
        print("="*60)

        seed_llm_models(db)
        seed_base_tools(db)
        seed_output_formats(db)
        seed_tool_configs(db)
        seed_agents(db)
        seed_agent_tools(db)
        seed_tenants(db)
        seed_tenant_llm_configs(db)
        seed_tenant_permissions(db)

        print("\n" + "="*60)
        print("✅ All data seeded successfully!")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        logger.error("seeding_failed", error=str(e))
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
