r"""Build and verify a new synthetic workspace, then back up and replace the demo DB.

Run with the API stopped: .venv\Scripts\python.exe scripts/reset_demo.py --reset-demo
Model weights, settings and unrelated directories are never touched.
"""

import argparse
import json
import os
import socket
import sqlite3
import subprocess
import sys
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

# Import every ORM table module before create_all. A fresh subprocess does not
# import app.main, unlike TestClient, and would otherwise omit commerce tables.
BUILD_CODE = (
    "from app.db import Base,engine; import app.billing_models; "
    "from app.demo_seed import seed_realistic,verify_seed; import json; "
    "Base.metadata.create_all(engine); seed_realistic(); "
    "print(json.dumps(verify_seed())); engine.dispose()"
)


def bounded(path, root):
    path, root = path.resolve(), root.resolve()
    if path == root or not path.is_relative_to(root):
        raise RuntimeError(f"Path is outside the intended workspace: {path}")
    return path


def preserve_access_and_configuration(previous, staged):
    """Copy account access/configuration only; never copy patient data or sessions.

    Everything is applied to the disposable staging DB before the live backup.
    Existing demo emails keep the refreshed role/tenant graph but retain their
    password hash and disabled state. Additional developer accounts retain their
    identity and access. Other old customer/clinic accounts are retained only in
    the backup, as this operation replaces the application dataset. No credentials
    are logged.
    """
    if not previous.exists():
        return {
            "matched_accounts": 0,
            "retained_accounts": 0,
            "retained_clinics": 0,
            "payment_methods": 0,
        }
    # sqlite3's own context manager commits but does NOT close file handles.
    # Explicit closing is required before Windows can rename either database.
    with (
        closing(sqlite3.connect(f"{previous.as_uri()}?mode=ro", uri=True)) as source,
        closing(sqlite3.connect(staged)) as target,
        target,
    ):
        source.row_factory = target.row_factory = sqlite3.Row
        target.execute("PRAGMA foreign_keys=ON")
        tables = {
            row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }

        def rows(table):
            return (
                [dict(row) for row in source.execute("SELECT * FROM " + table)]
                if table in tables
                else []
            )

        def upsert(table, values, key="id"):
            # Table/column identifiers come exclusively from known schema files.
            columns = {row[1] for row in target.execute("PRAGMA table_info(" + table + ")")}
            values = {key: value for key, value in values.items() if key in columns}
            names = list(values)
            target.execute(
                "INSERT INTO "
                + table
                + " ("
                + ",".join(names)
                + ") VALUES ("
                + ",".join("?" for _ in names)
                + ") ON CONFLICT("
                + key
                + ") DO UPDATE SET "
                + ",".join(name + "=excluded." + name for name in names if name != key),
                list(values.values()),
            )

        for plan in rows("billing_plans"):
            upsert("billing_plans", plan)
        methods = rows("billing_payment_methods")
        if methods:
            target.execute("UPDATE billing_payment_methods SET active=0")
        for method in methods:
            # Keep the new receipt's immutable snapshot; map matching method IDs
            # so refreshed demo requests still refer to the real configuration.
            match = target.execute(
                "SELECT id FROM billing_payment_methods WHERE name=? AND card_number=? AND recipient=?",
                (method["name"], method["card_number"], method["recipient"]),
            ).fetchone()
            if match:
                method["id"] = match["id"]
            upsert("billing_payment_methods", method)
        user_map, matched, retained = {}, 0, 0
        for user in rows("users"):
            match = target.execute(
                "SELECT id FROM users WHERE lower(email)=lower(?)", (user["email"],)
            ).fetchone()
            if match:
                target.execute(
                    "UPDATE users SET password_hash=?, active=? WHERE id=?",
                    (user["password_hash"], user["active"], match["id"]),
                )
                user_map[user["id"]] = match["id"]
                matched += 1
            elif user["role"] == "developer":
                upsert("users", user)
                user_map[user["id"]] = user["id"]
                retained += 1
        for profile in rows("billing_user_profiles"):
            if profile["user_id"] not in user_map:
                continue
            profile["user_id"] = user_map[profile["user_id"]]
            upsert("billing_user_profiles", profile, "user_id")
        retained_clinics = 0
        for clinic in rows("billing_clinics"):
            if target.execute(
                "SELECT 1 FROM billing_clinics WHERE id=?", (clinic["id"],)
            ).fetchone():
                continue
            developer_owner = target.execute(
                "SELECT id FROM users WHERE id=? AND role='developer'",
                (user_map.get(clinic["owner_id"]),),
            ).fetchone()
            if not developer_owner:
                continue
            clinic["owner_id"] = user_map[clinic["owner_id"]]
            upsert("billing_clinics", clinic)
            retained_clinics += 1
        if target.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError(
                "Preserved account/configuration references failed validation; current data was not changed."
            )
        return {
            "matched_accounts": matched,
            "retained_accounts": retained,
            "retained_clinics": retained_clinics,
            "payment_methods": len(methods),
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset-demo",
        action="store_true",
        help="Replace only the default local demonstration database and files after backup.",
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="Build and validate staged seed without replacing current data. Does not require stopping the app.",
    )
    args = parser.parse_args()
    if not args.reset_demo and not args.build_only:
        parser.error("Explicit --reset-demo or --build-only is required.")
    from app.config import settings

    runtime = bounded(ROOT / "runtime", ROOT)
    database = bounded(runtime / "aniq.db", runtime)
    storage = bounded(runtime / "files", runtime)
    if (
        not settings.demo_mode
        or settings.database_url != f"sqlite:///{database.as_posix()}"
        or settings.storage_root.resolve() != storage
    ):
        raise RuntimeError("Reset is restricted to the default local SQLite demo profile.")
    for port in () if args.build_only else (8000, 5173):
        with socket.socket() as probe:
            probe.settimeout(0.3)
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(f"Stop the application on port {port} before resetting.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    staging = bounded(runtime / ("seed-build-" + stamp), runtime)
    backup = bounded(runtime / "backups" / stamp, runtime)
    staging.mkdir(parents=True)
    environment = {
        **os.environ,
        "PYTHONUTF8": "1",
        "PYTHONPATH": str(ROOT / "backend"),
        "DEMO_MODE": "true",
        "SEED_PROFILE": "realistic",
        "DATABASE_URL": f"sqlite:///{(staging / 'aniq.db').as_posix()}",
        "STORAGE_ROOT": str(staging / "files"),
    }
    build = subprocess.run(
        [sys.executable, "-c", BUILD_CODE],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
        check=False,
    )
    if build.returncode:
        raise RuntimeError("Staged seed failed; current data was not changed.\n" + build.stderr)
    counts = json.loads(build.stdout.strip())
    preservation = preserve_access_and_configuration(database, staging / "aniq.db")
    check = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.demo_seed import verify_seed; import json; print(json.dumps(verify_seed()))",
        ],
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
        check=False,
    )
    if check.returncode:
        raise RuntimeError(
            "Preserved staged seed failed; current data was not changed.\n" + check.stderr
        )
    counts = json.loads(check.stdout.strip())
    if args.build_only:
        print(
            json.dumps(
                {
                    "staging": str(staging),
                    "activated": False,
                    "counts": counts,
                    "preserved": preservation,
                },
                indent=2,
            )
        )
        return
    backup.mkdir(parents=True)
    # Checkpoint and close SQLite before moving its single complete database file.
    for path in (database, staging / "aniq.db"):
        if path.exists():
            with sqlite3.connect(path) as connection:
                if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise RuntimeError("Database integrity check failed: " + str(path))
                if connection.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()[0] != 0:
                    raise RuntimeError("Database is in use. Stop every API/worker process.")
            connection.close()
    moved = []
    activated = []
    try:
        for source in (
            database,
            Path(str(database) + "-wal"),
            Path(str(database) + "-shm"),
            storage,
        ):
            source = bounded(source, runtime)
            if source.exists():
                target = bounded(backup / source.name, backup)
                source.rename(target)
                moved.append((source, target))
        for source, target in ((staging / "aniq.db", database), (staging / "files", storage)):
            source, target = bounded(source, staging), bounded(target, runtime)
            source.rename(target)
            activated.append((source, target))
    except Exception:
        for original, target in reversed(activated):
            target.rename(original)
        for original, target in reversed(moved):
            target.rename(original)
        raise
    manifest = {
        "backup": str(backup),
        "activated_at": stamp,
        "counts": counts,
        "preserved": preservation,
        "restoration": "Stop API and workers; move current aniq.db and files aside, then restore both aniq.db and files from this backup together.",
    }
    (backup / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (runtime / "seed-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
