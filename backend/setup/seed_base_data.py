#!/usr/bin/env python
"""
Seed Base Data Script

Creates core data that is shared across all tenants:
- LLM Models (GPT-4o, Claude, Gemini, etc.)
- Base Tools (HTTP_GET, HTTP_POST, RAG, DB_QUERY, OCR)
- Output Formats (JSON, Markdown, Chart, Summary)
- Agent Configurations (Guidance, Analysis, Supervisor)

Idempotent: Safe to run multiple times - checks if data exists before inserting.

Usage:
    python setup/seed_base_data.py
    python setup/seed_base_data.py --config setup/config.yaml
"""

import sys
import argparse
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import uuid

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.logging import get_logger
from src.config import SessionLocal
from src.models.llm_model import LLMModel
from src.models.base_tool import BaseTool
from src.models.tool import ToolConfig
from src.models.agent import AgentConfig
from src.models.output_format import OutputFormat
from sqlalchemy import text

logger = get_logger(__name__)


class BaseDataSeeder:
    """Seeds base data (LLM models, tools, agents, formats)."""

    def __init__(self, config_path: str = "setup/config.yaml"):
        """Initialize seeder with configuration."""
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.db = SessionLocal()
        self.stats = {"created": 0, "skipped": 0, "errors": 0}

    def _load_config(self) -> dict:
        """Load configuration from YAML."""
        try:
            with open(self.config_path, "r") as f:
                config = yaml.safe_load(f)
            logger.info("config_loaded", config_file=str(self.config_path))
            return config
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise

    def seed_llm_models(self) -> bool:
        """Seed LLM models from config."""
        print("\n→ Seeding LLM Models...")

        try:
            for model_data in self.config.get("base_data", {}).get("llm_models", []):
                model_id = model_data.get("id")

                # Check if already exists
                existing = self.db.query(LLMModel).filter(
                    LLMModel.llm_model_id == model_id
                ).first()

                if existing:
                    logger.debug(f"llm_model_exists", model_id=model_id)
                    print(f"  ⊘ LLM Model '{model_data.get('name')}' already exists")
                    self.stats["skipped"] += 1
                    continue

                # Create new LLM model
                llm_model = LLMModel(
                    llm_model_id=model_id,
                    name=model_data.get("name"),
                    provider=model_data.get("provider"),
                    base_url=model_data.get("base_url"),
                    model_name=model_data.get("model_name"),
                    context_window=model_data.get("context_window", 4096),
                    is_active=model_data.get("is_active", True),
                )
                self.db.add(llm_model)
                logger.info("llm_model_created", model_id=model_id)
                print(f"  ✅ Created LLM Model: {model_data.get('name')}")
                self.stats["created"] += 1

            self.db.commit()
            return True

        except Exception as e:
            logger.error("seed_llm_models_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error seeding LLM models: {str(e)}")
            self.stats["errors"] += 1
            return False

    def seed_output_formats(self) -> bool:
        """Seed output formats from config."""
        print("\n→ Seeding Output Formats...")

        try:
            for format_data in self.config.get("base_data", {}).get("output_formats", []):
                format_id = format_data.get("id")

                # Check if already exists
                existing = self.db.query(OutputFormat).filter(
                    OutputFormat.output_format_id == format_id
                ).first()

                if existing:
                    logger.debug(f"output_format_exists", format_id=format_id)
                    print(f"  ⊘ Output Format '{format_data.get('name')}' already exists")
                    self.stats["skipped"] += 1
                    continue

                # Create new output format
                output_format = OutputFormat(
                    output_format_id=format_id,
                    name=format_data.get("name"),
                    description=format_data.get("description"),
                    content_type=format_data.get("content_type", "text/plain"),
                )
                self.db.add(output_format)
                logger.info("output_format_created", format_id=format_id)
                print(f"  ✅ Created Output Format: {format_data.get('name')}")
                self.stats["created"] += 1

            self.db.commit()
            return True

        except Exception as e:
            logger.error("seed_output_formats_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error seeding output formats: {str(e)}")
            self.stats["errors"] += 1
            return False

    def seed_base_tools(self) -> bool:
        """Seed base tools (tool types) from config."""
        print("\n→ Seeding Base Tools...")

        try:
            for tool_data in self.config.get("base_data", {}).get("base_tools", []):
                tool_id = tool_data.get("id")

                # Check if already exists
                existing = self.db.query(BaseTool).filter(
                    BaseTool.base_tool_id == tool_id
                ).first()

                if existing:
                    logger.debug(f"base_tool_exists", tool_id=tool_id)
                    print(f"  ⊘ Base Tool '{tool_data.get('name')}' already exists")
                    self.stats["skipped"] += 1
                    continue

                # Create new base tool
                base_tool = BaseTool(
                    base_tool_id=tool_id,
                    name=tool_data.get("name"),
                    description=tool_data.get("description"),
                    handler_class=tool_data.get("handler_class"),
                    input_schema=tool_data.get("input_schema", {}),
                    is_active=tool_data.get("is_active", True),
                )
                self.db.add(base_tool)
                logger.info("base_tool_created", tool_id=tool_id)
                print(f"  ✅ Created Base Tool: {tool_data.get('name')}")
                self.stats["created"] += 1

            self.db.commit()
            return True

        except Exception as e:
            logger.error("seed_base_tools_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error seeding base tools: {str(e)}")
            self.stats["errors"] += 1
            return False

    def seed_agents(self) -> bool:
        """Seed agent configurations from config."""
        print("\n→ Seeding Agent Configurations...")

        try:
            for agent_data in self.config.get("base_data", {}).get("agents", []):
                agent_id = agent_data.get("id")

                # Check if already exists
                existing = self.db.query(AgentConfig).filter(
                    AgentConfig.agent_config_id == agent_id
                ).first()

                if existing:
                    logger.debug(f"agent_exists", agent_id=agent_id)
                    print(f"  ⊘ Agent '{agent_data.get('name')}' already exists")
                    self.stats["skipped"] += 1
                    continue

                # Get LLM model reference
                llm_model_id = agent_data.get("llm_model_id")
                llm_model = self.db.query(LLMModel).filter(
                    LLMModel.llm_model_id == llm_model_id
                ).first()

                if not llm_model:
                    logger.error(
                        "agent_llm_model_not_found",
                        agent_id=agent_id,
                        llm_model_id=llm_model_id,
                    )
                    print(f"  ❌ Agent '{agent_data.get('name')}': LLM model not found")
                    self.stats["errors"] += 1
                    continue

                # Create new agent
                agent = AgentConfig(
                    agent_config_id=agent_id,
                    name=agent_data.get("name"),
                    description=agent_data.get("description"),
                    llm_model_id=llm_model.llm_model_id,
                    handler_class=agent_data.get("handler_class"),
                    prompt_template=agent_data.get("prompt_template"),
                    is_active=agent_data.get("is_active", True),
                )
                self.db.add(agent)
                logger.info("agent_created", agent_id=agent_id)
                print(f"  ✅ Created Agent: {agent_data.get('name')}")
                self.stats["created"] += 1

            self.db.commit()
            return True

        except Exception as e:
            logger.error("seed_agents_failed", error=str(e))
            self.db.rollback()
            print(f"  ❌ Error seeding agents: {str(e)}")
            self.stats["errors"] += 1
            return False

    def run(self) -> bool:
        """Run all seeding operations."""
        print("\n" + "=" * 60)
        print("Seeding Base Data")
        print("=" * 60)

        try:
            success = True
            success &= self.seed_llm_models()
            success &= self.seed_output_formats()
            success &= self.seed_base_tools()
            success &= self.seed_agents()

            print("\n" + "=" * 60)
            print("Seeding Summary")
            print("=" * 60)
            print(f"✅ Created: {self.stats['created']}")
            print(f"⊘ Skipped: {self.stats['skipped']}")
            print(f"❌ Errors: {self.stats['errors']}")

            if self.stats["errors"] == 0:
                print("\n✅ Base data seeding completed successfully!")
                return True
            else:
                print(f"\n⚠️  {self.stats['errors']} error(s) occurred during seeding")
                return False

        finally:
            self.db.close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Seed base data for ITL_PGVector"
    )

    parser.add_argument(
        "--config",
        type=str,
        default="setup/config.yaml",
        help="Path to configuration file (default: setup/config.yaml)",
    )

    args = parser.parse_args()

    try:
        seeder = BaseDataSeeder(config_path=args.config)
        success = seeder.run()
        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error("seeding_failed", error=str(e))
        print(f"\n❌ Seeding failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
