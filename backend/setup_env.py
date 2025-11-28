"""
Interactive .env Setup Helper
Guides you through creating a production-ready .env file
"""
import os
from pathlib import Path

print("=" * 70)
print("INTERACTIVE .env SETUP")
print("=" * 70)
print()

# Check if .env exists
env_file = Path(".env")
if env_file.exists():
    print("⚠️  .env file already exists!")
    response = input("Do you want to back it up first? (y/n): ").lower()
    if response == 'y':
        backup_file = Path(".env.backup")
        env_file.rename(backup_file)
        print(f"✅ Backed up to {backup_file}")
    print()

print("This script will help you create a production-ready .env file.")
print()

# Step 1: Choose authentication mode
print("STEP 1: Choose Authentication Mode")
print("-" * 70)
print()
print("1. Development Mode (DISABLE_AUTH=true)")
print("   - No JWT required")
print("   - For local testing only")
print("   - ⚠️  NEVER use in production")
print()
print("2. Production Mode (DISABLE_AUTH=false)")
print("   - Requires JWT public key")
print("   - For production deployment")
print("   - Secure multi-tenant authentication")
print()

while True:
    choice = input("Choose mode (1 or 2): ").strip()
    if choice in ['1', '2']:
        break
    print("Invalid choice. Please enter 1 or 2.")

use_auth = (choice == '2')

# Step 2: Get JWT public key if production mode
jwt_public_key = ""
if use_auth:
    print()
    print("STEP 2: JWT Public Key")
    print("-" * 70)
    print()
    print("You need a JWT public key (RS256) from your auth provider.")
    print()
    print("Options:")
    print("  a) I have a public key ready")
    print("  b) I need to generate keys")
    print("  c) Skip for now (will configure later)")
    print()
    
    jwt_choice = input("Choose option (a/b/c): ").strip().lower()
    
    if jwt_choice == 'a':
        print()
        print("Paste your public key (including BEGIN/END markers).")
        print("Press Enter twice when done:")
        print()
        
        lines = []
        while True:
            line = input()
            if line == "" and len(lines) > 0:
                break
            lines.append(line)
        
        jwt_public_key = "\\n".join(lines)
        print()
        print("✅ Public key captured")
        
    elif jwt_choice == 'b':
        print()
        print("To generate JWT keys, run these commands:")
        print()
        print("  # Generate private key")
        print("  openssl genrsa -out private.pem 4096")
        print()
        print("  # Generate public key")
        print("  openssl rsa -in private.pem -pubout -out public.pem")
        print()
        print("  # View public key")
        print("  cat public.pem")
        print()
        print("After generating, re-run this script and choose option 'a'")
        print()
        input("Press Enter to continue with empty JWT_PUBLIC_KEY...")
        jwt_public_key = ""
    else:
        print()
        print("⚠️  Skipping JWT configuration. You'll need to add it manually later.")
        jwt_public_key = ""

# Step 3: Database configuration
print()
print("STEP 3: Database Configuration")
print("-" * 70)
print()

db_password = input("Enter PostgreSQL password (or press Enter for default): ").strip()
if not db_password:
    db_password = "CHANGE_THIS_PASSWORD"

db_host = input("Enter database host (default: localhost): ").strip() or "localhost"
db_port = input("Enter database port (default: 5432): ").strip() or "5432"
db_name = input("Enter database name (default: chatbot_itl): ").strip() or "chatbot_itl"
db_user = input("Enter database user (default: postgres): ").strip() or "postgres"

database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

# Step 4: CORS origins
print()
print("STEP 4: CORS Origins")
print("-" * 70)
print()

if use_auth:
    cors_default = "https://yourdomain.com"
    print("Enter your production domain(s) (comma-separated):")
else:
    cors_default = "http://localhost:3000,http://localhost:8080"
    print("Enter allowed origins (comma-separated):")

cors_origins = input(f"CORS origins (default: {cors_default}): ").strip() or cors_default

# Step 5: Log level
print()
print("STEP 5: Logging")
print("-" * 70)
print()

if use_auth:
    log_level = input("Log level (default: WARNING): ").strip() or "WARNING"
else:
    log_level = input("Log level (default: INFO): ").strip() or "INFO"

# Generate .env content
print()
print("=" * 70)
print("GENERATING .env FILE")
print("=" * 70)
print()

env_content = f"""# ============================================================================
# ITL Chatbot Backend Configuration
# Generated: {Path.cwd()}
# ============================================================================

# ----------------------------------------------------------------------------
# Authentication
# ----------------------------------------------------------------------------
DISABLE_AUTH={'false' if use_auth else 'true'}
ENVIRONMENT={'production' if use_auth else 'development'}
JWT_PUBLIC_KEY={'"' + jwt_public_key + '"' if jwt_public_key else ''}

# ----------------------------------------------------------------------------
# Encryption (VALIDATED ✅)
# ----------------------------------------------------------------------------
FERNET_KEY=kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=

# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------
DATABASE_URL={database_url}
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# ----------------------------------------------------------------------------
# Redis
# ----------------------------------------------------------------------------
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600

# ----------------------------------------------------------------------------
# Logging
# ----------------------------------------------------------------------------
LOG_LEVEL={log_level}

# ----------------------------------------------------------------------------
# CORS
# ----------------------------------------------------------------------------
CORS_ORIGINS={cors_origins}

# ----------------------------------------------------------------------------
# Rate Limiting
# ----------------------------------------------------------------------------
DEFAULT_RATE_LIMIT_RPM=60
DEFAULT_RATE_LIMIT_TPM=10000

# ----------------------------------------------------------------------------
# API Keys (Optional)
# ----------------------------------------------------------------------------
OPENROUTER_API_KEY=
PROTONX_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im15bGUxOTk2a2hAZ21haWwuY29tIiwiaWF0IjoxNzYyMjMwODM1LCJleHAiOjE3NjQ4MjI4MzV9.wrWOCUGEC_4tWFWlehvkQPzCVPB6NvscfvX_q0SzaKU
"""

# Write to file
with open(".env", "w") as f:
    f.write(env_content)

print("✅ .env file created successfully!")
print()

# Summary
print("=" * 70)
print("CONFIGURATION SUMMARY")
print("=" * 70)
print()
print(f"Mode: {'Production (JWT Auth)' if use_auth else 'Development (No Auth)'}")
print(f"Database: {db_host}:{db_port}/{db_name}")
print(f"CORS: {cors_origins}")
print(f"Log Level: {log_level}")
print()

# Next steps
print("=" * 70)
print("NEXT STEPS")
print("=" * 70)
print()
print("1. Review the generated .env file:")
print("   code .env")
print()
print("2. Verify configuration:")
print("   python verify_auth_config.py")
print()
print("3. Create database indexes:")
print("   python create_security_indexes.py")
print()
print("4. Scan dependencies:")
print("   python scan_dependencies.py")
print()

if not use_auth:
    print("⚠️  REMINDER: You're using DEVELOPMENT mode")
    print("   Change DISABLE_AUTH=false before deploying to production!")
    print()

if use_auth and not jwt_public_key:
    print("⚠️  WARNING: JWT_PUBLIC_KEY is not set")
    print("   You must add it to .env before the app will work!")
    print()

print("✅ Setup complete!")
