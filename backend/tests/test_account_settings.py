import json
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.billing_models import Clinic, UserProfile
from app.db import Audit, Idempotency, Session, SessionLocal, User, now
from app.main import app
from app.routes import password_hasher
from conftest import sign_in


def write(client, method, path, body=None, key=None):
    return client.request(
        method, "/api/v1/auth" + path, json=body, headers={"Idempotency-Key": key or str(uuid4())}
    )


def test_profile_preserves_auth_shape_identity_and_is_idempotent(client):
    before = client.get("/api/v1/auth/me").json()
    key = str(uuid4())
    changed = write(client, "PATCH", "/profile", {"name": "  Доктор Азиза Каримова  "}, key)
    assert changed.status_code == 200, changed.text
    expected = {**before, "user": {**before["user"], "name": "Доктор Азиза Каримова"}}
    assert changed.json() == expected
    assert client.get("/api/v1/auth/me").json() == expected
    assert (
        write(client, "PATCH", "/profile", {"name": "Доктор Азиза Каримова"}, key).json()
        == expected
    )
    assert write(client, "PATCH", "/profile", {"name": "Different Name"}, key).status_code == 409
    with SessionLocal() as db:
        assert db.get(UserProfile, before["user"]["id"]).version == 2
        assert (
            len(list(db.scalars(select(Audit).where(Audit.action == "account.profile_updated"))))
            == 1
        )


@pytest.mark.parametrize(
    "body",
    [
        {"name": " "},
        {"name": "X"},
        {"name": "Line\nBreak"},
        {"name": "Valid Name", "role": "developer"},
    ],
)
def test_profile_validation_forbids_empty_names_and_privilege_fields(client, body):
    before = client.get("/api/v1/auth/me").json()
    assert write(client, "PATCH", "/profile", body).status_code == 422
    assert client.get("/api/v1/auth/me").json() == before


@pytest.mark.parametrize("role", ["radiologist", "admin", "developer"])
def test_account_settings_available_to_non_doctor_roles(client, role):
    user = sign_in(client, role)
    result = write(client, "PATCH", "/profile", {"name": "Updated Account Name"})
    assert result.status_code == 200, result.text
    assert result.json()["user"]["id"] == user["id"]
    assert result.json()["user"]["role"] == role
    assert client.get("/api/v1/auth/sessions").status_code == 200


