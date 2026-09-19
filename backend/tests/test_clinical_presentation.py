import json

import pytest

from app import clinical_ai, llama_adapter
from app.ai import ModelUnavailable
from app.config import settings


def snapshot():
    return {
        "version": 2,
        "age": 45,
        "sex": "male",
        "facts": [
            {
                "id": "symptom",
                "source_id": "source1",
                "key": "symptom.complaint",
                "label": "Complaint",
                "value": "Кашель 3 дня",
                "confirmed": True,
                "assertion": "present",
            },
            {
                "id": "pulse",
                "source_id": "source2",
                "key": "vital.pulse",
                "label": "Pulse",
                "value": "70",
                "unit": "/min",
                "confirmed": True,
                "assertion": "present",
            },
        ],
    }


def result(*, english=False, questions=True):
    return {
        "case_version": 2,
        "summary": "A 45-year-old male with cough for 3 days and pulse 70/min."
        if english
        else "Мужчина 45 лет. Кашель 3 дня, пульс 70 /min.",
        "concerns": [],
        "limitations": ["The assessment needs clinician review."]
        if english
        else ["Оценка требует проверки врачом; клиническая валидация не выполнена."],
        "missing_fields": [],
        "assessment": {
            "status": "insufficient_data",
            "differential": [],
            "questions": ["Есть ли повышение температуры на фоне кашля?"] if questions else [],
        },
    }


def mocked_completions(monkeypatch, outputs):
    calls = []

    def complete(messages, schema):
        calls.append(messages)
        return json.dumps(outputs[min(len(calls) - 1, len(outputs) - 1)], ensure_ascii=False)

    monkeypatch.setattr(settings, "ai_backend", "llama_cpp")
    monkeypatch.setattr(llama_adapter, "complete", complete)
    return calls


def test_clinical_review_retries_observed_english_and_empty_questions_once(monkeypatch):
    calls = mocked_completions(monkeypatch, [result(english=True, questions=False), result()])
    reviewed = clinical_ai.review(snapshot())
    assert len(calls) == 2
    assert "пишите по-русски" in calls[0][1]["content"]
    assert "Исправьте формат" in calls[1][1]["content"]
    assert all(
        call[1]["content"].endswith(clinical_ai.language_instruction("ru")) for call in calls
    )
    assert reviewed["summary"] == result()["summary"]
    assert reviewed["assessment"]["status"] == "insufficient_data"
    assert reviewed["assessment"]["differential"] == []
    assert reviewed["assessment"]["questions"]
    assert reviewed["requires_clinician_review"] is True
    assert [entry["fact_id"] for entry in reviewed["evidence"]] == ["symptom", "pulse"]


def test_valid_russian_review_does_not_run_a_second_inference(monkeypatch):
    calls = mocked_completions(monkeypatch, [result()])
    assert (
        clinical_ai.review(snapshot())["clinical_prompt_version"]
        == clinical_ai.CLINICAL_PROMPT_VERSION
    )
    assert len(calls) == 1


def test_differential_prompt_keeps_observation_timing_and_medication_status(monkeypatch):
    data = snapshot()
    data["facts"][0].update(
        event_time="2026-09-01T10:00:00+05:00", available_time="2026-09-01T10:05:00+05:00"
    )
    data["facts"].append(
        {
            "id": "order",
            "source_id": "source3",
            "key": "medication.substance",
            "label": "Medication",
            "value": "Documented substance",
            "confirmed": True,
            "assertion": "present",
            "order_status": "stopped",
        }
    )
    output = result()
    output["summary"] = "Мужчина 45 лет; кашель отмечен 2026-09-01."
    calls = mocked_completions(monkeypatch, [output])
    reviewed = clinical_ai.review(data)
    assert len(calls) == 1
    context = json.loads(
        calls[0][1]["content"].split("UNTRUSTED CASE DATA\n")[1].split("\nEND DATA.")[0]
    )
    assert context["evidence"][0]["event_time"] == "2026-09-01T10:00:00+05:00"
    assert context["evidence"][0]["available_time"] == "2026-09-01T10:05:00+05:00"
    assert context["evidence"][-1]["order_status"] == "stopped"
    assert "fact_id" not in context["evidence"][0] and "source_id" not in context["evidence"][0]
    assert reviewed["summary"] == output["summary"]


@pytest.mark.parametrize(
    "bad_output,code",
    [
        (result(english=True), "AI_LANGUAGE_MISMATCH"),
        (result(questions=False), "MODEL_OUTPUT_REJECTED"),
    ],
)
def test_presentation_retry_is_bounded_and_never_publishes_unusable_prose(
    monkeypatch, bad_output, code
):
    calls = mocked_completions(monkeypatch, [bad_output])
    with pytest.raises(ModelUnavailable, match=code):
        clinical_ai.review(snapshot())
    assert len(calls) == 2


def test_russian_retry_still_rejects_invented_numeric_observations(monkeypatch):
    invented = result()
    invented["summary"] += " Температура 42."
    calls = mocked_completions(monkeypatch, [result(english=True), invented])
    with pytest.raises(ValueError, match="Unsupported numeric"):
        clinical_ai.review(snapshot())
    assert len(calls) == 2


def test_source_failure_is_rejected_without_a_presentation_retry(monkeypatch):
    invented = result(english=True)
    invented["assessment"] = {
        "status": "requires_clinician_review",
        "questions": [],
        "differential": [
            {
                "label": "Unsupported hypothesis",
                "supporting_refs": ["F99"],
                "opposing_refs": [],
                "verification_needed": "Check evidence.",
            },
        ],
    }
    calls = mocked_completions(monkeypatch, [invented, result()])
    with pytest.raises(ValueError, match="Unsupported or contradictory evidence"):
        clinical_ai.review(snapshot())
    assert len(calls) == 1
