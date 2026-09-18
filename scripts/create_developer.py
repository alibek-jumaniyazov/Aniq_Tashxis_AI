"""Create the first platform operator after migrations, without a default password."""
import argparse
import sys
from getpass import getpass
from pathlib import Path
from argon2 import PasswordHasher
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.db import Audit, SessionLocal, User  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email', required=True)
    parser.add_argument('--name', required=True)
    args = parser.parse_args()
    email = args.email.strip().lower()
    if '@' not in email or not args.name.strip():
        parser.error('A valid email and a name are required.')
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            parser.error('This email already exists. Existing users are never promoted or overwritten by this command.')
        password = getpass('Developer password (at least 14 characters): ')
        if len(password) < 14 or password != getpass('Repeat password: '):
            parser.error('Passwords must match and contain at least 14 characters.')
        user = User(tenant_id='avilab-platform', email=email, name=args.name.strip(), role='developer', password_hash=PasswordHasher().hash(password), active=True)
        db.add(user)
        db.flush()
        db.add(Audit(tenant_id=user.tenant_id, actor_id=user.id, action='developer.provisioned_locally', resource_id=user.id))
        db.commit()
    print('Developer account created. Password was not stored in configuration or logs.')


if __name__ == '__main__':
    main()
