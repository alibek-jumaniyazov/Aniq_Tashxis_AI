"""Server-only OpenAI Responses transport; no raw API errors, keys or prompts logged."""

import copy
import hashlib
import json
import math
from time import monotonic

import httpx

from .config import settings

API_ORIGIN = "https://api.openai.com/v1"
_health = {}


def _key():
    return settings.openai_api_key.get_secret_value().strip()


def _identity():
    return (settings.openai_model, hashlib.sha256(_key().encode()).hexdigest())


def _error(response):
    """Public error codes only. Provider messages can contain request fragments."""
    try:
        detail = response.json().get("error", {})
        code = detail.get("code") or detail.get("type") or ""
    except (ValueError, AttributeError):
        code = ""
    if response.status_code == 401:
        return "OPENAI_AUTH_ERROR"
    if response.status_code == 429:
        return (
            "OPENAI_QUOTA_EXCEEDED"
            if code in {"insufficient_quota", "billing_hard_limit_reached"}
            else "OPENAI_RATE_LIMIT"
        )
    if response.status_code in {403, 404}:
        return "OPENAI_MODEL_UNAVAILABLE"
    if response.status_code == 400:
        return "OPENAI_INVALID_REQUEST"
    return "OPENAI_UNAVAILABLE"


def _remember(reason):
    _health.update(identity=_identity(), checked_at=monotonic(), reason=reason)


def status():
    configured = bool(_key())
    reason = "OPENAI_API_KEY_MISSING" if not configured else None
    verified = False
    if configured:
        if (
            _health.get("identity") != _identity()
            or monotonic() - _health.get("checked_at", 0) > 60
        ):
            try:
                with httpx.Client(
                    base_url=API_ORIGIN,
                    timeout=4,
                    trust_env=False,
                    follow_redirects=False,
                    headers={"Authorization": "Bearer " + _key()},
                ) as client:
                    response = client.get("/models/" + settings.openai_model)
                _remember(None if response.status_code == 200 else _error(response))
            except httpx.HTTPError:
                _remember("OPENAI_UNAVAILABLE")
        reason = _health.get("reason")
        verified = reason is None
    return {
        "provider": "openai",
        "backend": "openai",
        "model_id": settings.openai_model,
        "revision": "api-managed",
        "configured": configured,
        "ready": configured and verified,
        "connection_verified": verified,
        "loaded": False,
        "vision_ready": configured and verified,
        "weights_available": False,
        "runtime_installed": True,
        "reason": reason,
        "clinical_validation": "not_validated",
        "data_processing": "openai_cloud",
        "response_storage": False,
        "prompt_version": "openai-responses-1.0",
    }


