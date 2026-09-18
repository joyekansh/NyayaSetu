"""Create the initial NyayaSetu case and audit-event schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "RECEIVED",
                "EXTRACTED",
                "TRIAGED",
                "MATCHED",
                "IN_REVIEW",
                "REFERRED",
                "CLOSED",
                name="case_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "urgency_tier",
            sa.Enum(
                "STANDARD",
                "HIGH",
                "CRITICAL",
                name="urgency_tier",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column("urgency_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("language", sa.String(length=5), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint(
            "urgency_score IS NULL OR (urgency_score >= 0 AND urgency_score <= 100)",
            name="ck_cases_urgency_score_range",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("event_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "sequence", name="uq_audit_events_case_sequence"),
    )
    op.create_index("ix_audit_events_case_sequence", "audit_events", ["case_id", "sequence"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_events_case_sequence", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_table("cases")
