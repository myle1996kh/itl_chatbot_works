"""
Simple test runner script
Run with: python run_tests.py
"""
import subprocess
import sys

print("=" * 70)
print("RUNNING TESTS")
print("=" * 70)
print()

# Run pytest
result = subprocess.run(
    [sys.executable, "-m", "pytest", "-v", "--tb=short"],
    cwd=".",
    capture_output=False
)

sys.exit(result.returncode)
