import copy
import json

import httpx
import pytest
from pydantic import SecretStr

from app import ai_provider, openai_adapter
from app.ai import ModelUnavailable
from app.config import Settings, settings
from app.patient_workspace_ai import ComparisonResult


@pytest.fixture
def remote(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", SecretStr("synthetic-test-secret"))
    monkeypatch.setattr(settings, "openai_model", "gpt-5.6-luna")
    openai_adapter._health.clear()
    yield
    openai_adapter._health.clear()


def response(text='{"answer":"Synthetic result"}', **extra):
    return {
        "status": "completed",
        "model": "gpt-5.6-luna",
        "output": [
            {"type": "reasoning", "summary": []},
            {"type": "message", "content": [{"type": "output_text", "text": text}]},
        ],
        **extra,
    }


def mock_http(monkeypatch, handle):
    real = httpx.Client
    monkeypatch.setattr(
        openai_adapter.httpx,
        "Client",
        lambda **kw: real(transport=httpx.MockTransport(handle), **kw),
    )


def test_server_only_key_is_excluded_from_settings_serialization_and_repr():
    config = Settings(_env_file=None, openai_api_key="synthetic-test-secret")
    assert "openai_api_key" not in config.model_dump()
    assert "synthetic-test-secret" not in repr(config)


def test_responses_request_has_strict_structure_no_storage_and_text_image_transport(
    remote, monkeypatch
):
    captured = []

    def handle(request):
        assert str(request.url) == "https://api.openai.com/v1/responses"
        assert request.headers["authorization"] == "Bearer synthetic-test-secret"
        captured.append(json.loads(request.content))
        return httpx.Response(200, json=response())

    mock_http(monkeypatch, handle)
    messages = [
        {"role": "system", "content": "Reply in Uzbek."},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Synthetic phantom only."},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}},
            ],
        },
    ]
    raw = ai_provider.complete(
        messages, {"type": "object", "properties": {"answer": {"type": "string"}}}, max_tokens=1200
    )
    assert json.loads(raw)["answer"] == "Synthetic result"
    body = captured[0]
    assert body["store"] is False and body["truncation"] == "disabled"
    assert body["model"] == "gpt-5.6-luna" and body["reasoning"]["effort"] == "high"
    assert body["max_output_tokens"] >= 8192
    assert body["text"]["format"]["strict"] is True
    assert body["text"]["format"]["schema"]["required"] == ["answer"]
    assert body["text"]["format"]["schema"]["additionalProperties"] is False
    assert body["input"][1]["content"][1]["type"] == "input_image"
    assert "temperature" not in body and "seed" not in body
    assert "synthetic-test-secret" not in json.dumps(body)
    assert ai_provider.result_metadata()["provenance"] == "openai_api"


def test_schema_conversion_keeps_original_medical_validation_unchanged():
    original = ComparisonResult.model_json_schema()
    before = copy.deepcopy(original)
    adapted = openai_adapter.strict_schema(original)
    assert original == before
    assert adapted["$defs"]["ReviewSection"]["required"] == ["status", "summary", "refs"]
    assert adapted["properties"]["questions"]["maxItems"] == 4
    assert "maxLength" not in adapted["properties"]["summary"]
    assert before["properties"]["summary"]["maxLength"] == 1000


def test_schema_metadata_does_not_remove_legitimate_field_names():
    from app.ai import AIResult

    original = AIResult.model_json_schema()
    adapted = openai_adapter.strict_schema(original)
    assert "title" in adapted["$defs"]["AIConcern"]["properties"]
    assert "title" in adapted["$defs"]["AIConcern"]["required"]
    assert set(adapted["$defs"]["AIConcern"]["properties"]) == set(
        original["$defs"]["AIConcern"]["properties"]
    )
    names = ["title", "default", "minLength", "maxLength"]
    collision = {
        "type": "object",
        "properties": {name: {"type": "string", "title": name} for name in names},
    }
    converted = openai_adapter.strict_schema(collision)
    assert list(converted["properties"]) == names
    assert converted["required"] == names


