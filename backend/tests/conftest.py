import os
import tempfile
from pathlib import Path
import pytest

_temp = tempfile.TemporaryDirectory(prefix='aniq-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(_temp.name) / 'test.db').as_posix()
os.environ['STORAGE_ROOT'] = str(Path(_temp.name) / 'files')
os.environ['QUEUE_MODE'] = 'inline'
os.environ['MODEL_PATH'] = ''
os.environ['AI_BACKEND'] = 'transformers'
os.environ['DEMO_MODE'] = 'true'
os.environ['SEED_PROFILE'] = 'minimal'

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app, login_attempts  # noqa: E402
from app.db import Base, engine  # noqa: E402


def sign_in(client, role='doctor'):
    result = client.post('/api/v1/auth/login', json={'email': f'{role}@demo.aniq', 'password': 'AniqDemo!2026'})
    assert result.status_code == 200, result.text
    client.headers['X-CSRF-Token'] = result.json()['csrf_token']
    return result.json()['user']


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_attempts.clear()
    with TestClient(app) as c:
        sign_in(c)
        yield c
    engine.dispose()


@pytest.fixture
def case(client):
    return client.get('/api/v1/cases').json()['items'][0]