def test_settings_available_to_owner_with_expired_subscription(client):
    result = client.post(
        "/api/v1/auth/register",
        json={
            "clinic_name": "Settings Clinic",
            "name": "Owner Example",
            "email": "settings@example.org",
            "password": "StrongDemo!2026",
            "phone": "+998 90 123 45 67",
            "plan_id": "clinic10",
        },
    )
    assert result.status_code == 201, result.text
    user = result.json()["user"]
    client.headers["X-CSRF-Token"] = result.json()["csrf_token"]
    with SessionLocal() as db:
        clinic = db.get(Clinic, user["tenant_id"])
        clinic.expires_at = now() - timedelta(days=1)
        db.commit()
    assert user["role"] == "owner"
    assert client.get("/api/v1/billing/account").json()["subscription"]["status"] == "expired"
    assert write(client, "PATCH", "/profile", {"name": "Updated Owner"}).status_code == 200
    assert (
        write(
            client,
            "POST",
            "/password",
            {"current_password": "StrongDemo!2026", "new_password": "ChangedOwner!2026"},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me").status_code == 200


def test_password_change_preserves_current_revokes_others_and_retries_safely(client):
    before = client.get("/api/v1/auth/me").json()
    with TestClient(app) as other, TestClient(app) as foreign:
        sign_in(other)
        sign_in(foreign, "other")
        summary = client.get("/api/v1/auth/sessions").json()
        assert summary["active_sessions"] == 2 and summary["other_sessions"] == 1
        assert set(summary) == {"active_sessions", "other_sessions", "current_expires_at"}
        key = str(uuid4())
        payload = {"current_password": "AniqDemo!2026", "new_password": "UpdatedDoctor!2026"}
        result = write(client, "POST", "/password", payload, key)
        assert result.status_code == 200, result.text
        assert result.json() == {"ok": True, "revoked_sessions": 1}
        assert write(client, "POST", "/password", payload, key).json() == result.json()
        assert (
            write(
                client,
                "POST",
                "/password",
                {**payload, "new_password": "DifferentDoctor!2026"},
                key,
            ).status_code
            == 409
        )
        assert client.get("/api/v1/auth/me").json() == before
        assert other.get("/api/v1/auth/me").status_code == 401
        assert foreign.get("/api/v1/auth/me").status_code == 200
        assert (
            other.post(
                "/api/v1/auth/login",
                json={"email": "doctor@demo.aniq", "password": payload["current_password"]},
            ).status_code
            == 401
        )
        assert (
            other.post(
                "/api/v1/auth/login",
                json={"email": "doctor@demo.aniq", "password": payload["new_password"]},
            ).status_code
            == 200
        )
        with SessionLocal() as db:
            user = db.get(User, before["user"]["id"])
            assert password_hasher.verify(user.password_hash, payload["new_password"])
            assert db.get(UserProfile, user.id).version == 2
            audit = list(
                db.scalars(select(Audit).where(Audit.action == "account.password_changed"))
            )
            assert len(audit) == 1
            cache = list(db.scalars(select(Idempotency).where(Idempotency.actor_id == user.id)))
            persisted = json.dumps(
                [{"digest": entry.digest, "response": entry.response} for entry in cache]
            )
            assert all(secret not in persisted for secret in payload.values())


@pytest.mark.parametrize(
    ("current", "new", "status", "code"),
    [
        ("WrongCurrent!2026", "Changed!2026", 400, "CURRENT_PASSWORD_INVALID"),
        ("AniqDemo!2026", "AniqDemo!2026", 422, "PASSWORD_UNCHANGED"),
        ("AniqDemo!2026", "Tiny#1", 422, "VALIDATION_ERROR"),
    ],
)
def test_password_rejections_do_not_change_account_or_expose_inputs(
    client, current, new, status, code
):
    before = client.get("/api/v1/auth/me").json()
    result = write(client, "POST", "/password", {"current_password": current, "new_password": new})
    assert result.status_code == status, result.text
    assert result.json()["error"]["code"] == code
    assert current not in result.text and new not in result.text
    with SessionLocal() as db:
        assert password_hasher.verify(
            db.get(User, before["user"]["id"]).password_hash, "AniqDemo!2026"
        )
        assert not db.scalar(select(Audit).where(Audit.action == "account.password_changed"))
        assert not db.scalar(select(Idempotency).where(Idempotency.operation == "account.password"))


def test_revoke_others_is_scoped_and_old_retry_does_not_revoke_new_session(client):
    with TestClient(app) as other, TestClient(app) as foreign:
        sign_in(other)
        sign_in(foreign, "other")
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == "doctor@demo.aniq"))
            db.add(
                Session(
                    id="a" * 64,
                    user_id=user.id,
                    csrf="expired",
                    expires_at=now() - timedelta(hours=1),
                )
            )
            db.commit()
        assert client.get("/api/v1/auth/sessions").json()["other_sessions"] == 1
        key = str(uuid4())
        result = write(client, "POST", "/sessions/revoke-others", key=key)
        assert result.json() == {"ok": True, "revoked_sessions": 1}
        assert other.get("/api/v1/auth/me").status_code == 401
        assert foreign.get("/api/v1/auth/me").status_code == 200
        assert client.get("/api/v1/auth/sessions").json()["active_sessions"] == 1
        sign_in(other)
        assert write(client, "POST", "/sessions/revoke-others", key=key).json() == result.json()
        assert other.get("/api/v1/auth/me").status_code == 200
        assert write(client, "POST", "/sessions/revoke-others").json()["revoked_sessions"] == 1


def test_settings_require_session_csrf_and_idempotency(client):
    csrf = client.headers.pop("X-CSRF-Token")
    for method, path, body in [
        ("PATCH", "/profile", {"name": "Valid Name"}),
        (
            "POST",
            "/password",
            {"current_password": "AniqDemo!2026", "new_password": "Changed!2026"},
        ),
        ("POST", "/sessions/revoke-others", None),
    ]:
        assert write(client, method, path, body).status_code == 403
    client.headers["X-CSRF-Token"] = csrf
    assert client.patch("/api/v1/auth/profile", json={"name": "Valid Name"}).status_code == 422
    client.cookies.clear()
    assert client.get("/api/v1/auth/sessions").status_code == 401
    assert write(client, "PATCH", "/profile", {"name": "Valid Name"}).status_code == 401


def test_password_attempts_are_rate_limited_without_blocking_session_reads(client):
    payload = {"current_password": "wrong", "new_password": "UpdatedDoctor!2026"}
    for _ in range(12):
        assert write(client, "POST", "/password", payload).status_code == 400
    result = write(client, "POST", "/password", payload)
    assert result.status_code == 429 and result.json()["error"]["code"] == "RATE_LIMIT"
    assert result.headers["Retry-After"] == "60"
    assert client.get("/api/v1/auth/me").status_code == 200
