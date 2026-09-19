import copy
import json
from types import SimpleNamespace

import httpx
import pytest

from app import ai, radiology
from app.config import settings
from app.db import Record, SessionLocal
from test_radiology_workflow import upload_study
from test_workflows import mutate


PROSE = {
    "ru": (
        "На кадре виден градиент интенсивности.",
        "Один кадр не позволяет оценить всё исследование.",
        "Для проверки заключения требуется полное исследование.",
        "Просмотрите все исходные серии.",
    ),
    "uz": (
        "Ushbu tasvirda intensivlik gradienti ko‘rinadi.",
        "Bu tasvir bilan barcha seriyalarni baholash mumkin emas.",
        "Xulosani tekshirish uchun to‘liq tekshiruv kerak.",
        "Barcha asl seriyalarni ko‘rib chiqing.",
    ),
    "en": (
        "The image shows an intensity gradient.",
        "A single frame cannot assess the entire study.",
        "The complete study is needed to assess the report.",
        "Review every original series.",
    ),
}


def localized_output(language, *, sample=False):
    observation, limitation, explanation, point = PROSE[language]
    output = {
        "observations": [observation],
        "limitations": [limitation],
        "report_comparison": {
            "status": "not_assessable",
            "explanation": explanation,
            "points_to_verify": [point],
        },
    }
    if sample:
        output["frame_assessments"] = [
            {
                "frame_ref": f"F{i + 1}",
                "quality": "limited",
                "observations": [observation],
                "limitations": [limitation],
            }
            for i in range(3)
        ]
        output["report_comparison"]["frame_refs"] = []
    return output


def queue_mock_review(client, case, monkeypatch, outputs, *, language="ru", sample=False):
    study, body = upload_study(client, case)
    # Synthetic fixture pixels, with the automatic phantom-comparison override
    # disabled to exercise validation of the actual model comparison prose.
    with SessionLocal() as db:
        record = db.get(Record, study["id"])
        record.data = {**record.data, "synthetic_phantom": False}
        db.commit()
    captured = []
    real_client = httpx.Client

    def respond(request):
        captured.append(
            {"body": json.loads(request.content), "timeout": request.extensions["timeout"]["read"]}
        )
        output = outputs[min(len(captured) - 1, len(outputs) - 1)]
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": json.dumps(output, ensure_ascii=False)},
                    }
                ]
            },
        )

    monkeypatch.setattr(settings, "ai_backend", "llama_cpp")
    monkeypatch.setattr(ai, "model_status", lambda: {"ready": True, "vision_ready": True})
    monkeypatch.setattr(
        radiology.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(respond), **kwargs),
    )
    report = "Исходное заключение врача на русском языке. Требуется проверка."
    response = mutate(
        client,
        f"/imaging-studies/{study['id']}/analyses",
        {
            **body,
            "analysis_scope": "study_sample" if sample else "selected_frame",
            "radiologist_report": report,
            "language": language,
        },
    )
    assert response.status_code == 202, response.text
    result = client.get("/api/v1/analyses/" + response.json()["run_id"]).json()["result"]
    assert (
        result["radiologist_report"] == report
    )  # Source prose is never translated or language-rejected.
    return result, captured


@pytest.mark.parametrize("language", ["ru", "uz", "en"])
@pytest.mark.parametrize("sample", [False, True])
def test_selected_language_covers_observations_frames_and_comparison(
    client, case, monkeypatch, language, sample
):
    output = localized_output(language, sample=sample)
    result, captured = queue_mock_review(
        client, case, monkeypatch, [output], language=language, sample=sample
    )
    assert result["image_review"] == output
    assert result["language"] == language
    assert result["image_coverage"]["reviewed_frames"] == (3 if sample else 1)
    assert result["image_coverage"]["full_study_review"] is False
    assert result["clinical_validation"] == "not_validated"
    assert len(captured) == 1
    expected = {"ru": "in Russian", "uz": "in Uzbek using the Latin alphabet", "en": "in English"}[
        language
    ]
    assert expected in captured[0]["body"]["messages"][0]["content"]
    assert expected in captured[0]["body"]["messages"][1]["content"][-1]["text"]
    labels = [
        item["text"]
        for item in captured[0]["body"]["messages"][1]["content"]
        if item["type"] == "text"
    ]
    assert any("window center" in text and "/ width" in text for text in labels)


