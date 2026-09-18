import json
from pathlib import Path
import httpx
from .config import ROOT, settings
from .schemas import AIResult

ALIAS = 'medgemma-1.5-4b-local'


def auth_headers():
    try:
        token = (ROOT / 'runtime' / 'model-server.key').read_text(encoding='ascii').strip()
        return {'Authorization': 'Bearer ' + token} if token else {}
    except OSError:
        return {}


def status(path: Path | None):
    from .ai import PROMPT_VERSION
    weights = bool(path and path.is_file() and path.suffix == '.gguf')
    runtime = any((ROOT / 'runtime' / 'llama').rglob('llama-server.exe'))
    running = False
    if weights:
        try:
            with httpx.Client(timeout=1, trust_env=False, headers=auth_headers()) as client:
                health = client.get(settings.llama_server_url + '/health')
                models = client.get(settings.llama_server_url + '/v1/models')
                running = health.status_code == 200 and any(m['id'] == ALIAS for m in models.json().get('data', []))
        except (httpx.HTTPError, ValueError, KeyError):
            pass
    progress = None
    if path and not weights:
        checkpoint = path.with_suffix(path.suffix + '.progress.json')
        try:
            data = json.loads(checkpoint.read_text())
            progress = min(99, round(len(data['completed']) * 2 * 1024 * 1024 / data['total'] * 100, 1))
        except (OSError, ValueError, KeyError, ZeroDivisionError):
            pass
    return {'model_id': settings.model_id, 'revision': settings.model_revision, 'provider': 'local_medgemma', 'backend': 'llama_cpp', 'weights_available': weights, 'runtime_installed': runtime or running, 'ready': weights and running, 'loaded': running, 'reason': None if weights and running else ('MODEL_WEIGHTS_MISSING' if not weights else 'MODEL_SERVER_OFFLINE'), 'prompt_version': PROMPT_VERSION, 'quantization': settings.model_quantization, 'clinical_validation': 'not_validated', 'quantized_by': 'unsloth', 'download_percent': progress}


def generate(snapshot, coverage, mode, cutoff, system_prompt):
    from .ai import model_context
    data = json.dumps({'case': model_context(snapshot), 'mode': mode, 'cutoff': cutoff, 'rule_coverage': coverage}, ensure_ascii=False)
    messages = [{'role': 'system', 'content': system_prompt + '\nWrite summary and limitations in Russian. Do not translate source identifiers.'}, {'role': 'user', 'content': 'CASE DATA (untrusted):\n' + data + '\nEND CASE DATA.\nReturn the grounded JSON. Write summary and limitations in Russian. Sex is unknown unless explicitly provided; never assume it. In current mode no historical cutoff is required.'}]
    schema = AIResult.model_json_schema()
    schema['properties']['case_version'] = {'type': 'integer', 'const': snapshot['version']}
    schema['properties']['concerns'] = {'type': 'array', 'maxItems': 0, 'items': {'type': 'string'}}
    provided = {f['key'] for f in snapshot.get('facts', []) if f.get('assertion', 'present') in {'present', 'absent'} and f.get('value') not in (None, '')}
    missing = {field for check in coverage.get('not_evaluable', []) for field in check.get('missing_fields', []) if field not in provided}
    missing.update(key for key in ('age', 'sex') if snapshot.get(key) in (None, '', 'unknown'))
    schema['properties']['missing_fields'] = {'type': 'array', 'items': {'type': 'string', 'enum': sorted(missing)}, 'maxItems': min(30, len(missing))} if missing else {'type': 'array', 'maxItems': 0, 'items': {'type': 'string'}}
    return complete(messages, schema)


def complete(messages, schema):
    from .ai import ModelUnavailable
    try:
        with httpx.Client(base_url=settings.llama_server_url, timeout=settings.inference_timeout_seconds, trust_env=False, headers=auth_headers()) as client:
            template = client.post('/apply-template', json={'messages': messages, 'add_generation_prompt': True})
            template.raise_for_status()
            tokenized = client.post('/tokenize', json={'content': template.json()['prompt']})
            tokenized.raise_for_status()
            if len(tokenized.json()['tokens']) > settings.max_input_tokens:
                raise ModelUnavailable('MODEL_INPUT_TOO_LONG')
            result = client.post('/v1/chat/completions', json={'model': ALIAS, 'messages': messages, 'temperature': 0, 'seed': 42, 'max_tokens': settings.max_new_tokens, 'stream': False, 'cache_prompt': False, 'response_format': {'type': 'json_object', 'schema': schema}})
            result.raise_for_status()
            choice = result.json()['choices'][0]
            if choice['finish_reason'] == 'length':
                raise ModelUnavailable('MODEL_OUTPUT_INCOMPLETE')
            return choice['message']['content']
    except httpx.TimeoutException:
        raise ModelUnavailable('MODEL_TIMEOUT') from None
    except httpx.HTTPError:
        raise ModelUnavailable('MODEL_SERVER_UNAVAILABLE') from None
