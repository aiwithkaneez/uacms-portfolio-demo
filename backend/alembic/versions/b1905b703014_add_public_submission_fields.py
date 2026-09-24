"""add public submission fields to complaints"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b1905b703014'
down_revision: Union[str, Sequence[str], None] = '4168d60998fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('complaints', sa.Column('submission_source', sa.String(length=20), server_default='employee_portal', nullable=False))
    op.add_column('complaints', sa.Column('contact_phone', sa.String(length=255), nullable=True))
    op.add_column('complaints', sa.Column('contact_email', sa.String(length=255), nullable=True))
    op.add_column('complaints', sa.Column('submitter_employee_id', sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column('complaints', 'submitter_employee_id')
    op.drop_column('complaints', 'contact_email')
    op.drop_column('complaints', 'contact_phone')
    op.drop_column('complaints', 'submission_source')
