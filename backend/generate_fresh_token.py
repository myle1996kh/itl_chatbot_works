"""
Generate a fresh JWT token with actual tenant/user data from database.

This script:
1. Connects to your database
2. Shows available tenants and users
3. Generates a valid JWT token for a selected user
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from src.config import get_db
from src.models.tenant import Tenant
from src.models.user import User
from src.api.auth import generate_token
from sqlalchemy.orm import Session

def main():
    print("=" * 80)
    print("JWT TOKEN GENERATOR - Using Real Database Data")
    print("=" * 80)
    print()
    
    # Get database session
    db = next(get_db())
    
    try:
        # List all tenants
        tenants = db.query(Tenant).filter(Tenant.status == "active").all()
        
        if not tenants:
            print("❌ No active tenants found in database!")
            print("   Please create a tenant first.")
            return
        
        print(f"📋 Found {len(tenants)} active tenant(s):")
        print("-" * 80)
        for i, tenant in enumerate(tenants, 1):
            print(f"{i}. {tenant.name}")
            print(f"   Tenant ID: {tenant.tenant_id}")
            print(f"   Domain: {tenant.domain}")
            print()
        
        # Get first tenant
        tenant = tenants[0]
        print(f"✅ Using tenant: {tenant.name} ({tenant.tenant_id})")
        print()
        
        # List users for this tenant
        users = db.query(User).filter(User.tenant_id == tenant.tenant_id).all()
        
        if not users:
            print(f"❌ No users found for tenant {tenant.name}!")
            print("   Please create a user first.")
            return
        
        print(f"👥 Found {len(users)} user(s) in this tenant:")
        print("-" * 80)
        for i, user in enumerate(users, 1):
            print(f"{i}. {user.username} ({user.email})")
            print(f"   User ID: {user.user_id}")
            print(f"   Role: {user.role}")
            print(f"   Status: {user.status}")
            print()
        
        # Get first admin user, or first user if no admin
        admin_user = next((u for u in users if u.role == "admin"), users[0])
        
        print(f"✅ Generating token for: {admin_user.username} ({admin_user.role})")
        print()
        
        # Generate token
        token = generate_token(
            user_id=str(admin_user.user_id),
            tenant_id=str(tenant.tenant_id),
            role=admin_user.role
        )
        
        print("=" * 80)
        print("🎉 TOKEN GENERATED SUCCESSFULLY!")
        print("=" * 80)
        print()
        print("Token Details:")
        print(f"  User:      {admin_user.username}")
        print(f"  Email:     {admin_user.email}")
        print(f"  Role:      {admin_user.role}")
        print(f"  Tenant:    {tenant.name}")
        print(f"  Tenant ID: {tenant.tenant_id}")
        print(f"  Valid for: 24 hours")
        print()
        print("=" * 80)
        print("YOUR TOKEN:")
        print("=" * 80)
        print(token)
        print("=" * 80)
        print()
        print("💡 Copy this token and use it in your requests:")
        print(f"   Authorization: Bearer {token}")
        print()
        print("=" * 80)
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
