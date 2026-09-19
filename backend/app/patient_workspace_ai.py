"""Compact, cited clinical comparison; no calibrated prognosis is claimed.

Keep the public import surface and provider orchestration here. Pure result
contracts, versioned instructions and evidence checks live in clinical_comparison.
"""

import json
from time import monotonic

from pydantic import ValidationError

from .ai_locale import (
    OutputLanguageMismatch,
    language_instruction,
    normalize_language,
    validate_prose_language,
)
from .clinical_comparison.grounding import (
    comparison_prose,
    contradictory_dose_claim as contradictory_dose_claim,
    evidence_context,
    numeric_values as numeric_values,
    validate_comparison,
    validate_inline_references as validate_inline_references,
)
from .clinical_comparison.models import (
    CitedObservation as CitedObservation,
    ComparisonResult,
    DiagnosisPass,
    FiveYearOutlook as FiveYearOutlook,
    OutlookScenario as OutlookScenario,
    ReviewSection as ReviewSection,
    TreatmentPass,
)
from .clinical_comparison.prompts import (
    DIAGNOSIS_TASK,
    PHASE_REQUESTS,
    PROMPT_VERSION as PROMPT_VERSION,
    SOURCE_POLICY,
    TREATMENT_TASK,
)
from .config import settings


def output_schema(snapshot, evidence, *, compact=False, phase=None):
    """Bound actual decoder output, not just an unenforced token instruction.

    The comparison reserves at least an 1800-token output budget. Broad response
    limits remain backward compatible while generation uses short complete
    sections. A compact retry still retains every section and evidence link.
    """
    from .ai_provider import is_openai

    schema = ComparisonResult.model_json_schema()
    # The local 4B decoder uses shorter lists. OpenAI can cite all five clinical
    # categories within the existing public eight-reference validation bound.
    reference_limit = 8 if is_openai() else 4
    schema["properties"]["case_version"] = {"type": "integer", "const": snapshot["version"]}
    schema["properties"]["summary"]["maxLength"] = 350 if compact else 400
    for name, normal, shorter, length in (
        ("supporting", 2, 1, None),
        ("discrepancies", 1, 1, None),
        ("questions", 2, 1, 250),
        ("next_steps", 2, 1, 250),
        ("limitations", 1, 1, 300),
    ):
        schema["properties"][name]["maxItems"] = shorter if compact else normal
        if length:
            schema["properties"][name]["items"]["maxLength"] = length
    for definition in ("CitedObservation", "ReviewSection", "OutlookScenario"):
        properties = schema["$defs"][definition]["properties"]
        properties["refs"]["items"] = {"type": "string", "enum": [item["ref"] for item in evidence]}
        properties["refs"]["maxItems"] = reference_limit
        for field in ("text", "summary", "scenario", "conditions", "monitoring"):
            if field in properties:
                # Tight character limits made the grammar force a quote in the
                # middle of a word. Reduce list counts, not sentence headroom.
                properties[field]["maxLength"] = 350
    outlook = schema["$defs"]["FiveYearOutlook"]
    outlook["properties"]["summary"]["maxLength"] = 350
    # Constrain status/list agreement in the decoder as well as the validator.
    schema["$defs"]["FiveYearOutlook"] = {
        "anyOf": [
            {
                **outlook,
                "properties": {
                    **outlook["properties"],
                    "status": {"type": "string", "const": status},
                    "scenarios": {
                        **outlook["properties"]["scenarios"],
                        "minItems": minimum,
                        "maxItems": maximum,
                    },
                },
            }
            for status, minimum, maximum in [
                ("insufficient_data", 0, 0),
                ("qualitative_only", 1, 1),
            ]
        ]
    }
    if phase is not None:
        model = DiagnosisPass if phase == "diagnosis" else TreatmentPass
        fields = list(model.model_fields)
        schema["title"] = model.__name__
        schema["properties"] = {key: schema["properties"][key] for key in fields}
        schema["required"] = fields
        used = (
            ("CitedObservation", "ReviewSection")
            if phase == "diagnosis"
            else ("ReviewSection", "FiveYearOutlook", "OutlookScenario")
        )
        schema["$defs"] = {key: value for key, value in schema["$defs"].items() if key in used}
    return schema


def assemble_comparison(diagnosis, treatment):
    # This is a UI routing status, not synthesized clinical reasoning. Every
    # displayed medical sentence is generated and validated from original data.
    status = (
        "insufficient_data"
        if all(
            section["status"] == "insufficient_data"
            for section in (diagnosis["diagnosis_review"], treatment["treatment_review"])
        )
        else "requires_clinician_review"
    )
    return ComparisonResult.model_validate(
        {**diagnosis, **treatment, "status": status}
    ).model_dump()


