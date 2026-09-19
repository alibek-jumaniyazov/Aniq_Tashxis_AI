"""Patient registration, immutable automatic codes and identity access boundaries."""

from concurrent.futures import ThreadPoolExecutor
import json
import re
from uuid import uuid4

import pytest
from sqlalchemy import select

from app import ai
from app.db import Case, Job, PatientCodeAllocation, SessionLocal, User
from conftest import sign_in
from test_workflows import add, fact, mutate, run


def test_name_only_creates_patient_and_replays_same_generated_code(client):
    body = {"full_name": "  Абдуллаев Азиз Каримович  "}
    key = str(uuid4())
    first = mutate(client, "/cases", body, key=key)
    assert first.status_code == 201, first.text
    patient = first.json()
    assert patient["full_name"] == body["full_name"].strip()
    assert re.fullmatch(r"AT-\d{8,}", patient["alias"])
    assert patient["age"] is None and patient["sex"] == "unknown"
    assert patient["patient_phone"] == patient["summary"] == patient["diagnosis"] == ""
    assert mutate(client, "/cases", body, key=key).json() == patient
    assert client.get("/api/v1/cases/" + patient["id"]).json()["full_name"] == patient["full_name"]
    with SessionLocal() as db:
        assert len(list(db.scalars(select(PatientCodeAllocation)))) == 1


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"full_name": ""},
        {"full_name": " \t\n "},
        {"full_name": None},
        {"full_name": "A" * 201},
        {"full_name": "Patient", "age": -1},
        {"full_name": "Patient", "age": 121},
        {"full_name": "Patient", "age": 18.5},
        {"full_name": "Patient", "age": True},
        {"full_name": "Patient", "patient_phone": "1" * 51},
        {"full_name": "Patient", "alias": "MANUAL-CODE"},
        {"full_name": "Patient", "diagnosis": "Unrequested"},
    ],
)
def test_registration_validates_input_and_rejects_manual_codes(client, body):
    assert mutate(client, "/cases", body).status_code == 422
    with SessionLocal() as db:
        assert not list(db.scalars(select(PatientCodeAllocation)))


def test_optional_fields_persist_and_partial_edit_keeps_omitted_fields(client):
    body = {
        "full_name": "  Dilnoza Karimova  ",
        "age": 0,
        "sex": "female",
        "patient_phone": " +998 (90) 123-45-67 ",
        "summary": "  Doctor comment.  ",
    }
    created = mutate(client, "/cases", body).json()
    assert created["age"] == 0 and created["summary"] == "Doctor comment."
    assert created["patient_phone"] == "+998 (90) 123-45-67"
    updated = mutate(
        client,
        "/cases/" + created["id"],
        {"expected_version": 1, "full_name": "Dilnoza Aliyeva"},
        method="patch",
    )
    assert updated.status_code == 200, updated.text
    patient = updated.json()
    assert patient["version"] == 2 and patient["alias"] == created["alias"]
    assert (
        patient["summary"] == created["summary"]
        and patient["patient_phone"] == created["patient_phone"]
    )
    assert patient["age"] == 0 and patient["sex"] == "female"
    assert (
        mutate(
            client,
            "/cases/" + created["id"],
            {"expected_version": 2, "alias": "FORGED"},
            method="patch",
        ).status_code
        == 422
    )
    assert (
        mutate(
            client,
            "/cases/" + created["id"],
            {"expected_version": 2, "full_name": "  "},
            method="patch",
        ).status_code
        == 422
    )
    assert (
        mutate(
            client,
            "/cases/" + created["id"],
            {"expected_version": 1, "summary": "stale"},
            method="patch",
        ).status_code
        == 409
    )


@pytest.mark.parametrize("field,clear_value", [("age", None), ("summary", "")])
def test_partial_edit_idempotency_distinguishes_omitted_and_cleared_fields(
    client, field, clear_value
):
    created = mutate(
        client,
        "/cases",
        {"full_name": "Original Patient", "age": 45, "summary": "Preserved doctor comment"},
    ).json()
    path = "/cases/" + created["id"]
    body = {"expected_version": 1, "full_name": "Updated Patient"}
    key = str(uuid4())
    first = mutate(client, path, body, method="patch", key=key)
    assert first.status_code == 200, first.text
    assert first.json()[field] == created[field]
    assert mutate(client, path, body, method="patch", key=key).json() == first.json()
    conflicting = mutate(client, path, {**body, field: clear_value}, method="patch", key=key)
    assert (
        conflicting.status_code == 409
        and conflicting.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    )
    preserved = client.get("/api/v1" + path).json()
    assert preserved["version"] == 2 and preserved[field] == created[field]
    cleared = mutate(client, path, {"expected_version": 2, field: clear_value}, method="patch")
    assert cleared.status_code == 200 and cleared.json()[field] == clear_value


