"""Add gate release to cases

Revision ID: 0003
Revises: e26c912cd2ab
Create Date: 2026-09-19 02:16:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = 'e26c912cd2ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cases', sa.Column('gate_release_operator', sa.String(length=255), nullable=True))
    op.add_column('cases', sa.Column('gate_release_reason', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('cases', 'gate_release_reason')
    op.drop_column('cases', 'gate_release_operator')
