"""add_interview_questions_to_jobs

Revision ID: b3a1c9f7d204
Revises: a57565ad8876
Create Date: 2026-02-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3a1c9f7d204'
down_revision: Union[str, None] = 'a57565ad8876'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('interview_questions', sa.JSON(), nullable=True))
    op.add_column('jobs', sa.Column('interview_questions_generated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'interview_questions_generated_at')
    op.drop_column('jobs', 'interview_questions')
