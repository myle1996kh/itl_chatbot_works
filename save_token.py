"""
Simple token generator - saves token to file for easy copying.
Updated to generate token for ADMIN role.
"""
import sys
sys.path.insert(0, 'backend')

from src.config import get_db
from src.models.tenant import Tenant
from src.models.user import User
from src.api.auth import generate_token

# Get database session
db = next(get_db())

try:
    # Get first tenant
    tenant = db.query(Tenant).first()
    
    # Find an admin user
    admin_user = db.query(User).filter(
        User.tenant_id == tenant.tenant_id,
        User.role == "admin"
    ).first()
    
    if not admin_user:
        print("❌ No admin user found! Looking for any user...")
        admin_user = db.query(User).filter(User.tenant_id == tenant.tenant_id).first()
        print(f"⚠️  Using user: {admin_user.username} with role: {admin_user.role}")
    else:
        print(f"✅ Found admin user: {admin_user.username}")
    
    # Generate token
    token = generate_token(str(admin_user.user_id), str(tenant.tenant_id), admin_user.role)
    
    # Save to file
    with open('backend/NEW_TOKEN.txt', 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("FRESH JWT TOKEN - Valid for 24 hours\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"User:      {admin_user.username}\n")
        f.write(f"Email:     {admin_user.email}\n")
        f.write(f"Role:      {admin_user.role}\n")
        f.write(f"Tenant:    {tenant.name}\n")
        f.write(f"Tenant ID: {tenant.tenant_id}\n\n")
        f.write("=" * 80 + "\n")
        f.write("TOKEN:\n")
        f.write("=" * 80 + "\n")
        f.write(token + "\n")
        f.write("=" * 80 + "\n\n")
        f.write("Use in Authorization header:\n")
        f.write(f"Authorization: Bearer {token}\n")
        f.write("=" * 80 + "\n")
    
    print(f"✅ Token saved to: backend/NEW_TOKEN.txt")
    print(f"   User: {admin_user.username} ({admin_user.role})")
    print(f"   Tenant: {tenant.name}")
    print(f"\n📋 Token preview: {token[:50]}...")
    
finally:
    db.close()
