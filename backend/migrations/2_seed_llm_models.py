#!/usr/bin/env python3
"""Step 2: Seed LLM models into database."""

import sys
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import LLMModel
from src.config import SessionLocal


def seed_llm_models():
    """Load and seed LLM models from JSON file."""
    db = SessionLocal()
    try:
        # Check if all 3 models from our seeding exist
        gemini25 = db.query(LLMModel).filter_by(model_name="gemini-2.5-flash").first()
        gemini20 = db.query(LLMModel).filter_by(model_name="google/gemini-2.0-flash-exp:free").first()
        gpt4o = db.query(LLMModel).filter_by(model_name="openai/gpt-4o-mini").first()

        if gemini25 and gemini20 and gpt4o:
            print("✓ All LLM models already seeded, skipping")
            return True

        print("Seeding LLM models...")

        # Load data from JSON
        data_file = Path(__file__).parent / "data" / "llm_models.json"
        with open(data_file, 'r') as f:
            llm_models_data = json.load(f)

        models_count = 0
        for model_data in llm_models_data:
            # Check if model already exists
            existing_model = db.query(LLMModel).filter_by(
                provider=model_data["provider"],
                model_name=model_data["model_name"]
            ).first()

            if not existing_model:
                # Map input_cost/output_cost per 1M to per 1K tokens
                input_cost_per_1k = (model_data.get("input_cost_per_1m", 0) / 1000) if model_data.get("input_cost_per_1m") else 0
                output_cost_per_1k = (model_data.get("output_cost_per_1m", 0) / 1000) if model_data.get("output_cost_per_1m") else 0

                model = LLMModel(
                    llm_model_id=uuid.uuid4(),
                    provider=model_data["provider"],
                    model_name=model_data["model_name"],
                    context_window=model_data.get("context_window", 4096),
                    cost_per_1k_input_tokens=input_cost_per_1k,
                    cost_per_1k_output_tokens=output_cost_per_1k,
                    is_active=model_data.get("is_active", True)
                )
                db.add(model)
                models_count += 1

        db.commit()
        print(f"✅ {models_count} LLM models seeded")
        return True

    except Exception as e:
        print(f"❌ Error seeding LLM models: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Step 2: Seed LLM Models")
    print("="*60)

    success = seed_llm_models()

    if success:
        print("✅ Step 2: LLM models seeded successfully")
    else:
        print("❌ Step 2: Failed to seed LLM models")

    sys.exit(0 if success else 1)