@pytest.mark.parametrize("field", ["observation", "frame_limitation", "comparison", "next_step"])
def test_wrong_language_retries_once_with_same_images_and_validates_all_sections(
    client, case, monkeypatch, field
):
    correct = localized_output("uz", sample=True)
    wrong = copy.deepcopy(correct)
    russian = "Необходимо просмотреть исходное исследование пациента целиком."
    if field == "observation":
        wrong["observations"] = [russian]
    elif field == "frame_limitation":
        wrong["frame_assessments"][2]["limitations"] = [russian]
    elif field == "comparison":
        wrong["report_comparison"]["explanation"] = russian
    else:
        wrong["report_comparison"]["points_to_verify"] = [russian]
    result, captured = queue_mock_review(
        client, case, monkeypatch, [wrong, correct], language="uz", sample=True
    )
    assert len(captured) == 2
    assert "LANGUAGE CORRECTION" in captured[1]["body"]["messages"][0]["content"]
    assert captured[0]["body"]["messages"][1] == captured[1]["body"]["messages"][1]
    assert len(captured[1]["body"]["messages"]) == 2  # Rejected prose is not fed back as context.
    assert result["image_review"] == correct
    assert not result["limitations"]
    assert (
        0 < captured[1]["timeout"] <= captured[0]["timeout"] <= settings.inference_timeout_seconds
    )


def test_repeated_language_mismatch_never_publishes_wrong_language_or_coverage(
    client, case, monkeypatch
):
    result, captured = queue_mock_review(
        client, case, monkeypatch, [localized_output("en")], language="ru"
    )
    assert len(captured) == 2
    assert result["image_review"] is None
    assert result["limitations"] == ["AI_LANGUAGE_MISMATCH"]
    assert result["image_coverage"]["reviewed_frames"] == 0
    assert result["image_coverage"]["reviewed_series"] == 0


@pytest.mark.parametrize("english", ["Visible intensity gradient.", "Synthetic image."])
def test_short_english_frame_prose_is_retried_for_uzbek(client, case, monkeypatch, english):
    correct = localized_output("uz", sample=True)
    mixed = copy.deepcopy(correct)
    mixed["frame_assessments"][1]["observations"] = [english]
    result, captured = queue_mock_review(
        client, case, monkeypatch, [mixed, correct], language="uz", sample=True
    )
    assert len(captured) == 2
    assert result["image_review"] == correct


def test_language_retry_does_not_receive_a_fresh_full_timeout(client, case, monkeypatch):
    monkeypatch.setattr(settings, "inference_timeout_seconds", 150)
    ticks = iter([100.0, 100.0, 248.0])
    monkeypatch.setattr(radiology, "time", SimpleNamespace(monotonic=lambda: next(ticks)))
    result, captured = queue_mock_review(
        client, case, monkeypatch, [localized_output("en"), localized_output("ru")]
    )
    assert [request["timeout"] for request in captured] == [150.0, 2.0]
    assert result["image_review"] == localized_output("ru")


def test_language_retry_stops_when_elapsed_budget_is_exhausted(client, case, monkeypatch):
    monkeypatch.setattr(settings, "inference_timeout_seconds", 150)
    ticks = iter([100.0, 100.0, 251.0])
    monkeypatch.setattr(radiology, "time", SimpleNamespace(monotonic=lambda: next(ticks)))
    result, captured = queue_mock_review(client, case, monkeypatch, [localized_output("en")])
    assert len(captured) == 1
    assert result["image_review"] is None and result["limitations"] == ["AI_LANGUAGE_MISMATCH"]


def test_correct_language_on_retry_cannot_bypass_frame_evidence_validation(
    client, case, monkeypatch
):
    wrong_language = localized_output("en", sample=True)
    invalid_evidence = localized_output("ru", sample=True)
    invalid_evidence["report_comparison"].update(status="possible_discrepancy", frame_refs=["F4"])
    result, captured = queue_mock_review(
        client, case, monkeypatch, [wrong_language, invalid_evidence], sample=True
    )
    assert len(captured) == 2
    assert result["image_review"] is None and result["limitations"] == ["MODEL_OUTPUT_REJECTED"]
    assert result["image_coverage"]["reviewed_frames"] == 0


def test_single_frame_comparison_cannot_claim_support_without_an_observation(
    client, case, monkeypatch
):
    output = localized_output("ru")
    output["observations"] = []
    output["report_comparison"]["status"] = "supported_on_selected_frame"
    result, captured = queue_mock_review(client, case, monkeypatch, [output])
    assert len(captured) == 1
    assert result["image_review"] is None and result["limitations"] == ["MODEL_OUTPUT_REJECTED"]