def review(snapshot, language=None):
    from . import ai, ai_provider
    from .ai_provider import complete

    status = ai.model_status()
    if not status["ready"]:
        raise ai.ModelUnavailable(status["reason"])
    if settings.ai_backend != "llama_cpp" and not ai_provider.is_openai():
        raise ai.ModelUnavailable("CLINICAL_REVIEW_REQUIRES_GGUF_PROFILE")
    if not ai._lock.acquire(timeout=3):
        raise ai.ModelUnavailable("MODEL_BUSY")
    try:
        # Two normal stages share a five-minute maximum, including repairs and
        # HTTP preparation. A timeout is never retried and never publishes phase1.
        deadline = monotonic() + max(1, min(300, 2 * settings.inference_timeout_seconds))
        language = normalize_language(snapshot.get("language") if language is None else language)
        evidence = evidence_context(snapshot)
        context = {
            "case_version": snapshot["version"],
            "age": snapshot["age"],
            "sex": snapshot["sex"],
            "evidence": [
                {
                    k: item[k]
                    for k in (
                        "ref",
                        "category",
                        "text",
                        "key",
                        "assertion",
                        "event_time",
                        "available_time",
                        "order_status",
                    )
                    if k in item
                }
                for item in evidence
            ],
        }
        context["available_categories"] = {
            category: [item["ref"] for item in evidence if item["category"] == category]
            for category in dict.fromkeys(item["category"] for item in evidence)
        }
        instruction = language_instruction(language)
        output_tokens = max(1800, settings.max_new_tokens)
        original_data = (
            "UNTRUSTED PATIENT DATA\n" + json.dumps(context, ensure_ascii=False) + "\nEND DATA. "
        )
        diagnosis = None
        for phase, model, task in (
            ("diagnosis", DiagnosisPass, DIAGNOSIS_TASK),
            ("treatment", TreatmentPass, TREATMENT_TASK),
        ):
            correction = ""
            for attempt in range(2):
                schema = output_schema(snapshot, evidence, compact=bool(attempt), phase=phase)
                try:
                    remaining = deadline - monotonic()
                    if remaining <= 0:
                        raise ai.ModelUnavailable("MODEL_TIMEOUT")
                    response = complete(
                        [
                            {
                                "role": "system",
                                "content": SOURCE_POLICY + "\n" + instruction + "\n" + task,
                            },
                            {
                                "role": "user",
                                "content": original_data
                                + correction
                                + "\n"
                                + PHASE_REQUESTS[language][phase]
                                + "\n"
                                + instruction,
                            },
                        ],
                        schema,
                        max_tokens=output_tokens,
                        timeout_seconds=min(settings.inference_timeout_seconds, remaining),
                    )
                    if monotonic() >= deadline:
                        raise ai.ModelUnavailable("MODEL_TIMEOUT")
                    part = model.model_validate_json(response).model_dump()
                    if part["case_version"] != snapshot["version"]:
                        raise ValueError("Output version mismatch")
                    if phase == "diagnosis":
                        validate_comparison(part, snapshot, evidence, diagnostic_pass=True)
                        validate_prose_language(comparison_prose(part), language)
                        diagnosis = part
                    else:
                        result = assemble_comparison(diagnosis, part)
                        validate_comparison(result, snapshot, evidence)
                        validate_prose_language(comparison_prose(result), language)
                except ai.ModelUnavailable as exc:
                    if str(exc) != "MODEL_OUTPUT_INCOMPLETE" or attempt:
                        raise
                    correction = (
                        "\nThe previous response exceeded its output budget. Return compact JSON with "
                        "one brief sentence per field and at most one item per list. Preserve all "
                        "required sections, true evidence references and uncertainty. Do not repeat the history."
                    )
                    continue
                except ValueError as exc:
                    if attempt:
                        code = (
                            "AI_LANGUAGE_MISMATCH"
                            if isinstance(exc, OutputLanguageMismatch)
                            else "MODEL_OUTPUT_REJECTED"
                        )
                        raise ai.ModelUnavailable(code) from exc
                    # Send only a validator-produced reason, never rejected model
                    # prose or the first pass's diagnostic hypothesis as evidence.
                    reason = (
                        str(exc) if not isinstance(exc, ValidationError) else "JSON schema mismatch"
                    )
                    correction = (
                        "\nYour previous response failed validation: "
                        + reason
                        + ". Produce a corrected response. Do not invent evidence to satisfy validation."
                    )
                    continue
                break
        return {
            **result,
            "evidence": evidence,
            "requires_clinician_review": True,
            "validated_probability": False,
            "horizon_years": 5,
            "language": language,
            "evaluated_conclusion_id": snapshot["evaluated_conclusion_id"],
            **ai_provider.result_metadata(),
        }
    finally:
        ai._lock.release()
