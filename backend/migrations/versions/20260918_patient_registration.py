"""Patient identity fields and server-assigned patient code reservations."""
from alembic import op
import sqlalchemy as sa

revision = '20260918_patient'
down_revision = '20260918_billing'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cases', sa.Column('full_name', sa.String(200), nullable=False, server_default=''))
    op.add_column('cases', sa.Column('patient_phone', sa.String(50), nullable=False, server_default=''))
    op.create_table('patient_code_allocations', sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True), sqlite_autoincrement=True)


def downgrade():
    op.drop_table('patient_code_allocations')
    op.drop_column('cases', 'patient_phone')
    op.drop_column('cases', 'full_name')
