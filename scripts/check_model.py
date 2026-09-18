"""Run real offline inference, without a fallback or fabricated answer."""
import json
import sys
import time
import argparse
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))
from app.ai import ModelUnavailable, extract_document, model_status, review  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--extract', action='store_true', help='Also test exact-quote document extraction (GGUF profile).')
parser.add_argument('--output', type=Path, help='Write the synthetic engineering smoke report as JSON.')
options = parser.parse_args()
status = model_status()
report = {'model': status, 'synthetic_only': True, 'clinical_validation': 'not_performed'}
print(json.dumps(status, indent=2))
try:
    started = time.monotonic()
    result = review({'version': 1, 'demo': True, 'age': 40, 'sex': 'unknown', 'summary': 'Synthetic engineering test.', 'facts': [{'id': 'smoke-fact', 'key': 'vital.pulse', 'value': '70', 'unit': '/min', 'source_id': 'smoke-source', 'confirmed': True}]}, {'completed': [], 'not_evaluable': []}, 'current', None)
    report['review'] = {'seconds': round(time.monotonic() - started, 2), 'result': result}
    if options.extract:
        started = time.monotonic()
        proposals = extract_document([{'page': 1, 'text': 'Synthetic engineering record. Pulse: 70 /min. SpO2: 97%.'}])
        report['extraction'] = {'seconds': round(time.monotonic() - started, 2), 'facts': [fact.model_dump() for fact in proposals]}
except ModelUnavailable as error:
    sys.exit(f'Inference unavailable: {error}')
print(json.dumps(report, ensure_ascii=False, indent=2))
if options.output:
    options.output.parent.mkdir(parents=True, exist_ok=True)
    options.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
if options.extract and not report['extraction']['facts']:
    sys.exit('Inference ran but extraction returned no facts for the explicit synthetic sample.')
print('REAL LOCAL INFERENCE PASSED. Clinical validation has not been performed.')
