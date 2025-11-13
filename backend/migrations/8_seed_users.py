#!/usr/bin/env python3
"""Step 8: Seed users (admins and supporters) with bcrypt password hashing."""

import sys
import json
import uuid
from pathlib import Path
import bcrypt

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import User, Supporter, Tenant
from src.config import SessionLocal


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def seed_users():
    """Load and seed users from JSON file."""
    db = SessionLocal()
    try:
        # Check if all 9 users already exist (3 admins + 6 supporters)
        users = db.query(User).count()
        if users >= 9:
            print("✓ All 9 users already seeded, skipping")
            return True

        print("Seeding users...")

        # Load data from JSON
        data_file = Path(__file__).parent / "data" / "users.json"
        with open(data_file, 'r') as f:
            users_data = json.load(f)

        users_count = 0
        for user_data in users_data:
            # Get tenant by name
            tenant = db.query(Tenant).filter_by(name=user_data["tenant_name"]).first()

            if tenant:
                # Check if user already exists
                existing_user = db.query(User).filter_by(
                    email=user_data["email"]
                ).first()

                if not existing_user:
                    # Hash password (default: 123456)
                    password_hash = hash_password("123456")

                    user = User(
                        user_id=uuid.uuid4(),
                        email=user_data["email"],
                        username=user_data.get("username", user_data["email"].split("@")[0]),
                        password_hash=password_hash,
                        role=user_data.get("role", "tenant_user"),
                        status="active",
                        tenant_id=tenant.tenant_id
                    )
                    db.add(user)
                    users_count += 1
            else:
                print(f"⚠ Warning: Tenant '{user_data['tenant_name']}' not found for user '{user_data['email']}'")

        db.commit()
        print(f"✅ {users_count} users seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding users: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def seed_supporters():
    """Seed supporters (alias for supporter role users)."""
    db = SessionLocal()
    try:
        # Check if all 6 supporters already exist
        supporters = db.query(Supporter).count()
        if supporters >= 6:
            print("✓ All 6 supporters already seeded, skipping")
            return True

        print("Seeding supporters...")

        # Get all supporter role users and create Supporter records
        supporter_users = db.query(User).filter_by(role="supporter").all()

        supporters_count = 0
        for user in supporter_users:
            # Check if supporter record already exists
            existing_supporter = db.query(Supporter).filter_by(
                user_id=user.user_id
            ).first()

            if not existing_supporter:
                supporter = Supporter(
                    supporter_id=uuid.uuid4(),
                    user_id=user.user_id,
                    tenant_id=user.tenant_id,
                    status="online"
                )
                db.add(supporter)
                supporters_count += 1

        db.commit()
        print(f"✅ {supporters_count} supporters seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding supporters: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 8: Seed Users & Supporters")
    print("="*60)

    success = seed_users() and seed_supporters()

    if success:
        print("✅ Step 8: Users and supporters seeded successfully")
    else:
        print("❌ Step 8: Failed to seed users and supporters")

    sys.exit(0 if success else 1)
