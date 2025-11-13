#!/usr/bin/env python3
"""
Quick script to create or verify admin user for testing
Usage: python backend/create_admin_user.py
"""

import os
import sys
import uuid
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models.user import User
from src.models.tenant import Tenant
from src.config import settings
import bcrypt

# Database connection
engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def create_admin_user():
    """Create admin user or show existing"""
    
    # Check if admin with this email exists
    admin_email = "admin@example.com"
    existing = db.query(User).filter(
        User.email == admin_email,
        User.role == 'admin'
    ).first()
    
    if existing:
        print(f"✅ Admin user already exists:")
        print(f"   Email: {existing.email}")
        print(f"   Username: {existing.username}")
        print(f"   Tenant ID: {existing.tenant_id}")
        print(f"\n🔐 Credentials:")
        print(f"   Email: {existing.email}")
        print(f"   Password: 123456")
        return
    
    # Get first tenant (or create default)
    tenant = db.query(Tenant).first()
    if not tenant:
        print("❌ No tenant found in database. Please create a tenant first.")
        return
    
    # Create admin user
    admin_user = User(
        user_id=uuid.uuid4(),
        tenant_id=tenant.tenant_id,
        email=admin_email,
        username="admin",
        password_hash=hash_password("123456"),
        role="admin",
        display_name="Admin User",
        status="active",
        created_by=None
    )
    
    db.add(admin_user)
    db.commit()
    
    print("✅ Admin user created successfully!")
    print(f"\n🔐 Admin Credentials:")
    print(f"   Email: {admin_user.email}")
    print(f"   Username: {admin_user.username}")
    print(f"   Password: 123456")
    print(f"   Tenant ID: {admin_user.tenant_id}")
    print(f"\n📝 Now login with:")
    print(f"   1. Go to frontend login page")
    print(f"   2. Email: admin@example.com")
    print(f"   3. Password: 123456")
    print(f"   4. Tenant: (select from dropdown)")
    
    db.close()

if __name__ == "__main__":
    try:
        create_admin_user()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
