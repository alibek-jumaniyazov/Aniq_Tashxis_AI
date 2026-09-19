"""Check the configured AI provider using authored synthetic input only.

Normal mode performs real inference and may call a paid external AI service.
Use --status-only to check availability without generating a model response.
"""

import argparse
import json
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.ai import ModelUnavailable, extract_document, model_status, review  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--extract",
    action="store_true",
    help="Also test exact-quote document extraction with the configured provider.",
)
parser.add_argument(
    "--language",
    choices=["ru", "uz", "en"],
    default="uz",
    help="Output language for the synthetic smoke test (default: uz).",
)
parser.add_argument(
    "--status-only",
    action="store_true",
    help="Check provider availability without inference; cloud status may contact the provider.",
)
parser.add_argument(
    "--output", type=Path, help="Write the synthetic engineering smoke report as JSON."
)
options = parser.parse_args()
if options.status_only and options.extract:
    parser.error("--extract cannot be combined with --status-only")
status = model_status()
report = {
    "model": status,
    "synthetic_only": True,
    "language": options.language,
    "clinical_validation": "not_performed",
}
print(json.dumps(status, indent=2))
if options.status_only:
    if options.output:
        options.output.parent.mkdir(parents=True, exist_ok=True)
        options.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    sys.exit(0 if status.get("ready") else 1)
try:
    started = time.monotonic()
    result = review(
        {
            "version": 1,
            "demo": True,
            "language": options.language,
            "age": 40,
            "sex": "unknown",
            "summary": "Synthetic engineering test.",
            "facts": [
                {
                    "id": "smoke-fact",
                    "key": "vital.pulse",
                    "label": "Pulse",
                    "value": "70",
                    "unit": "/min",
                    "source_id": "smoke-source",
                    "confirmed": True,
                }
            ],
        },
        {"completed": [], "not_evaluable": []},
        "current",
        None,
    )
    report["review"] = {"seconds": round(time.monotonic() - started, 2), "result": result}
    if options.extract:
        started = time.monotonic()
        # Extraction preserves exact source quotations and has no locale input.
        proposals = extract_document(
            [{"page": 1, "text": "Synthetic engineering record. Pulse: 70 /min. SpO2: 97%."}]
        )
        report["extraction"] = {
            "seconds": round(time.monotonic() - started, 2),
            "facts": [fact.model_dump() for fact in proposals],
        }
except ModelUnavailable as error:
    sys.exit(f"Inference unavailable: {error}")
print(json.dumps(report, ensure_ascii=False, indent=2))
if options.output:
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
if options.extract and not report["extraction"]["facts"]:
    sys.exit("Inference ran but extraction returned no facts for the explicit synthetic sample.")
print(
    f"REAL INFERENCE PASSED. Provider: {status.get('provider', status.get('backend', 'configured'))}; model: {status.get('model_id', 'configured')}; language: {options.language}. Clinical validation has not been performed."
)