@pytest.mark.parametrize(
    "http_status,error,expected",
    [
        (401, "invalid_api_key", "OPENAI_AUTH_ERROR"),
        (403, "permission_denied", "OPENAI_MODEL_UNAVAILABLE"),
        (404, "model_not_found", "OPENAI_MODEL_UNAVAILABLE"),
        (429, "insufficient_quota", "OPENAI_QUOTA_EXCEEDED"),
        (429, "rate_limit_exceeded", "OPENAI_RATE_LIMIT"),
        (400, "invalid_json_schema", "OPENAI_INVALID_REQUEST"),
        (500, "server_error", "OPENAI_UNAVAILABLE"),
    ],
)
def test_provider_failures_are_sanitized_without_fake_fallback(
    remote, monkeypatch, http_status, error, expected
):
    calls = []

    def handle(request):
        calls.append(request.url.path)
        return httpx.Response(
            http_status,
            json={"error": {"code": error, "message": "synthetic-test-secret patient data"}},
        )

    mock_http(monkeypatch, handle)
    with pytest.raises(ModelUnavailable) as caught:
        ai_provider.complete([], {"type": "object", "properties": {}})
    assert str(caught.value) == expected
    assert calls == ["/v1/responses"]


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({"status": "incomplete"}, "MODEL_OUTPUT_INCOMPLETE"),
        ({"status": "failed"}, "MODEL_OUTPUT_REJECTED"),
        (response(text="broken json"), "MODEL_OUTPUT_REJECTED"),
        (response(text="[]"), "MODEL_OUTPUT_REJECTED"),
        (
            response(
                output=[{"type": "message", "content": [{"type": "refusal", "refusal": "No"}]}]
            ),
            "AI_RESPONSE_REFUSED",
        ),
    ],
)
def test_incomplete_refused_or_malformed_responses_never_publish(payload, expected):
    with pytest.raises(ModelUnavailable, match=expected):
        openai_adapter.response_text(payload)


def test_missing_key_and_input_limit_prevent_network(remote, monkeypatch):
    mock_http(monkeypatch, lambda request: pytest.fail("Network must not be called"))
    monkeypatch.setattr(settings, "openai_api_key", SecretStr(""))
    assert openai_adapter.status()["reason"] == "OPENAI_API_KEY_MISSING"
    with pytest.raises(ModelUnavailable, match="OPENAI_API_KEY_MISSING"):
        openai_adapter.complete([], {})
    monkeypatch.setattr(settings, "openai_api_key", SecretStr("synthetic-test-secret"))
    monkeypatch.setattr(settings, "openai_max_input_chars", 10)
    with pytest.raises(ModelUnavailable, match="MODEL_INPUT_TOO_LONG"):
        openai_adapter.complete([{"role": "user", "content": "Long synthetic document"}], {})


def test_model_health_is_cached_without_exposing_credentials(remote, monkeypatch):
    calls = []

    def handle(request):
        calls.append(request.url.path)
        return httpx.Response(200, json={"id": "gpt-5.6-luna"})

    mock_http(monkeypatch, handle)
    first, second = openai_adapter.status(), openai_adapter.status()
    assert first == second and first["ready"] and first["connection_verified"]
    assert calls == ["/v1/models/gpt-5.6-luna"]
    assert "synthetic-test-secret" not in json.dumps(first)


def test_expired_response_is_never_published(remote, monkeypatch):
    ticks = iter([10.0, 10.0, 30.0])
    monkeypatch.setattr(openai_adapter, "monotonic", lambda: next(ticks))
    mock_http(monkeypatch, lambda request: httpx.Response(200, json=response()))
    with pytest.raises(ModelUnavailable, match="MODEL_TIMEOUT"):
        openai_adapter.complete([], {}, timeout_seconds=5)


def test_preparation_timeout_sends_no_billed_request(remote, monkeypatch):
    ticks = iter([10.0, 16.0])
    monkeypatch.setattr(openai_adapter, "monotonic", lambda: next(ticks))
    mock_http(monkeypatch, lambda request: pytest.fail("Expired request must not be sent"))
    with pytest.raises(ModelUnavailable, match="MODEL_TIMEOUT"):
        openai_adapter.complete([], {}, timeout_seconds=5)


def test_explicit_local_provider_wins_over_stale_cloud_backend(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "local_medgemma")
    monkeypatch.setattr(settings, "ai_backend", "openai")
    assert ai_provider.is_openai() is False
