import pytest

from app import ai, jobs, patient_workspace_ai
from app.db import Job, SessionLocal
from test_patient_workspace import ready_case, report
from test_workflows import mutate, new_case


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_analysis_language_reaches_worker_and_persisted_result(client, monkeypatch, language):
    case = new_case(client)
    received = []

    def model(snapshot, *args):
        received.append(snapshot['language'])
        return {'case_version': snapshot['version'], 'summary': 'Synthetic transport fixture',
                'concerns': [], 'limitations': [], 'missing_fields': []}

    monkeypatch.setattr(ai, 'review', model)
    response = mutate(client, f'/cases/{case["id"]}/analyses',
                      {'expected_version': case['version'], 'language': language})
    assert response.status_code == 202
    job = client.get('/api/v1/analyses/' + response.json()['run_id']).json()
    assert received == [language]
    assert job['language'] == job['result']['language'] == language
    assert job['result']['provenance'] == 'local_medgemma'
    with SessionLocal() as db:
        assert db.get(Job, job['id']).payload['snapshot']['language'] == language


@pytest.mark.parametrize('language', ['ru', 'uz', 'en'])
def test_patient_comparison_language_reaches_snapshot_and_review(client, monkeypatch, language):
    case = ready_case(client)
    received = []

    def model(snapshot, requested):
        received.append((snapshot['language'], requested))
        return report(snapshot['version'])

    monkeypatch.setattr(patient_workspace_ai, 'review', model)
    response = mutate(client, f'/cases/{case["id"]}/clinical-comparisons',
                      {'expected_version': case['version'], 'language': language})
    assert response.status_code == 202
    job = client.get('/api/v1/analyses/' + response.json()['run_id']).json()
    assert received == [(language, language)]
    assert job['status'] == 'succeeded'
    assert job['language'] == job['result']['language'] == language


def test_locale_retry_creates_new_snapshot_without_rewriting_the_original(client, monkeypatch):
    case = new_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    first = mutate(client, f'/cases/{case["id"]}/analyses',
                   {'expected_version': case['version'], 'language': 'ru'}).json()['run_id']
    with SessionLocal() as db:
        saved = db.get(Job, first)
        saved.status = 'succeeded'
        saved.result = {'language': 'ru', 'ai': {'summary': 'Исходный текст'}}
        snapshot = dict(saved.payload['snapshot'])
        db.commit()
    same = mutate(client, f'/analyses/{first}/retry',
                  {'expected_version': case['version'], 'language': 'ru'})
    assert same.status_code == 409
    retry = mutate(client, f'/analyses/{first}/retry',
                   {'expected_version': case['version'], 'language': 'uz'})
    assert retry.status_code == 202
    with SessionLocal() as db:
        original = db.get(Job, first)
        translated = db.get(Job, retry.json()['run_id'])
        assert original.payload['snapshot'] == snapshot
        assert original.result['ai']['summary'] == 'Исходный текст'
        assert translated.payload['language'] == 'uz'
        assert translated.payload['snapshot'] == {**snapshot, 'language': 'uz'}
        assert translated.payload['retry_of'] == original.id
        assert translated.case_version == original.case_version


def test_unsupported_language_rejected_and_missing_language_is_backward_compatible(client, monkeypatch):
    case = new_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    body = {'expected_version': case['version'], 'language': 'xx'}
    assert mutate(client, f'/cases/{case["id"]}/analyses', body).status_code == 422
    response = mutate(client, f'/cases/{case["id"]}/analyses', {'expected_version': case['version']})
    assert response.status_code == 202
    job = client.get('/api/v1/analyses/' + response.json()['run_id']).json()
    assert job['language'] == 'ru'


def test_language_change_does_not_bypass_case_version_check(client, monkeypatch):
    case = new_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    response = mutate(client, f'/cases/{case["id"]}/analyses', {'expected_version': case['version']})
    job_id = response.json()['run_id']
    with SessionLocal() as db:
        db.get(Job, job_id).status = 'succeeded'
        db.commit()
    retry = mutate(client, f'/analyses/{job_id}/retry', {'expected_version': case['version'] + 1, 'language': 'en'})
    assert retry.status_code == 409
    assert retry.json()['error']['code'] == 'CASE_VERSION_CONFLICT'


def test_retry_of_seed_comparison_becomes_real_inference_without_changing_example(client, monkeypatch):
    case = ready_case(client)
    monkeypatch.setattr(jobs, 'dispatch', lambda _: None)
    response = mutate(client, f'/cases/{case["id"]}/clinical-comparisons',
                      {'expected_version': case['version'], 'language': 'ru'})
    original_id = response.json()['run_id']
    with SessionLocal() as db:
        original = db.get(Job, original_id)
        original.status = 'succeeded'
        original.payload = {**original.payload, 'include_ai': False, 'seed_only': True}
        original.result = {'language': 'ru', 'provenance': 'synthetic_seed', 'demo_only': True}
        db.commit()
    response = mutate(client, f'/analyses/{original_id}/retry',
                      {'expected_version': case['version'], 'language': 'en'})
    assert response.status_code == 202
    with SessionLocal() as db:
        original = db.get(Job, original_id)
        retry = db.get(Job, response.json()['run_id'])
        assert original.payload['seed_only'] and not original.payload['include_ai']
        assert original.result['provenance'] == 'synthetic_seed'
        assert retry.payload['include_ai'] and 'seed_only' not in retry.payload
        assert retry.payload['language'] == retry.payload['snapshot']['language'] == 'en'
        assert retry.result == {}