def strict_schema(value):
    """Adapt Pydantic schemas to the strict Responses subset; local validators remain.

    String length limits are checked by the caller's original Pydantic model.
    No original schema is mutated, and no validation is bypassed on returned JSON.
    """
    if isinstance(value, list):
        return [strict_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        if key in {"default", "title", "minLength", "maxLength"}:
            continue
        if key in {"properties", "$defs", "definitions", "patternProperties"}:
            # Names in these maps are data: a field called "title" is not schema
            # metadata. Recurse into each field's schema, preserving its name.
            result[key] = {name: strict_schema(schema) for name, schema in item.items()}
        elif key in {"const", "enum"}:
            result[key] = copy.deepcopy(item)
        else:
            result[key] = strict_schema(item)
    if "const" in result:
        result["enum"] = [result.pop("const")]
    if result.get("type") == "object" or "properties" in result:
        result["additionalProperties"] = False
        result["required"] = list(result.get("properties", {}))
    return result


def response_input(messages):
    from .ai import ModelUnavailable

    result, text_length = [], 0
    for message in messages:
        role = message["role"]
        if role not in {"system", "developer", "user"}:
            raise ModelUnavailable("MODEL_OUTPUT_REJECTED")
        content = message["content"]
        content = [{"type": "text", "text": content}] if isinstance(content, str) else content
        parts = []
        for item in content:
            if item["type"] in {"text", "input_text"}:
                text_length += len(item["text"])
                parts.append({"type": "input_text", "text": item["text"]})
            elif item["type"] == "image_url":
                url = item["image_url"]["url"]
                # Only locally rendered frames, never arbitrary URLs from documents.
                if not url.startswith("data:image/png;base64,"):
                    raise ModelUnavailable("MODEL_OUTPUT_REJECTED")
                parts.append({"type": "input_image", "image_url": url, "detail": "high"})
            else:
                raise ModelUnavailable("MODEL_OUTPUT_REJECTED")
        result.append({"role": role, "content": parts})
    if text_length > settings.openai_max_input_chars:
        raise ModelUnavailable("MODEL_INPUT_TOO_LONG")
    return result


def response_text(payload):
    from .ai import ModelUnavailable

    if not isinstance(payload, dict):
        raise ModelUnavailable("MODEL_OUTPUT_REJECTED")
    if payload.get("status") == "incomplete":
        raise ModelUnavailable("MODEL_OUTPUT_INCOMPLETE")
    if payload.get("status") != "completed":
        raise ModelUnavailable("MODEL_OUTPUT_REJECTED")
    texts = []
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") == "refusal":
                raise ModelUnavailable("AI_RESPONSE_REFUSED")
            if part.get("type") == "output_text" and isinstance(part.get("text"), str):
                texts.append(part["text"])
    text = "".join(texts).strip()
    try:
        if not isinstance(json.loads(text), dict):
            raise ValueError
    except (ValueError, TypeError):
        raise ModelUnavailable("MODEL_OUTPUT_REJECTED") from None
    return text


def complete(messages, schema, *, max_tokens=None, timeout_seconds=None):
    from .ai import ModelUnavailable

    if not _key():
        raise ModelUnavailable("OPENAI_API_KEY_MISSING")
    budget = settings.inference_timeout_seconds if timeout_seconds is None else timeout_seconds
    if (
        isinstance(budget, bool)
        or not isinstance(budget, (int, float))
        or not math.isfinite(budget)
        or budget <= 0
    ):
        raise ModelUnavailable("MODEL_TIMEOUT")
    if max_tokens is not None and (
        isinstance(max_tokens, bool) or not isinstance(max_tokens, int) or max_tokens < 1
    ):
        raise ModelUnavailable("MODEL_OUTPUT_REJECTED")
    deadline = monotonic() + budget
    body = {
        "model": settings.openai_model,
        "input": response_input(messages),
        "store": False,
        "reasoning": {"effort": settings.openai_reasoning_effort},
        # Responses counts reasoning tokens inside this budget as well.
        "max_output_tokens": max(settings.openai_max_output_tokens, max_tokens or 0),
        "text": {
            "format": {
                "type": "json_schema",
                "name": "clinical_result",
                "strict": True,
                "schema": strict_schema(schema),
            }
        },
        "truncation": "disabled",
    }
    try:
        with httpx.Client(
            base_url=API_ORIGIN,
            timeout=budget,
            trust_env=False,
            follow_redirects=False,
            headers={"Authorization": "Bearer " + _key()},
        ) as client:
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise ModelUnavailable("MODEL_TIMEOUT")
            response = client.post("/responses", json=body, timeout=remaining)
        if response.status_code != 200:
            reason = _error(response)
            if reason in {
                "OPENAI_AUTH_ERROR",
                "OPENAI_QUOTA_EXCEEDED",
                "OPENAI_MODEL_UNAVAILABLE",
                "OPENAI_UNAVAILABLE",
            }:
                _remember(reason)
            raise ModelUnavailable(reason)
        if monotonic() >= deadline:
            raise ModelUnavailable("MODEL_TIMEOUT")
        text = response_text(response.json())
        _remember(None)
        return text
    except httpx.TimeoutException:
        raise ModelUnavailable("MODEL_TIMEOUT") from None
    except httpx.HTTPError:
        raise ModelUnavailable("OPENAI_UNAVAILABLE") from None
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ModelUnavailable("MODEL_OUTPUT_REJECTED") from None
