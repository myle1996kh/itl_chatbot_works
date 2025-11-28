# Quick .env Update Helper
# Adds the generated JWT public key to your .env file

import os
from pathlib import Path

print("=" * 70)
print(".ENV UPDATE HELPER")
print("=" * 70)
print()

# Read the public key
public_key_file = Path("jwt_public.pem")
if not public_key_file.exists():
    print("❌ jwt_public.pem not found!")
    print("   Run: python generate_jwt_keys.py first")
    exit(1)

with open(public_key_file, 'r') as f:
    public_key = f.read().strip()

# Format for .env (escape newlines)
public_key_escaped = public_key.replace('\n', '\\n')

print("Public key loaded from jwt_public.pem")
print()

# Read current .env
env_file = Path(".env")
if not env_file.exists():
    print("❌ .env file not found!")
    print("   Create it first or run: python setup_env.py")
    exit(1)

with open(env_file, 'r') as f:
    env_content = f.read()

print("Current .env settings:")
print()

# Check current settings
if 'DISABLE_AUTH=true' in env_content:
    print("  DISABLE_AUTH: true (will change to false)")
elif 'DISABLE_AUTH=false' in env_content:
    print("  DISABLE_AUTH: false ✅")
else:
    print("  DISABLE_AUTH: not set (will add)")

if 'JWT_PUBLIC_KEY=' in env_content and 'JWT_PUBLIC_KEY=\n' not in env_content and 'JWT_PUBLIC_KEY=\r' not in env_content:
    print("  JWT_PUBLIC_KEY: already set")
else:
    print("  JWT_PUBLIC_KEY: not set (will add)")

print()
response = input("Update .env file? (y/n): ").lower()

if response != 'y':
    print("Cancelled.")
    exit(0)

# Update .env
lines = env_content.split('\n')
new_lines = []
jwt_key_added = False
disable_auth_updated = False

for line in lines:
    # Update DISABLE_AUTH
    if line.startswith('DISABLE_AUTH='):
        new_lines.append('DISABLE_AUTH=false')
        disable_auth_updated = True
        print("✅ Updated DISABLE_AUTH=false")
    
    # Update JWT_PUBLIC_KEY
    elif line.startswith('JWT_PUBLIC_KEY='):
        new_lines.append(f'JWT_PUBLIC_KEY="{public_key_escaped}"')
        jwt_key_added = True
        print("✅ Updated JWT_PUBLIC_KEY")
    
    else:
        new_lines.append(line)

# Add if not found
if not disable_auth_updated:
    # Find where to add it (after ENVIRONMENT or at top)
    for i, line in enumerate(new_lines):
        if line.startswith('ENVIRONMENT='):
            new_lines.insert(i + 1, 'DISABLE_AUTH=false')
            print("✅ Added DISABLE_AUTH=false")
            break

if not jwt_key_added:
    # Add after DISABLE_AUTH
    for i, line in enumerate(new_lines):
        if line.startswith('DISABLE_AUTH='):
            new_lines.insert(i + 1, f'JWT_PUBLIC_KEY="{public_key_escaped}"')
            print("✅ Added JWT_PUBLIC_KEY")
            break

# Write back
with open(env_file, 'w') as f:
    f.write('\n'.join(new_lines))

print()
print("=" * 70)
print("✅ .ENV FILE UPDATED")
print("=" * 70)
print()
print("Next steps:")
print("1. Verify configuration: python verify_auth_config.py")
print("2. Restart your server: uvicorn backend.src.main:app --reload")
print()
print("Test token saved in: jwt_test_token.txt")
print()
