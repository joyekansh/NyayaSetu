"""Add intake_answers to cases

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-19 00:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cases', sa.Column('intake_answers', sa.JSON(), nullable=False, server_default='{}'))


def downgrade() -> None:
    op.drop_column('cases', 'intake_answers')
