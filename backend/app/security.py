import hashlib
import json
import secrets
from datetime import timezone
from fastapi import Depends, Header, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession
from .db import Audit, Case, CaseAccess, Idempotency, Record, Session, User, get_db, now


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details=None):
        self.status, self.code, self.message, self.details = status, code, message, details or {}


def current_user(request: Request, db: DBSession = Depends(get_db)):
    token = request.cookies.get('aniq_session', '')
    session = db.get(Session, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if session is None or session.expires_at.replace(tzinfo=timezone.utc) < now():
        raise ApiError(401, 'SESSION_EXPIRED', 'Please sign in again.')
    user = db.get(User, session.user_id)
    if not user or not user.active:
        raise ApiError(401, 'SESSION_EXPIRED', 'Please sign in again.')
    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
        if not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), session.csrf):
            raise ApiError(403, 'CSRF_REJECTED', 'Invalid session request.')
    request.state.user = user
    request.state.session = session
    return user


def require_role(user, *roles):
    if user.role not in roles:
        raise ApiError(403, 'ROLE_REQUIRED', 'Your role cannot perform this action.')


def access_case(db, user, case_id):
    case = db.get(Case, case_id)
    if not case or case.tenant_id != user.tenant_id or user.role in {'admin', 'analyst'}:
        raise ApiError(404, 'CASE_NOT_FOUND', 'Case is not available.')
    if case.owner_id != user.id:
        grant = db.scalar(select(CaseAccess).where(CaseAccess.case_id == case.id, CaseAccess.user_id == user.id))
        if not grant:
            raise ApiError(404, 'CASE_NOT_FOUND', 'Case is not available.')
    return case


def access_record(db, user, record_id, kinds=None):
    record = db.get(Record, record_id)
    if not record or record.tenant_id != user.tenant_id or (kinds and record.kind not in kinds):
        raise ApiError(404, 'RECORD_NOT_FOUND', 'Record is not available.')
    if record.case_id:
        access_case(db, user, record.case_id)
    elif record.kind == 'connection' and record.actor_id != user.id:
        raise ApiError(404, 'RECORD_NOT_FOUND', 'Record is not available.')
    return record


def audit(db, user, action, resource_id):
    db.add(Audit(tenant_id=user.tenant_id, actor_id=user.id, action=action, resource_id=resource_id))


def bump_case(db, case, expected_version):
    result = db.execute(update(Case).where(Case.id == case.id, Case.version == expected_version).values(version=expected_version + 1, updated_at=now()))
    if result.rowcount != 1:
        db.rollback()
        fresh = db.get(Case, case.id)
        raise ApiError(409, 'CASE_VERSION_CONFLICT', 'Case changed. Reload the current version.', {'expected_version': expected_version, 'current_version': fresh.version})
    db.refresh(case)
    return case.version


def create_record(db, user, kind, data, case=None, version=None):
    record = Record(tenant_id=user.tenant_id, actor_id=user.id, kind=kind, data=data, case_id=case.id if case else None, case_version=version or (case.version if case else None))
    db.add(record)
    db.flush()
    return record


def serialize(record):
    return {'id': record.id, 'kind': record.kind, 'case_id': record.case_id, 'case_version': record.case_version, 'actor_id': record.actor_id, 'created_at': record.created_at.isoformat(), **record.data}


def idem_key(value: str = Header(alias='Idempotency-Key', min_length=8, max_length=100)):
    return value


def idempotent(db, user, operation, key, payload, execute):
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    query = select(Idempotency).where(Idempotency.actor_id == user.id, Idempotency.operation == operation, Idempotency.key == key)
    prior = db.scalar(query)
    if prior:
        if prior.digest != digest:
            raise ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This key has already been used for a different request.')
        return prior.response
    try:
        guard = Idempotency(actor_id=user.id, operation=operation, key=key, digest=digest, response={})
        db.add(guard)
        db.flush()  # uniqueness serializes duplicate operations before side effects
        response = execute()
        guard.response = response
        db.commit()
        return response
    except IntegrityError:
        db.rollback()
        prior = db.scalar(query)
        if prior and prior.digest == digest:
            return prior.response
        raise ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Concurrent request conflict.')


def cached_idempotent(db, user, operation, key, payload):
    prior = db.scalar(select(Idempotency).where(Idempotency.actor_id == user.id, Idempotency.operation == operation, Idempotency.key == key))
    if not prior:
        return None
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    if prior.digest != digest:
        raise ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This key has already been used for a different request.')
    return prior.response


def current_facts(db, case_id, version=None):
    q = select(Record).where(Record.case_id == case_id, Record.kind == 'fact').order_by(Record.created_at, Record.id)
    if version is not None:
        q = q.where(Record.case_version <= version)
    records = list(db.scalars(q))
    replaced = {r.data.get('supersedes') for r in records if r.data.get('supersedes')}
    return [serialize(r) for r in records if r.id not in replaced]
