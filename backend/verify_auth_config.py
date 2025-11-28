"""
Authentication Configuration Verifier
Checks if authentication is properly configured for production
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
load_dotenv()

print("=" * 70)
print("AUTHENTICATION CONFIGURATION VERIFICATION")
print("=" * 70)
print()

# Critical settings for production
critical_checks = {
    "DISABLE_AUTH": {
        "expected": "false",
        "current": os.getenv("DISABLE_AUTH", "").lower(),
        "critical": True,
        "message": "Authentication MUST be enabled in production"
    },
    "JWT_PUBLIC_KEY": {
        "expected": "configured",
        "current": os.getenv("JWT_PUBLIC_KEY", ""),
        "critical": True,
        "message": "JWT public key MUST be set for token validation"
    },
    "ENVIRONMENT": {
        "expected": "production",
        "current": os.getenv("ENVIRONMENT", ""),
        "critical": True,
        "message": "Environment MUST be set to 'production'"
    },
    "LOG_LEVEL": {
        "expected": ["WARNING", "ERROR"],
        "current": os.getenv("LOG_LEVEL", ""),
        "critical": False,
        "message": "Log level should be WARNING or ERROR in production"
    },
    "FERNET_KEY": {
        "expected": "kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=",
        "current": os.getenv("FERNET_KEY", ""),
        "critical": True,
        "message": "Fernet key MUST be set for encryption"
    }
}

all_passed = True
critical_failed = False

for setting, config in critical_checks.items():
    current = config["current"]
    expected = config["expected"]
    
    # Check if value is set
    if not current:
        marker = "❌" if config["critical"] else "⚠️ "
        print(f"{marker} {setting}: NOT SET")
        print(f"   {config['message']}")
        print()
        all_passed = False
        if config["critical"]:
            critical_failed = True
        continue
    
    # Check expected value
    if expected == "configured":
        # Just check if it's set
        if len(current) > 10:
            print(f"✅ {setting}: Configured")
            print(f"   Length: {len(current)} characters")
        else:
            print(f"❌ {setting}: Too short or invalid")
            print(f"   {config['message']}")
            all_passed = False
            if config["critical"]:
                critical_failed = True
    elif isinstance(expected, list):
        # Check if value is in list
        if current.upper() in [e.upper() for e in expected]:
            print(f"✅ {setting}: {current}")
        else:
            marker = "❌" if config["critical"] else "⚠️ "
            print(f"{marker} {setting}: {current}")
            print(f"   Expected: {' or '.join(expected)}")
            print(f"   {config['message']}")
            all_passed = False
            if config["critical"]:
                critical_failed = True
    else:
        # Check exact match
        if current.lower() == expected.lower():
            print(f"✅ {setting}: {current}")
        else:
            marker = "❌" if config["critical"] else "⚠️ "
            print(f"{marker} {setting}: {current}")
            print(f"   Expected: {expected}")
            print(f"   {config['message']}")
            all_passed = False
            if config["critical"]:
                critical_failed = True
    
    print()

# Additional checks
print("=" * 70)
print("ADDITIONAL SECURITY CHECKS")
print("=" * 70)
print()

# Check CORS origins
cors_origins = os.getenv("CORS_ORIGINS", "")
if cors_origins and "*" not in cors_origins:
    print(f"✅ CORS_ORIGINS: Restricted")
    print(f"   Origins: {cors_origins[:50]}...")
elif "*" in cors_origins:
    print(f"⚠️  CORS_ORIGINS: Allows all origins (*)")
    print(f"   Consider restricting to specific domains in production")
else:
    print(f"⚠️  CORS_ORIGINS: Not set")
    print(f"   Will use default (may allow all origins)")

print()

# Check database URL
db_url = os.getenv("DATABASE_URL", "")
if db_url:
    if "CHANGE_THIS_PASSWORD" in db_url or "password" in db_url.lower():
        print(f"❌ DATABASE_URL: Contains default/weak password")
        print(f"   Use a strong password (20+ characters)")
        critical_failed = True
    else:
        print(f"✅ DATABASE_URL: Configured")
        # Hide password
        if "@" in db_url:
            parts = db_url.split("@")
            print(f"   Host: {parts[1] if len(parts) > 1 else 'configured'}")
else:
    print(f"❌ DATABASE_URL: Not set")
    critical_failed = True

print()

# Summary
print("=" * 70)
print("VERIFICATION SUMMARY")
print("=" * 70)
print()

if all_passed and not critical_failed:
    print("✅ ALL CHECKS PASSED")
    print()
    print("Your authentication configuration is ready for production!")
    sys.exit(0)
elif critical_failed:
    print("❌ CRITICAL ISSUES FOUND")
    print()
    print("You MUST fix all ❌ critical issues before deploying to production.")
    print()
    print("Action required:")
    print("  1. Update .env file with correct values")
    print("  2. Run this script again to verify")
    print("  3. Restart the application")
    sys.exit(1)
else:
    print("⚠️  WARNINGS FOUND")
    print()
    print("Review all ⚠️  warnings before deploying to production.")
    print("These are not blocking, but recommended to fix.")
    sys.exit(0)
