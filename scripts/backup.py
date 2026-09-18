"""Consistent SQLite backup. Copy protected file storage too when backing up documents."""
import argparse
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('database', type=Path)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
if args.database.resolve() == args.destination.resolve():
    parser.error('Backup destination must differ from the live database.')
args.destination.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(args.database) as source, sqlite3.connect(args.destination) as target:
    source.backup(target)
    assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
print('Backup verified:', args.destination)
