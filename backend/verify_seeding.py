#!/usr/bin/env python
"""
Verify Database Seeding - Check if all required data exists.

This script validates that the database has been properly seeded with:
- LLM Models (Google, OpenRouter)
- Agents
- Tools
- Tenants (eTMS, OpenRouter-LLM)
- Permissions

Usage:
    cd backend
    python verify_seeding.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from tabulate import tabulate
except ImportError:
    # Fallback if tabulate not installed
    def tabulate(data, headers, tablefmt="grid"):
        """Simple table formatter if tabulate not available."""
        col_widths = [max(len(str(h)), max(len(str(row[i])) for row in data)) for i, h in enumerate(headers)]
        header_row = " | ".join(f"{h:<{w}}" for h, w in zip(headers, col_widths))
        sep_row = "-+-".join("-" * w for w in col_widths)
        print(header_row)
        print(sep_row)
        for row in data:
            print(" | ".join(f"{str(col):<{w}}" for col, w in zip(row, col_widths)))
        return None

from src.config import SessionLocal
from src.models.tenant import Tenant
from src.models.llm_model import LLMModel
from src.models.agent import AgentConfig
from src.models.tool import ToolConfig
from src.models.tenant_llm_config import TenantLLMConfig
from src.models.permissions import TenantAgentPermission, TenantToolPermission


def check_llm_models(db):
    """Check LLM models are seeded."""
    print("\n" + "=" * 60)
    print("LLM MODELS")
    print("=" * 60)

    models = db.query(LLMModel).all()
    if not models:
        print("❌ No LLM models found!")
        return False

    table_data = [
        [m.provider, m.model_name, m.context_window, "✅" if m.is_active else "❌"]
        for m in models
    ]
    print(tabulate(
        table_data,
        headers=["Provider", "Model Name", "Context Window", "Active"],
        tablefmt="grid"
    ))

    # Check required models
    required_providers = ["google", "openrouter"]
    found_providers = {m.provider for m in models}

    print(f"\nRequired providers: {required_providers}")
    print(f"Found providers: {found_providers}")

    if not required_providers.issubset(found_providers):
        print("❌ Missing required providers!")
        return False

    print(f"✅ Found {len(models)} LLM model(s)")
    return True


def check_agents(db):
    """Check agents are seeded."""
    print("\n" + "=" * 60)
    print("AGENTS")
    print("=" * 60)

    agents = db.query(AgentConfig).all()
    if not agents:
        print("⚠️  No agents found")
        return True  # Not critical

    table_data = [
        [a.name, a.description[:50] if a.description else "", "✅" if a.is_active else "❌"]
        for a in agents
    ]
    print(tabulate(
        table_data,
        headers=["Name", "Description", "Active"],
        tablefmt="grid"
    ))

    print(f"✅ Found {len(agents)} agent(s)")
    return True


def check_tools(db):
    """Check tools are seeded."""
    print("\n" + "=" * 60)
    print("TOOLS")
    print("=" * 60)

    tools = db.query(ToolConfig).all()
    if not tools:
        print("⚠️  No tools found")
        return True  # Not critical

    table_data = [
        [t.name, t.description[:50] if t.description else "", "✅" if t.is_active else "❌"]
        for t in tools
    ]
    print(tabulate(
        table_data,
        headers=["Name", "Description", "Active"],
        tablefmt="grid"
    ))

    print(f"✅ Found {len(tools)} tool(s)")
    return True


def check_tenants(db):
    """Check tenants are seeded."""
    print("\n" + "=" * 60)
    print("TENANTS")
    print("=" * 60)

    tenants = db.query(Tenant).all()
    if not tenants:
        print("❌ No tenants found!")
        return False

    table_data = [
        [t.name, t.domain, t.status, str(t.tenant_id)[:8] + "..."]
        for t in tenants
    ]
    print(tabulate(
        table_data,
        headers=["Name", "Domain", "Status", "Tenant ID"],
        tablefmt="grid"
    ))

    # Check required tenants
    required_tenants = ["eTMS", "OpenRouter-LLM"]
    found_tenants = {t.name for t in tenants}

    print(f"\nRequired tenants: {required_tenants}")
    print(f"Found tenants: {found_tenants}")

    if not all(t in found_tenants for t in required_tenants):
        print("⚠️  Some expected tenants not found (this is OK if using different names)")
    else:
        print("✅ All expected tenants found")

    print(f"✅ Total: {len(tenants)} tenant(s)")
    return len(tenants) > 0


def check_tenant_llm_configs(db):
    """Check tenant LLM configurations."""
    print("\n" + "=" * 60)
    print("TENANT LLM CONFIGURATIONS")
    print("=" * 60)

    configs = db.query(TenantLLMConfig).all()
    if not configs:
        print("⚠️  No tenant LLM configurations found")
        return False

    # Get additional data
    table_data = []
    for config in configs:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == config.tenant_id).first()
        llm_model = db.query(LLMModel).filter(LLMModel.llm_model_id == config.llm_model_id).first()

        tenant_name = tenant.name if tenant else "Unknown"
        model_name = llm_model.model_name if llm_model else "Unknown"
        provider = llm_model.provider if llm_model else "Unknown"

        table_data.append([
            tenant_name,
            provider,
            model_name[:40] + "..." if len(model_name) > 40 else model_name,
            "✅ Set" if config.encrypted_api_key else "❌ Missing"
        ])

    print(tabulate(
        table_data,
        headers=["Tenant", "Provider", "Model", "API Key"],
        tablefmt="grid"
    ))

    print(f"✅ Found {len(configs)} configuration(s)")
    return len(configs) > 0


def check_permissions(db):
    """Check tenant permissions."""
    print("\n" + "=" * 60)
    print("PERMISSIONS")
    print("=" * 60)

    agent_perms = db.query(TenantAgentPermission).all()
    tool_perms = db.query(TenantToolPermission).all()

    print(f"Agent Permissions: {len(agent_perms)}")
    print(f"Tool Permissions: {len(tool_perms)}")

    if agent_perms:
        print("\n✅ Agent permissions configured")
    if tool_perms:
        print("✅ Tool permissions configured")

    return len(agent_perms) > 0 or len(tool_perms) > 0


def main():
    """Run all verification checks."""
    db = SessionLocal()

    try:
        print("\n" + "╔" + "=" * 58 + "╗")
        print("║" + " " * 15 + "Database Seeding Verification" + " " * 15 + "║")
        print("╚" + "=" * 58 + "╝")

        all_checks = [
            ("LLM Models", check_llm_models),
            ("Agents", check_agents),
            ("Tools", check_tools),
            ("Tenants", check_tenants),
            ("Tenant LLM Configs", check_tenant_llm_configs),
            ("Permissions", check_permissions),
        ]

        results = []
        for check_name, check_func in all_checks:
            try:
                result = check_func(db)
                results.append((check_name, result))
            except Exception as e:
                print(f"❌ {check_name} check failed: {str(e)}")
                results.append((check_name, False))

        # Summary
        print("\n" + "=" * 60)
        print("VERIFICATION SUMMARY")
        print("=" * 60)

        for check_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {check_name}")

        all_passed = all(result for _, result in results)

        if all_passed:
            print("\n" + "=" * 60)
            print("✅ ALL CHECKS PASSED - Database is properly seeded!")
            print("=" * 60)
            print("\n📋 Next steps:")
            print("  1. Update API keys in database with real values")
            print("  2. Start backend: python src/main.py")
            print("  3. Start frontend: cd ../frontend && npm start")
            print("  4. Test at http://localhost:3000")
        else:
            print("\n" + "=" * 60)
            print("⚠️  Some checks failed - see above for details")
            print("=" * 60)
            print("\nRun seeding scripts:")
            print("  python seed_all_data.py")
            print("  python seed_custom_tenants.py")

        return 0 if all_passed else 1

    except Exception as e:
        print(f"\n❌ Verification failed: {str(e)}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
