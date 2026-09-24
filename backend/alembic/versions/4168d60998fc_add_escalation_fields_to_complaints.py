"""add escalation fields to complaints"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '4168d60998fc'
down_revision: Union[str, Sequence[str], None] = '714edda34240'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('complaints', sa.Column('is_escalated', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('complaints', sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('complaints', 'escalated_at')
    op.drop_column('complaints', 'is_escalated')