def test_legacy_records_edit_without_inventing_name_and_code_collision_is_skipped(client, case):
    with SessionLocal() as db:
        legacy = db.get(Case, case["id"])
        legacy.alias = "AT-00000001"
        legacy.diagnosis = "Existing clinical conclusion"
        db.commit()
    response = mutate(
        client,
        "/cases/" + case["id"],
        {"expected_version": case["version"], "summary": "Updated doctor comment"},
        method="patch",
    )
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "" and response.json()["alias"] == "AT-00000001"
    assert response.json()["diagnosis"] == "Existing clinical conclusion"
    created = mutate(client, "/cases", {"full_name": "New Patient"}).json()
    assert created["alias"] == "AT-00000002"


def test_search_name_phone_and_code_stays_within_patient_permissions(client):
    patient = mutate(
        client,
        "/cases",
        {"full_name": "Абдуллаев Азиз Каримович", "patient_phone": "+998 (90) 123-45-67"},
    ).json()
    for query in ("абдуллаев", "Азиз Каримович", "901234567", patient["alias"]):
        found = client.get("/api/v1/cases", params={"q": query}).json()
        assert [row["id"] for row in found["items"]] == [patient["id"]]
    with SessionLocal() as db:
        owner = db.get(Case, patient["id"])
        expert = db.scalar(
            select(User).where(User.role == "expert", User.tenant_id == owner.tenant_id)
        )
        db.add(
            Case(
                tenant_id=owner.tenant_id,
                owner_id=expert.id,
                alias="PRIVATE",
                full_name="Private Patient",
                patient_phone="+998 99 444 44 44",
            )
        )
        db.commit()
    assert client.get("/api/v1/cases", params={"q": "Private Patient"}).json()["items"] == []
    sign_in(client, "other")
    assert client.get("/api/v1/cases", params={"q": "абдуллаев"}).json()["items"] == []
    assert client.get("/api/v1/cases/" + patient["id"]).status_code == 404
    sign_in(client, "expert")
    assert mutate(client, "/cases", {"full_name": "Not permitted"}).status_code == 403


def test_concurrent_registration_has_unique_codes_and_duplicate_request_replays(client):
    def create(index):
        return mutate(client, "/cases", {"full_name": f"Concurrent Patient {index}"})

    with ThreadPoolExecutor(max_workers=4) as workers:
        results = list(workers.map(create, range(8)))
    assert all(response.status_code == 201 for response in results), [
        response.text for response in results
    ]
    assert len({response.json()["alias"] for response in results}) == 8
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=4) as workers:
        duplicates = list(
            workers.map(
                lambda _: mutate(client, "/cases", {"full_name": "Same Patient"}, key=key), range(4)
            )
        )
    assert all(response.status_code == 201 for response in duplicates), [
        response.text for response in duplicates
    ]
    assert len({response.json()["id"] for response in duplicates}) == 1
    assert len({response.json()["alias"] for response in duplicates}) == 1


def test_patient_identity_is_excluded_from_analysis_snapshot_and_model(client, monkeypatch):
    captured = []

    def capture(snapshot, *args):
        captured.append(snapshot)
        raise ai.ModelUnavailable("MODEL_WEIGHTS_MISSING")

    monkeypatch.setattr(ai, "review", capture)
    patient = mutate(
        client,
        "/cases",
        {"full_name": "Private Identity Patient", "patient_phone": "+998901112233", "age": 40},
    ).json()
    result = run(client, patient)
    with SessionLocal() as db:
        snapshot = db.get(Job, result["id"]).payload["snapshot"]
    assert "full_name" not in snapshot and "patient_phone" not in snapshot
    assert captured and "full_name" not in captured[0] and "patient_phone" not in captured[0]
    assert patient["full_name"] not in json.dumps(ai.model_context(captured[0]))
    assert patient["patient_phone"] not in json.dumps(ai.model_context(captured[0]))


@pytest.mark.parametrize("age", [None, 0, 17])
def test_registration_does_not_expand_adult_clinical_scope(client, age):
    patient = mutate(
        client, "/cases", {"full_name": "Patient Outside Adult Scope", "age": age}
    ).json()
    add(
        client,
        patient,
        [fact("symptom.complaint", "cough"), fact("vital.pulse", "80", unit="/min")],
    )
    readiness = client.get(f"/api/v1/cases/{patient['id']}/readiness").json()
    assert not readiness["clinical_population_eligible"] and not readiness["clinical_review_ready"]
    response = mutate(
        client,
        f"/cases/{patient['id']}/analyses",
        {"expected_version": patient["version"], "review_focus": "clinical_assessment"},
    )
    assert response.status_code == 422 and response.json()["error"]["code"] == "OUTSIDE_DEMO_SCOPE"
