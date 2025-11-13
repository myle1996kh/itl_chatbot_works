#!/usr/bin/env python3
"""Step 3: Seed tenants into database."""

import sys
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import Tenant
from src.config import SessionLocal


def seed_tenants():
    """Load and seed tenants from JSON file."""
    db = SessionLocal()
    try:
        # Check if all 3 tenants already exist
        etms = db.query(Tenant).filter_by(name="eTMS").first()
        efms = db.query(Tenant).filter_by(name="eFMS").first()
        vela = db.query(Tenant).filter_by(name="Vela").first()

        if etms and efms and vela:
            print("✓ All tenants already seeded, skipping")
            return True

        print("Seeding tenants...")

        # Load data from JSON
        data_file = Path(__file__).parent / "data" / "tenants.json"
        with open(data_file, 'r') as f:
            tenants_data = json.load(f)

        tenants_count = 0
        for tenant_data in tenants_data:
            # Check if tenant already exists
            existing_tenant = db.query(Tenant).filter_by(
                domain=tenant_data["domain"]
            ).first()

            if not existing_tenant:
                tenant = Tenant(
                    tenant_id=uuid.uuid4(),
                    name=tenant_data["name"],
                    domain=tenant_data["domain"],
                    status="active"
                )
                db.add(tenant)
                tenants_count += 1

        db.commit()
        print(f"✅ {tenants_count} tenants seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding tenants: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 3: Seed Tenants")
    print("="*60)

    success = seed_tenants()

    if success:
        print("✅ Step 3: Tenants seeded successfully")
    else:
        print("❌ Step 3: Failed to seed tenants")

    sys.exit(0 if success else 1)
