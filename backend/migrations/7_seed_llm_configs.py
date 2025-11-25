#!/usr/bin/env python3
"""Step 7: Seed tenant LLM configurations with API key encryption."""

import sys
import os
import uuid
from pathlib import Path
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load .env file BEFORE importing config
env_file = Path(__file__).parent.parent / ".env"
load_dotenv(env_file)

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import TenantLLMConfig, Tenant, LLMModel
from src.config import SessionLocal, settings


def encrypt_api_key(api_key: str) -> str:
    """Encrypt API key using Fernet."""
    if not settings.FERNET_KEY:
        raise ValueError("FERNET_KEY not set in environment")

    cipher = Fernet(settings.FERNET_KEY.encode())
    encrypted = cipher.encrypt(api_key.encode())
    return encrypted.decode()


def seed_llm_configs():
    """Seed tenant LLM configurations with encrypted API keys."""
    db = SessionLocal()
    try:
        print("Seeding tenant LLM configurations...")

        # Define tenant-to-LLM mappings
        configs = [
            {
                "tenant_name": "Test_eTMS",
                "provider": "google",
                "model_name": "gemini-2.5-flash"
            }
        ]

        # Check if all expected configs already exist (specific check)
        expected_configs = len(configs)
        existing_configs = db.query(TenantLLMConfig).count()

        if existing_configs >= expected_configs:
            print(f"✓ All {expected_configs} LLM configs already seeded, skipping")
            return True

        # Now load API keys only from environment
        api_keys = {
            "google": os.getenv("GOOGLE_API_KEY"),
            "openrouter": os.getenv("OPENROUTER_API_KEY")
        }

        # Check if required API keys are available
        missing_keys = [k for k, v in api_keys.items() if not v]
        if missing_keys:
            print(f"⚠ Warning: Missing API keys in environment: {', '.join(missing_keys)}")
            print("  Set these environment variables:")
            for key in missing_keys:
                print(f"    - {key.upper()}_API_KEY")

        configs_count = 0
        for config_data in configs:
            tenant = db.query(Tenant).filter_by(name=config_data["tenant_name"]).first()
            llm_model = db.query(LLMModel).filter_by(
                provider=config_data["provider"],
                model_name=config_data["model_name"]
            ).first()

            if tenant and llm_model:
                # Check if config already exists for this tenant
                existing_config = db.query(TenantLLMConfig).filter_by(
                    tenant_id=tenant.tenant_id
                ).first()

                if not existing_config:
                    # Get API key for this provider
                    api_key = api_keys.get(config_data["provider"], "")

                    if not api_key:
                        print(f"⚠ Warning: No API key for provider '{config_data['provider']}'")
                        continue

                    # Encrypt API key
                    try:
                        encrypted_api_key = encrypt_api_key(api_key)
                    except Exception as e:
                        print(f"⚠ Warning: Failed to encrypt API key for {config_data['tenant_name']}: {e}")
                        raise  # Don't continue with unencrypted keys

                    # Create TenantLLMConfig with CORRECT column names
                    # config_id is auto-generated (no need to set)
                    config = TenantLLMConfig(
                        tenant_id=tenant.tenant_id,
                        llm_model_id=llm_model.llm_model_id,  # FIXED: was model_id
                        encrypted_api_key=encrypted_api_key,
                        rate_limit_rpm=60,  # Default value
                        rate_limit_tpm=10000  # Default value
                        # temperature and max_tokens do NOT exist in TenantLLMConfig
                    )
                    db.add(config)
                    configs_count += 1
                    print(f"  ✓ {config_data['tenant_name']}: {config_data['model_name']}")
                else:
                    print(f"  ✓ {config_data['tenant_name']}: already configured (skipped)")
            else:
                if not tenant:
                    print(f"⚠ Warning: Tenant '{config_data['tenant_name']}' not found")
                if not llm_model:
                    print(f"⚠ Warning: LLM model '{config_data['model_name']}' not found")

        db.commit()
        print(f"✅ {configs_count} LLM configs seeded with encrypted API keys")
        return True

    except Exception as e:
        print(f"❌ Error seeding LLM configs: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 7: Seed Tenant LLM Configurations")
    print("="*60)

    success = seed_llm_configs()

    if success:
        print("✅ Step 7: LLM configs seeded successfully")
    else:
        print("❌ Step 7: Failed to seed LLM configs")

    sys.exit(0 if success else 1)
