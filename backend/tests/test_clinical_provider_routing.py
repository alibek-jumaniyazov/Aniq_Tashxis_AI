"""All clinical text transports use the active provider without changing validators."""

import copy
import json

import pytest

from app import ai, clinical_ai, patient_workspace_ai
from app.config import settings
from test_ai_locale import PROSE, comparison, snapshot

META = {
    "provider": "openai",
    "model_id": "test-openai-model",
    "model_revision": "test",
    "provenance": "openai",
    "ai_backend": "openai",
    "quantization": None,
}


@pytest.fixture
def provider(monkeypatch):
    from app import ai_provider, openai_adapter

    monkeypatch.setattr(ai_provider, "is_openai", lambda: True)
    monkeypatch.setattr(ai_provider, "model_status", lambda: {"ready": True, "provider": "openai"})
    monkeypatch.setattr(ai_provider, "result_metadata", lambda: dict(META))
    # OpenAI must work without local weights or a GGUF backend.
    monkeypatch.setattr(settings, "ai_backend", "transformers")
    monkeypatch.setattr(settings, "model_path", "")
    calls = []

    def install(output):
        def complete(messages, schema, **kwargs):
            calls.append((copy.deepcopy(messages), schema, kwargs))
            data = output(messages, schema) if callable(output) else output
            return json.dumps(
                {key: value for key, value in data.items() if key in schema["properties"]},
                ensure_ascii=False,
            )

        monkeypatch.setattr(openai_adapter, "complete", complete)
        return calls

    return install


@pytest.mark.parametrize("language", ["ru", "uz", "en"])
def test_provider_summary_keeps_language_and_omits_administrative_identifiers(provider, language):
    data = snapshot(language)
    data.update(full_name="PRIVATE-NAME", patient_phone="PRIVATE-PHONE", owner_id="PRIVATE-OWNER")
    data["facts"][0]["actor_id"] = "PRIVATE-ACTOR"
    calls = provider(
        {
            "case_version": 4,
            "summary": PROSE[language][0],
            "concerns": [],
            "limitations": [PROSE[language][2]],
            "missing_fields": [],
        }
    )
    result = ai.review(data, {}, "current", None)
    assert len(calls) == 1
    assert "PRIVATE-" not in json.dumps(calls[0][0])
    assert result["language"] == language
    assert all(result[key] == value for key, value in META.items())


@pytest.mark.parametrize("language", ["ru", "uz", "en"])
def test_provider_comparison_uses_phase_transport_and_truthful_metadata(provider, language):
    calls = provider(comparison(language))
    result = patient_workspace_ai.review(snapshot(language))
    assert len(calls) == 2
    assert calls[0][1]["title"] == "DiagnosisPass"
    assert calls[1][1]["title"] == "TreatmentPass"
    assert all(call[2]["timeout_seconds"] > 0 for call in calls)
    assert result["language"] == language
    assert all(result[key] == value for key, value in META.items())


def test_provider_comparison_still_rejects_invented_evidence(provider):
    output = comparison("en")
    output["supporting"][0]["refs"] = ["E404"]
    calls = provider(output)
    with pytest.raises(ai.ModelUnavailable, match="MODEL_OUTPUT_REJECTED"):
        patient_workspace_ai.review(snapshot("en"))
    assert len(calls) == 2
    assert not ai._lock.locked()


def test_provider_differential_preserves_confirmed_evidence_and_metadata(provider):
    data = snapshot("en")
    calls = provider(
        {
            "case_version": 4,
            "summary": PROSE["en"][0],
            "concerns": [],
            "limitations": [PROSE["en"][2]],
            "missing_fields": [],
            "assessment": {
                "status": "insufficient_data",
                "differential": [],
                "questions": ["Has the patient reported fever?"],
            },
        }
    )
    result = clinical_ai.review(data)
    assert len(calls) == 1
    assert result["provider"] == "openai"
    assert result["model_id"] == META["model_id"]
    assert result["evidence"]


def test_provider_extraction_preserves_source_quotes_and_excludes_page_metadata(provider):
    calls = provider(
        {
            "facts": [
                {
                    "key": "vital.pulse",
                    "label": "Pulse",
                    "value": "72",
                    "unit": "/min",
                    "assertion": "present",
                    "page": 1,
                    "quote": "Pulse 72 /min.",
                }
            ]
        }
    )
    result = ai.extract_document(
        [
            {
                "page": 1,
                "text": "Pulse 72 /min.",
                "patient_phone": "PRIVATE-PHONE",
                "actor_id": "PRIVATE-ACTOR",
            }
        ]
    )
    assert result[0].value == "72" and result[0].unit == "/min"
    assert "PRIVATE-" not in calls[0][0][1]["content"]


def test_provider_extraction_never_accepts_an_invented_quote(provider):
    provider(
        {
            "facts": [
                {
                    "key": "vital.pulse",
                    "label": "Pulse",
                    "value": "99",
                    "unit": "/min",
                    "assertion": "present",
                    "page": 1,
                    "quote": "Pulse 99 /min.",
                }
            ]
        }
    )
    with pytest.raises(ValueError, match="not grounded"):
        ai.extract_document([{"page": 1, "text": "Pulse 72 /min."}])


def test_comparison_job_persists_actual_provider_metadata(client, provider):
    from test_patient_workspace import compare, ready_case, report

    case = ready_case(client)
    provider(report(case["version"]))
    job = compare(client, case, language="ru")
    assert job["status"] == "succeeded", job
    assert all(job["result"][key] == value for key, value in META.items())
    assert job["result"]["comparison"]["provider"] == "openai"
    assert job["result"]["model_id"] != settings.model_id


def test_rules_only_job_does_not_claim_it_called_the_configured_model(client, provider):
    from test_workflows import new_case, run

    case = new_case(client)
    calls = provider({})
    job = run(client, case, include_ai=False)
    assert calls == []
    assert job["result"]["provenance"] == "documentation_rules"
    assert "model_id" not in job["result"]


def test_documentation_job_persists_actual_provider_metadata(client, provider):
    from test_workflows import add, fact, new_case, run

    case = new_case(client)
    add(client, case, [fact("vital.pulse", "72", unit="/min")])
    provider(
        lambda messages, schema: {
            "case_version": schema["properties"]["case_version"]["const"],
            "summary": "Зафиксирован пульс 72 /min.",
            "concerns": [],
            "limitations": ["Результат требует проверки врачом."],
            "missing_fields": [],
        }
    )
    job = run(client, case, include_ai=True, language="ru")
    assert job["result"]["ai"] is not None, job
    assert all(job["result"][key] == value for key, value in META.items())
    assert job["result"]["ai"]["provider"] == "openai"
