import io
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from conftest import sign_in
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter
from sqlalchemy import select

from app.billing_models import Clinic, Plan, SubscriptionRequest
from app.billing_service import next_month
from app.db import Audit, Case, SessionLocal, now
from app.main import app


def test_demo_identities_and_existing_sessions_disabled_in_production(client, monkeypatch):
    from app.config import settings

    sign_in(client, "developer")
    assert client.get("/api/v1/developer/overview").status_code == 200
    monkeypatch.setattr(settings, "demo_mode", False)
    assert client.get("/api/v1/auth/me").status_code == 401
    response = client.post(
        "/api/v1/auth/login", json={"email": "developer@demo.aniq", "password": "AniqDemo!2026"}
    )
    assert response.status_code == 401
    user = register(client, email="production-owner@example.org")
    assert client.get("/api/v1/auth/me").json()["user"]["id"] == user["id"]


def register(client, email="owner@example.org", plan="clinic10"):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "clinic_name": "Navro‘z klinikasi",
            "name": "Owner Example",
            "email": email,
            "password": "StrongDemo!2026",
            "phone": "+998 90 123 45 67",
            "plan_id": plan,
        },
    )
    assert response.status_code == 201, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()["user"]


def login(client, email):
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "StrongDemo!2026"}
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()["user"]


def png(color="white"):
    stream = io.BytesIO()
    Image.new("RGB", (12, 12), color).save(stream, format="PNG")
    return stream.getvalue()


def submit(client, plan="clinic10", content=None, **extra):
    plans = client.get("/api/v1/billing/plans").json()["items"]
    method = client.get("/api/v1/billing/payment-methods").json()["items"][0]
    selected = next(p for p in plans if p["id"] == plan)
    data = {
        "plan_id": plan,
        "payment_method_id": method["id"],
        "plan_version": selected["version"],
        "payment_method_version": method["version"],
        **extra,
    }
    return client.post(
        "/api/v1/billing/requests",
        data=data,
        files={"file": ("receipt.png", content or png(), "image/png")},
        headers={"Idempotency-Key": str(uuid4())},
    )


