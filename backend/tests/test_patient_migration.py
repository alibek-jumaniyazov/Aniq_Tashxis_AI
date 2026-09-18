"""The additive migration also supports existing unversioned local databases."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_patient_migration_preserves_legacy_rows_and_does_not_stamp_history():
    path = Path(__file__).parents[1] / 'migrations' / 'versions' / '20260918_patient_registration.py'
    spec = importlib.util.spec_from_file_location('patient_registration_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE cases (id TEXT PRIMARY KEY, alias TEXT NOT NULL, age INTEGER, summary TEXT NOT NULL, diagnosis TEXT NOT NULL)'))
        connection.execute(text("INSERT INTO cases VALUES ('legacy-id', 'CUSTOM-LEGACY', NULL, 'Existing comment', 'Existing conclusion')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        patient = dict(connection.execute(text('SELECT * FROM cases')).mappings().one())
        assert patient == {'id': 'legacy-id', 'alias': 'CUSTOM-LEGACY', 'age': None, 'summary': 'Existing comment', 'diagnosis': 'Existing conclusion', 'full_name': '', 'patient_phone': ''}
        assert 'alembic_version' not in inspect(connection).get_table_names()
        connection.execute(text('INSERT INTO patient_code_allocations DEFAULT VALUES'))
        connection.execute(text('INSERT INTO patient_code_allocations DEFAULT VALUES'))
        assert list(connection.execute(text('SELECT id FROM patient_code_allocations')).scalars()) == [1, 2]
    engine.dispose()
