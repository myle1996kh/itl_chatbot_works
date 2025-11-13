"""Fix ChatSession.user_id: change from String to UUID FK.

This migration addresses Issue #1 in the escalation system where user_id
was incorrectly typed as String(255) instead of UUID with FK to users table.

Revision ID: 20251113_0000_fix_session_user_id_type
Revises: 20251112_1200_5f2b2d7b9e3a_drop_supporter_use_users_for_escalation
Create Date: 2025-11-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251113_0000_fix_session_user_id_type'
down_revision = '20251112_1200_5f2b2d7b9e3a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade: Convert sessions.user_id from String to UUID FK."""
    # Step 1: Create a temporary column for new UUID values
    op.add_column('sessions', sa.Column('user_id_new', postgresql.UUID(as_uuid=True), nullable=True))

    # Step 2: Migrate existing data - convert string UUIDs to UUID type
    op.execute("""
        UPDATE sessions
        SET user_id_new = user_id::uuid
        WHERE user_id IS NOT NULL
    """)

    # Step 3: Drop the old String column
    op.drop_column('sessions', 'user_id')

    # Step 4: Rename new column to original name
    op.alter_column('sessions', 'user_id_new', new_column_name='user_id')

    # Step 5: Make user_id NOT NULL and add FK constraint
    op.alter_column('sessions', 'user_id', nullable=False)
    op.create_foreign_key(
        'fk_sessions_user_id_users',
        'sessions', 'users',
        ['user_id'], ['user_id']
    )

    # Step 6: Drop old index and recreate with correct column type
    op.drop_index('ix_sessions_tenant_user', table_name='sessions')
    op.create_index(
        'ix_sessions_tenant_user',
        'sessions',
        ['tenant_id', 'user_id', 'created_at']
    )

    print("✓ Successfully migrated sessions.user_id from String to UUID FK")


def downgrade() -> None:
    """Downgrade: Revert ChatSession.user_id back to String type."""
    # Step 1: Drop FK constraint
    op.drop_constraint('fk_sessions_user_id_users', 'sessions', type_='foreignkey')

    # Step 2: Drop indexes that depend on the column
    op.drop_index('ix_sessions_tenant_user', table_name='sessions')

    # Step 3: Create temporary column for string values
    op.add_column('sessions', sa.Column('user_id_old', sa.String(255), nullable=True))

    # Step 4: Migrate UUID back to String
    op.execute("""
        UPDATE sessions
        SET user_id_old = user_id::text
        WHERE user_id IS NOT NULL
    """)

    # Step 5: Drop the UUID column
    op.drop_column('sessions', 'user_id')

    # Step 6: Rename back to original name
    op.alter_column('sessions', 'user_id_old', new_column_name='user_id')

    # Step 7: Restore index
    op.create_index(
        'ix_sessions_tenant_user',
        'sessions',
        ['tenant_id', 'user_id', 'created_at']
    )

    print("✓ Successfully reverted sessions.user_id to String type")
