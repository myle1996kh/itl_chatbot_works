"""Create chat_users table and fix sessions.user_id to UUID.

This comprehensive migration:
1. Fixes sessions.user_id type from String to UUID
2. Cleans up invalid data (default_user, emails, etc)
3. Creates new chat_users table for customer accounts
4. Migrates existing sessions to point to chat_users
5. Updates FK constraints

Revision ID: 20251114_0000_create_chat_users_table
Revises: 5f2b2d7b9e3a
Create Date: 2025-11-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '8a1c0e5f9d2b'
down_revision = '5f2b2d7b9e3a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade: Fix user_id type and create chat_users table."""

    # Step 1: Drop old FK constraint (if exists) using SQL
    op.execute("""
        DO $$ BEGIN
            BEGIN
                ALTER TABLE sessions DROP CONSTRAINT fk_sessions_user_id_users;
            EXCEPTION WHEN undefined_object THEN
                -- Constraint doesn't exist, ignore
            END;
        END $$;
    """)

    # Step 2: Create temporary column for new UUID values
    op.add_column('sessions', sa.Column('user_id_new', postgresql.UUID(as_uuid=True), nullable=True))

    # Step 3: Migrate existing data - convert valid UUIDs, generate for invalid
    op.execute("""
        UPDATE sessions
        SET user_id_new = CASE
            -- Try to convert if it looks like a UUID
            WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN user_id::uuid
            -- Otherwise generate a new UUID (for "default_user", emails, etc)
            ELSE gen_random_uuid()
        END
        WHERE user_id IS NOT NULL
    """)

    # Step 4: Drop the old String column
    op.drop_column('sessions', 'user_id')

    # Step 5: Rename new column to original name
    op.alter_column('sessions', 'user_id_new', new_column_name='user_id')

    # Step 6: Make user_id NOT NULL
    op.alter_column('sessions', 'user_id', nullable=False)

    # Step 7: Create chat_users table
    op.create_table(
        'chat_users',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('username', sa.String(255), nullable=False),
        sa.Column('department', sa.String(255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.Column('last_active', sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.tenant_id'], name='fk_chat_users_tenant_id'),
        sa.PrimaryKeyConstraint('user_id', name='pk_chat_users'),
        sa.UniqueConstraint('tenant_id', 'email', name='uq_chat_users_tenant_email'),
    )

    # Step 8: Create indexes on chat_users
    op.create_index('ix_chat_users_tenant_email', 'chat_users', ['tenant_id', 'email'])
    op.create_index('ix_chat_users_tenant_id', 'chat_users', ['tenant_id'])

    # Step 9: Migrate existing sessions to create corresponding chat_users
    op.execute("""
        INSERT INTO chat_users (user_id, tenant_id, email, username, created_at, last_active)
        SELECT DISTINCT s.user_id, s.tenant_id,
               'user_' || s.user_id::text || '@unknown.local' as email,
               'User ' || s.user_id::text as username,
               NOW(),
               NOW()
        FROM sessions s
        WHERE NOT EXISTS (
            SELECT 1 FROM chat_users cu
            WHERE cu.user_id = s.user_id
        )
    """)

    # Step 10: Create new FK constraint pointing to chat_users
    op.create_foreign_key(
        'fk_sessions_user_id_chat_users',
        'sessions', 'chat_users',
        ['user_id'], ['user_id']
    )

    # Step 11: Recreate the index for sessions
    op.execute("""
        DROP INDEX IF EXISTS ix_sessions_tenant_user;
    """)

    op.create_index(
        'ix_sessions_tenant_user',
        'sessions',
        ['tenant_id', 'user_id', 'created_at']
    )

    print("Successfully fixed user_id type and created chat_users table")


def downgrade() -> None:
    """Downgrade: Revert to previous state."""

    # Step 1: Drop the FK constraint from sessions pointing to chat_users
    op.execute("""
        DO $$ BEGIN
            BEGIN
                ALTER TABLE sessions DROP CONSTRAINT fk_sessions_user_id_chat_users;
            EXCEPTION WHEN undefined_object THEN
                NULL;
            END;
        END $$;
    """)

    # Step 2: Drop indexes using IF EXISTS
    op.execute("DROP INDEX IF EXISTS ix_chat_users_tenant_email;")
    op.execute("DROP INDEX IF EXISTS ix_chat_users_tenant_id;")
    op.execute("DROP INDEX IF EXISTS ix_sessions_tenant_user;")

    # Step 3: Drop chat_users table
    op.execute("DROP TABLE IF EXISTS chat_users;")

    # Step 4: Convert user_id back to String (lossy operation, will lose UUID data)
    op.add_column('sessions', sa.Column('user_id_old', sa.String(255), nullable=True))
    op.execute("UPDATE sessions SET user_id_old = user_id::text WHERE user_id IS NOT NULL")
    op.drop_column('sessions', 'user_id')
    op.alter_column('sessions', 'user_id_old', new_column_name='user_id')

    # Step 5: Recreate FK constraint to users table
    op.execute("""
        ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user_id_users
        FOREIGN KEY (user_id) REFERENCES users (user_id)
    """)

    # Step 6: Recreate index
    op.create_index(
        'ix_sessions_tenant_user',
        'sessions',
        ['tenant_id', 'user_id', 'created_at']
    )

    print("Successfully reverted migration")
