from uuid import uuid4
from app import ai
from app.schemas import ExtractedFact
from test_workflows import mutate, new_case


def source(client):
    c = new_case(client)
    uploaded = client.post(
        f"/api/v1/cases/{c['id']}/documents",
        headers={"Idempotency-Key": str(uuid4())},
        data={"expected_version": 1, "identity_confirmed": "true"},
        files={"file": ("note.txt", b"Pulse recorded as 72 /min.", "text/plain")},
    )
    assert uploaded.status_code == 201
    return c, uploaded.json()


def test_ai_extraction_preserves_exact_source_and_human_confirmation(client, monkeypatch):
    c, document = source(client)
    proposed = ExtractedFact(
        key="vital.pulse",
        label="Pulse",
        value="72",
        unit="/min",
        assertion="present",
        page=1,
        quote="Pulse recorded as 72 /min.",
    )
    calls = []

    def extract(pages):
        calls.append(pages)
        return [proposed]

    monkeypatch.setattr(ai, "extract_document", extract)
    key = str(uuid4())
    result = mutate(
        client, f"/documents/{document['id']}/extract", {"expected_version": 2}, key=key
    )
    assert result.status_code == 200, result.text
    assert result.json()["count"] == 1
    replay = mutate(
        client, f"/documents/{document['id']}/extract", {"expected_version": 2}, key=key
    )
    assert replay.json() == result.json() and len(calls) == 1
    facts = client.get(f"/api/v1/cases/{c['id']}/facts").json()["items"]
    assert facts[0]["source_id"] == document["id"]
    assert facts[0]["span"] == "page:1:chars:0-26"
    assert facts[0]["confirmed"] is False and facts[0]["available_time"] is None


def test_ai_extraction_rejects_invented_source_quote(client, monkeypatch):
    c, document = source(client)
    proposed = ExtractedFact(
        key="vital.pulse",
        label="Pulse",
        value="100",
        assertion="present",
        page=1,
        quote="Pulse is 100",
    )
    monkeypatch.setattr(ai, "extract_document", lambda pages: [proposed])
    result = mutate(client, f"/documents/{document['id']}/extract", {"expected_version": 2})
    assert result.status_code == 422
    assert client.get(f"/api/v1/cases/{c['id']}/facts").json()["items"] == []


def test_ai_extraction_missing_model_keeps_source(client):
    c, document = source(client)
    result = mutate(client, f"/documents/{document['id']}/extract", {"expected_version": 2})
    assert result.status_code == 503
    assert client.get("/api/v1/sources/" + document["id"]).status_code == 200
    assert client.get(f"/api/v1/cases/{c['id']}").json()["version"] == 2


def test_real_extractor_copies_literal_unit_and_rejects_invented_unit(monkeypatch):
    import json
    import pytest
    from app import llama_adapter
    from app.config import settings

    monkeypatch.setattr(ai, "model_status", lambda: {"ready": True})
    monkeypatch.setattr(settings, "ai_backend", "llama_cpp")
    fact = {
        "key": "vital.pulse",
        "label": "Pulse",
        "value": "70",
        "unit": None,
        "assertion": "present",
        "page": 1,
        "quote": "Pulse: 70 /min.",
    }
    monkeypatch.setattr(llama_adapter, "complete", lambda *args: json.dumps({"facts": [fact]}))
    assert ai.extract_document([{"page": 1, "text": fact["quote"]}])[0].unit == "/min"
    fact["unit"] = "mmHg"
    with pytest.raises(ValueError, match="unit is not present"):
        ai.extract_document([{"page": 1, "text": fact["quote"]}])
