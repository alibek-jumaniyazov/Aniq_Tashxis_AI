r"""Build and verify a new synthetic workspace, then back up and replace the demo DB.

Run with the API stopped: .venv\Scripts\python.exe scripts/reset_demo.py --reset-demo
Model weights, settings and unrelated directories are never touched.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def bounded(path, root):
    path, root = path.resolve(), root.resolve()
    if path == root or not path.is_relative_to(root):
        raise RuntimeError(f'Path is outside the intended workspace: {path}')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reset-demo', action='store_true', help='Replace only the default local demonstration database and files after backup.')
    args = parser.parse_args()
    if not args.reset_demo:
        parser.error('Explicit --reset-demo is required; stop the API first.')
    from app.config import settings
    runtime = bounded(ROOT / 'runtime', ROOT)
    database = bounded(runtime / 'aniq.db', runtime)
    storage = bounded(runtime / 'files', runtime)
    if not settings.demo_mode or settings.database_url != f'sqlite:///{database.as_posix()}' or settings.storage_root.resolve() != storage:
        raise RuntimeError('Reset is restricted to the default local SQLite demo profile.')
    for port in (8000, 5173):
        with socket.socket() as probe:
            probe.settimeout(.3)
            if probe.connect_ex(('127.0.0.1', port)) == 0:
                raise RuntimeError(f'Stop the application on port {port} before resetting.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    staging = bounded(runtime / ('seed-build-' + stamp), runtime)
    backup = bounded(runtime / 'backups' / stamp, runtime)
    staging.mkdir(parents=True)
    environment = {**os.environ, 'PYTHONUTF8': '1', 'PYTHONPATH': str(ROOT / 'backend'), 'DEMO_MODE': 'true', 'SEED_PROFILE': 'realistic', 'DATABASE_URL': f'sqlite:///{(staging / "aniq.db").as_posix()}', 'STORAGE_ROOT': str(staging / 'files')}
    code = 'from app.db import Base,engine; from app.demo_seed import seed_realistic,verify_seed; import json; Base.metadata.create_all(engine); seed_realistic(); print(json.dumps(verify_seed())); engine.dispose()'
    build = subprocess.run([sys.executable, '-c', code], cwd=ROOT, env=environment, capture_output=True, text=True, encoding='utf-8', timeout=120)
    if build.returncode:
        raise RuntimeError('Staged seed failed; current data was not changed.\n' + build.stderr)
    counts = json.loads(build.stdout.strip())
    backup.mkdir(parents=True)
    # Checkpoint and close SQLite before moving its single complete database file.
    for path in (database, staging / 'aniq.db'):
        if path.exists():
            with sqlite3.connect(path) as connection:
                if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Database integrity check failed: ' + str(path))
                if connection.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()[0] != 0:
                    raise RuntimeError('Database is in use. Stop every API/worker process.')
            connection.close()
    moved = []
    activated = []
    try:
        for source in (database, Path(str(database) + '-wal'), Path(str(database) + '-shm'), storage):
            source = bounded(source, runtime)
            if source.exists():
                target = bounded(backup / source.name, backup)
                source.rename(target)
                moved.append((source, target))
        for source, target in ((staging / 'aniq.db', database), (staging / 'files', storage)):
            source, target = bounded(source, staging), bounded(target, runtime)
            source.rename(target)
            activated.append((source, target))
    except Exception:
        for original, target in reversed(activated):
            target.rename(original)
        for original, target in reversed(moved):
            target.rename(original)
        raise
    manifest = {'backup': str(backup), 'activated_at': stamp, 'counts': counts, 'restoration': 'Stop API and workers; move current aniq.db and files aside, then restore both aniq.db and files from this backup together.'}
    (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (runtime / 'seed-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
