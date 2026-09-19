import json

import pytest

from app import ai, llama_adapter, openai_adapter
from app.config import settings
from test_radiology_language import localized_output
from test_radiology_workflow import upload_study
from test_workflows import mutate


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_radiology_uses_remote_frames_and_truthful_provider(client, case, monkeypatch, language):
    study, body = upload_study(client, case)
    monkeypatch.setattr(settings, 'ai_provider', 'openai')
    monkeypatch.setattr(settings, 'ai_backend', 'openai')
    monkeypatch.setattr(settings, 'openai_model', 'gpt-5.6-luna')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    monkeypatch.setattr(llama_adapter, 'auth_headers', lambda: pytest.fail('Local provider must not be accessed'))
    captured = []
    def complete(messages, schema, **kwargs):
        captured.append(messages)
        assert kwargs['timeout_seconds'] > 0
        return json.dumps(localized_output(language), ensure_ascii=False)
    monkeypatch.setattr(openai_adapter, 'complete', complete)
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses',
                      {**body, 'language': language, 'radiologist_report': 'Исходный текст врача'})
    assert response.status_code == 202
    run = client.get('/api/v1/analyses/' + response.json()['run_id']).json()
    result = run['result']
    assert result['provider'] == 'openai' and result['provenance'] == 'openai_api'
    assert result['model_id'] == 'gpt-5.6-luna' and result['language'] == language
    assert result['radiologist_report'] == 'Исходный текст врача'
    assert result['image_review'] is not None and result['image_coverage']['reviewed_frames'] == 1
    assert result['image_coverage']['full_study_review'] is False
    images = [item for item in captured[0][1]['content'] if item['type'] == 'image_url']
    assert len(images) == 1 and images[0]['image_url']['url'].startswith('data:image/png;base64,')


def test_remote_failure_does_not_publish_fake_image_findings(client, case, monkeypatch):
    study, body = upload_study(client, case)
    monkeypatch.setattr(settings, 'ai_provider', 'openai')
    monkeypatch.setattr(ai, 'model_status', lambda: {'ready': True, 'vision_ready': True})
    def unavailable(*args, **kwargs):
        raise ai.ModelUnavailable('OPENAI_QUOTA_EXCEEDED')
    monkeypatch.setattr(openai_adapter, 'complete', unavailable)
    response = mutate(client, f'/imaging-studies/{study["id"]}/analyses', {**body, 'language': 'uz'})
    result = client.get('/api/v1/analyses/' + response.json()['run_id']).json()['result']
    assert result['image_review'] is None
    assert result['limitations'] == ['OPENAI_QUOTA_EXCEEDED']
    assert result['image_coverage']['reviewed_frames'] == 0
