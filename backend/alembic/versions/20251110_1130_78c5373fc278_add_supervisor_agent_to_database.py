"""add_supervisor_agent_to_database

Revision ID: 78c5373fc278
Revises: 9a1ba78ab4db
Create Date: 2025-11-10 11:30:56.397689

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '78c5373fc278'
down_revision = '9a1ba78ab4db'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add SupervisorAgent to database for database-driven configuration."""

    # Insert supervisor agent into agent_configs
    op.execute("""
        INSERT INTO agent_configs (
            agent_id,
            name,
            prompt_template,
            llm_model_id,
            default_output_format_id,
            description,
            handler_class,
            is_active,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            'SupervisorAgent',
            'You are a Supervisor Agent that routes user queries to specialized domain agents.

Available agents:
{agents_list}

Your task:
1. Analyze the user''s message carefully
2. Detect if the message contains ONE or MULTIPLE distinct questions/intents
3. Respond with ONLY the agent name or status code

Detection Rules:
- SINGLE INTENT: User asks ONE clear question matching ONE agent → respond with agent name
- MULTIPLE INTENTS: User asks 2+ DIFFERENT questions → respond with "MULTI_INTENT"
- UNCLEAR: Ambiguous or not related to any agent → respond with "UNCLEAR"

Response Format:
Respond with ONLY ONE of these: {agent_names}"MULTI_INTENT", or "UNCLEAR"
NO explanations, NO additional text.',
            llm_models.llm_model_id,
            NULL,
            'Routes user queries to specialized agents based on intent detection',
            'services.supervisor_agent.SupervisorAgent',
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM llm_models
        WHERE model_name = 'gpt-4o-mini'
        LIMIT 1
        ON CONFLICT DO NOTHING;
    """)

    # Grant supervisor permission to all existing tenants
    op.execute("""
        INSERT INTO tenant_agent_permissions (tenant_id, agent_id, enabled, created_at, updated_at)
        SELECT
            t.tenant_id,
            ac.agent_id,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM tenants t
        CROSS JOIN agent_configs ac
        WHERE ac.name = 'SupervisorAgent'
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    """Remove SupervisorAgent from database."""

    # Delete tenant permissions first (foreign key constraint)
    op.execute("""
        DELETE FROM tenant_agent_permissions
        WHERE agent_id IN (
            SELECT agent_id FROM agent_configs WHERE name = 'SupervisorAgent'
        );
    """)

    # Delete supervisor agent
    op.execute("""
        DELETE FROM agent_configs WHERE name = 'SupervisorAgent';
    """)