def approve(client, request):
    sign_in(client, "developer")
    response = client.post(
        f"/api/v1/developer/subscription-requests/{request['id']}/review",
        json={
            "expected_version": request["version"],
            "decision": "approved",
            "note": "Test fixture: external transfer verified.",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_public_prices_registration_and_pending_entitlement(client):
    plans = client.get("/api/v1/billing/plans").json()
    assert [(p["price_uzs"], p["doctor_limit"]) for p in plans["items"]] == [
        (150000, 1),
        (1390000, 10),
        (2390000, 25),
        (None, None),
    ]
    assert plans["support_telegram"] == "https://t.me/avilab_uz_support"
    user = register(client, plan="solo")
    assert user["role"] == "doctor" and user["is_clinic_owner"]
    account = client.get("/api/v1/billing/account").json()
    assert account["subscription"]["status"] == "pending" and not account["can_use_workspace"]
    assert client.get("/api/v1/cases").status_code == 402
    assert client.get("/api/v1/auth/me").status_code == 200
    with SessionLocal() as db:
        assert not db.scalar(select(Case).where(Case.tenant_id == user["tenant_id"]))


def test_receipt_approval_exactly_once_and_calendar_renewal(client):
    register(client, plan="solo")
    request = submit(client, plan="solo").json()
    assert request["status"] == "pending" and request["price_uzs"] == 150000
    assert client.get(request["receipt_url"]).status_code == 200
    approved = approve(client, request)
    expiry = approved["subscription"]["expires_at"]
    repeat = client.post(
        f"/api/v1/developer/subscription-requests/{request['id']}/review",
        json={"expected_version": 1, "decision": "approved", "note": "Repeat submission"},
    )
    assert repeat.status_code == 409
    login(client, "owner@example.org")
    assert client.get("/api/v1/cases").status_code == 200
    assert client.get("/api/v1/billing/account").json()["subscription"]["expires_at"] == expiry
    assert (
        submit(client, plan="clinic10", content=png("yellow")).json()["error"]["code"]
        == "ACTIVE_PLAN_CHANGE_REQUIRES_SUPPORT"
    )
    renewed = submit(client, plan="solo", content=png("blue"))
    assert renewed.status_code == 201, renewed.text
    result = approve(client, renewed.json())
    assert datetime.fromisoformat(result["subscription"]["expires_at"]) == next_month(
        datetime.fromisoformat(expiry)
    )


def test_pending_duplicates_receipt_dedup_and_owner_isolation(client):
    register(client, "a@example.org")
    request = submit(client).json()
    duplicate_pending = submit(client, content=png("red"))
    assert duplicate_pending.status_code == 409
    register(client, "b@example.org")
    assert client.get(request["receipt_url"]).status_code == 404
    duplicate = submit(client)
    assert (
        duplicate.status_code == 409
        and duplicate.json()["error"]["code"] == "RECEIPT_ALREADY_SUBMITTED"
    )
    assert client.get("/api/v1/developer/clinics").status_code == 403


def test_receipt_is_private_audited_and_browser_safe(client):
    owner = register(client)
    request = submit(client).json()
    assert not {"receipt_path", "receipt_hash", "actor_id"} & request.keys()

    response = client.get(request["receipt_url"])
    assert response.status_code == 200
    assert response.content == png()
    assert response.headers["content-type"] == "image/png"
    assert response.headers["content-disposition"] == 'inline; filename="receipt.png"'
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-security-policy"] == "default-src 'none'; sandbox"

    approve(client, request)
    developer = client.get("/api/v1/auth/me").json()["user"]
    assert client.get(request["receipt_url"]).status_code == 200
    login(client, owner["email"])
    created = client.post(
        "/api/v1/billing/team",
        json={
            "name": "Receipt Privacy Doctor",
            "email": "receipt-doctor@example.org",
            "password": "StrongDemo!2026",
            "role": "doctor",
        },
    )
    assert created.status_code == 201, created.text
    login(client, "receipt-doctor@example.org")
    assert client.get("/api/v1/billing/account").json()["requests"] == []
    assert client.get(request["receipt_url"]).status_code == 404

    with SessionLocal() as db:
        views = list(
            db.scalars(
                select(Audit).where(
                    Audit.action == "subscription.receipt_viewed",
                    Audit.resource_id == request["id"],
                )
            )
        )
        assert len(views) == 2
        assert {view.actor_id for view in views} == {owner["id"], developer["id"]}


def test_rejection_does_not_activate_and_new_receipt_can_be_submitted(client):
    register(client, plan="solo")
    request = submit(client, plan="solo").json()
    sign_in(client, "developer")
    response = client.post(
        f"/api/v1/developer/subscription-requests/{request['id']}/review",
        json={
            "expected_version": 1,
            "decision": "rejected",
            "note": "Receipt amount does not match.",
        },
    )
    assert response.status_code == 200
    login(client, "owner@example.org")
    assert client.get("/api/v1/cases").status_code == 402
    assert submit(client, plan="solo", content=png("green")).status_code == 201


def test_immutable_plan_snapshot_and_price_version_check(client):
    register(client)
    assert submit(client, plan_version=99).json()["error"]["code"] == "PRICE_CHANGED"
    assert (
        submit(client, payment_method_version=99).json()["error"]["code"]
        == "PAYMENT_METHOD_CHANGED"
    )
    request = submit(client).json()
    sign_in(client, "developer")
    changed = client.patch(
        "/api/v1/developer/plans/clinic10",
        json={"expected_version": 1, "price_uzs": 1500000, "doctor_limit": 11},
    )
    assert changed.status_code == 200, changed.text
    assert (
        client.patch(
            "/api/v1/developer/plans/clinic10", json={"expected_version": 1, "price_uzs": 1500001}
        ).status_code
        == 409
    )
    approved = client.post(
        f"/api/v1/developer/subscription-requests/{request['id']}/review",
        json={
            "expected_version": 1,
            "decision": "approved",
            "note": "Earlier quoted price honored.",
        },
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["subscription"]["price_uzs"] == 1390000
    assert approved.json()["subscription"]["doctor_limit"] == 10


def test_team_seats_activation_role_security_and_session_revocation(client):
    register(client)
    with SessionLocal() as db:
        db.get(Plan, "clinic10").doctor_limit = 2
        db.commit()
    request = submit(client).json()
    approve(client, request)
    login(client, "owner@example.org")
    created = []
    for index, role in enumerate(["doctor", "radiologist"]):
        response = client.post(
            "/api/v1/billing/team",
            json={
                "name": f"Doctor {index}",
                "email": f"doc{index}@example.org",
                "password": "StrongDemo!2026",
                "role": role,
            },
        )
        assert response.status_code == 201, response.text
        created.append(response.json())
    full = client.post(
        "/api/v1/billing/team",
        json={
            "name": "Third Doctor",
            "email": "doc3@example.org",
            "password": "StrongDemo!2026",
            "role": "expert",
        },
    )
    assert full.status_code == 409 and full.json()["error"]["code"] == "DOCTOR_LIMIT_REACHED"
    with TestClient(app) as doctor:
        login(doctor, "doc0@example.org")
        assert doctor.get("/api/v1/billing/account").json()["requests"] == []
        assert (
            doctor.post(
                "/api/v1/billing/team",
                json={
                    "name": "No permission",
                    "email": "forbid@example.org",
                    "password": "StrongDemo!2026",
                    "role": "doctor",
                },
            ).status_code
            == 403
        )
        response = client.patch(
            f"/api/v1/billing/team/{created[0]['id']}",
            json={"expected_version": 1, "active": False},
        )
        assert response.status_code == 200, response.text
        assert doctor.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/billing/team",
            json={
                "name": "Replacement Doctor",
                "email": "new@example.org",
                "password": "StrongDemo!2026",
                "role": "doctor",
            },
        ).status_code
        == 201
    )
    assert (
        client.patch(
            f"/api/v1/billing/team/{created[0]['id']}", json={"expected_version": 2, "active": True}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/billing/team",
            json={
                "name": "Escalation",
                "email": "evil@example.org",
                "password": "StrongDemo!2026",
                "role": "developer",
            },
        ).status_code
        == 422
    )


def test_subscription_expiry_and_suspend_preserve_records(client):
    user = register(client, plan="solo")
    request = submit(client, plan="solo").json()
    approve(client, request)
    login(client, "owner@example.org")
    created = client.post(
        "/api/v1/cases",
        json={"full_name": "Subscription Patient", "age": 40, "sex": "male"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    with SessionLocal() as db:
        db.get(Clinic, user["tenant_id"]).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/v1/cases").status_code == 402
    assert client.get("/api/v1/billing/account").json()["subscription"]["status"] == "expired"
    with SessionLocal() as db:
        assert db.get(Case, created.json()["id"]) is not None
    sign_in(client, "developer")
    clinic = client.get(f"/api/v1/developer/clinics/{user['tenant_id']}").json()["clinic"]
    response = client.patch(
        f"/api/v1/developer/clinics/{user['tenant_id']}",
        json={"expected_version": clinic["version"], "status": "suspended"},
    )
    assert response.status_code == 200
    login(client, "owner@example.org")
    assert client.get("/api/v1/billing/account").json()["subscription"]["status"] == "suspended"
    assert submit(client, plan="solo", content=png("black")).status_code == 403


def test_upload_validation_and_csrf(client):
    register(client)
    method = client.get("/api/v1/billing/payment-methods").json()["items"][0]
    data = {
        "plan_id": "clinic10",
        "plan_version": 1,
        "payment_method_id": method["id"],
        "payment_method_version": method["version"],
    }
    for name, content, mime in [
        ("fake.png", b"<script>bad</script>", "image/png"),
        ("fake.svg", b"<svg/>", "image/svg+xml"),
        ("fake.pdf", b"%PDF-notvalid", "application/pdf"),
    ]:
        result = client.post(
            "/api/v1/billing/requests",
            data=data,
            files={"file": (name, content, mime)},
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert result.status_code == 422, result.text
    assert (
        client.post(
            "/api/v1/billing/requests",
            data=data,
            files={"file": ("receipt.png", png(), "image/png")},
            headers={"Idempotency-Key": str(uuid4()), "X-CSRF-Token": "bad"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/billing/requests",
            data=data,
            files={"file": ("receipt.png", b"x" * (10 * 1024 * 1024 + 1), "image/png")},
            headers={"Idempotency-Key": str(uuid4())},
        ).status_code
        == 413
    )


def test_pdf_receipt_passive_only(client):
    register(client)
    method = client.get("/api/v1/billing/payment-methods").json()["items"][0]
    data = {
        "plan_id": "clinic10",
        "plan_version": 1,
        "payment_method_id": method["id"],
        "payment_method_version": method["version"],
    }
    for scripted in [True, False]:
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=400)
        if scripted:
            writer.add_js('app.alert("test")')
        stream = io.BytesIO()
        writer.write(stream)
        result = client.post(
            "/api/v1/billing/requests",
            data=data,
            files={"file": ("receipt.pdf", stream.getvalue(), "application/pdf")},
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert result.status_code == (422 if scripted else 201), result.text


def test_review_race_grants_one_period(client):
    register(client)
    request = submit(client).json()
    sign_in(client, "developer")

    def review(_):
        return client.post(
            f"/api/v1/developer/subscription-requests/{request['id']}/review",
            json={
                "expected_version": 1,
                "decision": "approved",
                "note": "Concurrent approval fixture",
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(review, [1, 2])) == [200, 409]
    with SessionLocal() as db:
        row = db.get(SubscriptionRequest, request["id"])
        assert row.version == 2
        assert row.granted_expires_at == next_month(row.granted_starts_at)


def test_receipt_idempotency_replays_one_application(client):
    register(client)
    method = client.get("/api/v1/billing/payment-methods").json()["items"][0]
    data = {
        "plan_id": "clinic10",
        "plan_version": 1,
        "payment_method_id": method["id"],
        "payment_method_version": method["version"],
    }
    headers = {"Idempotency-Key": str(uuid4())}
    results = [
        client.post(
            "/api/v1/billing/requests",
            data=data,
            files={"file": ("receipt.png", png(), "image/png")},
            headers=headers,
        )
        for _ in range(2)
    ]
    assert [r.status_code for r in results] == [201, 201]
    assert results[0].json()["id"] == results[1].json()["id"]


def test_concurrent_team_creation_cannot_exceed_seat_limit(client):
    register(client)
    with SessionLocal() as db:
        db.get(Plan, "clinic10").doctor_limit = 1
        db.commit()
    approve(client, submit(client).json())
    login(client, "owner@example.org")

    def create(index):
        return client.post(
            "/api/v1/billing/team",
            json={
                "name": f"Concurrent Doctor {index}",
                "email": f"race{index}@example.org",
                "password": "StrongDemo!2026",
                "role": "doctor",
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(create, [1, 2])) == [201, 409]
    assert client.get("/api/v1/billing/team").json()["doctors_used"] == 1


def test_developer_cannot_browse_patient_records_or_modify_owner_role(client, case):
    sign_in(client, "developer")
    assert client.get("/api/v1/cases").status_code == 403
    assert client.get("/api/v1/cases/" + case["id"]).status_code == 403
    account = client.get("/api/v1/developer/clinics/avilab-demo").json()
    owner = account["clinic"]["owner_id"]
    result = client.patch(
        "/api/v1/developer/users/" + owner, json={"expected_version": 1, "active": False}
    )
    assert result.status_code == 403 and result.json()["error"]["code"] == "PROTECTED_ACCOUNT"


@pytest.mark.parametrize(
    "start,expected",
    [("2026-01-31", "2026-02-28"), ("2028-01-31", "2028-02-29"), ("2026-12-31", "2027-01-31")],
)
def test_calendar_month_boundaries(start, expected):
    value = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
    assert next_month(value).date().isoformat() == expected
