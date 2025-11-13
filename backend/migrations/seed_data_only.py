#!/usr/bin/env python3
"""Seed-only orchestrator: Populate existing database tables with data (skip alembic)."""

import sys
import subprocess
import time
from pathlib import Path


SEED_SCRIPTS = [
    "1_seed_base_data.py",
    "2_seed_llm_models.py",
    "3_seed_tenants.py",
    "4_seed_agents.py",
    "5_seed_tool_configs.py",
    "6_seed_agent_tools.py",
    "7_seed_llm_configs.py",
    "8_seed_users.py",
    "9_seed_permissions.py"
]


def run_script(script_name: str) -> bool:
    """Run a single seeding script."""
    script_path = Path(__file__).parent / script_name

    if not script_path.exists():
        print(f"❌ Script not found: {script_path}")
        return False

    print(f"\nRunning: {script_name}")
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=60
        )

        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)

        return result.returncode == 0

    except subprocess.TimeoutExpired:
        print(f"❌ Script timeout: {script_name}")
        return False
    except Exception as e:
        print(f"❌ Error running script: {e}")
        return False


def main():
    """Run all seeding scripts in sequence (skip alembic)."""
    print("\n" + "="*60)
    print("DATA SEEDING ORCHESTRATOR")
    print("(Existing Database Tables - Seeding Only)")
    print("="*60)
    print(f"Total scripts: {len(SEED_SCRIPTS)}")
    print("="*60)

    start_time = time.time()
    failed_scripts = []
    successful_scripts = []

    for i, script_name in enumerate(SEED_SCRIPTS, 1):
        print(f"\n[{i}/{len(SEED_SCRIPTS)}] {script_name}")
        print("-" * 60)

        if run_script(script_name):
            successful_scripts.append(script_name)
        else:
            failed_scripts.append(script_name)
            print(f"\n⚠ Script failed: {script_name}")
            print("Continuing with next script...")

    # Summary
    elapsed_time = time.time() - start_time
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total time: {elapsed_time:.2f} seconds")
    print(f"Successful: {len(successful_scripts)}/{len(SEED_SCRIPTS)}")
    print(f"Failed: {len(failed_scripts)}/{len(SEED_SCRIPTS)}")

    if failed_scripts:
        print("\n❌ Failed scripts:")
        for script in failed_scripts:
            print(f"  - {script}")
        print("\n⚠ Some seeding failed. Check errors above.")
        return False
    else:
        print("\n✅ All seeding scripts completed successfully!")
        print("\n" + "="*60)
        print("🎉 DATA SEEDING COMPLETE!")
        print("="*60)
        print("\nYour database is now populated with:")
        print("✅ 3 base tools (RAG, HTTP GET, HTTP POST)")
        print("✅ 3 output formats (default, json, markdown)")
        print("✅ 3 LLM models (Gemini 2.5, Gemini 2.0 Flash, GPT-4o Mini)")
        print("✅ 3 tenants (eTMS, eFMS, Vela)")
        print("✅ 4 agents (Supervisor, Guideline, Debt, Shipment)")
        print("✅ 5 tool configs with real API endpoints")
        print("✅ 9 users (3 admins + 6 supporters)")
        print("✅ Agent-tool mappings configured")
        print("✅ All permissions configured with tenant isolation")
        print("\nNext steps:")
        print("1. Verify database: python backend/migrations/verify_seeding.py")
        print("2. Start backend: uvicorn src.main:app --reload")
        print("3. Test endpoints: http://localhost:8000/docs")
        print("="*60 + "\n")
        return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
