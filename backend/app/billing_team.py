"""Clinic team management shared by owners and platform developers."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from .billing_models import Clinic, UserProfile
from .billing_schemas import TeamCreate, TeamPatch
from .billing_service import (
    SEAT_ROLES,
    enforce_seat,
    lock_clinic,
    own_clinic,
    revoke_sessions,
    subscription,
    usage,
    user_json,
)
from .db import User, get_db
from .routes import password_hasher
from .security import ApiError, audit, current_user

router = APIRouter()


def team_json(db, clinic):
    return {
        "items": [
            user_json(db, u)
            for u in db.scalars(select(User).where(User.tenant_id == clinic.id).order_by(User.name))
        ],
        "doctor_limit": clinic.doctor_limit,
        "doctors_used": usage(db, clinic.id)["doctors"],
    }


@router.get("/billing/team")
def team(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    clinic = db.get(Clinic, user.tenant_id)
    if not clinic:
        return {"items": [], "doctor_limit": 0, "doctors_used": 0}
    return team_json(db, clinic)


def add_user(db, actor, clinic, body):
    lock_clinic(db, clinic)
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise ApiError(409, "EMAIL_EXISTS", "This email already has an account.")
    if not subscription(clinic)["active"]:
        raise ApiError(
            402, "SUBSCRIPTION_REQUIRED", "Activate a subscription before adding team accounts."
        )
    if body.role in SEAT_ROLES:
        enforce_seat(db, clinic)
    if usage(db, clinic.id)["team_members"] >= max(10, clinic.doctor_limit * 4 + 1):
        raise ApiError(409, "TEAM_LIMIT_REACHED", "Contact support to expand this team.")
    new_user = User(
        tenant_id=clinic.id,
        email=body.email,
        name=body.name,
        role=body.role,
        password_hash=password_hasher.hash(body.password),
    )
    try:
        db.add(new_user)
        db.flush()
        db.add(UserProfile(user_id=new_user.id))
        audit(db, actor, "team.user_created", new_user.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "EMAIL_EXISTS", "This email already has an account.")
    return user_json(db, new_user)


@router.post("/billing/team", status_code=201)
def create_team_user(
    body: TeamCreate, user: User = Depends(current_user), db: DBSession = Depends(get_db)
):
    return add_user(db, user, own_clinic(db, user), body)


def change_user(db, actor, target, clinic, body):
    if target.role == "developer" or target.id == clinic.owner_id:
        raise ApiError(
            403,
            "PROTECTED_ACCOUNT",
            "Clinic owners and developer accounts cannot be changed through team management.",
        )
    lock_clinic(db, clinic)
    profile = db.get(UserProfile, target.id)
    if not profile:
        profile = UserProfile(user_id=target.id, version=1)
        db.add(profile)
        db.flush()
    result = db.execute(
        update(UserProfile)
        .where(UserProfile.user_id == target.id, UserProfile.version == body.expected_version)
        .values(version=UserProfile.version + 1)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, "VERSION_CONFLICT", "The team account changed. Refresh and retry.")
    changes = body.model_dump(exclude_unset=True, exclude={"expected_version"})
    if any(value is None for value in changes.values()):
        raise ApiError(422, "INVALID_USER_UPDATE", "Fields cannot be null.")
    next_role, next_active = changes.get("role", target.role), changes.get("active", target.active)
    if (
        next_active
        and next_role in SEAT_ROLES
        and not (target.active and target.role in SEAT_ROLES)
    ):
        enforce_seat(db, clinic)
    if "password" in changes:
        target.password_hash = password_hasher.hash(changes.pop("password"))
        revoke_sessions(db, target.id)
    if changes.get("active") is False or ("role" in changes and changes["role"] != target.role):
        revoke_sessions(db, target.id)
    for key, value in changes.items():
        setattr(target, key, value)
    audit(db, actor, "team.user_updated", target.id)
    db.commit()
    return user_json(db, target)


@router.patch("/billing/team/{user_id}")
def patch_team_user(
    user_id: str,
    body: TeamPatch,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    clinic = own_clinic(db, user)
    target = db.get(User, user_id)
    if not target or target.tenant_id != clinic.id:
        raise ApiError(404, "USER_NOT_FOUND", "Team account not available.")
    return change_user(db, user, target, clinic, body)
