from uuid import uuid4

from sqlalchemy import select

from app.db import Case, CaseAccess, Record, SessionLocal, User
from app.security import create_record
from conftest import sign_in


def mark_all(client, key=None, **headers):
    return client.post(
        "/api/v1/notifications/read-all",
        headers={"Idempotency-Key": key or str(uuid4()), **headers},
    )


def seed_notifications(case_id):
    with SessionLocal() as db:
        doctor = db.scalar(select(User).where(User.email == "doctor@demo.aniq"))
        expert = db.scalar(select(User).where(User.email == "expert@demo.aniq"))
        other = db.scalar(select(User).where(User.email == "other@demo.aniq"))
        owned = db.get(Case, case_id)
        granted = Case(tenant_id=expert.tenant_id, owner_id=expert.id, alias="GRANTED")
        private = Case(tenant_id=expert.tenant_id, owner_id=expert.id, alias="PRIVATE")
        foreign = Case(tenant_id=other.tenant_id, owner_id=other.id, alias="FOREIGN")
        db.add_all([granted, private, foreign])
        db.flush()
        # A stray grant must never bypass the tenant boundary.
        db.add_all(
            [
                CaseAccess(case_id=granted.id, user_id=doctor.id),
                CaseAccess(case_id=foreign.id, user_id=doctor.id),
            ]
        )
        visible = []
        for index in range(105):
            readers = [doctor.id] if index == 0 else [expert.id] if index == 1 else []
            visible.append(
                create_record(
                    db, doctor, "notification", {"status": "completed", "read_by": readers}, owned
                ).id
            )
        visible.append(
            create_record(
                db, expert, "notification", {"status": "partial", "read_by": []}, granted
            ).id
        )
        hidden = [
            create_record(
                db, expert, "notification", {"status": "completed", "read_by": []}, private
            ).id,
            create_record(
                db, other, "notification", {"status": "completed", "read_by": []}, foreign
            ).id,
            create_record(db, doctor, "source", {"read_by": []}, owned).id,
        ]
        db.commit()
        return doctor.id, expert.id, visible, hidden


def test_mark_all_includes_history_and_preserves_scope_and_readers(client, case):
    doctor_id, expert_id, visible, hidden = seed_notifications(case["id"])
    before = client.get("/api/v1/notifications").json()
    assert before["total"] == 106
    assert before["unread_count"] == 105
    assert len(before["items"]) == 100
    assert all(item["id"] in visible for item in before["items"])
    assert all(item["case_alias"] in {case["alias"], "GRANTED"} for item in before["items"])

    key = str(uuid4())
    result = mark_all(client, key)
    assert result.status_code == 200, result.text
    assert result.json() == {"updated": 105, "unread_count": 0}
    assert mark_all(client, key).json() == result.json()
    assert mark_all(client).json() == {"updated": 0, "unread_count": 0}
    after = client.get("/api/v1/notifications").json()
    assert after["unread_count"] == 0 and after["total"] == 106

    with SessionLocal() as db:
        assert all(
            db.get(Record, record_id).data["read_by"].count(doctor_id) == 1 for record_id in visible
        )
        assert expert_id in db.get(Record, visible[1]).data["read_by"]
        assert all(db.get(Record, record_id).data["read_by"] == [] for record_id in hidden)
        doctor = db.get(User, doctor_id)
        create_record(
            db,
            doctor,
            "notification",
            {"status": "partial", "read_by": []},
            db.get(Case, case["id"]),
        )
        db.commit()

    # Replaying an old click cannot consume a notification that arrived afterwards.
    assert mark_all(client, key).json() == result.json()
    assert client.get("/api/v1/notifications").json()["unread_count"] == 1
    assert mark_all(client).json()["updated"] == 1

    sign_in(client, "other")
    other_view = client.get("/api/v1/notifications").json()
    assert other_view["total"] == 1 and other_view["unread_count"] == 1
    assert [item["id"] for item in other_view["items"]] == [hidden[1]]


def test_notification_bulk_requires_csrf_idempotency_and_clinical_role(client, case):
    assert mark_all(client, **{"X-CSRF-Token": "invalid"}).status_code == 403
    assert client.post("/api/v1/notifications/read-all").status_code == 422
    for role in ["admin", "analyst"]:
        user = sign_in(client, role)
        with SessionLocal() as db:
            db.add(CaseAccess(case_id=case["id"], user_id=user["id"]))
            db.commit()
        assert client.get("/api/v1/notifications").status_code == 403
        assert mark_all(client).status_code == 403


def test_single_read_preserves_reader_added_after_access_check(client, case, monkeypatch):
    import app.routes as routes

    with SessionLocal() as db:
        doctor = db.scalar(select(User).where(User.email == "doctor@demo.aniq"))
        expert = db.scalar(select(User).where(User.email == "expert@demo.aniq"))
        doctor_id, expert_id = doctor.id, expert.id
        record_id = create_record(
            db,
            doctor,
            "notification",
            {"status": "completed", "read_by": []},
            db.get(Case, case["id"]),
        ).id
        db.commit()

    original_idempotent = routes.idempotent

    def concurrent_reader(db, user, operation, key, payload, execute):
        # The first request has loaded the notification for its access check;
        # another user finishes reading before the first request acquires its lock.
        with SessionLocal() as other_db:
            record = other_db.get(Record, record_id)
            record.data = {**record.data, "read_by": [expert_id]}
            other_db.commit()
        return original_idempotent(db, user, operation, key, payload, execute)

    monkeypatch.setattr(routes, "idempotent", concurrent_reader)
    response = client.post(
        f"/api/v1/notifications/{record_id}/read", headers={"Idempotency-Key": str(uuid4())}
    )
    assert response.status_code == 200 and response.json() == {"read": True}
    with SessionLocal() as db:
        assert set(db.get(Record, record_id).data["read_by"]) == {doctor_id, expert_id}
