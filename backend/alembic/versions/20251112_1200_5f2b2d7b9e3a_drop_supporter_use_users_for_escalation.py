"""drop supporter; use users for escalation assignment

Revision ID: 5f2b2d7b9e3a
Revises: 22922597bb3e
Create Date: 2025-11-12 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "5f2b2d7b9e3a"
down_revision = "22922597bb3e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add support profile fields on users
    op.add_column(
        "users",
        sa.Column("supporter_status", sa.String(length=50), nullable=True, server_default="offline"),
    )
    op.add_column(
        "users",
        sa.Column("max_concurrent_sessions", sa.Integer(), nullable=True, server_default="5"),
    )
    op.add_column(
        "users",
        sa.Column("current_sessions_count", sa.Integer(), nullable=True, server_default="0"),
    )

    # 2) Add assigned_user_id to sessions and FK to users
    op.add_column("sessions", sa.Column("assigned_user_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_sessions_assigned_user_users",
        "sessions",
        "users",
        ["assigned_user_id"],
        ["user_id"],
    )

    # Optional: index to help querying queue/assignment
    op.create_index(
        "ix_sessions_assigned_user",
        "sessions",
        ["tenant_id", "assigned_user_id"],
        unique=False,
    )

    # 3) Backfill sessions.assigned_user_id from supporters
    op.execute(
        """
        UPDATE sessions s
        SET assigned_user_id = sup.user_id
        FROM supporters sup
        WHERE s.assigned_supporter_id = sup.supporter_id
        """
    )

    # 4) Backfill messages.sender_user_id from supporters (only when NULL)
    op.execute(
        """
        UPDATE messages m
        SET sender_user_id = sup.user_id
        FROM supporters sup
        WHERE m.sender_supporter_id = sup.supporter_id
          AND m.sender_user_id IS NULL
        """
    )

    # 5) Drop supporters table (and dependent FKs) then drop referencing columns
    op.execute("DROP TABLE IF EXISTS supporters CASCADE")

    with op.batch_alter_table("messages") as batch:
        batch.drop_column("sender_supporter_id")

    with op.batch_alter_table("sessions") as batch:
        batch.drop_column("assigned_supporter_id")


def downgrade() -> None:
    # This migration is intentionally upgrade-only.
    raise NotImplementedError("Downgrade not supported for this migration.")

