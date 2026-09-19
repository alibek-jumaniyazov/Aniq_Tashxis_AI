"""Explicit provider routing. Never silently replace or mislabel an AI provider."""

from .config import settings


def is_openai():
    # The explicit provider decides whether data may leave this server. A stale
    # backend option must never override a deliberate return to local processing.
    return settings.ai_provider == "openai"


def complete(messages, schema, *, max_tokens=None, timeout_seconds=None):
    if is_openai():
        from . import openai_adapter

        return openai_adapter.complete(
            messages, schema, max_tokens=max_tokens, timeout_seconds=timeout_seconds
        )
    from . import llama_adapter

    options = {}
    if max_tokens is not None:
        options["max_tokens"] = max_tokens
    if timeout_seconds is not None:
        options["timeout_seconds"] = timeout_seconds
    return llama_adapter.complete(messages, schema, **options)


def model_status():
    if is_openai():
        from .openai_adapter import status

        return status()
    from .ai import model_status as local_status

    return local_status()


def result_metadata():
    if is_openai():
        return {
            "provider": "openai",
            "provenance": "openai_api",
            "model_id": settings.openai_model,
            "model_revision": "api-managed",
            "ai_backend": "openai",
            "quantization": None,
            "data_processing": "openai_cloud",
            "clinical_validation": "not_validated",
        }
    return {
        "provider": "local_medgemma",
        "provenance": "local_medgemma",
        "model_id": settings.model_id,
        "model_revision": settings.model_revision,
        "ai_backend": settings.ai_backend,
        "quantization": settings.model_quantization,
        "data_processing": "local",
        "clinical_validation": "not_validated",
    }
