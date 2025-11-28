"""
Code Quality Check Script
Runs linting and formatting checks
"""
import subprocess
import sys

print("=" * 70)
print("CODE QUALITY CHECKS")
print("=" * 70)
print()

# Check if tools are installed
print("Checking for linting tools...")
tools_needed = []

try:
    subprocess.run(["ruff", "--version"], capture_output=True, check=True)
    print("✅ ruff installed")
except (subprocess.CalledProcessError, FileNotFoundError):
    print("⚠️  ruff not installed")
    tools_needed.append("ruff")

try:
    subprocess.run(["black", "--version"], capture_output=True, check=True)
    print("✅ black installed")
except (subprocess.CalledProcessError, FileNotFoundError):
    print("⚠️  black not installed")
    tools_needed.append("black")

try:
    subprocess.run(["isort", "--version"], capture_output=True, check=True)
    print("✅ isort installed")
except (subprocess.CalledProcessError, FileNotFoundError):
    print("⚠️  isort not installed")
    tools_needed.append("isort")

if tools_needed:
    print()
    print(f"Missing tools: {', '.join(tools_needed)}")
    print()
    print("Install with:")
    print(f"  uv add {' '.join(tools_needed)}")
    print()
    sys.exit(1)

print()
print("=" * 70)
print("RUNNING CHECKS")
print("=" * 70)
print()

# Run ruff
print("1. Running ruff (linter)...")
result = subprocess.run(
    [sys.executable, "-m", "ruff", "check", "src/"],
    capture_output=False
)
ruff_passed = result.returncode == 0

print()

# Run black
print("2. Running black (formatter check)...")
result = subprocess.run(
    [sys.executable, "-m", "black", "--check", "src/"],
    capture_output=False
)
black_passed = result.returncode == 0

print()

# Run isort
print("3. Running isort (import sorter check)...")
result = subprocess.run(
    [sys.executable, "-m", "isort", "--check-only", "src/"],
    capture_output=False
)
isort_passed = result.returncode == 0

print()
print("=" * 70)
print("SUMMARY")
print("=" * 70)
print()

if ruff_passed:
    print("✅ Ruff: No issues found")
else:
    print("❌ Ruff: Issues found (run 'ruff check --fix src/' to auto-fix)")

if black_passed:
    print("✅ Black: Code is formatted correctly")
else:
    print("❌ Black: Code needs formatting (run 'black src/' to format)")

if isort_passed:
    print("✅ isort: Imports are sorted correctly")
else:
    print("❌ isort: Imports need sorting (run 'isort src/' to sort)")

print()

if ruff_passed and black_passed and isort_passed:
    print("🎉 All code quality checks passed!")
    sys.exit(0)
else:
    print("⚠️  Some checks failed. Run the suggested commands to fix.")
    sys.exit(1)
