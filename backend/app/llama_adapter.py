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
    vision = False
    if weights:
        try:
            with httpx.Client(timeout=1, trust_env=False, headers=auth_headers()) as client:
                health = client.get(settings.llama_server_url + '/health')
                models = client.get(settings.llama_server_url + '/v1/models')
                running = health.status_code == 200 and any(m['id'] == ALIAS for m in models.json().get('data', []))
                if running:
                    props = client.get(settings.llama_server_url + '/props')
                    vision = bool(props.status_code == 200 and props.json().get('modalities', {}).get('vision'))
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
    return {'model_id': settings.model_id, 'revision': settings.model_revision, 'provider': 'local_medgemma', 'backend': 'llama_cpp', 'vision_ready': vision, 'weights_available': weights, 'runtime_installed': runtime or running, 'ready': weights and running, 'loaded': running, 'reason': None if weights and running else ('MODEL_WEIGHTS_MISSING' if not weights else 'MODEL_SERVER_OFFLINE'), 'prompt_version': PROMPT_VERSION, 'quantization': settings.model_quantization, 'clinical_validation': 'not_validated', 'quantized_by': 'unsloth', 'download_percent': progress}


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


def completion_text(payload):
    """Only a finished text response can enter structured clinical validation."""
    from .ai import ModelUnavailable
    try:
        choice = payload['choices'][0]
        if choice['finish_reason'] == 'length':
            raise ModelUnavailable('MODEL_OUTPUT_INCOMPLETE')
        content = choice['message']['content']
        if choice['finish_reason'] != 'stop' or not isinstance(content, str) or not content.strip():
            raise ValueError('No completed text response')
        return content
    except (KeyError, IndexError, TypeError, ValueError):
        raise ModelUnavailable('MODEL_OUTPUT_REJECTED') from None


def complete(messages, schema, *, max_tokens=None):
    from .ai import ModelUnavailable
    try:
        with httpx.Client(base_url=settings.llama_server_url, timeout=settings.inference_timeout_seconds, trust_env=False, headers=auth_headers()) as client:
            template = client.post('/apply-template', json={'messages': messages, 'add_generation_prompt': True})
            template.raise_for_status()
            prompt = template.json()['prompt']
            if not isinstance(prompt, str):
                raise ValueError('Invalid rendered prompt')
            tokenized = client.post('/tokenize', json={'content': prompt})
            tokenized.raise_for_status()
            tokens = tokenized.json()['tokens']
            if not isinstance(tokens, list):
                raise ValueError('Invalid token list')
            if len(tokens) > settings.max_input_tokens:
                raise ModelUnavailable('MODEL_INPUT_TOO_LONG')
            output_tokens = settings.max_new_tokens if max_tokens is None else max_tokens
            if not isinstance(output_tokens, int) or isinstance(output_tokens, bool) or output_tokens < 1:
                raise ValueError('Invalid output token budget')
            if max_tokens is not None:
                # A comparison has more required JSON sections than a summary.
                # Reserve its explicit output budget before inference; never
                # truncate source evidence to make it fit the local context.
                props = client.get('/props')
                props.raise_for_status()
                context_tokens = props.json().get('default_generation_settings', {}).get('n_ctx')
                if not isinstance(context_tokens, int) or context_tokens < 1:
                    raise ValueError('Model context capacity unavailable')
                if len(tokens) + output_tokens + 16 > context_tokens:
                    raise ModelUnavailable('MODEL_INPUT_TOO_LONG')
            result = client.post('/v1/chat/completions', json={'model': ALIAS, 'messages': messages, 'temperature': 0, 'seed': 42, 'max_tokens': output_tokens, 'stream': False, 'cache_prompt': False, 'response_format': {'type': 'json_object', 'schema': schema}})
            result.raise_for_status()
            return completion_text(result.json())
    except httpx.TimeoutException:
        raise ModelUnavailable('MODEL_TIMEOUT') from None
    except httpx.HTTPError:
        raise ModelUnavailable('MODEL_SERVER_UNAVAILABLE') from None
    except (KeyError, IndexError, TypeError, ValueError):
        raise ModelUnavailable('MODEL_OUTPUT_REJECTED') from None
