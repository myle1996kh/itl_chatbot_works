"""
Dependency Security Scanner
Runs pip-audit to check for known vulnerabilities
"""
import subprocess
import sys

print("=" * 70)
print("DEPENDENCY SECURITY SCAN")
print("=" * 70)
print()

# Check if pip-audit is installed
try:
    result = subprocess.run(
        ["pip", "show", "pip-audit"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print("⚠️  pip-audit is not installed")
        print()
        print("Installing pip-audit...")
        install_result = subprocess.run(
            ["pip", "install", "pip-audit"],
            capture_output=True,
            text=True
        )
        
        if install_result.returncode != 0:
            print("❌ Failed to install pip-audit")
            print(install_result.stderr)
            sys.exit(1)
        
        print("✅ pip-audit installed successfully")
        print()
    else:
        print("✅ pip-audit is installed")
        print()
    
except Exception as e:
    print(f"❌ Error checking pip-audit: {e}")
    sys.exit(1)

# Run pip-audit
print("Running security scan...")
print("This may take a few minutes...")
print()

try:
    result = subprocess.run(
        ["pip-audit", "--desc"],
        capture_output=True,
        text=True
    )
    
    print(result.stdout)
    
    if result.returncode == 0:
        print("=" * 70)
        print("✅ NO VULNERABILITIES FOUND")
        print("=" * 70)
        print()
        print("All dependencies are secure!")
        sys.exit(0)
    else:
        print("=" * 70)
        print("⚠️  VULNERABILITIES FOUND")
        print("=" * 70)
        print()
        print("Please review the vulnerabilities above and:")
        print("  1. Update affected packages: pip install --upgrade <package>")
        print("  2. Check if updates break compatibility")
        print("  3. Run tests after updating")
        print("  4. Run this scan again")
        sys.exit(1)
        
except FileNotFoundError:
    print("❌ pip-audit command not found")
    print()
    print("Please install pip-audit:")
    print("  pip install pip-audit")
    sys.exit(1)
    
except Exception as e:
    print(f"❌ Error running pip-audit: {e}")
    sys.exit(1)
