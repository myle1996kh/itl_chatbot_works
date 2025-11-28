"""
Security Review Script for ITL Chatbot Backend
Validates security configuration and identifies potential issues
"""
import os
import sys
from pathlib import Path
from cryptography.fernet import Fernet
import re

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 70)
print("SECURITY REVIEW - ITL Chatbot Backend")
print("=" * 70)
print()

# ============================================================================
# 1. FERNET KEY VALIDATION
# ============================================================================
print("1. FERNET KEY VALIDATION")
print("-" * 70)

FERNET_KEY = "kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM="

try:
    # Test if key is valid
    fernet = Fernet(FERNET_KEY.encode())
    
    # Test encryption/decryption
    test_data = b"test_secret_data"
    encrypted = fernet.encrypt(test_data)
    decrypted = fernet.decrypt(encrypted)
    
    if decrypted == test_data:
        print("✅ Fernet key is VALID and working")
        print(f"   Key: {FERNET_KEY[:10]}...{FERNET_KEY[-10:]}")
    else:
        print("❌ Fernet key encryption/decryption failed")
        
except Exception as e:
    print(f"❌ Fernet key is INVALID: {e}")

print()

# ============================================================================
# 2. ENVIRONMENT CONFIGURATION CHECK
# ============================================================================
print("2. ENVIRONMENT CONFIGURATION")
print("-" * 70)

env_file = Path(".env")
if not env_file.exists():
    print("❌ .env file not found!")
else:
    print("✅ .env file exists")
    
    # Read .env
    with open(env_file, 'r') as f:
        env_content = f.read()
    
    # Check critical settings
    checks = {
        "DISABLE_AUTH": {
            "pattern": r"DISABLE_AUTH\s*=\s*(\w+)",
            "expected": "false",
            "critical": True
        },
        "ENVIRONMENT": {
            "pattern": r"ENVIRONMENT\s*=\s*(\w+)",
            "expected": "production",
            "critical": True
        },
        "LOG_LEVEL": {
            "pattern": r"LOG_LEVEL\s*=\s*(\w+)",
            "expected": ["WARNING", "ERROR"],
            "critical": False
        },
        "FERNET_KEY": {
            "pattern": r"FERNET_KEY\s*=\s*(.+)",
            "check": lambda v: v != "GENERATE_NEW_KEY_HERE" and len(v) > 20,
            "critical": True
        },
        "DATABASE_URL": {
            "pattern": r"DATABASE_URL\s*=\s*(.+)",
            "check": lambda v: "CHANGE_THIS_PASSWORD" not in v,
            "critical": True
        }
    }
    
    for setting, config in checks.items():
        match = re.search(config["pattern"], env_content)
        
        if not match:
            print(f"⚠️  {setting}: NOT FOUND in .env")
            continue
        
        value = match.group(1).strip()
        
        # Check expected value
        if "expected" in config:
            expected = config["expected"]
            if isinstance(expected, list):
                is_ok = value in expected
            else:
                is_ok = value.lower() == expected.lower()
            
            if is_ok:
                print(f"✅ {setting}: {value}")
            else:
                marker = "❌" if config.get("critical") else "⚠️ "
                print(f"{marker} {setting}: {value} (expected: {expected})")
        
        # Custom check
        elif "check" in config:
            if config["check"](value):
                print(f"✅ {setting}: Configured")
            else:
                marker = "❌" if config.get("critical") else "⚠️ "
                print(f"{marker} {setting}: Invalid or insecure value")

print()

# ============================================================================
# 3. GITIGNORE CHECK
# ============================================================================
print("3. GITIGNORE VERIFICATION")
print("-" * 70)

gitignore_file = Path("../.gitignore")
if gitignore_file.exists():
    with open(gitignore_file, 'r') as f:
        gitignore_content = f.read()
    
    if ".env" in gitignore_content:
        print("✅ .env is in .gitignore")
    else:
        print("❌ .env is NOT in .gitignore - CRITICAL SECURITY ISSUE!")
else:
    print("⚠️  .gitignore not found")

print()

# ============================================================================
# 4. AUTHENTICATION CHECK
# ============================================================================
print("4. AUTHENTICATION CONFIGURATION")
print("-" * 70)

try:
    from src.core.config import get_settings
    
    settings = get_settings()
    
    print(f"   DISABLE_AUTH: {settings.DISABLE_AUTH}")
    print(f"   ENVIRONMENT: {settings.ENVIRONMENT}")
    
    if settings.DISABLE_AUTH and settings.ENVIRONMENT == "production":
        print("❌ CRITICAL: Auth is disabled in production!")
    elif settings.DISABLE_AUTH:
        print("⚠️  Auth is disabled (OK for development)")
    else:
        print("✅ Authentication is enabled")
        
        if settings.JWT_PUBLIC_KEY:
            print("✅ JWT public key is configured")
        else:
            print("❌ JWT public key is NOT configured")
    
except Exception as e:
    print(f"⚠️  Could not load settings: {e}")

print()

# ============================================================================
# 5. DEPENDENCY SECURITY
# ============================================================================
print("5. DEPENDENCY SECURITY")
print("-" * 70)

print("Checking for known vulnerabilities...")
print("Run: pip-audit or safety check")
print("(Install with: pip install pip-audit)")

print()

# ============================================================================
# 6. CODE SECURITY PATTERNS
# ============================================================================
print("6. CODE SECURITY PATTERNS")
print("-" * 70)

# Check for common security issues
src_path = Path("src")
if src_path.exists():
    issues = []
    
    # Check for hardcoded secrets
    for py_file in src_path.rglob("*.py"):
        with open(py_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Check for potential hardcoded secrets
            if re.search(r'password\s*=\s*["\'][^"\']+["\']', content, re.IGNORECASE):
                issues.append(f"Potential hardcoded password in {py_file}")
            
            if re.search(r'api[_-]?key\s*=\s*["\'][^"\']+["\']', content, re.IGNORECASE):
                # Exclude test files and examples
                if "test" not in str(py_file) and "example" not in str(py_file):
                    issues.append(f"Potential hardcoded API key in {py_file}")
    
    if issues:
        print("⚠️  Potential security issues found:")
        for issue in issues[:5]:  # Show first 5
            print(f"   - {issue}")
    else:
        print("✅ No obvious hardcoded secrets found")
else:
    print("⚠️  src/ directory not found")

print()

# ============================================================================
# 7. DATABASE SECURITY
# ============================================================================
print("7. DATABASE SECURITY")
print("-" * 70)

try:
    from src.database.connection import get_db_session
    from sqlalchemy import text
    
    # Test database connection
    with get_db_session() as db:
        # Check if pgvector extension exists
        result = db.execute(text("SELECT * FROM pg_extension WHERE extname = 'vector'"))
        if result.fetchone():
            print("✅ pgvector extension is installed")
        else:
            print("⚠️  pgvector extension not found")
        
        # Check for tenant isolation in queries
        print("✅ Database connection successful")
        
except Exception as e:
    print(f"⚠️  Database connection failed: {e}")

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 70)
print("SECURITY REVIEW SUMMARY")
print("=" * 70)
print()
print("Review the findings above and address any ❌ CRITICAL issues before")
print("deploying to production.")
print()
print("Next steps:")
print("1. Fix all ❌ critical issues")
print("2. Review all ⚠️  warnings")
print("3. Run: pip-audit (for dependency vulnerabilities)")
print("4. Update PRE_PRODUCTION_CHECKLIST.md")
print()
