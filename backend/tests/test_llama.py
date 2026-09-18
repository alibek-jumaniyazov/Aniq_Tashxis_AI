import json
import httpx
import pytest
from app.config import Settings, settings
from app import llama_adapter
from app.ai import ModelUnavailable, model_context, parse_output, validate_summary


def test_local_provider_rejects_remote_urls():
    with pytest.raises(ValueError):
        Settings(llama_server_url='https://external.example/v1')


@pytest.mark.parametrize('summary', ['A 40-year-old male with pulse 70.', 'Женщина, 40 лет, пульс 70.'])
def test_summary_rejects_unsupported_sex_observed_in_real_smoke(summary):
    with pytest.raises(ValueError, match='unsupported patient sex'):
        validate_summary({'summary': summary}, {'age': 40, 'sex': 'unknown'})


def test_summary_allows_documented_sex_and_neutral_language():
    result = {'summary': 'A female patient with a documented pulse of 70.'}
    assert validate_summary(result, {'sex': 'female'}) == result
    neutral = {'summary': 'Зафиксирован пульс 70 в минуту.'}
    assert validate_summary(neutral, {'sex': 'unknown'}) == neutral


def test_summary_cannot_label_a_documented_value_as_missing():
    with pytest.raises(ValueError, match='provided value as missing'):
        validate_summary({'summary': 'Pulse documented.', 'missing_fields': ['vital.pulse']}, {'facts': [{'key': 'vital.pulse', 'value': '70'}]})


def test_model_context_excludes_administrative_identifiers():
    context = model_context({'version': 4, 'owner_id': 'private-owner', 'tenant_id': 'private-tenant', 'facts': [{'id': 'fact-id', 'actor_id': 'private-actor', 'key': 'vital.pulse', 'value': '70'}], 'notes': [{'actor_id': 'private-actor', 'text': 'Documented context'}]})
    assert 'private-' not in json.dumps(context)
    assert context['facts'] == [{'key': 'vital.pulse', 'value': '70'}]
    assert context['notes'] == [{'text': 'Documented context'}]


def test_local_provider_validates_token_budget_and_structured_request(monkeypatch):
    real_client = httpx.Client
    observed = []
    expected = {'case_version': 7, 'summary': 'Synthetic observation', 'concerns': [], 'limitations': [], 'missing_fields': []}
    def handle(request):
        assert request.url.host == '127.0.0.1'
        data = json.loads(request.content)
        observed.append(request.url.path)
        if request.url.path == '/apply-template':
            assert 'Synthetic' in data['messages'][1]['content']
            return httpx.Response(200, json={'prompt': 'valid prompt'})
        if request.url.path == '/tokenize':
            return httpx.Response(200, json={'tokens': [1, 2, 3]})
        assert data['response_format']['schema']['properties']['concerns']['maxItems'] == 0
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(expected)}}]})
    monkeypatch.setattr(llama_adapter.httpx, 'Client', lambda **kw: real_client(transport=httpx.MockTransport(handle), **kw))
    snapshot = {'version': 7, 'summary': 'Synthetic', 'facts': []}
    output = llama_adapter.generate(snapshot, {}, 'current', None, 'Data only')
    assert parse_output(output, 7, set()) == expected
    assert observed == ['/apply-template', '/tokenize', '/v1/chat/completions']
    monkeypatch.setattr(settings, 'max_input_tokens', 2)
    with pytest.raises(ModelUnavailable, match='MODEL_INPUT_TOO_LONG'):
        llama_adapter.generate(snapshot, {}, 'current', None, 'Data only')
