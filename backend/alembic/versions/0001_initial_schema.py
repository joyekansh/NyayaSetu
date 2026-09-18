"""Create the initial NyayaSetu core schema.

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
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "CITIZEN",
                "CASEWORKER",
                "ADVOCATE",
                "ADMIN",
                name="user_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "document_type",
            sa.Enum(
                "IDENTITY_DOCUMENT",
                "AADHAAR",
                "INCOME_CERTIFICATE",
                "EVICTION_NOTICE",
                "OTHER",
                name="document_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "ocr_status",
            sa.Enum(
                "PENDING",
                "PROCESSING",
                "COMPLETED",
                "FAILED",
                name="ocr_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("length(storage_key) > 0", name="ck_documents_storage_key_not_blank"),
        sa.CheckConstraint("length(checksum) = 64", name="ck_documents_checksum_sha256_length"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index("ix_documents_case_id", "documents", ["case_id"], unique=False)
    op.create_index("ix_documents_uploaded_by_user_id", "documents", ["uploaded_by_user_id"], unique=False)
    
    # Ensure audit_events is append-only
    bind = op.get_bind()
    if bind.engine.name == 'postgresql':
        op.execute(
            """
            CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION 'Audit events cannot be modified or deleted.';
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER trg_audit_append_only
            BEFORE UPDATE OR DELETE ON audit_events
            FOR EACH ROW
            EXECUTE FUNCTION prevent_audit_update_delete();
            """
        )
    op.create_table(
        "extracted_fields",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("field_name", sa.String(length=128), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=4, scale=3), nullable=False),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_extracted_fields_confidence_range"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extracted_fields_document_field", "extracted_fields", ["document_id", "field_name"], unique=False)
    op.create_index("ix_extracted_fields_document_id", "extracted_fields", ["document_id"], unique=False)
    op.create_table(
        "scheme_clauses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scheme_id", sa.String(length=100), nullable=False),
        sa.Column("scheme_name", sa.String(length=255), nullable=False),
        sa.Column("clause_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("criteria", sa.JSON(), nullable=False),
        sa.Column("benefit_description", sa.Text(), nullable=False),
        sa.Column("authority", sa.String(length=255), nullable=False),
        sa.Column("act_reference", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scheme_id", "clause_id", "version", name="uq_scheme_clause_version"),
    )
    op.create_index("ix_scheme_clauses_scheme_id", "scheme_clauses", ["scheme_id"], unique=False)
    op.create_index("ix_scheme_clauses_clause_id", "scheme_clauses", ["clause_id"], unique=False)
    op.create_table(
        "referrals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("operator_id", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("referred_schemes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id"),
    )
    op.create_index("ix_referrals_case_id", "referrals", ["case_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_referrals_case_id", table_name="referrals")
    op.drop_table("referrals")
    op.drop_index("ix_scheme_clauses_clause_id", "scheme_clauses")
    op.drop_index("ix_scheme_clauses_scheme_id", "scheme_clauses")
    op.drop_table("scheme_clauses")
    op.drop_index("ix_extracted_fields_document_id", table_name="extracted_fields")
    op.drop_index("ix_extracted_fields_document_field", table_name="extracted_fields")
    op.drop_table("extracted_fields")
    op.drop_index("ix_documents_uploaded_by_user_id", table_name="documents")
    op.drop_index("ix_documents_case_id", table_name="documents")
    op.drop_table("documents")
    op.drop_table("users")
    op.drop_index("ix_audit_events_case_sequence", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_table("cases")

