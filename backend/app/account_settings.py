"""Self-service account settings, independent of clinical or billing permissions."""

import json
from datetime import datetime, timezone

from argon2.exceptions import VerificationError
from argon2.low_level import Type, hash_secret_raw
from fastapi import APIRouter, Depends, Request
from pydantic import Field, field_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session as DBSession

from .billing_models import UserProfile
from .db import Session, User, get_db, now
from .routes import password_hasher, user_json
from .schemas import AuthResponse, StrictModel
from .security import ApiError, audit, current_user, idem_key, idempotent

router = APIRouter(prefix='/api/v1/auth', tags=['Account settings'])


class ProfileUpdate(StrictModel):
    name: str = Field(min_length=2, max_length=180)

    @field_validator('name')
    @classmethod
    def single_line_name(cls, value):
        if any(ord(char) < 32 for char in value):
            raise ValueError('Enter a name on one line.')
        return value


class PasswordChange(StrictModel):
    current_password: str = Field(min_length=1, max_length=200, repr=False)
    new_password: str = Field(min_length=10, max_length=200, repr=False)


class SessionSummary(StrictModel):
    active_sessions: int
    other_sessions: int
    current_expires_at: datetime


class SecurityActionResult(StrictModel):
    ok: bool
    revoked_sessions: int


def bump_profile(db, user):
    """Invalidate versions held by clinic/developer team management."""
    profile = db.get(UserProfile, user.id)
    if profile:
        db.execute(update(UserProfile).where(UserProfile.user_id == user.id).values(version=UserProfile.version + 1))
    else:
        db.add(UserProfile(user_id=user.id, version=2))


def revoke_other_sessions(db, user, current_session):
    count = db.scalar(select(func.count()).select_from(Session).where(
        Session.user_id == user.id, Session.id != current_session.id, Session.expires_at > now(),
    )) or 0
    db.execute(delete(Session).where(Session.user_id == user.id, Session.id != current_session.id))
    return count


@router.patch('/profile', response_model=AuthResponse)
def update_profile(body: ProfileUpdate, request: Request, user: User = Depends(current_user),
                   db: DBSession = Depends(get_db), key: str = Depends(idem_key)):
    def execute():
        user.name = body.name
        bump_profile(db, user)
        audit(db, user, 'account.profile_updated', user.id)
        return {'user': user_json(user), 'csrf_token': request.state.session.csrf}

    return idempotent(db, user, 'account.profile', key, {**body.model_dump(), 'session_id': request.state.session.id}, execute)


@router.post('/password', response_model=SecurityActionResult)
def change_password(body: PasswordChange, request: Request, user: User = Depends(current_user),
                    db: DBSession = Depends(get_db), key: str = Depends(idem_key)):
    session = request.state.session
    # Durable retries must not persist either plaintext or a fast password digest.
    # Use a session-specific salt and the same memory-hard algorithm as login.
    fingerprint = hash_secret_raw(
        json.dumps(body.model_dump(), sort_keys=True).encode(), bytes.fromhex(session.id),
        time_cost=password_hasher.time_cost, memory_cost=password_hasher.memory_cost,
        parallelism=password_hasher.parallelism, hash_len=32, type=Type.ID,
    ).hex()

    def execute():
        previous_hash = user.password_hash
        try:
            password_hasher.verify(previous_hash, body.current_password)
        except VerificationError:
            raise ApiError(400, 'CURRENT_PASSWORD_INVALID', 'The current password is incorrect.')
        if body.current_password == body.new_password:
            raise ApiError(422, 'PASSWORD_UNCHANGED', 'Choose a different new password.')
        result = db.execute(update(User).where(User.id == user.id, User.password_hash == previous_hash).values(
            password_hash=password_hasher.hash(body.new_password),
        ))
        if result.rowcount != 1:
            raise ApiError(409, 'VERSION_CONFLICT', 'The account changed. Refresh and try again.')
        revoked = revoke_other_sessions(db, user, session)
        bump_profile(db, user)
        audit(db, user, 'account.password_changed', user.id)
        return {'ok': True, 'revoked_sessions': revoked}

    return idempotent(db, user, 'account.password', key, {'session_id': session.id, 'fingerprint': fingerprint}, execute)


@router.get('/sessions', response_model=SessionSummary)
def session_summary(request: Request, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    active = db.scalar(select(func.count()).select_from(Session).where(Session.user_id == user.id, Session.expires_at > now())) or 0
    return {'active_sessions': active, 'other_sessions': max(0, active - 1), 'current_expires_at': request.state.session.expires_at.replace(tzinfo=timezone.utc)}


@router.post('/sessions/revoke-others', response_model=SecurityActionResult)
def revoke_sessions(request: Request, user: User = Depends(current_user), db: DBSession = Depends(get_db),
                    key: str = Depends(idem_key)):
    session = request.state.session

    def execute():
        revoked = revoke_other_sessions(db, user, session)
        audit(db, user, 'account.other_sessions_revoked', user.id)
        return {'ok': True, 'revoked_sessions': revoked}

    return idempotent(db, user, 'account.sessions.revoke_others', key, {'session_id': session.id}, execute)
