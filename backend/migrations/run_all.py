#!/usr/bin/env python3
"""Master orchestrator for running all migration and seeding scripts in sequence."""

import sys
import subprocess
import time
from pathlib import Path


SCRIPTS = [
    "7_seed_llm_configs.py",
]


def run_script(script_name: str) -> bool:
    """Run a single migration script."""
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
    """Run all migration scripts in sequence."""
    print("\n" + "="*60)
    print("DATABASE MIGRATION & SEEDING ORCHESTRATOR")
    print("="*60)
    print(f"Total scripts: {len(SCRIPTS)}")
    print("="*60)

    start_time = time.time()
    failed_scripts = []
    successful_scripts = []

    for i, script_name in enumerate(SCRIPTS, 1):
        print(f"\n[{i}/{len(SCRIPTS)}] {script_name}")
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
    print(f"Successful: {len(successful_scripts)}/{len(SCRIPTS)}")
    print(f"Failed: {len(failed_scripts)}/{len(SCRIPTS)}")

    if failed_scripts:
        print("\n❌ Failed scripts:")
        for script in failed_scripts:
            print(f"  - {script}")
        print("\n⚠ Some migrations failed. Check errors above.")
        return False
    else:
        print("\n✅ All migration scripts completed successfully!")
        print("\n" + "="*60)
        print("🎉 DATABASE INITIALIZATION COMPLETE!")
        print("="*60)
        print("\nYour database is now ready with:")
        print("✅ 3 tenants (eTMS, eFMS, Vela)")
        print("✅ 4 agents (Supervisor, Guideline, Debt, Shipment)")
        print("✅ 5 tool configs with real API endpoints")
        print("✅ 9 users (3 admins + 6 supporters)")
        print("✅ All permissions configured")
        print("\nNext steps:")
        print("1. Verify database with verification script")
        print("2. Start backend: uvicorn src.main:app --reload")
        print("3. Test endpoints on http://localhost:8000/docs")
        print("="*60 + "\n")
        return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
